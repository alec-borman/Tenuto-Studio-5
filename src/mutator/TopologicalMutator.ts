import { TemporalEngine } from '../parser/TemporalEngine';
import { PitchEngine } from '../parser/PitchEngine';

export interface TokenModifierPatch {
  duration?: string;
  velocity?: number;
  pan?: number;
  chance?: number;
  articulation?: string | null;
}

export interface MixerASTMutation {
  mutationType:
    | 'VOLUME_UPDATE'
    | 'PAN_UPDATE'
    | 'ADD_FX'
    | 'REMOVE_FX'
    | 'SEND_UPDATE'
    | 'ADD_RETURN_TRACK'
    | 'GROUP_VOLUME_UPDATE'
    | 'META_SIDECHAIN_UPDATE'
    | 'META_SIDECHAIN_TAP_UPDATE'
    | 'META_UPDATE'
    | string;
  trackId?: string;
  groupId?: string;
  tapMode?: string;
  value?: number | string;
  fxType?: string;
  fxParams?: Record<string, any>;
  sendId?: string;
  sendLevel?: number;
  returnId?: string;
  returnName?: string;
  source?: string;
  target?: string;
  metaKey?: string;
  metaValue?: string | number | boolean;
  expectedSyntax?: string;
}

const SHARP_NOTES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT_NOTES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

export class TopologicalMutator {
  private temporalEngine: TemporalEngine;
  private pitchEngine: PitchEngine;

  constructor() {
    this.temporalEngine = new TemporalEngine();
    this.pitchEngine = new PitchEngine();
  }

  private gcd(a: number, b: number): number {
    return b === 0 ? a : this.gcd(b, a % b);
  }

  private approximateFraction(val: number, maxDenominator: number = 128) {
    let bestNum = 1;
    let bestDen = 1;
    let minError = Infinity;

    for (let den = 1; den <= maxDenominator; den++) {
      const num = Math.round(val * den);
      const error = Math.abs(val - num / den);
      if (error < minError) {
        minError = error;
        bestNum = num;
        bestDen = den;
      }
    }
    return { numerator: bestNum, denominator: bestDen };
  }

  /**
   * Splits a raw token (e.g. `c4:4.stacc.vol(90)` or `[c4 e4 g4]:2.fx(reverb, @{mix: 0.4})~`)
   * into its pitch/chord core, duration string, chained modifiers, and trailing tie flag.
   */
  public decomposeToken(rawToken: string): {
    pitchPart: string;
    durationPart: string | null;
    modifiers: string[];
    hasTie: boolean;
  } {
    const trimmed = rawToken.trim();
    const hasTie = trimmed.includes('~');
    const withoutTie = trimmed.replace(/~/g, '');

    const modifiers: string[] = [];
    let current = '';
    let parenDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    let inQuotes = false;
    let core: string | null = null;

    for (let i = 0; i < withoutTie.length; i++) {
      const ch = withoutTie[i];
      if (ch === '"' && withoutTie[i - 1] !== '\\') inQuotes = !inQuotes;
      if (!inQuotes) {
        if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
        else if (ch === '[') bracketDepth++;
        else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
      }

      if (
        ch === '.' &&
        !inQuotes &&
        parenDepth === 0 &&
        braceDepth === 0 &&
        bracketDepth === 0
      ) {
        const nextChar = withoutTie[i + 1] || '';
        const isDottedDuration =
          core === null &&
          current.includes(':') &&
          (nextChar === '' || nextChar === '.' || nextChar === '*');

        if (isDottedDuration) {
          current += ch;
          continue;
        }

        if (core === null) {
          core = current;
          current = '';
        } else if (current.length > 0) {
          modifiers.push(current);
          current = '';
        }
        continue;
      }

      current += ch;
    }

    if (core === null) {
      core = current;
    } else if (current.length > 0) {
      modifiers.push(current);
    }

    const colonIdx = core.indexOf(':');
    if (colonIdx === -1) {
      return { pitchPart: core, durationPart: null, modifiers, hasTie };
    }

    return {
      pitchPart: core.slice(0, colonIdx),
      durationPart: core.slice(colonIdx + 1),
      modifiers,
      hasTie,
    };
  }

  public recomposeToken(parts: {
    pitchPart: string;
    durationPart: string | null;
    modifiers: string[];
    hasTie: boolean;
  }): string {
    const durSuffix = parts.durationPart ? `:${parts.durationPart}` : '';
    const isDottedDur = parts.durationPart?.endsWith('.') ?? false;
    const modSuffix =
      parts.modifiers.length > 0
        ? (isDottedDur ? '..' : '.') + parts.modifiers.join('.')
        : '';
    const tieSuffix = parts.hasTie ? '~' : '';
    return `${parts.pitchPart}${durSuffix}${modSuffix}${tieSuffix}`;
  }

  public resizeDuration(rawToken: string, deltaWidth: number, zScale: number): string {
    const { pitchPart, durationPart, modifiers, hasTie } = this.decomposeToken(rawToken);

    if (!durationPart) {
      throw new Error(`Invalid token format, missing duration: ${rawToken}`);
    }

    const { numerator: N1, denominator: D1 } = this.temporalEngine.parseDuration(':' + durationPart);

    const dragRatio = deltaWidth / zScale;
    const { numerator: N2, denominator: D2 } = this.approximateFraction(dragRatio, 128);

    let newNum = N1 * D2 + N2 * D1;
    let newDen = D1 * D2;

    if (newNum <= 0) {
      newNum = 1;
      newDen = 64;
    }

    const divisor = this.gcd(Math.abs(newNum), Math.abs(newDen));
    newNum /= divisor;
    newDen /= divisor;

    const newDurationPart = newNum === 1 ? `${newDen}` : `${newNum}/${newDen}`;

    return this.recomposeToken({
      pitchPart,
      durationPart: newDurationPart,
      modifiers,
      hasTie,
    });
  }

  public midiToPitchLiteral(midi: number, preferFlats: boolean = false): string {
    const clamped = Math.max(0, Math.min(127, Math.round(midi)));
    const octave = Math.floor(clamped / 12) - 1;
    const noteIdx = clamped % 12;
    const step = preferFlats ? FLAT_NOTES[noteIdx] : SHARP_NOTES[noteIdx];
    return `${step}${octave}`;
  }

  /**
   * Transposes a single note token (`c4:4.stacc`) or chord token (`[c4 e4 g4]:2.mf`)
   * by `semitoneDelta` semitones while preserving duration, modifiers, and ties.
   */
  public transposePitch(rawToken: string, semitoneDelta: number, preferFlats?: boolean): string {
    if (semitoneDelta === 0) return rawToken;
    const { pitchPart, durationPart, modifiers, hasTie } = this.decomposeToken(rawToken);

    const useFlats =
      preferFlats !== undefined
        ? preferFlats
        : /[a-g]b\d*/i.test(pitchPart) && !pitchPart.includes('#');

    if (pitchPart.startsWith('[') && pitchPart.endsWith(']')) {
      const innerNotes = pitchPart
        .slice(1, -1)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      this.pitchEngine.reset(4);
      const transposedNotes = innerNotes.map((n) => {
        const parsed = this.pitchEngine.parsePitch(n);
        if (parsed.isRest || parsed.isSpacer || parsed.gridKey) return n;
        return this.midiToPitchLiteral(parsed.midi + semitoneDelta, useFlats);
      });
      return this.recomposeToken({
        pitchPart: `[${transposedNotes.join(' ')}]`,
        durationPart,
        modifiers,
        hasTie,
      });
    }

    this.pitchEngine.reset(4);
    const parsed = this.pitchEngine.parsePitch(pitchPart);
    if (parsed.isRest || parsed.isSpacer || parsed.gridKey) {
      return rawToken;
    }

    const nextPitch = this.midiToPitchLiteral(parsed.midi + semitoneDelta, useFlats);
    return this.recomposeToken({
      pitchPart: nextPitch,
      durationPart,
      modifiers,
      hasTie,
    });
  }

  /**
   * Surgically updates duration, velocity, pan, probability, or articulation on a token
   * without clobbering unrelated chained modifiers.
   */
  public mutateTokenModifiers(rawToken: string, patch: TokenModifierPatch): string {
    const parts = this.decomposeToken(rawToken);

    if (patch.duration !== undefined) {
      const cleanDur = patch.duration.replace(/^:/, '').trim();
      if (cleanDur.startsWith('1/')) {
        parts.durationPart = cleanDur.slice(2);
      } else {
        parts.durationPart = cleanDur;
      }
    }

    let mods = [...parts.modifiers];

    if (patch.pan !== undefined) {
      const clampedPan = Math.max(-1, Math.min(1, Number(patch.pan.toFixed(2))));
      mods = mods.filter((m) => !m.startsWith('pan('));
      mods.push(`pan(${clampedPan})`);
    }

    if (patch.velocity !== undefined) {
      const clampedVel = Math.max(0, Math.min(127, Math.round(patch.velocity)));
      mods = mods.filter(
        (m) =>
          !['pp', 'p', 'mp', 'mf', 'f', 'ff', 'sfz'].includes(m) &&
          !m.startsWith('vol(')
      );
      mods.push(`vol(${clampedVel})`);
    }

    if (patch.chance !== undefined) {
      const clampedChance = Math.max(0, Math.min(100, Math.round(patch.chance)));
      mods = mods.filter((m) => !m.startsWith('chance(') && !m.startsWith('prob('));
      mods.push(`chance(${clampedChance}%)`);
    }

    if (patch.articulation !== undefined) {
      mods = mods.filter(
        (m) =>
          !['stacc', 'staccato', 'marc', 'ten', 'tenuto', 'accent', 'legato', 'slur', 'pizz'].includes(m)
      );
      if (patch.articulation) {
        mods.unshift(patch.articulation);
      }
    }

    parts.modifiers = mods;
    return this.recomposeToken(parts);
  }

  /**
   * Replaces a specific event's token in `sourceCode` using its exact character span
   * (`sourceStartOffset`..`sourceEndOffset`) or `(line, col)` coordinates, falling back
   * to substring replacement only when span metadata is absent.
   */
  public replaceEventInSource(
    sourceCode: string,
    event: {
      rawToken?: string;
      sourceStartOffset?: number;
      sourceEndOffset?: number;
      line?: number;
      col?: number;
    },
    mutatedToken: string
  ): string {
    if (!event || !event.rawToken) return sourceCode;

    // 1. Exact character offset replacement
    if (
      typeof event.sourceStartOffset === 'number' &&
      typeof event.sourceEndOffset === 'number' &&
      event.sourceStartOffset >= 0 &&
      event.sourceEndOffset <= sourceCode.length
    ) {
      const sliceAtSpan = sourceCode.slice(event.sourceStartOffset, event.sourceEndOffset);
      if (sliceAtSpan === event.rawToken) {
        return (
          sourceCode.slice(0, event.sourceStartOffset) +
          mutatedToken +
          sourceCode.slice(event.sourceEndOffset)
        );
      }
    }

    // 2. 1-based Line & Column coordinate replacement
    if (typeof event.line === 'number' && event.line >= 1) {
      const lines = sourceCode.split('\n');
      const lineIdx = event.line - 1;
      if (lineIdx < lines.length) {
        const lineText = lines[lineIdx];
        const colIdx = typeof event.col === 'number' && event.col >= 1 ? event.col - 1 : 0;
        if (lineText.slice(colIdx, colIdx + event.rawToken.length) === event.rawToken) {
          lines[lineIdx] =
            lineText.slice(0, colIdx) +
            mutatedToken +
            lineText.slice(colIdx + event.rawToken.length);
          return lines.join('\n');
        }
        const tokenIdxInLine = lineText.indexOf(event.rawToken);
        if (tokenIdxInLine !== -1) {
          lines[lineIdx] =
            lineText.slice(0, tokenIdxInLine) +
            mutatedToken +
            lineText.slice(tokenIdxInLine + event.rawToken.length);
          return lines.join('\n');
        }
      }
    }

    // 3. Fallback first-match replacement
    return sourceCode.replace(event.rawToken, mutatedToken);
  }

  /**
   * Surgically mutates `meta`, `var <track>_vol`, or `def <track>` lines in `sourceCode`
   * when the Mixer, Device Rack, or Transport dispatches an AST update, preserving all
   * user comments (`%%`) and document formatting.
   */
  public applyMixerMutationToSource(sourceCode: string, mutation: MixerASTMutation): string {
    if (!sourceCode.trim()) return sourceCode;

    // 1. Meta block updates (sidechain, tempo, key, scale, crossfader, quantize_launch)
    if (mutation.mutationType === 'META_SIDECHAIN_TAP_UPDATE') {
      return this.applyMixerMutationToSource(sourceCode, {
        mutationType: 'META_UPDATE',
        metaKey: 'sidechain_tap',
        metaValue: mutation.tapMode || 'post_fx',
      });
    }

    if (
      mutation.mutationType === 'GROUP_VOLUME_UPDATE' &&
      mutation.groupId &&
      mutation.value !== undefined
    ) {
      const gId = mutation.groupId;
      const vol = Math.max(0, Math.min(127, Math.round(Number(mutation.value))));
      const varRegex = new RegExp(`(\\bvar\\s+${gId}_vol\\s*=\\s*)(\\d+)`);
      if (varRegex.test(sourceCode)) {
        return sourceCode.replace(varRegex, `$1${vol}`);
      }
      const groupLineRegex = new RegExp(`(^\\s*group\\s+${gId}\\b[^\\n]*$)`, 'm');
      if (groupLineRegex.test(sourceCode)) {
        return sourceCode.replace(groupLineRegex, `var ${gId}_vol = ${vol}\n$1`);
      }
      return sourceCode;
    }

    if (
      mutation.mutationType === 'META_SIDECHAIN_UPDATE' ||
      mutation.mutationType === 'META_UPDATE'
    ) {
      const key =
        mutation.mutationType === 'META_SIDECHAIN_UPDATE'
          ? 'sidechain'
          : mutation.metaKey || 'tempo';
      const rawVal =
        mutation.mutationType === 'META_SIDECHAIN_UPDATE'
          ? mutation.source ?? ''
          : mutation.metaValue ?? '';
      const formattedVal =
        typeof rawVal === 'string' ? `"${rawVal}"` : String(rawVal);

      const metaRegex = /(\bmeta\s*@\{)([^}]*)(\})/i;
      const match = sourceCode.match(metaRegex);
      if (match) {
        const body = match[2];
        const keyRegex = new RegExp(`(\\b${key}\\s*:\\s*)("[^"]*"|[^,\\s}]+)`, 'i');
        let nextBody: string;
        if (keyRegex.test(body)) {
          nextBody = body.replace(keyRegex, `$1${formattedVal}`);
        } else {
          const trimmedBody = body.trim();
          nextBody = trimmedBody
            ? ` ${trimmedBody}, ${key}: ${formattedVal} `
            : ` ${key}: ${formattedVal} `;
        }
        return sourceCode.replace(metaRegex, `$1${nextBody}$3`);
      }
      return sourceCode;
    }

    if (mutation.mutationType === 'ADD_RETURN_TRACK') {
      const returnId = mutation.returnId || 'rev_bus';
      const returnName = mutation.returnName || 'Hall Return';
      const fxType = mutation.fxType || 'hybrid_reverb';
      const returnLine = `  return ${returnId} "${returnName}" .fx(${fxType}, @{mix: 1.0})`;

      const firstDefOrMeasure = sourceCode.search(/^\s*(?:def|measure|scene|clip)\b/m);
      if (firstDefOrMeasure !== -1) {
        return (
          sourceCode.slice(0, firstDefOrMeasure) +
          `${returnLine}\n` +
          sourceCode.slice(firstDefOrMeasure)
        );
      }
      return `${sourceCode.trim()}\n${returnLine}\n`;
    }

    const trackId = mutation.trackId;
    if (!trackId) return sourceCode;

    // 2. Track Volume update (`var <trackId>_vol = <val>` or `vol=<val>` on `def <trackId>`)
    if (mutation.mutationType === 'VOLUME_UPDATE' && mutation.value !== undefined) {
      const vol = Math.max(0, Math.min(127, Math.round(Number(mutation.value))));
      const varRegex = new RegExp(`(\\bvar\\s+${trackId}_vol\\s*=\\s*)(\\d+)`);
      if (varRegex.test(sourceCode)) {
        return sourceCode.replace(varRegex, `$1${vol}`);
      }

      const defVolRegex = new RegExp(
        `(^\\s*def\\s+${trackId}\\b[^\\n]*?\\bvol(?:ume)?\\s*=\\s*)(\\d+)`,
        'm'
      );
      if (defVolRegex.test(sourceCode)) {
        return sourceCode.replace(defVolRegex, `$1${vol}`);
      }

      const defLineRegex = new RegExp(`(^\\s*def\\s+${trackId}\\b[^\\n]*$)`, 'm');
      if (defLineRegex.test(sourceCode)) {
        return sourceCode.replace(defLineRegex, `var ${trackId}_vol = ${vol}\n$1`);
      }
      return sourceCode;
    }

    // 3. Track Pan update (`pan=<val>` on `def <trackId>`)
    if (mutation.mutationType === 'PAN_UPDATE' && mutation.value !== undefined) {
      const pan = Math.max(-1, Math.min(1, Number(Number(mutation.value).toFixed(2))));
      const defPanRegex = new RegExp(
        `(^\\s*def\\s+${trackId}\\b[^\\n]*?\\bpan\\s*=\\s*)(-?\\d+(?:\\.\\d+)?)`,
        'm'
      );
      if (defPanRegex.test(sourceCode)) {
        return sourceCode.replace(defPanRegex, `$1${pan}`);
      }

      const defLineRegex = new RegExp(`(^\\s*def\\s+${trackId}\\b[^\\n]*?)(?=\\s*(?:%%|\\/\\/|$))`, 'm');
      if (defLineRegex.test(sourceCode)) {
        return sourceCode.replace(defLineRegex, `$1 pan=${pan}`);
      }
      return sourceCode;
    }

    // 4. Add FX to Track (`def <trackId> ... .fx(type, @{mix: 0.5})`)
    if (mutation.mutationType === 'ADD_FX' && mutation.fxType) {
      const params = mutation.fxParams || { mix: 0.5 };
      const paramPairs = Object.entries(params)
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
        .join(', ');
      const fxString =
        mutation.expectedSyntax || `.fx(${mutation.fxType}, @{${paramPairs}})`;

      const defLineRegex = new RegExp(
        `(^\\s*(?:def|def_return|return|group)\\s+${trackId}\\b[^\\n]*?)(?=\\s*(?:%%|\\/\\/|$))`,
        'm'
      );
      if (defLineRegex.test(sourceCode)) {
        return sourceCode.replace(defLineRegex, `$1 ${fxString}`);
      }
      return sourceCode;
    }

    // 5. Update Send level on `def <trackId>` (`sends=@{rev_bus: 0.5}`)
    if (
      mutation.mutationType === 'SEND_UPDATE' &&
      mutation.sendId &&
      mutation.sendLevel !== undefined
    ) {
      const level = Math.max(0, Math.min(1, Number(mutation.sendLevel.toFixed(2))));
      const defSendsRegex = new RegExp(
        `(^\\s*def\\s+${trackId}\\b[^\\n]*?\\bsends\\s*=\\s*@\\{)([^}]*)(\\})`,
        'm'
      );
      const sendMatch = sourceCode.match(defSendsRegex);
      if (sendMatch) {
        const body = sendMatch[2];
        const keyRegex = new RegExp(`(\\b${mutation.sendId}\\s*:\\s*)(-?\\d+(?:\\.\\d+)?)`);
        const nextBody = keyRegex.test(body)
          ? body.replace(keyRegex, `$1${level}`)
          : `${body.trim() ? body.trim() + ', ' : ''}${mutation.sendId}: ${level}`;
        return sourceCode.replace(defSendsRegex, `$1${nextBody}$3`);
      }

      const defLineRegex = new RegExp(`(^\\s*def\\s+${trackId}\\b[^\\n]*?)(?=\\s*(?:%%|\\/\\/|$))`, 'm');
      if (defLineRegex.test(sourceCode)) {
        return sourceCode.replace(defLineRegex, `$1 sends=@{${mutation.sendId}: ${level}}`);
      }
    }

    return sourceCode;
  }

  public serializeAutomationModifier(
    param: string,
    values: number[],
    curve: string = 'linear'
  ): string {
    const cleanParam = param.trim().toLowerCase();
    const formattedValues = values
      .map((v) => Number(Number(v).toFixed(2)))
      .join(', ');
    const cleanCurve = (curve || 'linear').trim().toLowerCase();
    return `.automate("${cleanParam}", [${formattedValues}], "${cleanCurve}")`;
  }

  /**
   * Surgically updates an existing `.automate("<param>", ...)` modifier on `trackId` in `measureNumber`,
   * or injects a spacer automation token `s:1.automate(...)` into `measureNumber` while preserving
   * all comments and formatting.
   */
  public upsertTrackAutomationInSource(
    sourceCode: string,
    trackId: string,
    measureNumber: number,
    param: string,
    values: number[],
    curve: string = 'linear'
  ): string {
    if (!sourceCode.trim() || !trackId || values.length === 0) return sourceCode;
    const modStr = this.serializeAutomationModifier(param, values, curve);
    const escapedParam = param.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 1. If the source already contains `.automate("<param>", [...], "...")` on this track, replace it in-place
    const existingAutoRegex = new RegExp(
      `(\\.automate\\(\\s*"?${escapedParam}"?\\s*,\\s*\\[[^\\]]*\\](?:\\s*,\\s*"?[a-zA-Z0-9_-]+"?)?\\s*\\))`,
      'i'
    );
    if (existingAutoRegex.test(sourceCode)) {
      return sourceCode.replace(existingAutoRegex, modStr);
    }

    // 2. If inside a full document with `measure <measureNumber> { ... }`, inject or append to `trackId:`
    const measureRegex = new RegExp(
      `(\\bmeasure\\s+${measureNumber}\\b[^{]*\\{)([\\s\\S]*?)(\\})`,
      'i'
    );
    const mMatch = sourceCode.match(measureRegex);
    if (mMatch) {
      const mHeader = mMatch[1];
      const mBody = mMatch[2];
      const mClose = mMatch[3];

      const trackLineRegex = new RegExp(
        `(^\\s*${trackId}\\s*:\\s*)(.+?)(\\s*\\|?\\s*)$`,
        'm'
      );
      const tMatch = mBody.match(trackLineRegex);
      if (tMatch) {
        const prefix = tMatch[1];
        const rhs = tMatch[2].trim();
        let nextRhs: string;
        if (rhs.startsWith('<[') && rhs.endsWith(']>')) {
          const inner = rhs.slice(2, -2).trim();
          nextRhs = `<[ ${inner} | s:1${modStr} ]>`;
        } else {
          const cleanRhs = rhs.replace(/\|$/, '').trim();
          nextRhs = `<[ v1: ${cleanRhs} | v2: s:1${modStr} ]>`;
        }
        const nextBody = mBody.replace(trackLineRegex, `${prefix}${nextRhs}`);
        return sourceCode.replace(measureRegex, `${mHeader}${nextBody}${mClose}`);
      } else {
        const nextBody = `${mBody.trimEnd()}\n    ${trackId}: s:1${modStr} |\n  `;
        return sourceCode.replace(measureRegex, `${mHeader}${nextBody}${mClose}`);
      }
    }

    // 3. Sketch mode fallback: append spacer automation token
    return `${sourceCode.trim()} s:1${modStr}`;
  }
}

