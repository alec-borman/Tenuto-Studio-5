import { PitchEngine, PitchResult, TuningConfiguration } from './PitchEngine';
import { TemporalEngine, TemporalResult } from './TemporalEngine';

export type WarpMode = 'beats' | 'tones' | 'texture' | 'repitch' | 'complex' | 'complex_pro';

export interface AutomationEnvelopeSpec {
  param: string;
  controller?: number;
  values: number[];
  curve: string;
}

export interface WindowedModulationSpec {
  peak: number;
  startNorm: number; // 0.0 .. 1.0 within the sustained note
  endNorm: number;   // 0.0 .. 1.0 within the sustained note
  curve?: number[];  // Optional multi-point trajectory across the note
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
  detune?: number;
  detuneMod?: WindowedModulationSpec;
  detuneCents?: number;
  detuneCentsMod?: WindowedModulationSpec;
  cutoff?: number;
  filterSweep?: [number, number];
  cutoffMod?: WindowedModulationSpec;
  resonance?: number;
  flutterRateHz?: number;
  flutterDepth?: number;
  flutterCurve?: number[];
  warbleDepth?: number;
  warbleRateHz?: number;
  pitchDipSt?: number;
  stackMode?: 'octaves' | 'fifths' | 'seventh' | 'super' | 'none';
  noiseLevel?: number;
  noiseColor?: 'white' | 'pink' | 'breath';
  noiseMod?: WindowedModulationSpec;
  syncRatio?: number;
  syncSweep?: [number, number];
  fmAmount?: number;
  fmRatio?: number;
  ringAmount?: number;
  ringFreqHz?: number;
  pwmDuty?: number;
  pwmRateHz?: number;
  waveWarpMode?: 'bend' | 'mirror' | 'quantize';
  waveWarpAmount?: number;
  keytrack?: number;
  combFreqHz?: number;
  combFeedback?: number;
  duckDepth?: number;
  tranceGate?: number[];
  pluckDecayMs?: number;
  pluckSemitones?: number;
  haasDelayMs?: number;
  stereoWidth?: number;
  widthCurve?: number[];
  bassMonoHz?: number;
  analogSlop?: number;
  airSheen?: number;
  preSwell?: boolean;
  openVoice?: boolean;
  driveMod?: WindowedModulationSpec;
  ottAmount?: number;
  reverbThrow?: WindowedModulationSpec;
  echoThrow?: WindowedModulationSpec;
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

  private parseWindowedOrCurveArg(
    inner: string,
    maxNormThreshold: number = 100
  ): { scalar: number; spec: WindowedModulationSpec } | null {
    const trimmed = inner.trim();
    // Case 1: Array curve e.g. [0, 85, 20]
    const arrMatch = trimmed.match(/^\[([^\]]+)\](?:\s*,\s*([0-9.]+)\.\.([0-9.]+))?$/);
    if (arrMatch) {
      const vals = arrMatch[1]
        .split(',')
        .map((s) => parseFloat(s.replace(/%|hz|c|st|ms/gi, '').trim()))
        .filter((n) => !isNaN(n));
      if (vals.length === 0) return null;
      const startNorm = arrMatch[2] !== undefined ? Math.max(0, Math.min(1, parseFloat(arrMatch[2]))) : 0;
      const endNorm = arrMatch[3] !== undefined ? Math.max(startNorm, Math.min(1, parseFloat(arrMatch[3]))) : 1;
      const peak = Math.max(...vals.map((v) => Math.abs(v)));
      return {
        scalar: vals[vals.length - 1],
        spec: { peak, startNorm, endNorm, curve: vals },
      };
    }

    // Case 2: Value with optional window e.g. (85%, 0.35..0.85) or (85)
    const parts = trimmed.split(',').map((s) => s.trim());
    const rawVal = parseFloat(parts[0].replace(/%|hz|c|st|ms/gi, ''));
    if (isNaN(rawVal)) return null;
    const val =
      !parts[0].includes('%') && maxNormThreshold === 100 && rawVal > 0 && rawVal <= 1
        ? rawVal * 100
        : rawVal;

    let startNorm = 0.0;
    let endNorm = 1.0;
    if (parts[1]) {
      const rangeMatch = parts[1].match(/^([0-9.]+)\.\.([0-9.]+)$/);
      if (rangeMatch) {
        startNorm = Math.max(0, Math.min(1, parseFloat(rangeMatch[1])));
        endNorm = Math.max(startNorm, Math.min(1, parseFloat(rangeMatch[2])));
      }
    }

    return {
      scalar: val,
      spec: { peak: val, startNorm, endNorm },
    };
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
      } else if (mod.startsWith('detune(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(7, -1), 100);
        if (parsed) {
          physics.detune = Math.max(0, Math.min(100, parsed.scalar));
          physics.detuneMod = parsed.spec;
        }
      } else if (mod.startsWith('detune_cents(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(13, -1), 1200);
        if (parsed) {
          physics.detuneCents = parsed.scalar;
          physics.detuneCentsMod = parsed.spec;
        }
      } else if (mod.startsWith('cutoff(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(7, -1), 16000);
        if (parsed) {
          physics.cutoff = Math.max(60, Math.min(16000, parsed.scalar));
          physics.cutoffMod = parsed.spec;
        }
      } else if (mod.startsWith('res(') && mod.endsWith(')')) {
        const v = parseFloat(mod.slice(4, -1));
        if (!isNaN(v)) physics.resonance = Math.max(0.5, Math.min(18, v));
      } else if (mod.startsWith('filter(') && mod.endsWith(')')) {
        const inner = mod.slice(7, -1).trim();
        if (inner.startsWith('[')) {
          const parsed = this.parseWindowedOrCurveArg(inner, 16000);
          if (parsed) {
            physics.cutoff = Math.max(60, Math.min(16000, parsed.scalar));
            physics.cutoffMod = parsed.spec;
          }
        } else {
          const parts = inner.split(',').map((s) => parseFloat(s.replace(/hz/gi, '').trim()));
          if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            const c0 = Math.max(60, Math.min(16000, parts[0]));
            const c1 = Math.max(60, Math.min(16000, parts[1]));
            physics.filterSweep = [c0, c1];
            physics.cutoff = Math.round((c0 + c1) / 2);
            physics.cutoffMod = { peak: Math.max(c0, c1), startNorm: 0, endNorm: 1, curve: [c0, c1] };
          } else if (parts.length === 1 && !isNaN(parts[0])) {
            physics.cutoff = Math.max(60, Math.min(16000, parts[0]));
          }
        }
      } else if (mod.startsWith('flutter(') && mod.endsWith(')')) {
        const inner = mod.slice(8, -1).trim();
        const parsed = this.parseWindowedOrCurveArg(inner, 32);
        if (parsed) {
          physics.flutterRateHz = Math.max(1, Math.min(32, parsed.scalar));
          physics.flutterDepth = 0.65;
          if (parsed.spec.curve) physics.flutterCurve = parsed.spec.curve;
        }
      } else if (mod === 'flutter') {
        physics.flutterRateHz = 12;
        physics.flutterDepth = 0.65;
      } else if (mod.startsWith('warble(') && mod.endsWith(')')) {
        const parts = mod.slice(7, -1).split(',').map((s) => parseFloat(s.replace(/%|hz/gi, '').trim()));
        if (!isNaN(parts[0])) physics.warbleDepth = Math.max(0, Math.min(100, parts[0]));
        if (parts[1] !== undefined && !isNaN(parts[1])) physics.warbleRateHz = Math.max(0.2, Math.min(16, parts[1]));
      } else if (mod === 'warble') {
        physics.warbleDepth = 45;
        physics.warbleRateHz = 3.2;
      } else if ((mod.startsWith('pitch_dip(') || mod.startsWith('tapestop(')) && mod.endsWith(')')) {
        const inner = mod.slice(mod.indexOf('(') + 1, -1).replace(/st/gi, '');
        const val = parseFloat(inner);
        if (!isNaN(val)) {
          const dip = val > 0 ? -val : val;
          physics.pitchDipSt = Math.max(-24, Math.min(24, dip));
          physics.mpe = { ...(physics.mpe || {}), bend: [0, 0, physics.pitchDipSt, 0] };
        }
      } else if (mod === 'tapestop' || mod === 'pitch_dip') {
        physics.pitchDipSt = -7;
        physics.mpe = { ...(physics.mpe || {}), bend: [0, 0, -7, 0] };
      } else if (mod.startsWith('stack(') && mod.endsWith(')')) {
        const mode = mod.slice(6, -1).replace(/^["']|["']$/g, '').trim().toLowerCase();
        if (mode === 'octaves' || mode === 'fifths' || mode === 'seventh' || mode === 'super') {
          physics.stackMode = mode;
        }
      } else if (mod.startsWith('noise(') && mod.endsWith(')')) {
        const parts = mod.slice(6, -1).split(',').map((s) => s.trim());
        const lvl = parseFloat(parts[0].replace('%', ''));
        if (!isNaN(lvl)) {
          physics.noiseLevel = lvl > 1 ? lvl / 100 : Math.max(0, Math.min(1, lvl));
        }
        const colorArg = parts.find((p) => /^(?:"|')?(white|pink|breath)(?:"|')?$/i.test(p));
        if (colorArg) {
          physics.noiseColor = colorArg.replace(/["']/g, '').toLowerCase() as 'white' | 'pink' | 'breath';
        }
        const rangeArg = parts.find((p) => /^[0-9.]+\.\.[0-9.]+$/.test(p));
        if (rangeArg) {
          const [sN, eN] = rangeArg.split('..').map(Number);
          physics.noiseMod = { peak: physics.noiseLevel ?? 0.3, startNorm: sN, endNorm: eN };
        }
      } else if (mod.startsWith('sync(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(5, -1), 16);
        if (parsed) {
          physics.syncRatio = Math.max(1, Math.min(16, parsed.scalar));
          if (parsed.spec.curve && parsed.spec.curve.length >= 2) {
            physics.syncSweep = [parsed.spec.curve[0], parsed.spec.curve[parsed.spec.curve.length - 1]];
          }
        }
      } else if (mod.startsWith('fm(') && mod.endsWith(')')) {
        const parts = mod.slice(3, -1).split(',').map((s) => parseFloat(s.replace('%', '').trim()));
        if (!isNaN(parts[0])) physics.fmAmount = parts[0] > 1 ? parts[0] / 100 : parts[0];
        if (parts[1] !== undefined && !isNaN(parts[1])) physics.fmRatio = Math.max(0.25, Math.min(16, parts[1]));
      } else if (mod.startsWith('ring(') && mod.endsWith(')')) {
        const parts = mod.slice(5, -1).split(',').map((s) => parseFloat(s.replace(/%|hz/gi, '').trim()));
        if (!isNaN(parts[0])) physics.ringAmount = parts[0] > 1 ? parts[0] / 100 : parts[0];
        if (parts[1] !== undefined && !isNaN(parts[1])) physics.ringFreqHz = Math.max(20, Math.min(4000, parts[1]));
      } else if (mod.startsWith('pwm(') && mod.endsWith(')')) {
        const parts = mod.slice(4, -1).split(',').map((s) => parseFloat(s.replace(/%|hz/gi, '').trim()));
        if (!isNaN(parts[0])) physics.pwmDuty = Math.max(0.05, Math.min(0.95, parts[0] > 1 ? parts[0] / 100 : parts[0]));
        if (parts[1] !== undefined && !isNaN(parts[1])) physics.pwmRateHz = Math.max(0.1, Math.min(16, parts[1]));
      } else if (mod.startsWith('warp_wave(') && mod.endsWith(')')) {
        const parts = mod.slice(10, -1).split(',').map((s) => s.trim());
        const m = parts[0].replace(/["']/g, '').toLowerCase();
        if (m === 'bend' || m === 'mirror' || m === 'quantize') physics.waveWarpMode = m;
        if (parts[1]) {
          const amt = parseFloat(parts[1].replace('%', ''));
          if (!isNaN(amt)) physics.waveWarpAmount = amt > 1 ? amt / 100 : amt;
        }
      } else if (mod.startsWith('keytrack(') && mod.endsWith(')')) {
        const v = parseFloat(mod.slice(9, -1).replace('%', ''));
        if (!isNaN(v)) physics.keytrack = Math.max(0, Math.min(100, v <= 1 ? v * 100 : v));
      } else if (mod.startsWith('comb(') && mod.endsWith(')')) {
        const parts = mod.slice(5, -1).split(',').map((s) => parseFloat(s.replace(/hz|%/gi, '').trim()));
        if (!isNaN(parts[0])) physics.combFreqHz = Math.max(60, Math.min(4000, parts[0]));
        if (parts[1] !== undefined && !isNaN(parts[1])) {
          physics.combFeedback = Math.max(0.1, Math.min(0.92, parts[1] > 1 ? parts[1] / 100 : parts[1]));
        }
      } else if (mod.startsWith('duck(') && mod.endsWith(')')) {
        const v = parseFloat(mod.slice(5, -1).replace('%', ''));
        if (!isNaN(v)) physics.duckDepth = Math.max(0, Math.min(1, v > 1 ? v / 100 : v));
      } else if (mod === 'duck') {
        physics.duckDepth = 0.78;
      } else if (mod.startsWith('gate(') && mod.endsWith(')')) {
        const inner = mod.slice(5, -1).replace(/[\[\]]/g, '');
        const steps = inner.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
        if (steps.length > 0) physics.tranceGate = steps;
      } else if (mod.startsWith('pluck(') && mod.endsWith(')')) {
        const parts = mod.slice(6, -1).split(',').map((s) => parseFloat(s.replace(/ms|st/gi, '').trim()));
        physics.pluckDecayMs = !isNaN(parts[0]) ? Math.max(4, Math.min(120, parts[0])) : 22;
        physics.pluckSemitones = parts[1] !== undefined && !isNaN(parts[1]) ? parts[1] : 12;
      } else if (mod === 'zap' || mod === 'pluck') {
        physics.pluckDecayMs = 18;
        physics.pluckSemitones = 18;
      } else if (mod.startsWith('haas(') && mod.endsWith(')')) {
        const v = parseFloat(mod.slice(5, -1).replace(/ms/gi, ''));
        if (!isNaN(v)) physics.haasDelayMs = Math.max(0.5, Math.min(35, v));
      } else if (mod.startsWith('width(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(6, -1), 200);
        if (parsed) {
          physics.stereoWidth = Math.max(0, Math.min(200, parsed.scalar));
          if (parsed.spec.curve) physics.widthCurve = parsed.spec.curve;
        }
      } else if (mod.startsWith('analog_slop(') && mod.endsWith(')')) {
        const v = parseFloat(mod.slice(12, -1).replace('%', ''));
        if (!isNaN(v)) physics.analogSlop = Math.max(0, Math.min(100, v <= 1 ? v * 100 : v));
      } else if (mod.startsWith('air(') && mod.endsWith(')')) {
        const v = parseFloat(mod.slice(4, -1).replace('%', ''));
        if (!isNaN(v)) physics.airSheen = Math.max(0, Math.min(100, v <= 1 ? v * 100 : v));
      } else if (mod === 'pre_swell' || mod === 'reverse_swell') {
        physics.preSwell = true;
      } else if (mod === 'open_voice' || mod === 'drop2') {
        physics.openVoice = true;
      } else if (mod.startsWith('drive(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(6, -1), 100);
        if (parsed) physics.driveMod = parsed.spec;
      } else if (mod.startsWith('ott(') && mod.endsWith(')')) {
        const v = parseFloat(mod.slice(4, -1).replace('%', ''));
        if (!isNaN(v)) physics.ottAmount = Math.max(0, Math.min(100, v <= 1 ? v * 100 : v));
      } else if (mod.startsWith('reverb_throw(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(13, -1), 100);
        if (parsed) physics.reverbThrow = parsed.spec;
      } else if (mod.startsWith('echo_throw(') && mod.endsWith(')')) {
        const parsed = this.parseWindowedOrCurveArg(mod.slice(11, -1), 100);
        if (parsed) physics.echoThrow = parsed.spec;
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
