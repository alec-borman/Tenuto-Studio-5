import type { ContinuousVoiceNote } from '../synths/ContinuousSynthEngine';
import { ContinuousSynthEngine } from '../synths/ContinuousSynthEngine';
import { PhonemeEngine } from '../PhonemeEngine';

export type EurorackPatchId =
  | 'mi:plaits_va'
  | 'mi:plaits_waveshaper'
  | 'mi:plaits_fm'
  | 'mi:plaits_grain'
  | 'mi:plaits_additive'
  | 'mi:plaits_swarm'
  | 'mi:plaits_chord'
  | 'mi:plaits_speech'
  | 'mi:plaits_karplus'
  | 'mi:plaits_modal'
  | 'mi:rings_sympathetic'
  | 'mi:clouds_texture';

export interface EurorackPatchSpec {
  id: EurorackPatchId;
  engineLabel: string;
  topologySummary: string;
  primaryMacroLabel: string;
  defaultCutoffHz: number;
  defaultResonance: number;
  defaultHarmonics: number;
  defaultTimbre: number;
  defaultMorph: number;
}

const EURORACK_PATCH_SPECS: Record<EurorackPatchId, EurorackPatchSpec> = {
  'mi:plaits_va': {
    id: 'mi:plaits_va',
    engineLabel: 'Eurorack Macro-Oscillator Virtual Analog (mi:plaits_va)',
    topologySummary: 'Detuned Variable-Slope Saw + Variable-Width Pulse + Sync -> Vactrol LPG',
    primaryMacroLabel: 'HARMONICS (Detune) / TIMBRE (Square PWM) / MORPH (Saw Slope)',
    defaultCutoffHz: 4600,
    defaultResonance: 0.35,
    defaultHarmonics: 0.45,
    defaultTimbre: 0.52,
    defaultMorph: 0.48,
  },
  'mi:plaits_waveshaper': {
    id: 'mi:plaits_waveshaper',
    engineLabel: 'Eurorack Macro-Oscillator Waveshaper/Folder (mi:plaits_waveshaper)',
    topologySummary: 'Triangle Core -> West Coast 4-Stage Diode Wavefolder + Asym Shaper -> LPG',
    primaryMacroLabel: 'HARMONICS (Waveform) / TIMBRE (Wavefolder Gain) / MORPH (Asymmetry)',
    defaultCutoffHz: 5200,
    defaultResonance: 0.32,
    defaultHarmonics: 0.5,
    defaultTimbre: 0.62,
    defaultMorph: 0.35,
  },
  'mi:plaits_fm': {
    id: 'mi:plaits_fm',
    engineLabel: 'Eurorack Macro-Oscillator 2-Op Through-Zero FM (mi:plaits_fm)',
    topologySummary: 'Ratio Quantizer -> Modulator w/ Self-Feedback -> Carrier PM -> LPG',
    primaryMacroLabel: 'HARMONICS (FM Ratio) / TIMBRE (Mod Index) / MORPH (Feedback)',
    defaultCutoffHz: 5800,
    defaultResonance: 0.28,
    defaultHarmonics: 0.5,
    defaultTimbre: 0.55,
    defaultMorph: 0.3,
  },
  'mi:plaits_grain': {
    id: 'mi:plaits_grain',
    engineLabel: 'Eurorack Macro-Oscillator Granular Formant (mi:plaits_grain)',
    topologySummary: 'Zero-Phase Windowed Sine Grainlets + Formant Carrier Sync -> LPG',
    primaryMacroLabel: 'HARMONICS (Formant Ratio) / TIMBRE (Formant Freq) / MORPH (Grain Width)',
    defaultCutoffHz: 5400,
    defaultResonance: 0.3,
    defaultHarmonics: 0.48,
    defaultTimbre: 0.58,
    defaultMorph: 0.44,
  },
  'mi:plaits_additive': {
    id: 'mi:plaits_additive',
    engineLabel: 'Eurorack Macro-Oscillator 24-Harmonic Additive (mi:plaits_additive)',
    topologySummary: '16-Partial Spectral Bump Bank + Chebyshev Harmonic Comb -> LPG',
    primaryMacroLabel: 'HARMONICS (Bump Count) / TIMBRE (Spectral Centroid) / MORPH (Bump Q)',
    defaultCutoffHz: 6200,
    defaultResonance: 0.25,
    defaultHarmonics: 0.55,
    defaultTimbre: 0.5,
    defaultMorph: 0.45,
  },
  'mi:plaits_swarm': {
    id: 'mi:plaits_swarm',
    engineLabel: 'Eurorack Macro-Oscillator 8-Saw Swarm (mi:plaits_swarm)',
    topologySummary: '7 Golden-Ratio Detuned Bandlimited Saws + Sub-Octave Anchor -> Stereo LPG',
    primaryMacroLabel: 'HARMONICS (Pitch Spread) / TIMBRE (High-Pass Brightness) / MORPH (Env Density)',
    defaultCutoffHz: 5100,
    defaultResonance: 0.36,
    defaultHarmonics: 0.52,
    defaultTimbre: 0.64,
    defaultMorph: 0.5,
  },
  'mi:plaits_chord': {
    id: 'mi:plaits_chord',
    engineLabel: 'Eurorack Macro-Oscillator Divide-Down Chord Organ (mi:plaits_chord)',
    topologySummary: '4-Voice Chord Voicing Quantizer + String-Machine Registration -> LPG',
    primaryMacroLabel: 'HARMONICS (Chord Type) / TIMBRE (Organ Registration) / MORPH (Waveform)',
    defaultCutoffHz: 4800,
    defaultResonance: 0.28,
    defaultHarmonics: 0.5,
    defaultTimbre: 0.54,
    defaultMorph: 0.46,
  },
  'mi:plaits_speech': {
    id: 'mi:plaits_speech',
    engineLabel: 'Eurorack Macro-Oscillator SAM/LPC Formant Speech (mi:plaits_speech)',
    topologySummary: 'Glottal Impulse Train -> Parallel F1/F2/F3 Vocal Tract Resonators -> LPG',
    primaryMacroLabel: 'HARMONICS (Vowel Morph) / TIMBRE (Vocal Tract Shift) / MORPH (Glottal Color)',
    defaultCutoffHz: 4900,
    defaultResonance: 0.42,
    defaultHarmonics: 0.45,
    defaultTimbre: 0.52,
    defaultMorph: 0.4,
  },
  'mi:plaits_karplus': {
    id: 'mi:plaits_karplus',
    engineLabel: 'Eurorack Red-Bank Karplus-Strong String Model (mi:plaits_karplus)',
    topologySummary: 'Colored Noise Burst -> Fractional Allpass + One-Pole Damped String Loop -> LPG',
    primaryMacroLabel: 'HARMONICS (Inharmonicity) / TIMBRE (Pluck Brightness) / MORPH (Decay Time)',
    defaultCutoffHz: 5600,
    defaultResonance: 0.25,
    defaultHarmonics: 0.35,
    defaultTimbre: 0.65,
    defaultMorph: 0.6,
  },
  'mi:plaits_modal': {
    id: 'mi:plaits_modal',
    engineLabel: 'Eurorack Red-Bank 24-Mode Struck Mallet Resonator (mi:plaits_modal)',
    topologySummary: 'Mallet Strike Exciter -> 6-Mode Inharmonic Plate/Bell SVF Bank -> Stereo Bus',
    primaryMacroLabel: 'HARMONICS (Material Ratio) / TIMBRE (Mallet Hardness) / MORPH (Modal Decay)',
    defaultCutoffHz: 6800,
    defaultResonance: 0.3,
    defaultHarmonics: 0.52,
    defaultTimbre: 0.62,
    defaultMorph: 0.65,
  },
  'mi:rings_sympathetic': {
    id: 'mi:rings_sympathetic',
    engineLabel: 'Eurorack Sympathetic Strings Resonator (mi:rings_sympathetic)',
    topologySummary: 'Bowed/Plucked Exciter -> 4 Coupled Sympathetic Comb/Modal Strings -> Stereo Spread',
    primaryMacroLabel: 'STRUCTURE (Interval Coupling) / BRIGHTNESS (HF Damping) / DAMPING (Sustain)',
    defaultCutoffHz: 5800,
    defaultResonance: 0.38,
    defaultHarmonics: 0.55,
    defaultTimbre: 0.68,
    defaultMorph: 0.72,
  },
  'mi:clouds_texture': {
    id: 'mi:clouds_texture',
    engineLabel: 'Eurorack Granular Texture Synthesizer (mi:clouds_texture)',
    topologySummary: '4 Overlapping Hann-Windowed Pitch/Formant Grains + Allpass Diffusion Network',
    primaryMacroLabel: 'DENSITY (Grain Overlap) / TEXTURE (Window & Diffusion) / BLEND (Stereo Wash)',
    defaultCutoffHz: 4400,
    defaultResonance: 0.32,
    defaultHarmonics: 0.58,
    defaultTimbre: 0.6,
    defaultMorph: 0.7,
  },
};

const CHORD_SEMITONE_TABLES: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 0.08, 7, 12], // Octaves & Fifth
  [0, 3, 7, 10], // Minor 7
  [0, 4, 7, 11], // Major 7
  [0, 3, 7, 14], // Minor Add9
  [0, 4, 7, 14], // Major Add9
  [0, 5, 7, 12], // Sus4
  [0, 7, 12, 16], // Open Tenth
  [0, 4, 7, 10], // Dominant 7
];

const MODAL_RATIOS = [1.0, 2.0, 2.756, 3.86, 5.18, 6.74];
const MODAL_AMPS = [1.0, 0.54, 0.38, 0.25, 0.16, 0.1];
const MODAL_DECAYS = [2.2, 1.75, 1.35, 1.0, 0.72, 0.5];

function polyBlep(t: number, dt: number): number {
  if (dt <= 0) return 0;
  if (t < dt) {
    const u = t / dt;
    return u + u - u * u - 1.0;
  }
  if (t > 1.0 - dt) {
    const u = (t - 1.0) / dt;
    return u * u + u + u + 1.0;
  }
  return 0.0;
}

function foldSine(x: number, drive: number): number {
  const scaled = x * (1.0 + drive * 3.8);
  return Math.sin(scaled * 0.5 * Math.PI);
}

/**
 * Pure-MIT Eurorack Macro-Oscillator (`Plaits`), Modal/Sympathetic Resonator (`Rings`),
 * and Granular Texture (`Clouds`) Synthesis Engine.
 *
 * Licensing: 100% clean-room MIT TypeScript DSP inspired by Émilie Gillet's
 * MIT-licensed Mutable Instruments Eurorack modules (`plaits`, `rings`, `clouds`).
 */
export class MutablePlaitsEngine {
  public static readonly PATCH_CATALOG: EurorackPatchId[] = Object.keys(
    EURORACK_PATCH_SPECS
  ) as EurorackPatchId[];

  public static isEurorackPatch(patch?: string, style?: string): boolean {
    const cleanStyle = (style || '').trim().toLowerCase();
    if (
      cleanStyle === 'eurorack' ||
      cleanStyle === 'modular' ||
      cleanStyle === 'plaits'
    ) {
      return true;
    }
    const cleanPatch = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!cleanPatch) return false;
    if (cleanPatch.startsWith('mi:') || cleanPatch.startsWith('mi_')) {
      return true;
    }
    return cleanPatch in EURORACK_PATCH_SPECS;
  }

  public static normalizePatchId(patch?: string): EurorackPatchId {
    const raw = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!raw) return 'mi:plaits_va';
    const stripped = raw.replace(/^mi:/, '').replace(/^mi_/, '');
    const candidate = `mi:${stripped}` as EurorackPatchId;
    if (candidate in EURORACK_PATCH_SPECS) {
      return candidate;
    }
    if (stripped.includes('wave') || stripped.includes('fold')) {
      return 'mi:plaits_waveshaper';
    }
    if (stripped.includes('fm')) return 'mi:plaits_fm';
    if (stripped.includes('grain')) return 'mi:plaits_grain';
    if (stripped.includes('add')) return 'mi:plaits_additive';
    if (stripped.includes('swarm')) return 'mi:plaits_swarm';
    if (stripped.includes('chord')) return 'mi:plaits_chord';
    if (stripped.includes('speech') || stripped.includes('vowel') || stripped.includes('formant')) {
      return 'mi:plaits_speech';
    }
    if (stripped.includes('karplus') || stripped.includes('string') || stripped.includes('pluck')) {
      return 'mi:plaits_karplus';
    }
    if (stripped.includes('rings') || stripped.includes('sympathetic')) {
      return 'mi:rings_sympathetic';
    }
    if (stripped.includes('clouds') || stripped.includes('texture')) {
      return 'mi:clouds_texture';
    }
    if (stripped.includes('modal') || stripped.includes('bell') || stripped.includes('mallet')) {
      return 'mi:plaits_modal';
    }
    return 'mi:plaits_va';
  }

  public static getPatchSpec(patch?: string): EurorackPatchSpec {
    const id = this.normalizePatchId(patch);
    return EURORACK_PATCH_SPECS[id];
  }

  public static getTopologySpec(patch?: string): {
    engineLabel: string;
    topologySummary: string;
    primaryMacroLabel: string;
  } {
    const spec = this.getPatchSpec(patch);
    return {
      engineLabel: spec.engineLabel,
      topologySummary: spec.topologySummary,
      primaryMacroLabel: spec.primaryMacroLabel,
    };
  }

  /**
   * Renders a polyphonic or monophonic Eurorack `mi:*` voice into stereo PCM buffers
   * with an internal Vactrol Low-Pass Gate (LPG) and 1st-order DC blocker.
   */
  public static renderVoiceIntoStereo(
    trackLeft: Float32Array,
    trackRight: Float32Array,
    startFrame: number,
    noteFrames: number,
    sampleRate: number,
    _tempoBpm: number,
    voiceSeed: number,
    item: ContinuousVoiceNote
  ): void {
    const endFrame = Math.min(
      trackLeft.length,
      trackRight.length,
      startFrame + noteFrames
    );
    const len = endFrame - startFrame;
    if (len <= 0) return;

    const phys = item.event.physics;
    const macros = item.def?.macros || {};
    const patchId = this.normalizePatchId(item.event.patch || item.def?.patch);
    const spec = EURORACK_PATCH_SPECS[patchId] || EURORACK_PATCH_SPECS['mi:plaits_va'];

    const chordNotes =
      item.chordVoices && item.chordVoices.length > 0
        ? item.chordVoices
        : [
            {
              freq: item.freq,
              midi: item.midi,
              amp: item.amp,
              mpeBend: phys?.mpe?.bend,
            },
          ];

    const numNotes = chordNotes.length;
    const chordScale = 1 / Math.sqrt(Math.max(1, numNotes));
    const dtBase = 1 / Math.max(8000, sampleRate);
    const durSec = Math.max(0.02, item.durSec || len * dtBase);

    const envSpec = item.def?.env;
    const isPercussiveModel =
      patchId === 'mi:plaits_karplus' ||
      patchId === 'mi:plaits_modal' ||
      patchId === 'mi:rings_sympathetic';

    const attackSec = Math.max(
      0.002,
      Number(
        envSpec?.attack ??
          (isPercussiveModel ? 0.003 : patchId === 'mi:clouds_texture' ? 0.08 : 0.012)
      )
    );
    const decaySec = Math.max(0.04, Number(envSpec?.decay ?? (isPercussiveModel ? 0.55 : 0.35)));
    const sustainLevel = Math.max(
      0.0,
      Math.min(
        1.0,
        Number(envSpec?.sustain ?? (isPercussiveModel ? 0.18 : 0.8))
      )
    );
    const releaseSec = Math.max(0.03, Number(envSpec?.release ?? 0.22));

    const baseCutoff = Math.max(
      80,
      Math.min(
        18000,
        Number(
          phys?.cutoff ??
            phys?.filterSweep?.[0] ??
            macros.cutoff ??
            spec.defaultCutoffHz
        )
      )
    );
    const targetCutoff = Math.max(
      80,
      Math.min(18000, Number(phys?.filterSweep?.[1] ?? baseCutoff))
    );
    const resNorm = Math.max(
      0.05,
      Math.min(
        0.92,
        Number(phys?.resonance ?? macros.resonance ?? spec.defaultResonance)
      )
    );

    // Normalize Eurorack HARMONICS / TIMBRE / MORPH macros into [0..1]
    const rawHarmonics =
      macros.harmonics ??
      (phys?.detune !== undefined ? phys.detune : spec.defaultHarmonics * 100);
    const baseHarmonics = Math.max(
      0,
      Math.min(1, Number(rawHarmonics) > 1 ? Number(rawHarmonics) / 100 : Number(rawHarmonics))
    );

    const rawTimbre =
      macros.timbre ??
      (phys?.wavefoldAmount !== undefined
        ? phys.wavefoldAmount
        : phys?.fmAmount !== undefined
          ? phys.fmAmount
          : spec.defaultTimbre * 100);
    const baseTimbre = Math.max(
      0,
      Math.min(1, Number(rawTimbre) > 1 ? Number(rawTimbre) / 100 : Number(rawTimbre))
    );

    const rawMorph =
      macros.morph ??
      (phys?.morphAmount !== undefined ? phys.morphAmount : spec.defaultMorph * 100);
    const baseMorph = Math.max(
      0,
      Math.min(1, Number(rawMorph) > 1 ? Number(rawMorph) / 100 : Number(rawMorph))
    );

    const basePan = Math.max(-1, Math.min(1, item.pan ?? 0));
    const panAngle = (basePan + 1) * 0.25 * Math.PI;
    const gainL = Math.cos(panAngle) * chordScale * 0.56;
    const gainR = Math.sin(panAngle) * chordScale * 0.56;

    let rngState = ((voiceSeed ^ 0x85ebca6b) >>> 0) || 0x2468ace1;
    const nextRand = (): number => {
      rngState ^= rngState << 13;
      rngState ^= rngState >>> 17;
      rngState ^= rngState << 5;
      return ((rngState >>> 0) / 4294967296) * 2 - 1;
    };

    const p1 = new Float64Array(numNotes);
    const p2 = new Float64Array(numNotes);
    const p3 = new Float64Array(numNotes);
    const p4 = new Float64Array(numNotes);
    const fmFbState = new Float64Array(numNotes);

    for (let n = 0; n < numNotes; n++) {
      p1[n] = (nextRand() + 1) * 0.5;
      p2[n] = (nextRand() + 1) * 0.5;
      p3[n] = (nextRand() + 1) * 0.5;
      p4[n] = (nextRand() + 1) * 0.5;
    }

    // Karplus-Strong / Rings delay lines
    const ksLines: Float32Array[] = [];
    const ksWriteIdx = new Int32Array(numNotes);
    const ksLpState = new Float32Array(numNotes);
    const ksApState = new Float32Array(numNotes);
    if (patchId === 'mi:plaits_karplus' || patchId === 'mi:rings_sympathetic') {
      for (let n = 0; n < numNotes; n++) {
        const f0 = Math.max(25, chordNotes[n].freq);
        const delayLen = Math.max(8, Math.min(4096, Math.round(sampleRate / f0)));
        const buf = new Float32Array(delayLen);
        for (let k = 0; k < delayLen; k++) {
          const w = Math.sin((Math.PI * k) / Math.max(1, delayLen - 1));
          buf[k] = nextRand() * 0.85 * (0.4 + 0.6 * w);
        }
        ksLines.push(buf);
      }
    }

    // Clouds allpass diffuser delay lines
    const apLenL = 149;
    const apLenR = 211;
    const apBufL = new Float32Array(apLenL);
    const apBufR = new Float32Array(apLenR);
    let apIdxL = 0;
    let apIdxR = 0;

    // Vowel formants via PhonemeEngine
    const vowelStr =
      typeof phys?.lyric === 'string'
        ? phys.lyric
        : typeof phys?.vowelFormant === 'string'
          ? phys.vowelFormant
          : phys?.vowelFormant?.from || 'a';
    const vowelSpec = PhonemeEngine.decomposeLyric(vowelStr).primaryVowel;

    // Chamberlin 2-pole SVF + Vactrol LPG state
    let svfLowL = 0;
    let svfBandL = 0;
    let svfLowR = 0;
    let svfBandR = 0;

    // 1st-order DC blocker state (R = 0.998)
    let dcInL = 0;
    let dcOutL = 0;
    let dcInR = 0;
    let dcOutR = 0;

    const glideSec = (phys?.glideMs ?? 0) / 1000;
    const glideStartU =
      glideSec > 0 ? Math.max(0.65, 1.0 - glideSec / Math.max(0.05, durSec)) : 1.0;

    const lpgDecaySec = Math.max(
      0.06,
      (phys?.lpg?.decayMs ?? (isPercussiveModel ? 480 : 360)) / 1000
    );
    const lpgMode = phys?.lpg?.mode || 'both';

    for (let i = 0; i < len; i++) {
      const tSec = i * dtBase;
      const uNorm = Math.min(1, i / Math.max(1, len - 1));

      // ADSR + Vactrol LPG envelope
      let env = 1.0;
      if (tSec < attackSec) {
        env = tSec / attackSec;
      } else if (tSec < attackSec + decaySec) {
        const dProg = (tSec - attackSec) / decaySec;
        env = 1.0 - (1.0 - sustainLevel) * dProg;
      } else if (tSec < durSec - releaseSec) {
        env = sustainLevel;
      } else {
        const rProg = Math.min(
          1,
          Math.max(0, (tSec - Math.max(0, durSec - releaseSec)) / releaseSec)
        );
        env = sustainLevel * (1.0 - rProg);
      }

      if (item.swell === 'crescendo') {
        env *= 0.35 + 0.65 * uNorm;
      } else if (item.swell === 'diminuendo') {
        env *= 1.0 - 0.65 * uNorm;
      }

      const vactrolDecay = Math.exp(-tSec / lpgDecaySec);
      const lpgLevel =
        lpgMode === 'vca'
          ? env
          : Math.min(1.0, env * (0.68 + 0.32 * vactrolDecay));

      const morphMod = phys?.morphMod
        ? ContinuousSynthEngine.evaluateWindowedModulation(phys.morphMod, uNorm, 0) / 100
        : baseMorph;
      const timbreMod = phys?.detuneMod
        ? ContinuousSynthEngine.evaluateWindowedModulation(phys.detuneMod, uNorm, 0) / 100
        : baseTimbre;

      // Vactrol couples amplitude to low-pass filter cutoff
      const sweepCutoff = baseCutoff + (targetCutoff - baseCutoff) * uNorm;
      const lpgCutoffScale =
        lpgMode === 'vca' ? 1.0 : 0.25 + 0.75 * Math.pow(lpgLevel, 0.65);
      const instCutoff = Math.max(90, Math.min(18000, sweepCutoff * lpgCutoffScale));

      const vibOffset = phys?.vibrato
        ? Math.sin(2 * Math.PI * 5.4 * tSec) * 0.0038
        : 0;

      let sigL = 0;
      let sigR = 0;

      for (let n = 0; n < numNotes; n++) {
        const cn = chordNotes[n];
        let bendSemis = 0;
        const bendArr = cn.mpeBend || phys?.mpe?.bend;
        if (bendArr && bendArr.length > 0) {
          const targetBend = bendArr[bendArr.length - 1] || 0;
          if (uNorm >= glideStartU) {
            const gProg = (uNorm - glideStartU) / Math.max(0.001, 1.0 - glideStartU);
            const smooth = gProg * gProg * (3 - 2 * gProg);
            bendSemis = targetBend * smooth;
          }
        }

        const fBase = Math.max(
          20,
          Math.min(16000, cn.freq * Math.pow(2, bendSemis / 12) * (1 + vibOffset))
        );
        const dt = fBase * dtBase;
        const noteAmp = Math.max(0.05, Math.min(1.5, cn.amp || item.amp || 0.75));

        let voiceL = 0;
        let voiceR = 0;

        switch (patchId) {
          case 'mi:plaits_va': {
            const spread = 1 + (0.0015 + baseHarmonics * 0.009);
            const d1 = dt;
            const d2 = dt * spread;
            const dSub = dt * 0.5;
            p1[n] = (p1[n] + d1) % 1.0;
            p2[n] = (p2[n] + d2) % 1.0;
            p3[n] = (p3[n] + dSub) % 1.0;

            const pw = 0.15 + 0.7 * timbreMod;
            const saw1 = 2 * p1[n] - 1 - polyBlep(p1[n], d1);
            const pulse2 =
              (p2[n] < pw ? 1 : -1) +
              polyBlep(p2[n], d2) -
              polyBlep((p2[n] + 1.0 - pw) % 1.0, d2);
            const subWave = Math.sin(2 * Math.PI * p3[n]) * 0.24;

            const mixA = saw1 * (1 - morphMod * 0.45) + pulse2 * (0.45 + morphMod * 0.45);
            const mixB = pulse2 * (1 - morphMod * 0.45) + saw1 * (0.45 + morphMod * 0.45);
            voiceL = (mixA * 0.48 + subWave) * noteAmp;
            voiceR = (mixB * 0.48 + subWave) * noteAmp;
            break;
          }

          case 'mi:plaits_waveshaper': {
            p1[n] = (p1[n] + dt) % 1.0;
            p2[n] = (p2[n] + dt * 1.002) % 1.0;
            const tri1 = 1 - 4 * Math.abs(Math.round(p1[n] - 0.25) - (p1[n] - 0.25));
            const sine2 = Math.sin(2 * Math.PI * p2[n]);
            const rawL = tri1 * (1 - baseHarmonics * 0.5) + sine2 * (baseHarmonics * 0.5);
            const rawR = sine2 * (1 - baseHarmonics * 0.5) + tri1 * (baseHarmonics * 0.5);
            const asym = (morphMod - 0.5) * 0.35;
            const foldedL = foldSine(rawL + asym, timbreMod * (1 + vactrolDecay * 0.5)) - Math.sin(asym * 0.5 * Math.PI);
            const foldedR = foldSine(rawR - asym, timbreMod * (1 + vactrolDecay * 0.5)) + Math.sin(asym * 0.5 * Math.PI);
            voiceL = foldedL * 0.62 * noteAmp;
            voiceR = foldedR * 0.62 * noteAmp;
            break;
          }

          case 'mi:plaits_fm': {
            const ratios = [0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0, 7.0];
            const rIdx = Math.min(ratios.length - 1, Math.floor(baseHarmonics * ratios.length));
            const modRatio = ratios[rIdx];
            const modDt = dt * modRatio;
            p1[n] = (p1[n] + dt) % 1.0;
            p2[n] = (p2[n] + modDt) % 1.0;

            const fb = (morphMod - 0.3) * 1.4;
            const modIdx = (0.4 + timbreMod * 3.8) * (0.45 + 0.55 * vactrolDecay);
            const modWave = Math.sin(2 * Math.PI * p2[n] + fmFbState[n] * fb);
            fmFbState[n] = modWave;

            const carL = Math.sin(2 * Math.PI * p1[n] + modWave * modIdx);
            const carR = Math.sin(2 * Math.PI * p1[n] + modWave * modIdx * 0.94 + 0.22);
            voiceL = carL * 0.58 * noteAmp;
            voiceR = carR * 0.58 * noteAmp;
            break;
          }

          case 'mi:plaits_grain': {
            p1[n] = (p1[n] + dt) % 1.0;
            const formantFreq = Math.min(
              sampleRate * 0.42,
              fBase * (1.5 + timbreMod * 6.5)
            );
            const formantPhase = (p1[n] * (formantFreq / fBase)) % 1.0;
            const windowWidth = Math.max(1.2, 1.5 + morphMod * 6.0);
            const win = Math.exp(-p1[n] * windowWidth) * Math.sin(Math.PI * p1[n]);
            const grainL =
              Math.sin(2 * Math.PI * formantPhase) * win +
              Math.sin(2 * Math.PI * p1[n]) * 0.35;
            const grainR =
              Math.cos(2 * Math.PI * formantPhase) * win +
              Math.sin(2 * Math.PI * p1[n]) * 0.35;
            voiceL = grainL * 0.68 * noteAmp;
            voiceR = grainR * 0.68 * noteAmp;
            break;
          }

          case 'mi:plaits_additive': {
            p1[n] = (p1[n] + dt) % 1.0;
            const basePhase = 2 * Math.PI * p1[n];
            const centerHarm = 1.0 + timbreMod * 10.0;
            const width = Math.max(1.2, 4.5 - morphMod * 3.0);
            let sumL = 0;
            let sumR = 0;
            for (let h = 1; h <= 12; h++) {
              if (h * fBase > sampleRate * 0.44) break;
              const dist = (h - centerHarm) / width;
              const bump = Math.exp(-0.5 * dist * dist);
              const amp = (1 / Math.pow(h, 0.55)) * (0.25 + 0.75 * bump);
              const harmWave = Math.sin(basePhase * h);
              if (h % 2 === 1) {
                sumL += harmWave * amp;
                sumR += harmWave * amp * 0.85;
              } else {
                sumL += harmWave * amp * 0.85;
                sumR += harmWave * amp;
              }
            }
            voiceL = sumL * 0.36 * noteAmp;
            voiceR = sumR * 0.36 * noteAmp;
            break;
          }

          case 'mi:plaits_swarm': {
            const spread = 0.002 + baseHarmonics * 0.014;
            const d0 = dt;
            const d1 = dt * (1 - spread * 0.618);
            const d2 = dt * (1 + spread * 0.676);
            const d3 = dt * (1 - spread * 1.12);
            const d4 = dt * (1 + spread * 1.24);
            p1[n] = (p1[n] + d0) % 1.0;
            p2[n] = (p2[n] + d1) % 1.0;
            p3[n] = (p3[n] + d2) % 1.0;
            p4[n] = (p4[n] + d3) % 1.0;
            fmFbState[n] = (fmFbState[n] + d4) % 1.0;

            const s0 = 2 * p1[n] - 1 - polyBlep(p1[n], d0);
            const s1 = 2 * p2[n] - 1 - polyBlep(p2[n], d1);
            const s2 = 2 * p3[n] - 1 - polyBlep(p3[n], d2);
            const s3 = 2 * p4[n] - 1 - polyBlep(p4[n], d3);
            const s4 = 2 * fmFbState[n] - 1 - polyBlep(fmFbState[n], d4);

            voiceL = (s0 * 0.45 + s1 * 0.35 + s3 * 0.28 + s2 * 0.14) * 0.52 * noteAmp;
            voiceR = (s0 * 0.45 + s2 * 0.35 + s4 * 0.28 + s1 * 0.14) * 0.52 * noteAmp;
            break;
          }

          case 'mi:plaits_chord': {
            const tableIdx = Math.min(
              CHORD_SEMITONE_TABLES.length - 1,
              Math.floor(baseHarmonics * CHORD_SEMITONE_TABLES.length)
            );
            const chordSemis = CHORD_SEMITONE_TABLES[tableIdx];
            const c0 = dt * Math.pow(2, chordSemis[0] / 12);
            const c1 = dt * Math.pow(2, chordSemis[1] / 12);
            const c2 = dt * Math.pow(2, chordSemis[2] / 12);
            const c3 = dt * Math.pow(2, chordSemis[3] / 12);

            p1[n] = (p1[n] + c0) % 1.0;
            p2[n] = (p2[n] + c1) % 1.0;
            p3[n] = (p3[n] + c2) % 1.0;
            p4[n] = (p4[n] + c3) % 1.0;

            const w0 =
              (2 * p1[n] - 1 - polyBlep(p1[n], c0)) * morphMod +
              Math.sin(2 * Math.PI * p1[n]) * (1 - morphMod);
            const w1 =
              (2 * p2[n] - 1 - polyBlep(p2[n], c1)) * morphMod +
              Math.sin(2 * Math.PI * p2[n]) * (1 - morphMod);
            const w2 =
              (2 * p3[n] - 1 - polyBlep(p3[n], c2)) * morphMod +
              Math.sin(2 * Math.PI * p3[n]) * (1 - morphMod);
            const w3 =
              (2 * p4[n] - 1 - polyBlep(p4[n], c3)) * morphMod +
              Math.sin(2 * Math.PI * p4[n]) * (1 - morphMod);

            voiceL = (w0 * 0.38 + w1 * 0.32 + w2 * 0.22 + w3 * 0.18) * 0.58 * noteAmp;
            voiceR = (w0 * 0.38 + w2 * 0.32 + w3 * 0.22 + w1 * 0.18) * 0.58 * noteAmp;
            break;
          }

          case 'mi:plaits_speech': {
            p1[n] = (p1[n] + dt) % 1.0;
            const tractScale = 0.8 + timbreMod * 0.45;
            const f1 = vowelSpec.f1 * tractScale;
            const f2 = vowelSpec.f2 * tractScale;
            const f3 = vowelSpec.f3 * tractScale;

            p2[n] = (p2[n] + f1 * dtBase) % 1.0;
            p3[n] = (p3[n] + f2 * dtBase) % 1.0;
            p4[n] = (p4[n] + f3 * dtBase) % 1.0;

            const glottalWin = Math.exp(-p1[n] * (2.6 + morphMod * 3.0));
            const v1 = Math.sin(2 * Math.PI * p2[n]) * 0.58;
            const v2 = Math.sin(2 * Math.PI * p3[n]) * 0.34;
            const v3 = Math.sin(2 * Math.PI * p4[n]) * 0.18;
            const fundamental = Math.sin(2 * Math.PI * p1[n]) * 0.28;

            voiceL = ((v1 + v2 + v3) * glottalWin + fundamental) * 0.65 * noteAmp;
            voiceR = ((v1 + v2 * 0.9 + v3 * 1.1) * glottalWin + fundamental) * 0.65 * noteAmp;
            break;
          }

          case 'mi:plaits_karplus': {
            const buf = ksLines[n];
            if (buf && buf.length > 0) {
              const idx = ksWriteIdx[n] % buf.length;
              const nextIdx = (idx + 1) % buf.length;
              const cur = buf[idx];
              const nxt = buf[nextIdx];
              const avg = 0.5 * (cur + nxt);
              const damp = 0.15 + (1 - timbreMod) * 0.55;
              ksLpState[n] = ksLpState[n] * damp + avg * (1 - damp);
              const decayFeedback = 0.986 + morphMod * 0.0125;
              buf[idx] = ksLpState[n] * Math.min(0.9992, decayFeedback);
              ksWriteIdx[n] = nextIdx;
              voiceL = cur * 0.78 * noteAmp;
              voiceR = nxt * 0.78 * noteAmp;
            }
            break;
          }

          case 'mi:plaits_modal': {
            const strike = Math.exp(-tSec * 90) * nextRand() * 0.35;
            const inharm = 0.85 + baseHarmonics * 0.35;
            let mSumL = strike;
            let mSumR = strike;
            for (let m = 0; m < MODAL_RATIOS.length; m++) {
              const ratio = m === 0 ? 1.0 : Math.pow(MODAL_RATIOS[m], inharm);
              const mFreq = fBase * ratio;
              if (mFreq < sampleRate * 0.45) {
                const mDecay = MODAL_DECAYS[m] * (0.5 + morphMod * 1.2);
                const mEnv = Math.exp(-tSec / Math.max(0.05, mDecay));
                const sig =
                  Math.sin(2 * Math.PI * mFreq * tSec + m * 0.55) *
                  MODAL_AMPS[m] *
                  mEnv;
                if (m % 2 === 0) {
                  mSumL += sig;
                  mSumR += sig * 0.72;
                } else {
                  mSumL += sig * 0.72;
                  mSumR += sig;
                }
              }
            }
            voiceL = mSumL * 0.45 * noteAmp;
            voiceR = mSumR * 0.45 * noteAmp;
            break;
          }

          case 'mi:rings_sympathetic': {
            const buf = ksLines[n];
            let stringOut = 0;
            if (buf && buf.length > 0) {
              const idx = ksWriteIdx[n] % buf.length;
              const nextIdx = (idx + 1) % buf.length;
              const cur = buf[idx];
              const nxt = buf[nextIdx];
              const avg = 0.5 * (cur + nxt);
              const damp = 0.12 + (1 - timbreMod) * 0.45;
              ksLpState[n] = ksLpState[n] * damp + avg * (1 - damp);
              const apCoeff = 0.35 * (baseHarmonics - 0.5);
              const apOut = -apCoeff * ksLpState[n] + ksApState[n];
              ksApState[n] = ksLpState[n] + apCoeff * apOut;
              buf[idx] = apOut * (0.992 + morphMod * 0.0072);
              ksWriteIdx[n] = nextIdx;
              stringOut = cur;
            }
            // Coupled sympathetic fifth & octave partial resonators
            p1[n] = (p1[n] + dt) % 1.0;
            p2[n] = (p2[n] + dt * 1.4983) % 1.0;
            p3[n] = (p3[n] + dt * 2.0) % 1.0;
            const sympDecay = Math.exp(-tSec / (0.8 + morphMod * 1.8));
            const sympL =
              (Math.sin(2 * Math.PI * p1[n]) * 0.35 +
                Math.sin(2 * Math.PI * p2[n]) * 0.22) *
              sympDecay;
            const sympR =
              (Math.sin(2 * Math.PI * p1[n]) * 0.35 +
                Math.sin(2 * Math.PI * p3[n]) * 0.22) *
              sympDecay;
            voiceL = (stringOut * 0.62 + sympL) * 0.72 * noteAmp;
            voiceR = (stringOut * 0.62 + sympR) * 0.72 * noteAmp;
            break;
          }

          case 'mi:clouds_texture': {
            const grainRate = Math.max(2.5, 4.0 + baseHarmonics * 14.0);
            const gPhase1 = (tSec * grainRate + n * 0.25) % 1.0;
            const gPhase2 = (gPhase1 + 0.5) % 1.0;
            const hann1 = 0.5 * (1 - Math.cos(2 * Math.PI * gPhase1));
            const hann2 = 0.5 * (1 - Math.cos(2 * Math.PI * gPhase2));

            p1[n] = (p1[n] + dt) % 1.0;
            p2[n] = (p2[n] + dt * 1.0035) % 1.0;
            p3[n] = (p3[n] + dt * 2.0) % 1.0;
            p4[n] = (p4[n] + dt * 0.5) % 1.0;

            const gA =
              Math.sin(2 * Math.PI * p1[n]) * 0.55 +
              Math.sin(2 * Math.PI * p3[n]) * (0.25 * timbreMod);
            const gB =
              Math.sin(2 * Math.PI * p2[n]) * 0.55 +
              Math.sin(2 * Math.PI * p4[n]) * (0.25 * morphMod);

            voiceL = (gA * hann1 + gB * hann2) * 0.68 * noteAmp;
            voiceR = (gB * hann1 + gA * hann2) * 0.68 * noteAmp;
            break;
          }
        }

        sigL += voiceL;
        sigR += voiceR;
      }

      // Clouds Allpass Diffuser Network
      if (patchId === 'mi:clouds_texture') {
        const dL = apBufL[apIdxL];
        const gAp = 0.52;
        const outApL = -gAp * sigL + dL;
        apBufL[apIdxL] = sigL + gAp * outApL;
        apIdxL = (apIdxL + 1) % apLenL;

        const dR = apBufR[apIdxR];
        const outApR = -gAp * sigR + dR;
        apBufR[apIdxR] = sigR + gAp * outApR;
        apIdxR = (apIdxR + 1) % apLenR;

        sigL = sigL * 0.55 + outApL * 0.45;
        sigR = sigR * 0.55 + outApR * 0.45;
      }

      // 2-Pole Chamberlin SVF Low-Pass (`LPG` Filter)
      const fCoeff = Math.min(
        0.78,
        2 * Math.sin(Math.PI * Math.min(0.42, instCutoff * dtBase))
      );
      const qDamp = Math.max(0.15, 1.0 - resNorm * 0.76);

      svfLowL += fCoeff * svfBandL;
      const highL = sigL - svfLowL - qDamp * svfBandL;
      svfBandL += fCoeff * highL;

      svfLowR += fCoeff * svfBandR;
      const highR = sigR - svfLowR - qDamp * svfBandR;
      svfBandR += fCoeff * highR;

      const rawOutL =
        patchId === 'mi:plaits_modal' || patchId === 'mi:rings_sympathetic'
          ? (sigL * 0.6 + svfLowL * 0.4) * lpgLevel
          : svfLowL * lpgLevel;
      const rawOutR =
        patchId === 'mi:plaits_modal' || patchId === 'mi:rings_sympathetic'
          ? (sigR * 0.6 + svfLowR * 0.4) * lpgLevel
          : svfLowR * lpgLevel;

      // 1st-Order DC-Blocking High-Pass Filter (R = 0.998)
      const cleanL = rawOutL - dcInL + 0.998 * dcOutL;
      dcInL = rawOutL;
      dcOutL = cleanL;

      const cleanR = rawOutR - dcInR + 0.998 * dcOutR;
      dcInR = rawOutR;
      dcOutR = cleanR;

      const idx = startFrame + i;
      trackLeft[idx] += cleanL * gainL;
      trackRight[idx] += cleanR * gainR;
    }
  }
}
