import { ASTSerializer, AtomicEvent } from './ASTSerializer';
import { TemporalResult } from './TemporalEngine';

export interface TrackDefinition {
  id: string;
  name: string;
  style: 'standard' | 'synth' | 'grid' | 'concrete' | 'tab' | string;
  patch: string;
  volume: number;
  pan: number;
  fx: string[];
  env?: Record<string, string>;
  src?: string;
  map?: Record<string, any>;
}

export interface ScoreMeta {
  title: string;
  tempo: number;
  time: string;
  key?: string;
  sidechain: string | null;
  autoPadVoices: boolean;
}

export interface CompilerDiagnostic {
  code: string;
  message: string;
  line: number;
  col: number;
  severity: 'error' | 'warning';
}

export interface CompiledScore {
  version: string;
  meta: ScoreMeta;
  defs: TrackDefinition[];
  events: AtomicEvent[];
  diagnostics: CompilerDiagnostic[];
}

export class DocumentParser {
  private gcd(a: number, b: number): number {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y !== 0) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  private addFractions(
    a: { numerator: number; denominator: number },
    b: { numerator: number; denominator: number }
  ): { numerator: number; denominator: number } {
    const num = a.numerator * b.denominator + b.numerator * a.denominator;
    const den = a.denominator * b.denominator;
    const div = this.gcd(num, den);
    return { numerator: num / div, denominator: den / div };
  }

  /**
   * Strips Markdown code fences (e.g. ```tenuto ... ```) and leading/trailing prose
   * when a user copies code directly from Gemini, ChatGPT, or Claude.
   */
  public sanitizeLLMInput(raw: string): string {
    const trimmed = raw.trim();
    const fenceMatch = trimmed.match(/```(?:tenuto|ten|music|plaintext|[a-zA-Z0-9_-]*)?\s*\n([\s\S]*?)```/i);
    if (fenceMatch && fenceMatch[1]) {
      return fenceMatch[1].trim();
    }
    return trimmed
      .replace(/^```[a-zA-Z0-9_-]*\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  public isFullDocument(raw: string): boolean {
    const cleaned = this.sanitizeLLMInput(raw);
    return (
      /\btenuto\b/i.test(cleaned) ||
      /\bmeasure\s+\d+/i.test(cleaned) ||
      /\bdef\s+[a-zA-Z0-9_]+/i.test(cleaned) ||
      /\bmeta\s*@\{/i.test(cleaned)
    );
  }

  private stripComments(source: string): string {
    return source
      .split('\n')
      .map((line) => {
        const pctIdx = line.indexOf('%%');
        const slashIdx = line.indexOf('//');
        let cutIdx = -1;
        if (pctIdx !== -1 && slashIdx !== -1) cutIdx = Math.min(pctIdx, slashIdx);
        else if (pctIdx !== -1) cutIdx = pctIdx;
        else if (slashIdx !== -1) cutIdx = slashIdx;
        return cutIdx !== -1 ? line.slice(0, cutIdx) : line;
      })
      .join('\n');
  }

  private parseDictionary(dictBody: string): Record<string, any> {
    const result: Record<string, any> = {};
    const pairs: string[] = [];
    let current = '';
    let depth = 0;
    let inQuotes = false;

    for (let i = 0; i < dictBody.length; i++) {
      const ch = dictBody[i];
      if (ch === '"' && dictBody[i - 1] !== '\\') inQuotes = !inQuotes;
      if (!inQuotes) {
        if (ch === '[' || ch === '{' || ch === '(') depth++;
        else if (ch === ']' || ch === '}' || ch === ')') depth = Math.max(0, depth - 1);
      }
      if (ch === ',' && !inQuotes && depth === 0) {
        if (current.trim()) pairs.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    if (current.trim()) pairs.push(current.trim());

    for (const pair of pairs) {
      const colonIdx = pair.indexOf(':');
      if (colonIdx === -1) continue;
      const key = pair.slice(0, colonIdx).trim();
      const valRaw = pair.slice(colonIdx + 1).trim();
      if (valRaw.startsWith('"') && valRaw.endsWith('"')) {
        result[key] = valRaw.slice(1, -1);
      } else if (valRaw === 'true') {
        result[key] = true;
      } else if (valRaw === 'false') {
        result[key] = false;
      } else if (!isNaN(Number(valRaw))) {
        result[key] = Number(valRaw);
      } else {
        result[key] = valRaw;
      }
    }
    return result;
  }

  private tokenizeVoiceStream(stream: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let bracketDepth = 0;
    let parenDepth = 0;
    let braceDepth = 0;
    let inQuotes = false;

    for (let i = 0; i < stream.length; i++) {
      const ch = stream[i];
      if (ch === '"' && stream[i - 1] !== '\\') inQuotes = !inQuotes;

      if (!inQuotes) {
        if (ch === '[') bracketDepth++;
        else if (ch === ']') bracketDepth = Math.max(0, bracketDepth - 1);
        else if (ch === '(') parenDepth++;
        else if (ch === ')') parenDepth = Math.max(0, parenDepth - 1);
        else if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth = Math.max(0, braceDepth - 1);
      }

      const isSpace = /\s/.test(ch);
      if (isSpace && !inQuotes && bracketDepth === 0 && parenDepth === 0 && braceDepth === 0) {
        if (current.trim()) {
          tokens.push(current.trim());
          current = '';
        }
      } else {
        current += ch;
      }
    }

    if (current.trim()) {
      tokens.push(current.trim());
    }

    // Merge standalone multiplier suffixes like "* 4" or "*4" onto the preceding token
    const merged: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok === '*' && i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1]) && merged.length > 0) {
        merged[merged.length - 1] = `${merged[merged.length - 1]}*${tokens[i + 1]}`;
        i++;
      } else if (/^\*\d+$/.test(tok) && merged.length > 0) {
        merged[merged.length - 1] = `${merged[merged.length - 1]}${tok}`;
      } else {
        merged.push(tok);
      }
    }

    const finalTokens: string[] = [];
    for (const tok of merged) {
      const fusedMatch = tok.match(
        /^([a-gA-G][#b]*[0-9]*:[0-9.]+\.(?:pp|p|mp|mf|f|ff|sfz|stacc|ten|marc|cresc|crescendo|dim|diminuendo))([a-gA-G][#b]*[0-9]*:[0-9.].*)$/
      );
      if (fusedMatch) {
        finalTokens.push(fusedMatch[1], fusedMatch[2]);
      } else {
        finalTokens.push(tok);
      }
    }

    return finalTokens;
  }

  private expandEuclideanPattern(hits: number, steps: number): boolean[] {
    if (steps <= 0) return [];
    if (hits <= 0) return new Array(steps).fill(false);
    if (hits >= steps) return new Array(steps).fill(true);

    const pattern: boolean[] = [];
    for (let i = 0; i < steps; i++) {
      pattern.push((i * hits) % steps < hits);
    }
    return pattern;
  }

  private parseVoiceTokensToEvents(
    rawTokens: string[],
    serializer: ASTSerializer,
    trackDef: TrackDefinition,
    measureNumber: number,
    voiceId: string,
    measureStartTime: { numerator: number; denominator: number },
    macros: Map<string, string[]>,
    skipInvalidTokens: boolean = false
  ): { events: AtomicEvent[]; totalDuration: { numerator: number; denominator: number } } {
    const events: AtomicEvent[] = [];
    let cursorTime = { ...measureStartTime };
    let voiceDuration = { numerator: 0, denominator: 1 };

    const expandedTokens: string[] = [];
    for (const tok of rawTokens) {
      if (tok === '|') continue;
      if (tok.startsWith('$')) {
        const macroName = tok.slice(1).replace(/\(.*\)$/, '');
        const macroBody = macros.get(macroName) || macros.get('$' + macroName);
        if (macroBody) {
          expandedTokens.push(...macroBody);
          continue;
        }
      }
      expandedTokens.push(tok);
    }

    for (const token of expandedTokens) {
      try {
        // 1. Euclidean syntax: (c2):3/8 or (k):3/8:16 or k(3,8):16
        const euclidParensMatch = token.match(/^\(([^()\s]+)\):(\d+)\/(\d+)(?::(\d+\.?))?((?:\.[a-zA-Z_].*)?)$/);
        const euclidCallMatch = token.match(/^([a-zA-Z0-9_#b]+)\((\d+)\s*,\s*(\d+)\)(?::(\d+\.?))?((?:\.[a-zA-Z_].*)?)$/);

        if (euclidParensMatch || euclidCallMatch) {
          const m = (euclidParensMatch || euclidCallMatch)!;
          const pitchToken = m[1];
          const hits = parseInt(m[2], 10);
          const steps = parseInt(m[3], 10);
          const stepDenom = m[4] ? m[4] : String(steps);
          const modSuffix = m[5] || '';

          const pattern = this.expandEuclideanPattern(hits, steps);
          for (const isHit of pattern) {
            const stepToken = isHit
              ? `${pitchToken}:${stepDenom}${modSuffix}`
              : `r:${stepDenom}`;
            const ev = serializer.parseToken(stepToken, trackDef.style);
            ev.rawToken = stepToken;
            ev.startTime = { ...cursorTime };
            ev.trackId = trackDef.id;
            ev.voiceId = voiceId;
            ev.measureNumber = measureNumber;
            ev.style = trackDef.style;
            ev.patch = trackDef.patch;
            ev.env = trackDef.env;

            if (!ev.pitch.isRest && !ev.pitch.isSpacer) {
              events.push(ev);
            }
            if (!ev.duration.isGrace) {
              cursorTime = this.addFractions(cursorTime, ev.duration);
              voiceDuration = this.addFractions(voiceDuration, ev.duration);
            }
          }
          continue;
        }

        // 2. Tuplet syntax: (c4:8 d e):3/2
        const tupletMatch = token.match(/^\((.+)\):(\d+)\/(\d+)((?:\.[a-zA-Z_].*)?)$/);
        if (tupletMatch) {
          const innerStream = tupletMatch[1];
          const num = parseInt(tupletMatch[2], 10);
          const den = parseInt(tupletMatch[3], 10);
          const innerTokens = this.tokenizeVoiceStream(innerStream);

          for (const innerTok of innerTokens) {
            const ev = serializer.parseToken(innerTok, trackDef.style);
            const scaledNum = ev.duration.numerator * den;
            const scaledDen = ev.duration.denominator * num;
            const div = this.gcd(scaledNum, scaledDen);
            ev.duration = {
              numerator: scaledNum / div,
              denominator: scaledDen / div,
              isGrace: ev.duration.isGrace,
            };
            ev.rawToken = innerTok;
            ev.startTime = { ...cursorTime };
            ev.trackId = trackDef.id;
            ev.voiceId = voiceId;
            ev.measureNumber = measureNumber;
            ev.style = trackDef.style;
            ev.patch = trackDef.patch;
            ev.env = trackDef.env;

            if (!ev.pitch.isRest && !ev.pitch.isSpacer) {
              events.push(ev);
            }
            if (!ev.duration.isGrace) {
              cursorTime = this.addFractions(cursorTime, ev.duration);
              voiceDuration = this.addFractions(voiceDuration, ev.duration);
            }
          }
          continue;
        }

        // 3. Chord syntax: [c4 e4 g4]:4.stacc or [c4 e4 g4]
        const chordMatch = token.match(/^\[([^\]]+)\](.*)$/);
        if (chordMatch) {
          const chordPitches = chordMatch[1].trim().split(/\s+/).filter(Boolean);
          const suffix = chordMatch[2] || ''; // e.g. ":4.stacc"

          let chordDuration: TemporalResult | null = null;
          for (let i = 0; i < chordPitches.length; i++) {
            const noteToken = i === 0 ? `${chordPitches[i]}${suffix}` : chordPitches[i];
            const ev = serializer.parseToken(noteToken, trackDef.style);
            if (i === 0) {
              chordDuration = ev.duration;
            } else if (chordDuration) {
              ev.duration = { ...chordDuration };
            }
            ev.rawToken = token;
            ev.startTime = { ...cursorTime };
            ev.trackId = trackDef.id;
            ev.voiceId = voiceId;
            ev.measureNumber = measureNumber;
            ev.style = trackDef.style;
            ev.patch = trackDef.patch;
            ev.env = trackDef.env;

            if (!ev.pitch.isRest && !ev.pitch.isSpacer) {
              events.push(ev);
            }
          }

          if (chordDuration && !chordDuration.isGrace) {
            cursorTime = this.addFractions(cursorTime, chordDuration);
            voiceDuration = this.addFractions(voiceDuration, chordDuration);
          }
          continue;
        }

        // 4. Standard atomic note / rest / spacer token
        const ev = serializer.parseToken(token, trackDef.style);
        ev.rawToken = token;
        ev.startTime = { ...cursorTime };
        ev.trackId = trackDef.id;
        ev.voiceId = voiceId;
        ev.measureNumber = measureNumber;
        ev.style = trackDef.style;
        ev.patch = trackDef.patch;
        ev.env = trackDef.env;

        if (!ev.pitch.isRest && !ev.pitch.isSpacer) {
          events.push(ev);
        }

        if (!ev.duration.isGrace) {
          cursorTime = this.addFractions(cursorTime, ev.duration);
          voiceDuration = this.addFractions(voiceDuration, ev.duration);
        }
      } catch (err) {
        if (!skipInvalidTokens) {
          throw err;
        }
      }
    }

    this.applyPhraseSwellInterpolation(events);
    return { events, totalDuration: voiceDuration };
  }

  /**
   * When multiple consecutive notes in a voice carry .cresc or .dim (without explicit (start,end) overrides),
   * smoothly interpolates their startVelocity and endVelocity across the entire phrase run.
   */
  private applyPhraseSwellInterpolation(events: AtomicEvent[]): void {
    let i = 0;
    while (i < events.length) {
      const swellType = events[i].physics?.swell;
      if (!swellType) {
        i++;
        continue;
      }

      const startTime0 = events[i].startTime;
      let j = i;
      const timeSteps: Array<{ startNum: number; startDen: number; items: AtomicEvent[] }> = [];

      while (j < events.length && events[j].physics?.swell === swellType) {
        const st = events[j].startTime || { numerator: 0, denominator: 1 };
        const lastStep = timeSteps[timeSteps.length - 1];
        if (lastStep && lastStep.startNum === st.numerator && lastStep.startDen === st.denominator) {
          lastStep.items.push(events[j]);
        } else {
          timeSteps.push({ startNum: st.numerator, startDen: st.denominator, items: [events[j]] });
        }
        j++;
      }

      void startTime0;
      if (timeSteps.length > 1) {
        const firstPhysics = timeSteps[0].items[0].physics!;
        const overallStart =
          swellType === 'crescendo'
            ? Math.min(85, firstPhysics.startVelocity ?? 40)
            : Math.max(65, firstPhysics.startVelocity ?? 112);
        const overallEnd =
          swellType === 'crescendo'
            ? Math.max(overallStart + 25, firstPhysics.endVelocity ?? 116)
            : Math.min(overallStart - 25, firstPhysics.endVelocity ?? 32);

        const totalSteps = timeSteps.length;
        for (let s = 0; s < totalSteps; s++) {
          const segStart = Math.round(overallStart + ((overallEnd - overallStart) * s) / totalSteps);
          const segEnd = Math.round(overallStart + ((overallEnd - overallStart) * (s + 1)) / totalSteps);
          const segMid = Math.round((segStart + segEnd) / 2);
          for (const ev of timeSteps[s].items) {
            if (ev.physics) {
              ev.physics.startVelocity = segStart;
              ev.physics.endVelocity = segEnd;
              ev.physics.velocity = segMid;
            }
          }
        }
      }

      i = j;
    }
  }

  public compile(rawSource: string): CompiledScore {
    const sanitized = this.sanitizeLLMInput(rawSource);
    const cleanSource = this.stripComments(sanitized);

    const meta: ScoreMeta = {
      title: 'Untitled Score',
      tempo: 120,
      time: '4/4',
      sidechain: null,
      autoPadVoices: true,
    };

    const defsMap = new Map<string, TrackDefinition>();
    const macros = new Map<string, string[]>();
    const diagnostics: CompilerDiagnostic[] = [];
    const allEvents: AtomicEvent[] = [];

    // If sketch mode (not wrapped in tenuto / measure / def), compile directly as a single track
    if (!this.isFullDocument(cleanSource)) {
      const trackMatch = cleanSource.match(/^([a-zA-Z0-9_]+):\s+([\s\S]*)$/);
      const trackId = trackMatch ? trackMatch[1] : 'pno';
      const body = trackMatch ? trackMatch[2].trim() : cleanSource.trim();

      const defaultDef: TrackDefinition = {
        id: trackId,
        name: trackId.toUpperCase(),
        style: 'standard',
        patch: 'salamander_grand',
        volume: 100,
        pan: 0,
        fx: [],
      };
      defsMap.set(trackId, defaultDef);

      if (body) {
        const serializer = new ASTSerializer();
        const tokens = this.tokenizeVoiceStream(body);
        const { events } = this.parseVoiceTokensToEvents(
          tokens,
          serializer,
          defaultDef,
          1,
          'v1',
          { numerator: 0, denominator: 1 },
          macros
        );
        allEvents.push(...events);
      }

      return {
        version: '5.0',
        meta,
        defs: Array.from(defsMap.values()),
        events: allEvents,
        diagnostics,
      };
    }

    // 1. Extract version
    const versionMatch = cleanSource.match(/\btenuto\s+"([^"]+)"/i);
    const version = versionMatch ? versionMatch[1] : '5.0';

    // 2. Extract meta @{ ... }
    const metaMatch = cleanSource.match(/\bmeta\s*@\{([^}]*)\}/i);
    if (metaMatch) {
      const parsedMeta = this.parseDictionary(metaMatch[1]);
      if (typeof parsedMeta.title === 'string') meta.title = parsedMeta.title;
      if (typeof parsedMeta.tempo === 'number') meta.tempo = parsedMeta.tempo;
      if (typeof parsedMeta.time === 'string') meta.time = parsedMeta.time;
      if (typeof parsedMeta.key === 'string') meta.key = parsedMeta.key;
      if (typeof parsedMeta.sidechain === 'string') meta.sidechain = parsedMeta.sidechain;
      if (typeof parsedMeta.auto_pad_voices === 'boolean') meta.autoPadVoices = parsedMeta.auto_pad_voices;
    }

    // 3. Extract var declarations (e.g. var vox_vol = 95)
    const trackVolumes = new Map<string, number>();
    const varRegex = /\bvar\s+([a-zA-Z0-9_]+)_vol\s*=\s*(\d+)/g;
    let varMatch: RegExpExecArray | null;
    while ((varMatch = varRegex.exec(cleanSource)) !== null) {
      trackVolumes.set(varMatch[1], parseInt(varMatch[2], 10));
    }

    // 4. Extract macro definitions: macro motif = { c4:8 d e } or $motif = { c4:8 d e }
    const macroRegex = /(?:macro\s+([a-zA-Z0-9_]+)(?:\([^)]*\))?|\$([a-zA-Z0-9_]+))\s*=?\s*\{([^}]*)\}/g;
    let macroMatch: RegExpExecArray | null;
    while ((macroMatch = macroRegex.exec(cleanSource)) !== null) {
      const name = macroMatch[1] || macroMatch[2];
      const tokens = this.tokenizeVoiceStream(macroMatch[3]);
      macros.set(name, tokens);
    }

    // 5. Extract def statements line by line
    const lines = cleanSource.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const defMatch = line.match(/^def\s+([a-zA-Z0-9_]+)\s*(?:"([^"]*)")?\s*(.*)$/i);
      if (defMatch) {
        const id = defMatch[1];
        const name = defMatch[2] || id;
        const attrStr = defMatch[3] || '';

        const styleMatch = attrStr.match(/\bstyle\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
        const patchMatch = attrStr.match(/\bpatch\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
        const srcMatch = attrStr.match(/\bsrc\s*=\s*"([^"]+)"/i);
        const envMatch = attrStr.match(/\benv\s*=\s*@\{([^}]*)\}/i);
        const fxMatches = Array.from(attrStr.matchAll(/\.fx\(\s*([a-zA-Z0-9_]+)/g)).map((m) => m[1]);

        const style = styleMatch ? styleMatch[1].replace(/^"|"$/g, '').toLowerCase() : 'standard';
        const defaultPatch =
          style === 'synth'
            ? 'saw_lead'
            : style === 'grid'
              ? 'tenuto_808_kit'
              : 'salamander_grand';
        const patch = patchMatch ? patchMatch[1].replace(/^"|"$/g, '') : defaultPatch;

        let env: Record<string, string> | undefined;
        if (envMatch) {
          const parsedEnv = this.parseDictionary(envMatch[1]);
          env = {};
          for (const [k, v] of Object.entries(parsedEnv)) {
            env[k] = String(v);
          }
        }

        defsMap.set(id, {
          id,
          name,
          style,
          patch,
          volume: trackVolumes.get(id) ?? 100,
          pan: 0,
          fx: fxMatches,
          env,
          src: srcMatch ? srcMatch[1] : undefined,
        });
      }
    }

    // 6. Parse measure blocks and maintain per-track/voice sticky serializers across measures
    const trackSerializers = new Map<string, ASTSerializer>();
    const getSerializer = (key: string): ASTSerializer => {
      if (!trackSerializers.has(key)) {
        trackSerializers.set(key, new ASTSerializer());
      }
      return trackSerializers.get(key)!;
    };

    const [beatsStr, beatTypeStr] = (meta.time || '4/4').split('/');
    const capNum = parseInt(beatsStr, 10) || 4;
    const capDen = parseInt(beatTypeStr, 10) || 4;
    const capDiv = this.gcd(capNum, capDen);
    const measureCapacity = {
      numerator: capNum / capDiv,
      denominator: capDen / capDiv,
    };

    const measureHeaderRegex = /\bmeasure\s+(\d+)(?:\s*-\s*(\d+))?\s*\{/gi;
    let measureMatch: RegExpExecArray | null;
    let currentScoreTime = { numerator: 0, denominator: 1 };

    while ((measureMatch = measureHeaderRegex.exec(cleanSource)) !== null) {
      const startNum = parseInt(measureMatch[1], 10);
      const endNum = measureMatch[2] ? parseInt(measureMatch[2], 10) : startNum;
      const bodyStartIdx = measureMatch.index + measureMatch[0].length;
      let braceDepth = 1;
      let cursor = bodyStartIdx;
      let inQuotes = false;

      while (cursor < cleanSource.length && braceDepth > 0) {
        const ch = cleanSource[cursor];
        if (ch === '"' && cleanSource[cursor - 1] !== '\\') {
          inQuotes = !inQuotes;
        } else if (!inQuotes) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }
        cursor++;
      }

      const measureBody = cleanSource.slice(bodyStartIdx, cursor - 1);
      measureHeaderRegex.lastIndex = cursor;

      for (let mNum = startNum; mNum <= endNum; mNum++) {
        const measureStartTime = { ...currentScoreTime };
        let maxVoiceDurationInMeasure = { ...measureCapacity };

        const assignmentRegex = /^\s*([a-zA-Z0-9_]+)\s*:\s+(<\[[\s\S]*?\]>|[^\n]+)$/gm;
        let assignMatch: RegExpExecArray | null;

        while ((assignMatch = assignmentRegex.exec(measureBody)) !== null) {
          const trackId = assignMatch[1].trim();
          const rhs = assignMatch[2].trim();

          if (!defsMap.has(trackId)) {
            const inferredStyle =
              /^(drum|drums|kit|perc|808_kit)$/i.test(trackId)
                ? 'grid'
                : /^(synth|lead|pad|bass|sub|arp|808)$/i.test(trackId)
                  ? 'synth'
                  : 'standard';
            defsMap.set(trackId, {
              id: trackId,
              name: trackId.toUpperCase(),
              style: inferredStyle,
              patch:
                inferredStyle === 'synth'
                  ? 'saw_lead'
                  : inferredStyle === 'grid'
                    ? 'tenuto_808_kit'
                    : 'salamander_grand',
              volume: trackVolumes.get(trackId) ?? 100,
              pan: 0,
              fx: [],
            });
          }

          const trackDef = defsMap.get(trackId)!;

          if (rhs.startsWith('<[') && rhs.endsWith(']>')) {
            const innerVoices = rhs
              .slice(2, -2)
              .split('|')
              .map((s) => s.trim())
              .filter(Boolean);
            innerVoices.forEach((voiceSegment, vIdx) => {
              const voiceLabelMatch = voiceSegment.match(/^([a-zA-Z0-9_]+)\s*:\s+([\s\S]*)$/);
              const voiceId = voiceLabelMatch ? voiceLabelMatch[1] : `v${vIdx + 1}`;
              const tokenStream = voiceLabelMatch ? voiceLabelMatch[2] : voiceSegment;
              const serializer = getSerializer(`${trackId}:${voiceId}`);
              const tokens = this.tokenizeVoiceStream(tokenStream);
              const { events, totalDuration } = this.parseVoiceTokensToEvents(
                tokens,
                serializer,
                trackDef,
                mNum,
                voiceId,
                measureStartTime,
                macros,
                true
              );
              allEvents.push(...events);
              if (
                totalDuration.numerator * maxVoiceDurationInMeasure.denominator >
                maxVoiceDurationInMeasure.numerator * totalDuration.denominator
              ) {
                maxVoiceDurationInMeasure = totalDuration;
              }
            });
          } else {
            const cleanRhs = rhs.replace(/\|$/, '').trim();
            const serializer = getSerializer(`${trackId}:v1`);
            const tokens = this.tokenizeVoiceStream(cleanRhs);
            const { events, totalDuration } = this.parseVoiceTokensToEvents(
              tokens,
              serializer,
              trackDef,
              mNum,
              'v1',
              measureStartTime,
              macros,
              true
            );
            allEvents.push(...events);
            if (
              totalDuration.numerator * maxVoiceDurationInMeasure.denominator >
              maxVoiceDurationInMeasure.numerator * totalDuration.denominator
            ) {
              maxVoiceDurationInMeasure = totalDuration;
            }
          }
        }

        currentScoreTime = this.addFractions(measureStartTime, maxVoiceDurationInMeasure);
      }
    }

    return {
      version,
      meta,
      defs: Array.from(defsMap.values()),
      events: allEvents,
      diagnostics,
    };
  }
}
