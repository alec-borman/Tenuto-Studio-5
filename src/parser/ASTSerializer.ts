import { PitchEngine, PitchResult, TuningConfiguration } from './PitchEngine';
import { TemporalEngine, TemporalResult } from './TemporalEngine';

export type WarpMode = 'beats' | 'tones' | 'texture' | 'repitch' | 'complex' | 'complex_pro';

export interface AutomationEnvelopeSpec {
  param: string;
  controller?: number;
  values: number[];
  curve: string;
}

export interface EventPhysics {
  articulation?: string;
  modifiers?: string[];
  velocity?: number;
  chance?: number;
  velocityRange?: [number, number];
  pickOne?: boolean;
  warpMode?: WarpMode;
  pitchShiftSt?: number;
  formant?: number;
  mpe?: { bend?: number[]; slide?: number[]; pressure?: number[] };
  swell?: 'crescendo' | 'diminuendo';
  startVelocity?: number;
  endVelocity?: number;
  pedal?: boolean;
  arp?: boolean;
  vibrato?: boolean;
  pizz?: boolean;
  fermata?: boolean;
  fp?: boolean;
  legato?: boolean;
  trill?: boolean;
  mordent?: boolean;
  roll?: number;
  pan?: number;
  pushMs?: number;
  pullMs?: number;
  glideMs?: number;
  slice?: number;
  reverse?: boolean;
  stretch?: boolean;
  tie?: boolean;
  fx?: Array<{ type: string; params: Record<string, any> }>;
  cc?: { controller: number; values: number[]; curve: string };
  automations?: AutomationEnvelopeSpec[];
  lyric?: string;
}

export interface AtomicEvent {
  pitch: PitchResult;
  duration: TemporalResult;
  startTime?: { numerator: number; denominator: number };
  rawToken?: string;
  trackId?: string;
  voiceId?: string;
  measureNumber?: number;
  clipId?: string;
  sceneIndex?: number;
  style?: string;
  patch?: string;
  env?: Record<string, string>;
  line?: number;
  col?: number;
  sourceStartOffset?: number;
  sourceEndOffset?: number;
  physics?: EventPhysics;
  astNodeId?: string;
}

export class ASTSerializer {
  private pitchEngine: PitchEngine;
  private temporalEngine: TemporalEngine;

  constructor() {
    this.pitchEngine = new PitchEngine();
    this.temporalEngine = new TemporalEngine();
  }

  public reset(): void {
    this.pitchEngine.reset(4);
    this.temporalEngine.reset();
  }

  public configureTuning(config: TuningConfiguration): void {
    this.pitchEngine.setTuningConfiguration(config);
  }

  private splitModifiers(raw: string): { core: string; modifiers: string[] } {
    const modifiers: string[] = [];
    let current = '';
    let parenDepth = 0;
    let braceDepth = 0;
    let bracketDepth = 0;
    let inQuotes = false;
    let core: string | null = null;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"' && raw[i - 1] !== '\\') {
        inQuotes = !inQuotes;
      }
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
        const nextChar = raw[i + 1] || '';
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

    return { core, modifiers };
  }

  public parseModifiersToPhysics(modifiers: string[], defaultVelocity: number = 80): EventPhysics | undefined {
    if (modifiers.length === 0) return undefined;

    const physics: EventPhysics = {
      modifiers: [...modifiers],
      velocity: defaultVelocity,
    };

    const dynamicVelocities: Record<string, number> = {
      pp: 40,
      p: 60,
      mp: 75,
      mf: 90,
      f: 105,
      ff: 120,
      sfz: 124,
    };

    for (const mod of modifiers) {
      if (['stacc', 'staccato', 'marc', 'ten', 'tenuto', 'accent'].includes(mod)) {
        physics.articulation = mod;
      } else if (mod === 'slur' || mod === 'legato') {
        physics.articulation = mod;
        physics.legato = true;
      } else if (mod === 'pizz' || mod === 'pizzicato') {
        physics.articulation = 'pizz';
        physics.pizz = true;
      } else if (mod === 'ped' || mod === 'pedal') {
        physics.pedal = true;
      } else if (mod === 'arp' || mod === 'strum' || mod === 'rolled') {
        physics.arp = true;
      } else if (mod === 'vib' || mod === 'vibrato') {
        physics.vibrato = true;
      } else if (mod === 'fermata' || mod === 'hold') {
        physics.fermata = true;
      } else if (mod === 'fp' || mod === 'sfp') {
        physics.fp = true;
        physics.velocity = 118;
      } else if (mod === 'tr' || mod === 'trill') {
        physics.trill = true;
      } else if (mod === 'mordent' || mod === 'turn') {
        physics.mordent = true;
      } else if (mod === 'trem' || mod === 'tremolo') {
        physics.roll = 4;
      } else if (mod.startsWith('roll(') && mod.endsWith(')')) {
        const count = parseInt(mod.slice(5, -1), 10);
        if (!isNaN(count) && count > 1) {
          physics.roll = Math.min(16, count);
        }
      } else if (dynamicVelocities[mod] !== undefined) {
        physics.velocity = dynamicVelocities[mod];
      } else if (mod === 'reverse') {
        physics.reverse = true;
      } else if (mod === 'stretch') {
        physics.stretch = true;
      } else if (mod === 'pick_one' || mod === 'chance_group') {
        physics.pickOne = true;
      } else if ((mod.startsWith('chance(') || mod.startsWith('prob(')) && mod.endsWith(')')) {
        const inner = mod.slice(mod.indexOf('(') + 1, -1).trim();
        const isPercent = inner.endsWith('%');
        const rawVal = parseFloat(inner.replace('%', ''));
        if (!isNaN(rawVal)) {
          const normalized = !isPercent && rawVal > 0 && rawVal <= 1 ? rawVal * 100 : rawVal;
          physics.chance = Math.max(0, Math.min(100, Math.round(normalized)));
        }
      } else if (mod.startsWith('vel_range(') && mod.endsWith(')')) {
        const parts = mod
          .slice(10, -1)
          .split(',')
          .map((s) => parseFloat(s.trim()));
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          const low = Math.max(1, Math.min(127, Math.round(Math.min(parts[0], parts[1]))));
          const high = Math.max(1, Math.min(127, Math.round(Math.max(parts[0], parts[1]))));
          physics.velocityRange = [low, high];
          physics.velocity = Math.round((low + high) / 2);
        }
      } else if (mod.startsWith('warp(') && mod.endsWith(')')) {
        const modeRaw = mod.slice(5, -1).trim().replace(/^"|"$/g, '').toLowerCase();
        if (
          modeRaw === 'beats' ||
          modeRaw === 'tones' ||
          modeRaw === 'texture' ||
          modeRaw === 'repitch' ||
          modeRaw === 'complex' ||
          modeRaw === 'complex_pro'
        ) {
          physics.warpMode = modeRaw;
          physics.stretch = true;
        }
      } else if ((mod.startsWith('transpose(') || mod.startsWith('pitch(')) && mod.endsWith(')')) {
        const inner = mod.slice(mod.indexOf('(') + 1, -1).replace(/st|semitones/gi, '').trim();
        const val = parseFloat(inner);
        if (!isNaN(val)) {
          physics.pitchShiftSt = Math.max(-48, Math.min(48, val));
        }
      } else if (mod.startsWith('formant(') && mod.endsWith(')')) {
        const inner = mod.slice(8, -1).replace('%', '').trim();
        const val = parseFloat(inner);
        if (!isNaN(val)) {
          physics.formant = Math.max(-100, Math.min(100, val));
        }
      } else if (mod.startsWith('cc(') && mod.endsWith(')')) {
        const inner = mod.slice(3, -1).trim();
        const ccMatch = inner.match(/^(\d+)\s*,\s*\[([^\]]*)\](?:\s*,\s*"?([a-zA-Z0-9_-]+)"?)?$/);
        if (ccMatch) {
          const controller = parseInt(ccMatch[1], 10);
          const values = ccMatch[2]
            .split(',')
            .map((v) => parseFloat(v.trim()))
            .filter((v) => !isNaN(v));
          const curve = (ccMatch[3] || 'linear').toLowerCase();
          physics.cc = { controller, values, curve };
          if (!physics.automations) physics.automations = [];
          physics.automations.push({
            param: `cc:${controller}`,
            controller,
            values,
            curve,
          });
        }
      } else if (mod.startsWith('automate(') && mod.endsWith(')')) {
        const inner = mod.slice(9, -1).trim();
        const autoMatch = inner.match(/^"?([a-zA-Z0-9_.:-]+)"?\s*,\s*\[([^\]]*)\](?:\s*,\s*"?([a-zA-Z0-9_-]+)"?)?$/);
        if (autoMatch) {
          const param = autoMatch[1].trim();
          const values = autoMatch[2]
            .split(',')
            .map((v) => parseFloat(v.trim()))
            .filter((v) => !isNaN(v));
          const curve = (autoMatch[3] || 'linear').toLowerCase();
          if (!physics.automations) physics.automations = [];
          physics.automations.push({
            param,
            values,
            curve,
          });
        }
      } else if (
        (mod.startsWith('lyric(') || mod.startsWith('word(') || mod.startsWith('vox(')) &&
        mod.endsWith(')')
      ) {
        const inner = mod.slice(mod.indexOf('(') + 1, -1).trim().replace(/^["']|["']$/g, '');
        if (inner) {
          physics.lyric = inner;
        }
      } else if (mod.startsWith('mpe(') && mod.endsWith(')')) {
        const inner = mod.slice(4, -1).trim();
        const mpe: { bend?: number[]; slide?: number[]; pressure?: number[] } = {};
        const parseNumArray = (key: string): number[] | undefined => {
          const m = inner.match(new RegExp(`\\b${key}\\s*:\\s*\\[([^\\]]*)\\]`, 'i'));
          if (!m) return undefined;
          return m[1]
            .split(',')
            .map((s) => parseFloat(s.trim()))
            .filter((n) => !isNaN(n));
        };
        const bend = parseNumArray('bend');
        const slide = parseNumArray('slide');
        const pressure = parseNumArray('pressure');
        if (bend) mpe.bend = bend;
        if (slide) mpe.slide = slide;
        if (pressure) mpe.pressure = pressure;
        physics.mpe = mpe;
      } else if (mod.startsWith('vol(') && mod.endsWith(')')) {
        const val = parseFloat(mod.slice(4, -1));
        if (!isNaN(val)) physics.velocity = Math.max(0, Math.min(127, Math.round(val)));
      } else if (
        mod === 'cresc' ||
        mod === 'crescendo' ||
        mod.startsWith('cresc(') ||
        mod.startsWith('crescendo(')
      ) {
        physics.swell = 'crescendo';
        const openIdx = mod.indexOf('(');
        if (openIdx !== -1 && mod.endsWith(')')) {
          const parts = mod
            .slice(openIdx + 1, -1)
            .split(',')
            .map((s) => parseFloat(s.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            physics.startVelocity = Math.max(1, Math.min(127, Math.round(parts[0])));
            physics.endVelocity = Math.max(1, Math.min(127, Math.round(parts[1])));
            physics.velocity = Math.round((physics.startVelocity + physics.endVelocity) / 2);
          }
        }
        if (physics.startVelocity === undefined || physics.endVelocity === undefined) {
          const base = physics.velocity !== defaultVelocity ? physics.velocity! : 45;
          physics.startVelocity = Math.max(20, Math.min(100, base));
          physics.endVelocity = Math.min(124, physics.startVelocity + 55);
          physics.velocity = Math.round((physics.startVelocity + physics.endVelocity) / 2);
        }
      } else if (
        mod === 'dim' ||
        mod === 'diminuendo' ||
        mod === 'decresc' ||
        mod === 'decrescendo' ||
        mod.startsWith('dim(') ||
        mod.startsWith('diminuendo(')
      ) {
        physics.swell = 'diminuendo';
        const openIdx = mod.indexOf('(');
        if (openIdx !== -1 && mod.endsWith(')')) {
          const parts = mod
            .slice(openIdx + 1, -1)
            .split(',')
            .map((s) => parseFloat(s.trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            physics.startVelocity = Math.max(1, Math.min(127, Math.round(parts[0])));
            physics.endVelocity = Math.max(1, Math.min(127, Math.round(parts[1])));
            physics.velocity = Math.round((physics.startVelocity + physics.endVelocity) / 2);
          }
        }
        if (physics.startVelocity === undefined || physics.endVelocity === undefined) {
          const base = physics.velocity !== defaultVelocity ? physics.velocity! : 110;
          physics.startVelocity = Math.max(50, Math.min(124, base));
          physics.endVelocity = Math.max(20, physics.startVelocity - 55);
          physics.velocity = Math.round((physics.startVelocity + physics.endVelocity) / 2);
        }
      } else if (mod.startsWith('pan(') && mod.endsWith(')')) {
        const val = parseFloat(mod.slice(4, -1));
        if (!isNaN(val)) physics.pan = Math.max(-1, Math.min(1, val));
      } else if (mod.startsWith('pull(') && mod.endsWith(')')) {
        const inner = mod.slice(5, -1).replace(/ms|s|ticks/g, '');
        const val = parseFloat(inner);
        if (!isNaN(val)) physics.pullMs = val;
      } else if (mod.startsWith('push(') && mod.endsWith(')')) {
        const inner = mod.slice(5, -1).replace(/ms|s|ticks/g, '');
        const val = parseFloat(inner);
        if (!isNaN(val)) physics.pushMs = val;
      } else if (mod.startsWith('glide(') && mod.endsWith(')')) {
        const inner = mod.slice(6, -1);
        const val = parseFloat(inner);
        if (!isNaN(val)) {
          physics.glideMs = inner.endsWith('s') && !inner.endsWith('ms') ? val * 1000 : val;
        }
      } else if (mod.startsWith('slice(') && mod.endsWith(')')) {
        const val = parseInt(mod.slice(6, -1), 10);
        if (!isNaN(val)) physics.slice = val;
      } else if (mod.startsWith('fx(') && mod.endsWith(')')) {
        const inner = mod.slice(3, -1);
        const commaIdx = inner.indexOf(',');
        const fxType = (commaIdx !== -1 ? inner.slice(0, commaIdx) : inner).trim().replace(/^"|"$/g, '');
        const params: Record<string, any> = {};
        const dictMatch = inner.match(/@\{([^}]*)\}/);
        if (dictMatch) {
          dictMatch[1].split(',').forEach((pair) => {
            const [k, v] = pair.split(':').map((s) => s.trim());
            if (k && v !== undefined) {
              const cleanV = v.replace(/^"|"$/g, '');
              params[k] = !isNaN(Number(cleanV)) ? Number(cleanV) : cleanV;
            }
          });
        }
        if (!physics.fx) physics.fx = [];
        physics.fx.push({ type: fxType, params });
      }
    }

    return physics;
  }

  public parseToken(token: string, style: string = 'standard'): AtomicEvent {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new Error('Invalid empty token');
    }

    // Reject incomplete trailing colon syntax errors like "f:"
    if (trimmed.endsWith(':')) {
      throw new Error(`Invalid token format, missing duration: ${token}`);
    }

    const hasTie = trimmed.includes('~');
    const withoutTie = trimmed.replace(/~/g, '');

    const { core, modifiers } = this.splitModifiers(withoutTie);
    const colonIdx = core.indexOf(':');

    let pitchStr = core;
    let duration: TemporalResult;

    if (colonIdx !== -1) {
      pitchStr = core.slice(0, colonIdx);
      const durationRawStr = core.slice(colonIdx + 1);
      if (!durationRawStr) {
        throw new Error(`Invalid token format, missing duration: ${token}`);
      }
      duration = this.temporalEngine.parseDuration(':' + durationRawStr);
    } else {
      // Sticky duration inheritance when colon is omitted (e.g. "c4:4 d e")
      duration = this.temporalEngine.getLastDuration();
    }

    const pitch = this.pitchEngine.parsePitch(pitchStr, style);
    const physics = this.parseModifiersToPhysics(modifiers);
    if (hasTie) {
      const mergedPhysics = physics || { modifiers: [] };
      mergedPhysics.tie = true;
      return { pitch, duration, physics: mergedPhysics };
    }

    return physics ? { pitch, duration, physics } : { pitch, duration };
  }
}
