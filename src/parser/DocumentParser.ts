import { ASTSerializer, AtomicEvent, WarpMode } from './ASTSerializer';
import { TemporalResult } from './TemporalEngine';
import { AutomationLane, compileAutomationLanes } from '../audio/AutomationEngine';

export interface FXChainItem {
  type: string;
  params: Record<string, any>;
}

export interface TrackDefinition {
  id: string;
  name: string;
  style: 'standard' | 'synth' | 'grid' | 'concrete' | 'tab' | 'simpler' | 'sampler' | 'return' | string;
  patch: string;
  volume: number;
  pan: number;
  fx: string[];
  fxChain?: FXChainItem[];
  isReturn?: boolean;
  groupId?: string;
  sends?: Record<string, number>;
  crossfadeAssign?: 'A' | 'B' | 'OFF';
  trackDelayMs?: number;
  groove?: string;
  macros?: Record<string, number>;
  env?: Record<string, string>;
  src?: string;
  map?: Record<string, any>;
}

export interface FollowActionConfig {
  bars: number;
  actionA: 'next' | 'prev' | 'first' | 'last' | 'any' | 'other' | 'play_again' | 'stop' | 'none' | string;
  actionB: 'next' | 'prev' | 'first' | 'last' | 'any' | 'other' | 'play_again' | 'stop' | 'none' | string;
  chanceA: number;
  chanceB: number;
  linked: boolean;
}

export interface ClipDefinition {
  id: string;
  name: string;
  trackId: string;
  sceneIndex?: number;
  bars: number;
  loop: boolean;
  src?: string;
  warpMode?: WarpMode;
  pitchShiftSt?: number;
  gainDb?: number;
  followAction?: FollowActionConfig;
  events: AtomicEvent[];
}

export interface SceneDefinition {
  index: number;
  name: string;
  tempo?: number;
  time?: string;
  clipIds: string[];
}

export interface GroupDefinition {
  id: string;
  name: string;
  trackIds: string[];
  volume: number;
  pan: number;
  fx: string[];
  fxChain: FXChainItem[];
}

export interface LocatorDefinition {
  id: string;
  name: string;
  measureNumber: number;
  startWhole: number;
}

export interface GrooveDefinition {
  id: string;
  name: string;
  base: string;
  quantizePercent: number;
  timingPercent: number;
  randomPercent: number;
  velocityPercent: number;
}

export interface ScoreMeta {
  title: string;
  tempo: number;
  time: string;
  key?: string;
  scale?: string;
  scaleLock?: boolean;
  tuning?: string;
  a4Hz?: number;
  quantizeLaunch?: string;
  crossfader?: number;
  sidechain: string | null;
  sidechainTap?: 'pre_fx' | 'post_fx' | 'post_mixer' | string;
  autoPadVoices: boolean;
  tempoMap?: Array<{ startWhole: number; tempo: number }>;
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
  groups?: GroupDefinition[];
  scenes?: SceneDefinition[];
  clips?: ClipDefinition[];
  locators?: LocatorDefinition[];
  grooves?: GrooveDefinition[];
  automationLanes?: AutomationLane[];
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
      /\bscene\s+\d+/i.test(cleaned) ||
      /\bclip\s+[a-zA-Z0-9_]+/i.test(cleaned) ||
      /\bgroup\s+[a-zA-Z0-9_]+/i.test(cleaned) ||
      /\b(?:def|def_return|return)\s+[a-zA-Z0-9_]+/i.test(cleaned) ||
      /\blocator\s+/i.test(cleaned) ||
      /\bgroove\s+[a-zA-Z0-9_]+/i.test(cleaned) ||
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
      } else if (valRaw.endsWith('%') && !isNaN(Number(valRaw.slice(0, -1)))) {
        result[key] = Number(valRaw.slice(0, -1));
      } else if (!isNaN(Number(valRaw))) {
        result[key] = Number(valRaw);
      } else {
        result[key] = valRaw;
      }
    }
    return result;
  }

  private parseFXChainFromAttributes(attrStr: string): { fxNames: string[]; fxChain: FXChainItem[] } {
    const fxNames: string[] = [];
    const fxChain: FXChainItem[] = [];
    const fxRegex = /\.fx\(\s*([a-zA-Z0-9_"-]+)\s*(?:,\s*@\{([^}]*)\})?\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = fxRegex.exec(attrStr)) !== null) {
      const type = m[1].replace(/^"|"$/g, '').trim();
      const params = m[2] ? this.parseDictionary(m[2]) : {};
      fxNames.push(type);
      fxChain.push({ type, params });
    }
    return { fxNames, fxChain };
  }

  private parseFollowActionDict(dict: Record<string, any>): FollowActionConfig {
    const bars = typeof dict.bars === 'number' ? dict.bars : typeof dict.after === 'number' ? dict.after : 4;
    const actionA = String(dict.actionA || dict.action || 'next').toLowerCase();
    const actionB = String(dict.actionB || 'none').toLowerCase();
    const chanceA =
      typeof dict.chanceA === 'number'
        ? dict.chanceA
        : typeof dict.chance === 'number'
          ? dict.chance
          : 100;
    const chanceB =
      typeof dict.chanceB === 'number' ? dict.chanceB : Math.max(0, 100 - chanceA);
    const linked = typeof dict.linked === 'boolean' ? dict.linked : true;

    return {
      bars,
      actionA,
      actionB,
      chanceA,
      chanceB,
      linked,
    };
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
        /^([a-gA-G][#b]*[0-9]*:[0-9.]+(?:\.(?:pp|p|mp|mf|f|ff|sfz|stacc|staccato|ten|tenuto|marc|accent|legato|vib|trem|pizz|ped|fp|fermata|trill|mordent|cresc|crescendo|dim|diminuendo))+?)([a-gA-G][#b]*[0-9]+:[0-9.].*)$/
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
    for (let idx = 0; idx < rawTokens.length; idx++) {
      const tok = rawTokens[idx];
      if (tok === '|') continue;

      if (tok.toLowerCase() === 'repeat' && idx + 2 < rawTokens.length) {
        const count = parseInt(rawTokens[idx + 1], 10);
        const block = rawTokens[idx + 2];
        if (!isNaN(count) && count > 0 && block.startsWith('{') && block.endsWith('}')) {
          const innerTokens = this.tokenizeVoiceStream(block.slice(1, -1));
          for (let r = 0; r < Math.min(32, count); r++) {
            expandedTokens.push(...innerTokens);
          }
          idx += 2;
          continue;
        }
      }

      if (tok.startsWith('$')) {
        const macroName = tok.slice(1).replace(/\(.*\)$/, '');
        const macroBody = macros.get(macroName) || macros.get('$' + macroName);
        if (macroBody) {
          expandedTokens.push(...macroBody);
          continue;
        }
      }

      const modRepeatMatch = tok.match(/^(.+\.[a-zA-Z_][^*]*)\*(\d+)$/);
      if (modRepeatMatch) {
        const baseTok = modRepeatMatch[1];
        const repeatCount = Math.min(64, Math.max(1, parseInt(modRepeatMatch[2], 10)));
        for (let r = 0; r < repeatCount; r++) {
          expandedTokens.push(baseTok);
        }
        continue;
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

            const hasAuto = Boolean(
              ev.physics?.cc || (ev.physics?.automations && ev.physics.automations.length > 0)
            );
            if (!ev.pitch.isRest && (!ev.pitch.isSpacer || hasAuto)) {
              events.push(ev);
            }
            if (!ev.duration.isGrace) {
              cursorTime = this.addFractions(cursorTime, ev.duration);
              voiceDuration = this.addFractions(voiceDuration, ev.duration);
            }
          }
          continue;
        }

        // 2. Tuplet syntax: (c4:8 d e):3/2 or (c4:8 d e):2/3
        const tupletMatch = token.match(/^\((.+)\):(\d+)\/(\d+)((?:\.[a-zA-Z_].*)?)$/);
        if (tupletMatch) {
          const innerStream = tupletMatch[1];
          const rawNum = parseInt(tupletMatch[2], 10);
          const rawDen = parseInt(tupletMatch[3], 10);
          const modSuffix = tupletMatch[4] || '';
          const innerTokens = this.tokenizeVoiceStream(innerStream);

          const isStandardTupletRatio = rawNum > rawDen && innerTokens.length === rawNum;
          const scaleNum = isStandardTupletRatio ? rawDen : rawNum;
          const scaleDen = isStandardTupletRatio ? rawNum : rawDen;

          for (let i = 0; i < innerTokens.length; i++) {
            const innerTok = i === 0 && modSuffix ? `${innerTokens[i]}${modSuffix}` : innerTokens[i];
            const ev = serializer.parseToken(innerTok, trackDef.style);
            const scaledNum = ev.duration.numerator * scaleNum;
            const scaledDen = ev.duration.denominator * scaleDen;
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

            const hasAuto = Boolean(
              ev.physics?.cc || (ev.physics?.automations && ev.physics.automations.length > 0)
            );
            if (!ev.pitch.isRest && (!ev.pitch.isSpacer || hasAuto)) {
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
          const suffix = chordMatch[2] || '';

          let chordDuration: TemporalResult | null = null;
          let sharedPhysics: any = undefined;
          const chordEvents: AtomicEvent[] = [];

          for (let i = 0; i < chordPitches.length; i++) {
            const noteToken = i === 0 ? `${chordPitches[i]}${suffix}` : chordPitches[i];
            const ev = serializer.parseToken(noteToken, trackDef.style);
            if (i === 0) {
              chordDuration = ev.duration;
              sharedPhysics = ev.physics;
            } else {
              if (chordDuration) ev.duration = { ...chordDuration };
              if (sharedPhysics) {
                ev.physics = {
                  ...sharedPhysics,
                  modifiers: sharedPhysics.modifiers ? [...sharedPhysics.modifiers] : undefined,
                  fx: sharedPhysics.fx ? [...sharedPhysics.fx] : undefined,
                };
              }
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
              chordEvents.push(ev);
            }
          }

          if (sharedPhysics?.arp && chordEvents.length > 1) {
            const sortedByPitch = [...chordEvents].sort((a, b) => a.pitch.midi - b.pitch.midi);
            sortedByPitch.forEach((cev, rollIdx) => {
              if (!cev.physics) cev.physics = {};
              cev.physics.pullMs = (cev.physics.pullMs || 0) + rollIdx * 28;
            });
          }

          const rollSubdiv = sharedPhysics?.roll && sharedPhysics.roll > 1 ? sharedPhysics.roll : 1;
          if (rollSubdiv > 1 && chordDuration && !chordDuration.isGrace) {
            const subNum = chordDuration.numerator;
            const subDen = chordDuration.denominator * rollSubdiv;
            const div = this.gcd(subNum, subDen);
            const sliceDur = { numerator: subNum / div, denominator: subDen / div };
            let sliceCursor = { ...cursorTime };

            for (let r = 0; r < rollSubdiv; r++) {
              for (const baseEv of chordEvents) {
                const cloned: AtomicEvent = {
                  ...baseEv,
                  duration: { ...sliceDur },
                  startTime: { ...sliceCursor },
                  physics: baseEv.physics
                    ? {
                        ...baseEv.physics,
                        roll: undefined,
                        legato: r > 0 ? true : baseEv.physics.legato,
                      }
                    : r > 0
                      ? { legato: true }
                      : undefined,
                };
                events.push(cloned);
              }
              sliceCursor = this.addFractions(sliceCursor, sliceDur);
            }
          } else {
            events.push(...chordEvents);
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

        const rollCount = ev.physics?.roll && ev.physics.roll > 1 ? ev.physics.roll : 1;
        const hasAuto = Boolean(
          ev.physics?.cc || (ev.physics?.automations && ev.physics.automations.length > 0)
        );
        if (!ev.pitch.isRest && (!ev.pitch.isSpacer || hasAuto)) {
          if (rollCount > 1 && !ev.duration.isGrace) {
            const subNum = ev.duration.numerator;
            const subDen = ev.duration.denominator * rollCount;
            const div = this.gcd(subNum, subDen);
            const sliceDur = { numerator: subNum / div, denominator: subDen / div };
            let sliceCursor = { ...cursorTime };

            for (let r = 0; r < rollCount; r++) {
              events.push({
                ...ev,
                duration: { ...sliceDur },
                startTime: { ...sliceCursor },
                physics: ev.physics
                  ? {
                      ...ev.physics,
                      roll: undefined,
                      legato: r > 0 ? true : ev.physics.legato,
                    }
                  : r > 0
                    ? { legato: true }
                    : undefined,
              });
              sliceCursor = this.addFractions(sliceCursor, sliceDur);
            }
          } else {
            events.push(ev);
          }
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

  private ensureTrackDefinition(
    trackId: string,
    defsMap: Map<string, TrackDefinition>,
    trackVolumes: Map<string, number>
  ): TrackDefinition {
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
        fxChain: [],
      });
    }
    return defsMap.get(trackId)!;
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
    const groups: GroupDefinition[] = [];
    const scenes: SceneDefinition[] = [];
    const clips: ClipDefinition[] = [];
    const locators: LocatorDefinition[] = [];
    const grooves: GrooveDefinition[] = [];
    const macros = new Map<string, string[]>();
    const diagnostics: CompilerDiagnostic[] = [];
    const allEvents: AtomicEvent[] = [];

    // If sketch mode (not wrapped in tenuto / measure / scene / clip / def), compile directly as a single track
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
        fxChain: [],
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

      const mergedSketchEvents = this.mergeTiedEvents(allEvents);
      this.attachSourceLocations(rawSource, mergedSketchEvents);
      const automationLanes = compileAutomationLanes(mergedSketchEvents);

      return {
        version: '5.0',
        meta,
        defs: Array.from(defsMap.values()),
        groups,
        scenes,
        clips,
        locators,
        grooves,
        automationLanes,
        events: mergedSketchEvents,
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
      if (typeof parsedMeta.scale === 'string') meta.scale = parsedMeta.scale;
      if (typeof parsedMeta.scale_lock === 'boolean') meta.scaleLock = parsedMeta.scale_lock;
      if (typeof parsedMeta.tuning === 'string') meta.tuning = parsedMeta.tuning;
      if (typeof parsedMeta.a4_hz === 'number') meta.a4Hz = parsedMeta.a4_hz;
      if (typeof parsedMeta.quantize_launch === 'string') meta.quantizeLaunch = parsedMeta.quantize_launch;
      else if (typeof parsedMeta.quantize === 'string') meta.quantizeLaunch = parsedMeta.quantize;
      if (typeof parsedMeta.crossfader === 'number') meta.crossfader = parsedMeta.crossfader;
      if (typeof parsedMeta.sidechain === 'string') meta.sidechain = parsedMeta.sidechain;
      if (typeof parsedMeta.sidechain_tap === 'string') {
        meta.sidechainTap = parsedMeta.sidechain_tap.toLowerCase();
      }
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

    // 5. Extract def and return / def_return statements line by line
    const lines = cleanSource.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const defMatch = line.match(/^(def|def_return|return)\s+([a-zA-Z0-9_]+)\s*(?:"([^"]*)")?\s*(.*)$/i);
      if (defMatch) {
        const keyword = defMatch[1].toLowerCase();
        const id = defMatch[2];
        const name = defMatch[3] || id;
        const attrStr = defMatch[4] || '';

        const styleMatch = attrStr.match(/\bstyle\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
        const patchMatch = attrStr.match(/\bpatch\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
        const srcMatch = attrStr.match(/\bsrc\s*=\s*"([^"]+)"/i);
        const groupAttrMatch = attrStr.match(/\bgroup\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
        const grooveAttrMatch = attrStr.match(/\bgroove\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
        const crossfadeMatch = attrStr.match(/\bcrossfade\s*=\s*("?[ABab]"?|"OFF"|OFF)/i);
        const delayMatch = attrStr.match(/\bdelay\s*=\s*(-?\d+(?:\.\d+)?)(?:ms)?/i);
        const volAttrMatch = attrStr.match(/\bvol(?:ume)?\s*=\s*(\d+)/i);
        const panAttrMatch = attrStr.match(/\bpan\s*=\s*(-?\d+(?:\.\d+)?)/i);
        const envMatch = attrStr.match(/\benv\s*=\s*@\{([^}]*)\}/i);
        const sendsMatch = attrStr.match(/\bsends\s*=\s*@\{([^}]*)\}/i);
        const macrosAttrMatch = attrStr.match(/\bmacros\s*=\s*@\{([^}]*)\}/i);

        const { fxNames, fxChain } = this.parseFXChainFromAttributes(attrStr);

        const isReturn =
          keyword === 'return' ||
          keyword === 'def_return' ||
          (styleMatch ? styleMatch[1].replace(/^"|"$/g, '').toLowerCase() === 'return' : false);

        const style = isReturn
          ? 'return'
          : styleMatch
            ? styleMatch[1].replace(/^"|"$/g, '').toLowerCase()
            : 'standard';

        const defaultPatch =
          style === 'synth'
            ? 'saw_lead'
            : style === 'grid'
              ? 'tenuto_808_kit'
              : style === 'return'
                ? 'return_bus'
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

        let sends: Record<string, number> | undefined;
        if (sendsMatch) {
          const parsedSends = this.parseDictionary(sendsMatch[1]);
          sends = {};
          for (const [k, v] of Object.entries(parsedSends)) {
            if (typeof v === 'number') sends[k] = v;
          }
        }

        let trackMacros: Record<string, number> | undefined;
        if (macrosAttrMatch) {
          const parsedMacros = this.parseDictionary(macrosAttrMatch[1]);
          trackMacros = {};
          for (const [k, v] of Object.entries(parsedMacros)) {
            if (typeof v === 'number') trackMacros[k] = v;
          }
        }

        const crossfadeRaw = crossfadeMatch ? crossfadeMatch[1].replace(/^"|"$/g, '').toUpperCase() : undefined;
        const crossfadeAssign =
          crossfadeRaw === 'A' || crossfadeRaw === 'B' || crossfadeRaw === 'OFF'
            ? (crossfadeRaw as 'A' | 'B' | 'OFF')
            : undefined;

        defsMap.set(id, {
          id,
          name,
          style,
          patch,
          volume: volAttrMatch ? parseInt(volAttrMatch[1], 10) : (trackVolumes.get(id) ?? 100),
          pan: panAttrMatch ? parseFloat(panAttrMatch[1]) : 0,
          fx: fxNames,
          fxChain,
          isReturn,
          groupId: groupAttrMatch ? groupAttrMatch[1].replace(/^"|"$/g, '') : undefined,
          groove: grooveAttrMatch ? grooveAttrMatch[1].replace(/^"|"$/g, '') : undefined,
          crossfadeAssign,
          trackDelayMs: delayMatch ? parseFloat(delayMatch[1]) : undefined,
          sends,
          macros: trackMacros,
          env,
          src: srcMatch ? srcMatch[1] : undefined,
        });
      }
    }

    // 5b. Extract group definitions (both single-line tracks=[...] and block group { ... })
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const singleGroupMatch = line.match(
        /^group\s+([a-zA-Z0-9_]+)\s*(?:"([^"]*)")?\s*tracks\s*=\s*\[([^\]]*)\]\s*(.*)$/i
      );
      if (singleGroupMatch) {
        const id = singleGroupMatch[1];
        const name = singleGroupMatch[2] || id;
        const trackIds = singleGroupMatch[3]
          .split(/[,\s]+/)
          .map((s) => s.trim().replace(/^"|"$/g, ''))
          .filter(Boolean);
        const attrStr = singleGroupMatch[4] || '';
        const { fxNames, fxChain } = this.parseFXChainFromAttributes(attrStr);
        groups.push({
          id,
          name,
          trackIds,
          volume: trackVolumes.get(id) ?? 100,
          pan: 0,
          fx: fxNames,
          fxChain,
        });
        for (const tId of trackIds) {
          const def = defsMap.get(tId);
          if (def) def.groupId = id;
        }
      }
    }

    const groupBlockRegex = /\bgroup\s+([a-zA-Z0-9_]+)\s*(?:"([^"]*)")?\s*((?:@\{[^}]*\}|[^{])*)\{([\s\S]*?)\}/gi;
    let groupBlockMatch: RegExpExecArray | null;
    while ((groupBlockMatch = groupBlockRegex.exec(cleanSource)) !== null) {
      const id = groupBlockMatch[1];
      const name = groupBlockMatch[2] || id;
      const attrStr = groupBlockMatch[3] || '';
      const groupBody = groupBlockMatch[4] || '';
      if (groups.some((g) => g.id === id)) continue;

      const { fxNames, fxChain } = this.parseFXChainFromAttributes(attrStr);
      const trackIds: string[] = [];
      const memberDefRegex = /\bdef\s+([a-zA-Z0-9_]+)/gi;
      let memberMatch: RegExpExecArray | null;
      while ((memberMatch = memberDefRegex.exec(groupBody)) !== null) {
        const tId = memberMatch[1];
        trackIds.push(tId);
        const def = defsMap.get(tId);
        if (def) def.groupId = id;
      }
      groups.push({
        id,
        name,
        trackIds,
        volume: trackVolumes.get(id) ?? 100,
        pan: 0,
        fx: fxNames,
        fxChain,
      });
    }

    // 5c. Extract Groove Pool definitions: groove <id> "<Name>" @{ base: "1/16", quantize: 80, timing: 35, random: 10, velocity: 50 }
    const grooveRegex = /\bgroove\s+([a-zA-Z0-9_]+)\s*(?:"([^"]*)")?\s*@\{([^}]*)\}/gi;
    let grooveMatch: RegExpExecArray | null;
    while ((grooveMatch = grooveRegex.exec(cleanSource)) !== null) {
      const id = grooveMatch[1];
      const name = grooveMatch[2] || id;
      const dict = this.parseDictionary(grooveMatch[3]);
      grooves.push({
        id,
        name,
        base: typeof dict.base === 'string' ? dict.base : '1/16',
        quantizePercent: typeof dict.quantize === 'number' ? dict.quantize : 100,
        timingPercent: typeof dict.timing === 'number' ? dict.timing : 0,
        randomPercent: typeof dict.random === 'number' ? dict.random : 0,
        velocityPercent: typeof dict.velocity === 'number' ? dict.velocity : 0,
      });
    }

    const [beatsStr, beatTypeStr] = (meta.time || '4/4').split('/');
    const capNum = parseInt(beatsStr, 10) || 4;
    const capDen = parseInt(beatTypeStr, 10) || 4;
    const capDiv = this.gcd(capNum, capDen);
    const measureCapacity = {
      numerator: capNum / capDiv,
      denominator: capDen / capDiv,
    };

    // 5d. Extract Arrangement Locators:
    // Either `locator "Drop" at measure 17` or `locator drop_id "Drop" measure=17`
    for (const rawLine of lines) {
      const line = rawLine.trim();
      const locAtMatch = line.match(/^locator\s+(?:([a-zA-Z0-9_]+)\s+)?"([^"]+)"\s+(?:at\s+)?measure\s*=?\s*(\d+)/i);
      if (locAtMatch) {
        const name = locAtMatch[2];
        const id = locAtMatch[1] || name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
        const measureNumber = Math.max(1, parseInt(locAtMatch[3], 10));
        const startWhole = (measureNumber - 1) * (measureCapacity.numerator / measureCapacity.denominator);
        locators.push({ id, name, measureNumber, startWhole });
      }
    }

    // 6. Parse measure blocks and maintain per-track/voice sticky serializers across measures
    const tuningConfig = {
      system: meta.tuning || '12tet',
      rootKey: meta.key || 'C',
      scaleName: meta.scale || 'chromatic',
      scaleLock: Boolean(meta.scaleLock),
      a4Hz: meta.a4Hz || 440.0,
    };

    const trackSerializers = new Map<string, ASTSerializer>();
    const getSerializer = (key: string): ASTSerializer => {
      if (!trackSerializers.has(key)) {
        const s = new ASTSerializer();
        s.configureTuning(tuningConfig);
        trackSerializers.set(key, s);
      }
      return trackSerializers.get(key)!;
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

      const measureMetaMatch = measureBody.match(/\bmeta\s*@\{([^}]*)\}/i);
      if (measureMetaMatch) {
        const parsedMeasureMeta = this.parseDictionary(measureMetaMatch[1]);
        if (typeof parsedMeasureMeta.tempo === 'number' && parsedMeasureMeta.tempo > 0) {
          if (!meta.tempoMap) meta.tempoMap = [];
          meta.tempoMap.push({
            startWhole: currentScoreTime.numerator / currentScoreTime.denominator,
            tempo: parsedMeasureMeta.tempo,
          });
        }
      }

      for (let mNum = startNum; mNum <= endNum; mNum++) {
        const measureStartTime = { ...currentScoreTime };
        let maxVoiceDurationInMeasure = { ...measureCapacity };

        const assignmentRegex = /^\s*([a-zA-Z0-9_]+)\s*:\s+(<\[[\s\S]*?\]>|\{[\s\S]*?\}|[^\n]+)$/gm;
        let assignMatch: RegExpExecArray | null;

        while ((assignMatch = assignmentRegex.exec(measureBody)) !== null) {
          const trackId = assignMatch[1].trim();
          if (trackId.toLowerCase() === 'meta') continue;
          const rhs = assignMatch[2].trim();

          const trackDef = this.ensureTrackDefinition(trackId, defsMap, trackVolumes);

          if (
            (rhs.startsWith('<[') && rhs.endsWith(']>')) ||
            (rhs.startsWith('{') && rhs.endsWith('}'))
          ) {
            const innerRaw = rhs.startsWith('<[') ? rhs.slice(2, -2) : rhs.slice(1, -1);
            const innerVoices = innerRaw
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

    // 7. Parse standalone Session/Arrangement `clip` blocks:
    // clip <id> "<Name>" track=<trackId> scene=<N> bars=<B> follow=@{...} { ... }
    const clipHeaderRegex = /\bclip\s+([a-zA-Z0-9_]+)\s*(?:"([^"]*)")?\s*((?:@\{[^}]*\}|[^{])*)\{/gi;
    let clipMatch: RegExpExecArray | null;
    while ((clipMatch = clipHeaderRegex.exec(cleanSource)) !== null) {
      const clipId = clipMatch[1];
      const clipName = clipMatch[2] || clipId;
      const attrStr = clipMatch[3] || '';
      const bodyStartIdx = clipMatch.index + clipMatch[0].length;
      let braceDepth = 1;
      let cursor = bodyStartIdx;
      let inQuotes = false;

      while (cursor < cleanSource.length && braceDepth > 0) {
        const ch = cleanSource[cursor];
        if (ch === '"' && cleanSource[cursor - 1] !== '\\') inQuotes = !inQuotes;
        else if (!inQuotes) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }
        cursor++;
      }

      const clipBody = cleanSource.slice(bodyStartIdx, cursor - 1).trim();
      clipHeaderRegex.lastIndex = cursor;

      const trackAttr = attrStr.match(/\btrack\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
      const sceneAttr = attrStr.match(/\bscene\s*=\s*(\d+)/i);
      const barsAttr = attrStr.match(/\bbars\s*=\s*(\d+)/i);
      const loopAttr = attrStr.match(/\bloop\s*=\s*(true|false)/i);
      const srcAttr = attrStr.match(/\bsrc\s*=\s*"([^"]+)"/i);
      const warpAttr = attrStr.match(/\bwarp\s*=\s*("[^"]+"|[a-zA-Z0-9_]+)/i);
      const transposeAttr = attrStr.match(/\b(?:transpose|pitch)\s*=\s*(-?\d+(?:\.\d+)?)/i);
      const gainAttr = attrStr.match(/\bgain\s*=\s*(-?\d+(?:\.\d+)?)/i);
      const followAttr = attrStr.match(/\bfollow(?:_action)?\s*=\s*@\{([^}]*)\}/i);

      const trackId = trackAttr ? trackAttr[1].replace(/^"|"$/g, '') : 'pno';
      const sceneIndex = sceneAttr ? parseInt(sceneAttr[1], 10) : undefined;
      const trackDef = this.ensureTrackDefinition(trackId, defsMap, trackVolumes);

      const clipSerializer = new ASTSerializer();
      clipSerializer.configureTuning(tuningConfig);
      const cleanBody = clipBody.replace(/^[a-zA-Z0-9_]+\s*:\s+/, '').replace(/\|$/, '').trim();
      const clipTokens = this.tokenizeVoiceStream(cleanBody);
      const { events: clipEvents, totalDuration } = this.parseVoiceTokensToEvents(
        clipTokens,
        clipSerializer,
        trackDef,
        sceneIndex ?? 1,
        'v1',
        { numerator: 0, denominator: 1 },
        macros,
        true
      );

      for (const ev of clipEvents) {
        ev.clipId = clipId;
        ev.sceneIndex = sceneIndex;
      }

      const computedBars = Math.max(
        1,
        Math.round(
          (totalDuration.numerator / totalDuration.denominator) /
            (measureCapacity.numerator / measureCapacity.denominator)
        ) || 1
      );

      const warpRaw = warpAttr ? warpAttr[1].replace(/^"|"$/g, '').toLowerCase() : undefined;
      const warpMode =
        warpRaw === 'beats' ||
        warpRaw === 'tones' ||
        warpRaw === 'texture' ||
        warpRaw === 'repitch' ||
        warpRaw === 'complex' ||
        warpRaw === 'complex_pro'
          ? (warpRaw as WarpMode)
          : undefined;

      const clipDef: ClipDefinition = {
        id: clipId,
        name: clipName,
        trackId,
        sceneIndex,
        bars: barsAttr ? parseInt(barsAttr[1], 10) : computedBars,
        loop: loopAttr ? loopAttr[1].toLowerCase() === 'true' : true,
        src: srcAttr ? srcAttr[1] : trackDef.src,
        warpMode,
        pitchShiftSt: transposeAttr ? parseFloat(transposeAttr[1]) : undefined,
        gainDb: gainAttr ? parseFloat(gainAttr[1]) : undefined,
        followAction: followAttr ? this.parseFollowActionDict(this.parseDictionary(followAttr[1])) : undefined,
        events: this.mergeTiedEvents(clipEvents),
      };

      clips.push(clipDef);

      if (sceneIndex !== undefined) {
        let existingScene = scenes.find((s) => s.index === sceneIndex);
        if (!existingScene) {
          existingScene = { index: sceneIndex, name: `Scene ${sceneIndex}`, clipIds: [] };
          scenes.push(existingScene);
        }
        if (!existingScene.clipIds.includes(clipId)) {
          existingScene.clipIds.push(clipId);
        }
      }
    }

    // 8. Parse Session View `scene` blocks:
    // scene 1 "Intro" @{ tempo: 120 } { lead: c4:4 e4:4 g4:2 | drums: k:4 s:4 k:4 s:4 }
    const sceneHeaderRegex = /\bscene\s+(\d+)\s*(?:"([^"]*)")?\s*(?:@\{([^}]*)\})?\s*\{/gi;
    let sceneMatch: RegExpExecArray | null;
    const hasExplicitMeasures = allEvents.length > 0;
    let sceneTimelineCursor = { ...currentScoreTime };

    while ((sceneMatch = sceneHeaderRegex.exec(cleanSource)) !== null) {
      const sceneIndex = parseInt(sceneMatch[1], 10);
      const sceneName = sceneMatch[2] || `Scene ${sceneIndex}`;
      const sceneMetaDict = sceneMatch[3] ? this.parseDictionary(sceneMatch[3]) : {};

      const bodyStartIdx = sceneMatch.index + sceneMatch[0].length;
      let braceDepth = 1;
      let cursor = bodyStartIdx;
      let inQuotes = false;

      while (cursor < cleanSource.length && braceDepth > 0) {
        const ch = cleanSource[cursor];
        if (ch === '"' && cleanSource[cursor - 1] !== '\\') inQuotes = !inQuotes;
        else if (!inQuotes) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
        }
        cursor++;
      }

      const sceneBody = cleanSource.slice(bodyStartIdx, cursor - 1);
      sceneHeaderRegex.lastIndex = cursor;

      let sceneObj = scenes.find((s) => s.index === sceneIndex);
      if (!sceneObj) {
        sceneObj = {
          index: sceneIndex,
          name: sceneName,
          tempo: typeof sceneMetaDict.tempo === 'number' ? sceneMetaDict.tempo : undefined,
          time: typeof sceneMetaDict.time === 'string' ? sceneMetaDict.time : undefined,
          clipIds: [],
        };
        scenes.push(sceneObj);
      } else {
        sceneObj.name = sceneName;
        if (typeof sceneMetaDict.tempo === 'number') sceneObj.tempo = sceneMetaDict.tempo;
        if (typeof sceneMetaDict.time === 'string') sceneObj.time = sceneMetaDict.time;
      }

      let maxSceneDuration = { ...measureCapacity };
      const assignmentRegex = /^\s*([a-zA-Z0-9_]+)\s*:\s+(<\[[\s\S]*?\]>|\{[\s\S]*?\}|[^\n]+)$/gm;
      let assignMatch: RegExpExecArray | null;

      while ((assignMatch = assignmentRegex.exec(sceneBody)) !== null) {
        const trackId = assignMatch[1].trim();
        if (trackId.toLowerCase() === 'meta') continue;
        let rhs = assignMatch[2].trim();

        // Extract optional inline follow action dictionary: @follow @{ bars: 4, actionA: "next", chanceA: 80 }
        let inlineFollow: FollowActionConfig | undefined;
        const followInlineMatch = rhs.match(/@follow\s*@\{([^}]*)\}/i);
        if (followInlineMatch) {
          inlineFollow = this.parseFollowActionDict(this.parseDictionary(followInlineMatch[1]));
          rhs = rhs.replace(followInlineMatch[0], '').trim();
        }

        const trackDef = this.ensureTrackDefinition(trackId, defsMap, trackVolumes);
        const clipId = `scene_${sceneIndex}_${trackId}`;
        const clipEvents: AtomicEvent[] = [];
        let trackClipDuration = { numerator: 0, denominator: 1 };

        if (
          (rhs.startsWith('<[') && rhs.endsWith(']>')) ||
          (rhs.startsWith('{') && rhs.endsWith('}'))
        ) {
          const innerRaw = rhs.startsWith('<[') ? rhs.slice(2, -2) : rhs.slice(1, -1);
          const innerVoices = innerRaw
            .split('|')
            .map((s) => s.trim())
            .filter(Boolean);
          innerVoices.forEach((voiceSegment, vIdx) => {
            const voiceLabelMatch = voiceSegment.match(/^([a-zA-Z0-9_]+)\s*:\s+([\s\S]*)$/);
            const voiceId = voiceLabelMatch ? voiceLabelMatch[1] : `v${vIdx + 1}`;
            const tokenStream = voiceLabelMatch ? voiceLabelMatch[2] : voiceSegment;
            const serializer = new ASTSerializer();
            serializer.configureTuning(tuningConfig);
            const tokens = this.tokenizeVoiceStream(tokenStream);
            const { events, totalDuration } = this.parseVoiceTokensToEvents(
              tokens,
              serializer,
              trackDef,
              sceneIndex,
              voiceId,
              { numerator: 0, denominator: 1 },
              macros,
              true
            );
            clipEvents.push(...events);
            if (
              totalDuration.numerator * trackClipDuration.denominator >
              trackClipDuration.numerator * totalDuration.denominator
            ) {
              trackClipDuration = totalDuration;
            }
          });
        } else {
          const cleanRhs = rhs.replace(/\|$/, '').trim();
          const serializer = new ASTSerializer();
          serializer.configureTuning(tuningConfig);
          const tokens = this.tokenizeVoiceStream(cleanRhs);
          const { events, totalDuration } = this.parseVoiceTokensToEvents(
            tokens,
            serializer,
            trackDef,
            sceneIndex,
            'v1',
            { numerator: 0, denominator: 1 },
            macros,
            true
          );
          clipEvents.push(...events);
          trackClipDuration = totalDuration;
        }

        for (const ev of clipEvents) {
          ev.clipId = clipId;
          ev.sceneIndex = sceneIndex;
        }

        const mergedClipEvents = this.mergeTiedEvents(clipEvents);
        const bars = Math.max(
          1,
          Math.round(
            (trackClipDuration.numerator / trackClipDuration.denominator) /
              (measureCapacity.numerator / measureCapacity.denominator)
          ) || 1
        );

        clips.push({
          id: clipId,
          name: `${sceneName} - ${trackDef.name}`,
          trackId,
          sceneIndex,
          bars,
          loop: true,
          src: trackDef.src,
          followAction: inlineFollow,
          events: mergedClipEvents,
        });
        sceneObj.clipIds.push(clipId);

        if (
          trackClipDuration.numerator * maxSceneDuration.denominator >
          maxSceneDuration.numerator * trackClipDuration.denominator
        ) {
          maxSceneDuration = trackClipDuration;
        }

        // If the document is written purely in Session `scene` blocks without `measure` blocks,
        // also project scene events onto the linear playback timeline so Play works out of the box.
        if (!hasExplicitMeasures) {
          for (const ev of mergedClipEvents) {
            const timelineOffset = ev.startTime
              ? this.addFractions(sceneTimelineCursor, ev.startTime)
              : { ...sceneTimelineCursor };
            allEvents.push({
              ...ev,
              startTime: timelineOffset,
            });
          }
        }
      }

      if (!hasExplicitMeasures) {
        sceneTimelineCursor = this.addFractions(sceneTimelineCursor, maxSceneDuration);
      }
    }

    // If a score contains only standalone `clip` blocks (and no `measure` or `scene` blocks),
    // project the clips onto the main timeline so linear Play / Export WAV still works.
    if (allEvents.length === 0 && clips.length > 0) {
      for (const clip of clips) {
        for (const ev of clip.events) {
          allEvents.push({ ...ev });
        }
      }
    }

    scenes.sort((a, b) => a.index - b.index);
    locators.sort((a, b) => a.startWhole - b.startWhole);

    const mergedEvents = this.mergeTiedEvents(allEvents);
    this.attachSourceLocations(rawSource, mergedEvents);
    const automationLanes = compileAutomationLanes(mergedEvents);

    return {
      version,
      meta,
      defs: Array.from(defsMap.values()),
      groups,
      scenes,
      clips,
      locators,
      grooves,
      automationLanes,
      events: mergedEvents,
      diagnostics,
    };
  }

  /**
   * Maps each compiled AtomicEvent in order to its exact character span (`sourceStartOffset`, `sourceEndOffset`)
   * and 1-based `(line, col)` coordinates in the raw source string, skipping comments (`%%` and `//`).
   */
  private attachSourceLocations(rawSource: string, events: AtomicEvent[]): void {
    if (!rawSource || events.length === 0) return;

    const lineStarts: number[] = [0];
    for (let i = 0; i < rawSource.length; i++) {
      if (rawSource[i] === '\n') {
        lineStarts.push(i + 1);
      }
    }

    const offsetToLineCol = (offset: number): { line: number; col: number } => {
      let low = 0;
      let high = lineStarts.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (lineStarts[mid] <= offset) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      const lineIdx = Math.max(0, high);
      return {
        line: lineIdx + 1,
        col: offset - lineStarts[lineIdx] + 1,
      };
    };

    let searchCursor = 0;
    let lastRawToken = '';
    let lastFoundStart = -1;
    let lastFoundEnd = -1;

    for (const ev of events) {
      const tokenStr = ev.rawToken;
      if (!tokenStr) continue;

      // Chords share the same rawToken across simultaneous chord notes at the same startTime
      if (
        tokenStr === lastRawToken &&
        lastFoundStart !== -1 &&
        tokenStr.startsWith('[')
      ) {
        ev.sourceStartOffset = lastFoundStart;
        ev.sourceEndOffset = lastFoundEnd;
        const loc = offsetToLineCol(lastFoundStart);
        ev.line = loc.line;
        ev.col = loc.col;
        continue;
      }

      let foundIdx = -1;
      let probe = searchCursor;
      while (probe < rawSource.length) {
        const idx = rawSource.indexOf(tokenStr, probe);
        if (idx === -1) break;

        // Ensure match is not inside a %% or // comment on the same line
        const { line } = offsetToLineCol(idx);
        const lineStart = lineStarts[line - 1];
        const linePrefix = rawSource.slice(lineStart, idx);
        if (linePrefix.includes('%%') || linePrefix.includes('//')) {
          const nextNl = rawSource.indexOf('\n', idx);
          if (nextNl === -1) break;
          probe = nextNl + 1;
          continue;
        }

        const charBefore = idx > 0 ? rawSource[idx - 1] : ' ';
        const endIdx = idx + tokenStr.length;
        const charAfter = endIdx < rawSource.length ? rawSource[endIdx] : ' ';
        const validBefore = /[\s:{\[(|<>]/.test(charBefore);
        const validAfter = /[\s|}\])>~]/.test(charAfter);

        if (validBefore && validAfter) {
          foundIdx = idx;
          break;
        }
        probe = idx + 1;
      }

      if (foundIdx !== -1) {
        ev.sourceStartOffset = foundIdx;
        ev.sourceEndOffset = foundIdx + tokenStr.length;
        const loc = offsetToLineCol(foundIdx);
        ev.line = loc.line;
        ev.col = loc.col;
        lastRawToken = tokenStr;
        lastFoundStart = foundIdx;
        lastFoundEnd = foundIdx + tokenStr.length;
        searchCursor = foundIdx + tokenStr.length;
      }
    }
  }

  /**
   * Merges forward-looking tied notes (`~`) of identical pitch on the same track & voice
   * into a single continuous AtomicEvent so tied notes sustain seamlessly across beats and barlines.
   */
  private mergeTiedEvents(events: AtomicEvent[]): AtomicEvent[] {
    const merged: AtomicEvent[] = [];
    const activeTies = new Map<string, AtomicEvent>();

    for (const ev of events) {
      if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer || !ev.startTime) {
        merged.push(ev);
        continue;
      }

      const key = `${ev.trackId || 'pno'}:${ev.voiceId || 'v1'}:${ev.pitch.midi}`;
      const prevTied = activeTies.get(key);

      if (prevTied && prevTied.startTime) {
        const expectedStart = this.addFractions(prevTied.startTime, prevTied.duration);
        const isContiguous =
          expectedStart.numerator * ev.startTime.denominator ===
          ev.startTime.numerator * expectedStart.denominator;

        if (isContiguous) {
          prevTied.duration = this.addFractions(prevTied.duration, ev.duration);
          if (ev.physics?.vibrato && prevTied.physics) prevTied.physics.vibrato = true;
          if (!ev.physics?.tie) {
            activeTies.delete(key);
          }
          continue;
        } else {
          activeTies.delete(key);
        }
      }

      merged.push(ev);
      if (ev.physics?.tie) {
        activeTies.set(key, ev);
      }
    }

    return merged;
  }
}
