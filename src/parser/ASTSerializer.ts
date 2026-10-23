import { PitchEngine, PitchResult } from './PitchEngine';
import { TemporalEngine, TemporalResult } from './TemporalEngine';

export interface EventPhysics {
  articulation?: string;
  modifiers?: string[];
  velocity?: number;
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
}

export interface AtomicEvent {
  pitch: PitchResult;
  duration: TemporalResult;
  startTime?: { numerator: number; denominator: number };
  rawToken?: string;
  trackId?: string;
  voiceId?: string;
  measureNumber?: number;
  style?: string;
  patch?: string;
  env?: Record<string, string>;
  line?: number;
  col?: number;
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
