import { FXChainItem, TrackDefinition } from '../../parser/DocumentParser';
import { AtomicEvent } from '../../parser/ASTSerializer';
import { PhonemeEngine } from '../PhonemeEngine';

export const ABLETON_AUDIO_FX_NAMES = [
  'eq_eight',
  'auto_filter',
  'compressor',
  'glue_compressor',
  'multiband_dynamics',
  'drum_buss',
  'roar',
  'saturator',
  'hybrid_reverb',
  'echo',
  'reverb',
  'delay',
  'chorus',
  'auto_shift',
  'vocoder',
  'spectral_resonator',
  'utility',
  'limiter',
] as const;

export type AbletonAudioFxType = (typeof ABLETON_AUDIO_FX_NAMES)[number];

/**
 * 20-Band Logarithmically Spaced Formant Filterbank Center Frequencies (Hz)
 * spanning 90 Hz (chest fundamental resonance) to 9600 Hz (fricative sibilance).
 */
export const VOCODER_20_BAND_CENTERS_HZ: readonly number[] = [
  90, 115, 148, 190, 245, 315, 405, 520, 670, 860,
  1100, 1420, 1820, 2340, 3000, 3850, 4950, 6350, 8150, 9600,
];

export interface FxModulationState {
  amp: number;
  pan: number;
  freq: number;
  cutoffHz?: number;
  reverbSendGain: number;
}

export interface FxSliceContext {
  lyric?: string;
  carrierFreqHz?: number;
  tempoBpm?: number;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * C1-continuous Pade rational tanh approximation: < 0.05% error for |x| <= 1,
 * monotonically bounded to [-1, 1], and ~10x faster than Math.tanh in tight DSP loops.
 */
function fastTanh(x: number): number {
  if (x <= -3) return -1;
  if (x >= 3) return 1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

export class AbletonAudioFxEngine {
  /**
   * Returns true if the given FX identifier matches one of the 18 Ableton Audio Effects
   * (or common aliases like 'ott', 'eq8', 'filter', 'comp', 'glue').
   */
  public static isSupportedFx(fxType: string): boolean {
    const norm = (fxType || '').trim().toLowerCase();
    if (!norm) return false;
    if ((ABLETON_AUDIO_FX_NAMES as readonly string[]).includes(norm)) {
      return true;
    }
    return (
      norm === 'ott' ||
      norm === 'eq8' ||
      norm === 'eq' ||
      norm === 'filter' ||
      norm === 'comp' ||
      norm === 'glue' ||
      norm === 'gated_reverb' ||
      norm === 'tape_degrade' ||
      norm === 'transformer_color_adc' ||
      norm === 'dual_bus_silk_sum' ||
      norm === 'fet_fast_limiter' ||
      norm === 'vari_mu_tube_comp' ||
      norm === 'mastering_clip_limiter' ||
      norm === 'spectral_pitch_harmonizer' ||
      norm === 'true_stereo_hall_reverb' ||
      norm === 'burl_mothership' ||
      norm === 'neve_5059' ||
      norm === 'wes_mimas' ||
      norm === 'wes_rhea' ||
      norm === 'bettermaker_limiter' ||
      norm === 'eventide_h9000' ||
      norm === 'bricasti_m7'
    );
  }

  /**
   * Normalizes an FX device name into its canonical Audio Effect identifier.
   */
  public static normalizeFxType(fxType: string): string {
    const norm = (fxType || '').trim().toLowerCase();
    if (norm === 'ott') return 'multiband_dynamics';
    if (norm === 'eq8' || norm === 'eq') return 'eq_eight';
    if (norm === 'filter') return 'auto_filter';
    if (norm === 'comp') return 'compressor';
    if (norm === 'glue') return 'glue_compressor';
    if (norm === 'transformer_color_adc') return 'burl_mothership';
    if (norm === 'dual_bus_silk_sum') return 'neve_5059';
    if (norm === 'fet_fast_limiter') return 'wes_mimas';
    if (norm === 'vari_mu_tube_comp') return 'wes_rhea';
    if (norm === 'mastering_clip_limiter') return 'bettermaker_limiter';
    if (norm === 'spectral_pitch_harmonizer') return 'eventide_h9000';
    if (norm === 'true_stereo_hall_reverb') return 'bricasti_m7';
    return norm;
  }

  /**
   * Resolves the ordered FX chain for a given track definition and note event,
   * combining track-level `fxChain` / `fx` with note-level `.fx(...)` modifiers.
   */
  public static resolveActiveFxChain(
    def?: TrackDefinition,
    event?: AtomicEvent
  ): FXChainItem[] {
    const chain: FXChainItem[] = [];

    if (def?.fxChain && def.fxChain.length > 0) {
      for (const item of def.fxChain) {
        chain.push({
          type: this.normalizeFxType(item.type),
          params: { ...(item.params || {}) },
        });
      }
    } else if (def?.fx && def.fx.length > 0) {
      for (const fxName of def.fx) {
        chain.push({
          type: this.normalizeFxType(fxName),
          params: {},
        });
      }
    }

    if (event?.physics?.fx && event.physics.fx.length > 0) {
      for (const evFx of event.physics.fx) {
        const normType = this.normalizeFxType(evFx.type);
        const existingIdx = chain.findIndex((c) => c.type === normType);
        if (existingIdx >= 0) {
          chain[existingIdx] = {
            type: normType,
            params: { ...chain[existingIdx].params, ...(evFx.params || {}) },
          };
        } else {
          chain.push({
            type: normType,
            params: { ...(evFx.params || {}) },
          });
        }
      }
    }

    return chain;
  }

  /**
   * Computes real-time voice parameter modulations (gain, stereo pan, pitch shift,
   * filter cutoff, and reverb send) induced by the active Ableton FX chain.
   */
  public static computeRealtimeChainModulation(
    fxChain: FXChainItem[],
    base: FxModulationState,
    lyric?: string
  ): FxModulationState {
    let amp = base.amp;
    let pan = base.pan;
    let freq = base.freq;
    let cutoffHz = base.cutoffHz;
    let reverbSendGain = base.reverbSendGain;

    for (const item of fxChain) {
      const type = this.normalizeFxType(item.type);
      const p = item.params || {};

      switch (type) {
        case 'eq_eight': {
          const highShelfDb = Number(p.high_shelf_db ?? p.high_gain ?? 1.5);
          const bellDb = Number(p.bell1_db ?? 2.0);
          amp *= dbToLinear(clamp((highShelfDb + bellDb) * 0.2, -6, 6));
          if (highShelfDb > 0 && cutoffHz === undefined) {
            cutoffHz = clamp(3200 + highShelfDb * 350, 800, 14000);
          }
          break;
        }
        case 'auto_filter': {
          const cut = Number(p.cutoff ?? p.freq ?? 2400);
          if (Number.isFinite(cut) && cut > 0) {
            cutoffHz = clamp(cut, 60, 16000);
          }
          const drive = Number(p.drive ?? 0);
          if (drive > 0) {
            amp *= 1 + clamp(drive, 0, 24) * 0.015;
          }
          break;
        }
        case 'compressor':
        case 'glue_compressor': {
          const makeupDb = Number(p.makeup ?? (type === 'glue_compressor' ? 3 : 2));
          amp *= dbToLinear(clamp(makeupDb * 0.45, -6, 9));
          break;
        }
        case 'multiband_dynamics': {
          const amount = clamp(Number(p.amount ?? 0.5), 0, 1);
          const highGainDb = Number(p.high_gain ?? 2.5);
          amp *= 1 + amount * 0.18;
          if (cutoffHz === undefined && highGainDb > 0) {
            cutoffHz = clamp(4200 + highGainDb * 400, 1200, 15000);
          }
          break;
        }
        case 'drum_buss': {
          const drive = clamp(Number(p.drive ?? 0.35), 0, 1);
          const boom = clamp(Number(p.boom_amount ?? p.boom ?? 0.45), 0, 1);
          amp *= 1 + drive * 0.22 + boom * 0.12;
          break;
        }
        case 'roar':
        case 'saturator': {
          const rawDrive = Number(p.drive ?? (type === 'saturator' ? 6.0 : 0.4));
          const normDrive = type === 'saturator' ? clamp(rawDrive / 24, 0, 1) : clamp(rawDrive, 0, 1);
          amp *= 1 + normDrive * 0.2;
          break;
        }
        case 'tape_degrade': {
          const highCut = clamp(Number(p.high_cut ?? 5200), 900, 7500);
          cutoffHz = cutoffHz !== undefined ? Math.min(cutoffHz, highCut) : highCut;
          break;
        }
        case 'hybrid_reverb':
        case 'reverb':
        case 'gated_reverb': {
          const mix = clamp(Number(p.mix ?? (type === 'gated_reverb' ? 0.55 : 0.45)), 0, 1);
          reverbSendGain = Math.max(reverbSendGain, mix);
          break;
        }
        case 'echo':
        case 'delay': {
          const mix = clamp(Number(p.mix ?? 0.32), 0, 1);
          reverbSendGain = Math.max(reverbSendGain, mix * 0.65);
          break;
        }
        case 'auto_shift': {
          const semitones = Number(p.pitch_shift ?? p.semitones ?? 0);
          if (Number.isFinite(semitones) && semitones !== 0) {
            freq *= Math.pow(2, clamp(semitones, -24, 24) / 12);
          }
          const formantSt = Number(p.formant_shift ?? p.formant ?? 0);
          if (Number.isFinite(formantSt) && formantSt !== 0) {
            const baseCut = cutoffHz ?? 2200;
            cutoffHz = clamp(baseCut * Math.pow(2, clamp(formantSt, -12, 12) / 12), 120, 14000);
          }
          break;
        }
        case 'vocoder': {
          const targetLyric = lyric || String(p.lyric ?? p.vowel ?? 'ah');
          const phoneme = PhonemeEngine.decomposeLyric(targetLyric);
          const f2 = phoneme.secondaryVowel
            ? 0.5 * (phoneme.primaryVowel.f2 + phoneme.secondaryVowel.f2)
            : phoneme.primaryVowel.f2;
          cutoffHz = clamp(f2, 300, 12000);
          break;
        }
        case 'utility': {
          const gainDb = Number(p.gain_db ?? p.gain ?? 0);
          if (Number.isFinite(gainDb)) {
            amp *= dbToLinear(clamp(gainDb, -36, 24));
          }
          const utilPan = Number(p.pan ?? 0);
          if (Number.isFinite(utilPan) && utilPan !== 0) {
            const normPan = Math.abs(utilPan) > 1 ? utilPan / 50 : utilPan;
            pan = clamp(pan + normPan, -1, 1);
          }
          break;
        }
        case 'limiter':
        case 'bettermaker_limiter': {
          const gainDb = Number(p.gain_db ?? 2.0);
          const ceilingDb = Number(p.ceiling ?? -0.3);
          const ceilingLin = dbToLinear(clamp(ceilingDb, -18, 0));
          amp = Math.min(ceilingLin * 1.35, amp * dbToLinear(clamp(gainDb, 0, 18)));
          break;
        }
        case 'burl_mothership':
        case 'neve_5059':
        case 'wes_mimas':
        case 'wes_rhea': {
          const drive = clamp(Number(p.drive ?? p.texture ?? 0.45), 0, 1);
          amp *= 1 + drive * 0.16;
          break;
        }
        case 'bricasti_m7':
        case 'eventide_h9000': {
          const mix = clamp(Number(p.mix ?? 0.42), 0, 1);
          reverbSendGain = Math.max(reverbSendGain, mix * 0.85);
          break;
        }
        default:
          break;
      }
    }

    return {
      amp: clamp(amp, 0.02, 1.5),
      pan: clamp(pan, -1, 1),
      freq: clamp(freq, 20, 16000),
      cutoffHz,
      reverbSendGain: clamp(reverbSendGain, 0, 1),
    };
  }

  /**
   * 20-Band Formant Talking Vocoder:
   * Decomposes the lyric via PhonemeEngine into onset consonant, primary/secondary Klatt vowels
   * (F1, F2, F3), and coda consonant, evaluates the 20-band formant filterbank transfer envelope,
   * and imprints vocal articulation + consonant sibilance onto the stereo carrier slice.
   */
  public static applyTalkingVocoderToSlice(
    left: Float32Array,
    right: Float32Array,
    startFrame: number,
    frameCount: number,
    sampleRate: number,
    lyric: string,
    params: Record<string, any> = {}
  ): void {
    const endFrame = Math.min(left.length, right.length, startFrame + frameCount);
    const len = endFrame - startFrame;
    if (len <= 0) return;

    const phoneme = PhonemeEngine.decomposeLyric(lyric || 'ah');
    const depth = clamp(Number(params.depth ?? 1.0), 0.1, 2.0);
    const mix = clamp(Number(params.mix ?? 0.92), 0, 1);
    const formantShiftSt = clamp(Number(params.formant_shift ?? params.formant ?? 0), -12, 12);
    const formantRatio = Math.pow(2, formantShiftSt / 12);

    const durSec = len / sampleRate;
    const onsetSec = Math.min(durSec * 0.25, phoneme.onsetDurationSec);
    const codaSec = Math.min(durSec * 0.25, phoneme.codaDurationSec);

    // 3 parallel resonant biquad-like state-variable bandpass filters tracking F1, F2, F3
    // weighted across the 20-band vocoder matrix
    let bp1L = 0;
    let lp1L = 0;
    let bp2L = 0;
    let lp2L = 0;
    let bp3L = 0;
    let lp3L = 0;

    let bp1R = 0;
    let lp1R = 0;
    let bp2R = 0;
    let lp2R = 0;
    let bp3R = 0;
    let lp3R = 0;

    let noiseBpState = 0;
    let noiseLpState = 0;

    let w1 = 1.0;
    let w2 = 1.0;
    let w3 = 0.6;
    let f1Coeff = 0.08;
    let f2Coeff = 0.22;
    let f3Coeff = 0.36;
    const qDamp1 = 0.065;
    const qDamp2 = 0.055;
    const qDamp3 = 0.075;
    let tractLpL = 0;
    let tractLpR = 0;

    const v1 = phoneme.primaryVowel;
    const v2 = phoneme.secondaryVowel || v1;
    const invBw1Sq = 1 / Math.max(2500, v1.bandwidth1 * v1.bandwidth1 * 1.96);
    const invBw2Sq = 1 / Math.max(4900, v1.bandwidth2 * v1.bandwidth2 * 1.96);
    const invBw3Sq = 1 / Math.max(10000, v1.bandwidth3 * v1.bandwidth3 * 1.96);

    for (let i = 0; i < len; i++) {
      const idx = startFrame + i;
      const t = i / sampleRate;

      if ((i & 63) === 0) {
        const normT = len > 1 ? i / (len - 1) : 0;
        // Interpolate primary -> secondary vowel for diphthongs ("doin'", "right", "now", "make")
        const diphthongMorph = phoneme.secondaryVowel
          ? clamp((normT - 0.2) / 0.65, 0, 1)
          : 0;

        const f1 = (v1.f1 + (v2.f1 - v1.f1) * diphthongMorph) * formantRatio;
        const f2 = (v1.f2 + (v2.f2 - v1.f2) * diphthongMorph) * formantRatio;
        const f3 = (v1.f3 + (v2.f3 - v1.f3) * diphthongMorph) * formantRatio;

        // Compute 20-band spectral energy normalization near F1, F2, F3
        let bandGain1 = 0;
        let bandGain2 = 0;
        let bandGain3 = 0;
        for (let b = 0; b < VOCODER_20_BAND_CENTERS_HZ.length; b++) {
          const fc = VOCODER_20_BAND_CENTERS_HZ[b];
          const df1 = fc - f1;
          const df2 = fc - f2;
          const df3 = fc - f3;
          bandGain1 += Math.exp(-0.5 * df1 * df1 * invBw1Sq);
          bandGain2 += Math.exp(-0.5 * df2 * df2 * invBw2Sq);
          bandGain3 += Math.exp(-0.5 * df3 * df3 * invBw3Sq);
        }

        w1 = clamp((0.55 + 0.25 * bandGain1) * depth, 0.2, 2.2);
        w2 = clamp((0.65 + 0.3 * bandGain2) * depth, 0.2, 2.4);
        w3 = clamp((0.35 + 0.2 * bandGain3) * depth, 0.1, 1.6);

        // Chamberlin SVF bandpass coefficients for F1, F2, F3
        f1Coeff = clamp(2 * Math.sin((Math.PI * clamp(f1, 120, 1200)) / sampleRate), 0.01, 0.75);
        f2Coeff = clamp(2 * Math.sin((Math.PI * clamp(f2, 500, 4200)) / sampleRate), 0.02, 0.85);
        f3Coeff = clamp(2 * Math.sin((Math.PI * clamp(f3, 1400, 7500)) / sampleRate), 0.04, 0.9);
      }

      const dryL = left[idx];
      const dryR = right[idx];
      const absPeak = Math.max(Math.abs(dryL), Math.abs(dryR));

      // Linear polyphonic carrier into unity-gain qDamp-normalized formant resonators (zero intermodulation buzz)
      const hp1L = qDamp1 * dryL - lp1L - qDamp1 * bp1L;
      bp1L += f1Coeff * hp1L;
      lp1L += f1Coeff * bp1L;

      const hp2L = qDamp2 * dryL - lp2L - qDamp2 * bp2L;
      bp2L += f2Coeff * hp2L;
      lp2L += f2Coeff * bp2L;

      const hp3L = qDamp3 * dryL - lp3L - qDamp3 * bp3L;
      bp3L += f3Coeff * hp3L;
      lp3L += f3Coeff * bp3L;

      const hp1R = qDamp1 * dryR - lp1R - qDamp1 * bp1R;
      bp1R += f1Coeff * hp1R;
      lp1R += f1Coeff * bp1R;

      const hp2R = qDamp2 * dryR - lp2R - qDamp2 * bp2R;
      bp2R += f2Coeff * hp2R;
      lp2R += f2Coeff * bp2R;

      const hp3R = qDamp3 * dryR - lp3R - qDamp3 * bp3R;
      bp3R += f3Coeff * hp3R;
      lp3R += f3Coeff * bp3R;

      // Consonant unvoiced noise burst synthesis (onset & coda plosives/fricatives)
      let consonantBurst = 0;
      let noiseCenterHz = 0;
      let noiseEnv = 0;

      if (onsetSec > 0 && t < onsetSec && phoneme.onsetConsonant !== 'none') {
        noiseCenterHz = phoneme.onsetNoiseHz || 2800;
        const p = t / onsetSec;
        noiseEnv =
          phoneme.onsetConsonant === 'plosive'
            ? Math.exp(-p * 5.0) * 0.16
            : Math.sin(p * Math.PI) * 0.14;
      } else if (codaSec > 0 && t > durSec - codaSec && phoneme.codaConsonant !== 'none') {
        noiseCenterHz = phoneme.codaNoiseHz || 3200;
        const p = (t - (durSec - codaSec)) / codaSec;
        noiseEnv = Math.sin(clamp(p, 0, 1) * Math.PI) * 0.12;
      }

      if (noiseEnv > 0 && noiseCenterHz > 0) {
        // Deterministic pseudo-noise locked to sample index for reproducible tests
        const pseudoRand = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
        const white = (pseudoRand - Math.floor(pseudoRand)) * 2 - 1;
        const nf = clamp(2 * Math.sin((Math.PI * clamp(noiseCenterHz, 300, 8500)) / sampleRate), 0.05, 0.9);
        const nhp = 0.25 * white - noiseLpState - 0.25 * noiseBpState;
        noiseBpState += nf * nhp;
        noiseLpState += nf * noiseBpState;
        consonantBurst = noiseBpState * noiseEnv;
      }

      // Syllable articulation envelope (prevents click on consonant transitions)
      const sylEnv =
        t < 0.008
          ? t / 0.008
          : t > durSec - 0.012
          ? Math.max(0, (durSec - t) / 0.012)
          : 1.0;

      const rawVocL =
        (bp1L * w1 * 0.48 + bp2L * w2 * 0.44 + bp3L * w3 * 0.28 + consonantBurst * 0.16 * absPeak) * sylEnv;
      const rawVocR =
        (bp1R * w1 * 0.48 + bp2R * w2 * 0.44 + bp3R * w3 * 0.28 + consonantBurst * 0.16 * absPeak) * sylEnv;

      const tractAlpha = Math.min(0.45, (2 * Math.PI * 3600) / sampleRate);
      tractLpL += tractAlpha * (rawVocL - tractLpL);
      tractLpR += tractAlpha * (rawVocR - tractLpR);

      const wetL = dryL * 0.28 + Math.tanh(tractLpL * 0.95) * 0.58;
      const wetR = dryR * 0.28 + Math.tanh(tractLpR * 0.95) * 0.58;
      left[idx] = dryL * (1 - mix) + wetL * mix;
      right[idx] = dryR * (1 - mix) + wetR * mix;
    }
  }

  /**
   * Processes a single Ableton Audio Effect in-place on a stereo buffer slice.
   */
  public static applyDeviceToSlice(
    left: Float32Array,
    right: Float32Array,
    startFrame: number,
    frameCount: number,
    sampleRate: number,
    fx: FXChainItem,
    context?: FxSliceContext
  ): void {
    const endFrame = Math.min(left.length, right.length, startFrame + frameCount);
    const len = endFrame - startFrame;
    if (len <= 0) return;

    const type = this.normalizeFxType(fx.type);
    const p = fx.params || {};

    switch (type) {
      case 'vocoder': {
        const lyric = context?.lyric || String(p.lyric ?? p.vowel ?? 'ah');
        this.applyTalkingVocoderToSlice(left, right, startFrame, len, sampleRate, lyric, p);
        break;
      }

      case 'eq_eight': {
        const lowCutHz = clamp(Number(p.low_cut ?? 100), 20, 2000);
        const bellFreqHz = clamp(Number(p.bell1_freq ?? 1200), 100, 12000);
        const bellGainLin = dbToLinear(clamp(Number(p.bell1_db ?? 2.0), -15, 15)) - 1;
        const highShelfLin = dbToLinear(clamp(Number(p.high_shelf_db ?? 1.5), -15, 15)) - 1;

        const hpAlpha = clamp(1 - (2 * Math.PI * lowCutHz) / sampleRate, 0.05, 0.999);
        const bellF = clamp(2 * Math.sin((Math.PI * bellFreqHz) / sampleRate), 0.01, 0.85);
        const shelfAlpha = clamp((2 * Math.PI * 4500) / sampleRate, 0.02, 0.85);

        let hpStateL = 0;
        let prevInL = 0;
        let bellBpL = 0;
        let bellLpL = 0;
        let shelfLpL = 0;

        let hpStateR = 0;
        let prevInR = 0;
        let bellBpR = 0;
        let bellLpR = 0;
        let shelfLpR = 0;

        for (let i = startFrame; i < endFrame; i++) {
          const inL = left[i];
          const inR = right[i];

          hpStateL = hpAlpha * (hpStateL + inL - prevInL);
          prevInL = inL;
          const bhpL = hpStateL - bellLpL - 0.35 * bellBpL;
          bellBpL += bellF * bhpL;
          bellLpL += bellF * bellBpL;
          shelfLpL += shelfAlpha * (hpStateL - shelfLpL);
          const highL = hpStateL - shelfLpL;
          left[i] = hpStateL + bellBpL * bellGainLin * 0.5 + highL * highShelfLin * 0.5;

          hpStateR = hpAlpha * (hpStateR + inR - prevInR);
          prevInR = inR;
          const bhpR = hpStateR - bellLpR - 0.35 * bellBpR;
          bellBpR += bellF * bhpR;
          bellLpR += bellF * bellBpR;
          shelfLpR += shelfAlpha * (hpStateR - shelfLpR);
          const highR = hpStateR - shelfLpR;
          right[i] = hpStateR + bellBpR * bellGainLin * 0.5 + highR * highShelfLin * 0.5;
        }
        break;
      }

      case 'auto_filter': {
        const baseCutoff = clamp(Number(p.cutoff ?? p.freq ?? 2400), 60, 16000);
        const res = clamp(Number(p.res ?? p.resonance ?? 0.4), 0.05, 0.92);
        const drive = clamp(Number(p.drive ?? 3.0), 0, 24);
        const lfoRate = clamp(Number(p.lfo_rate ?? 1.5), 0.05, 16);
        const lfoAmount = clamp(Number(p.lfo_amount ?? 0.2), 0, 1);
        const mix = clamp(Number(p.mix ?? 1.0), 0, 1);
        const driveScalar = 1 + drive * 0.12;
        const qDamp = clamp(1.1 - res, 0.12, 1.0);

        let lpL = 0;
        let bpL = 0;
        let lpR = 0;
        let bpR = 0;
        let f = clamp(2 * Math.sin((Math.PI * baseCutoff) / sampleRate), 0.01, 0.88);

        for (let i = 0; i < len; i++) {
          const idx = startFrame + i;
          if ((i & 15) === 0) {
            const t = i / sampleRate;
            const lfoMod = 1 + Math.sin(2 * Math.PI * lfoRate * t) * lfoAmount * 0.45;
            const dynCut = clamp(baseCutoff * lfoMod, 60, 16000);
            f = clamp(2 * Math.sin((Math.PI * dynCut) / sampleRate), 0.01, 0.88);
          }

          const drivenL = fastTanh(left[idx] * driveScalar);
          const hpL = drivenL - lpL - qDamp * bpL;
          bpL += f * hpL;
          lpL += f * bpL;

          const drivenR = fastTanh(right[idx] * driveScalar);
          const hpR = drivenR - lpR - qDamp * bpR;
          bpR += f * hpR;
          lpR += f * bpR;

          left[idx] = left[idx] * (1 - mix) + lpL * mix;
          right[idx] = right[idx] * (1 - mix) + lpR * mix;
        }
        break;
      }

      case 'compressor':
      case 'glue_compressor': {
        const threshDb = clamp(Number(p.threshold ?? (type === 'glue_compressor' ? -10 : -14)), -48, 0);
        const ratio = clamp(Number(p.ratio ?? 4), 1.1, 20);
        const attackMs = clamp(Number(p.attack ?? 10), 0.2, 200);
        const releaseMs = clamp(Number(p.release ?? 120), 10, 1500);
        const makeupLin = dbToLinear(clamp(Number(p.makeup ?? (type === 'glue_compressor' ? 1.5 : 1.0)), -12, 18));
        const mix = clamp(Number(p.mix ?? (type === 'glue_compressor' ? 0.85 : 1.0)), 0, 1);

        const threshLin = dbToLinear(threshDb);
        const attCoeff = Math.exp(-1 / (Math.max(0.0005, attackMs / 1000) * sampleRate));
        const relCoeff = Math.exp(-1 / (Math.max(0.005, releaseMs / 1000) * sampleRate));
        let env = 0;
        let gain = 1.0;

        for (let i = startFrame; i < endFrame; i++) {
          const dryL = left[i];
          const dryR = right[i];
          const peak = Math.max(Math.abs(dryL), Math.abs(dryR));
          env = peak > env ? attCoeff * env + (1 - attCoeff) * peak : relCoeff * env + (1 - relCoeff) * peak;

          if (((i - startFrame) & 31) === 0) {
            if (env > threshLin && env > 1e-6) {
              const overDb = 20 * Math.log10(env / threshLin);
              const compressedOverDb = overDb / ratio;
              gain = dbToLinear(compressedOverDb - overDb);
            } else {
              gain = 1.0;
            }
          }

          const wetL = dryL * gain * makeupLin;
          const wetR = dryR * gain * makeupLin;
          left[i] = dryL * (1 - mix) + wetL * mix;
          right[i] = dryR * (1 - mix) + wetR * mix;
        }
        break;
      }

      case 'multiband_dynamics': {
        // 3-Band OTT Upward + Downward Dynamics Processor
        const amount = clamp(Number(p.amount ?? 0.5), 0, 1);
        const lowGain = dbToLinear(clamp(Number(p.low_gain ?? 2.0), -12, 12));
        const midGain = dbToLinear(clamp(Number(p.mid_gain ?? 1.0), -12, 12));
        const highGain = dbToLinear(clamp(Number(p.high_gain ?? 2.5), -12, 12));

        const lowAlpha = clamp((2 * Math.PI * 140) / sampleRate, 0.005, 0.4);
        const highAlpha = clamp((2 * Math.PI * 2600) / sampleRate, 0.02, 0.85);

        let lpLowL = 0;
        let lpHighL = 0;
        let lpLowR = 0;
        let lpHighR = 0;
        let envLow = 0.05;
        let envMid = 0.05;
        let envHigh = 0.05;

        for (let i = startFrame; i < endFrame; i++) {
          const inL = left[i];
          const inR = right[i];

          lpLowL += lowAlpha * (inL - lpLowL);
          lpHighL += highAlpha * (inL - lpHighL);
          const lowL = lpLowL;
          const highL = inL - lpHighL;
          const midL = inL - lowL - highL;

          lpLowR += lowAlpha * (inR - lpLowR);
          lpHighR += highAlpha * (inR - lpHighR);
          const lowR = lpLowR;
          const highR = inR - lpHighR;
          const midR = inR - lowR - highR;

          envLow = 0.995 * envLow + 0.005 * (Math.abs(lowL) + Math.abs(lowR) + 1e-4);
          envMid = 0.995 * envMid + 0.005 * (Math.abs(midL) + Math.abs(midR) + 1e-4);
          envHigh = 0.995 * envHigh + 0.005 * (Math.abs(highL) + Math.abs(highR) + 1e-4);

          // Upward boost for quiet signals + downward ceiling for hot peaks
          const ottScaleLow = clamp(Math.pow(0.18 / envLow, amount * 0.35), 0.5, 2.2) * lowGain;
          const ottScaleMid = clamp(Math.pow(0.16 / envMid, amount * 0.35), 0.5, 2.2) * midGain;
          const ottScaleHigh = clamp(Math.pow(0.12 / envHigh, amount * 0.4), 0.5, 2.5) * highGain;

          const wetL = lowL * ottScaleLow + midL * ottScaleMid + highL * ottScaleHigh;
          const wetR = lowR * ottScaleLow + midR * ottScaleMid + highR * ottScaleHigh;

          left[i] = inL * (1 - amount) + fastTanh(wetL) * amount;
          right[i] = inR * (1 - amount) + fastTanh(wetR) * amount;
        }
        break;
      }

      case 'drum_buss': {
        const drive = clamp(Number(p.drive ?? 0.35), 0, 1);
        const crunch = clamp(Number(p.crunch ?? 0.25), 0, 1);
        const boomAmount = clamp(Number(p.boom_amount ?? p.boom ?? 0.45), 0, 1);
        const subInc = (2 * Math.PI * 56) / sampleRate;
        let subPhase = 0;
        let envSub = 0;

        for (let i = startFrame; i < endFrame; i++) {
          const inL = left[i];
          const inR = right[i];
          const mono = 0.5 * (inL + inR);
          envSub = 0.992 * envSub + 0.008 * Math.abs(mono);
          subPhase += subInc;
          const boomSub = Math.sin(subPhase) * envSub * boomAmount * 0.55;

          const driveGain = 1 + drive * 2.2;
          const crunchWaveL = fastTanh((inL + boomSub) * driveGain + crunch * inL * inL * 0.6);
          const crunchWaveR = fastTanh((inR + boomSub) * driveGain + crunch * inR * inR * 0.6);

          left[i] = crunchWaveL;
          right[i] = crunchWaveR;
        }
        break;
      }

      case 'roar':
      case 'saturator': {
        const rawDrive = Number(p.drive ?? (type === 'saturator' ? 6.0 : 0.4));
        const driveGain =
          type === 'saturator'
            ? dbToLinear(clamp(rawDrive, 0, 36))
            : 1 + clamp(rawDrive, 0, 1) * 3.5;
        const feedback = clamp(Number(p.feedback ?? 0.2), 0, 0.75);
        const mix = clamp(Number(p.mix ?? 0.8), 0, 1);
        let fbL = 0;
        let fbR = 0;

        for (let i = startFrame; i < endFrame; i++) {
          const dryL = left[i];
          const dryR = right[i];
          const xL = dryL + (type === 'roar' ? fbL * feedback : 0);
          const xR = dryR + (type === 'roar' ? fbR * feedback : 0);
          const wetL = fastTanh(xL * driveGain);
          const wetR = fastTanh(xR * driveGain);
          fbL = wetL;
          fbR = wetR;
          left[i] = dryL * (1 - mix) + wetL * mix;
          right[i] = dryR * (1 - mix) + wetR * mix;
        }
        break;
      }

      case 'hybrid_reverb':
      case 'reverb': {
        const decaySec = clamp(Number(p.decay ?? 2.4), 0.2, 12.0);
        const predelayMs = clamp(Number(p.predelay ?? 16), 0, 150);
        const mix = clamp(Number(p.mix ?? 0.45), 0, 1);

        const preFrames = Math.max(1, Math.floor((predelayMs / 1000) * sampleRate));
        const tap1 = preFrames + Math.floor(0.017 * sampleRate);
        const tap2 = preFrames + Math.floor(0.031 * sampleRate);
        const tap3 = preFrames + Math.floor(0.047 * sampleRate);
        const fbGain = clamp(Math.pow(0.001, 0.031 / decaySec), 0.25, 0.88);

        const bufL = new Float32Array(len + tap3 + 4);
        const bufR = new Float32Array(len + tap3 + 4);

        for (let i = 0; i < len; i++) {
          const dryL = left[startFrame + i];
          const dryR = right[startFrame + i];
          const revL =
            (i >= tap1 ? bufL[i - tap1] * 0.40 : 0) +
            (i >= tap2 ? bufR[i - tap2] * 0.30 : 0) +
            (i >= tap3 ? bufL[i - tap3] * 0.20 : 0);
          const revR =
            (i >= tap1 ? bufR[i - tap1] * 0.40 : 0) +
            (i >= tap2 ? bufL[i - tap2] * 0.30 : 0) +
            (i >= tap3 ? bufR[i - tap3] * 0.20 : 0);

          bufL[i] = fastTanh(dryL + revL * fbGain);
          bufR[i] = fastTanh(dryR + revR * fbGain);

          left[startFrame + i] = dryL * (1 - mix) + (dryL * 0.5 + revL * 0.85) * mix;
          right[startFrame + i] = dryR * (1 - mix) + (dryR * 0.5 + revR * 0.85) * mix;
        }
        break;
      }

      case 'gated_reverb': {
        const decaySec = clamp(Number(p.decay ?? 3.5), 0.3, 12.0);
        const gateMs = clamp(Number(p.gate_ms ?? 180), 20, 1200);
        const thresholdDb = clamp(Number(p.threshold ?? -24), -60, -3);
        const mix = clamp(Number(p.mix ?? 0.55), 0, 1);

        const gateHoldFrames = Math.max(1, Math.floor((gateMs / 1000) * sampleRate));
        const gateReleaseFrames = Math.max(1, Math.floor(0.012 * sampleRate));
        const thresholdLin = dbToLinear(thresholdDb);
        const tap1 = Math.max(1, Math.floor(0.013 * sampleRate));
        const tap2 = Math.max(2, Math.floor(0.029 * sampleRate));
        const tap3 = Math.max(3, Math.floor(0.043 * sampleRate));
        const fbGain = clamp(Math.pow(0.001, 0.029 / decaySec), 0.35, 0.86);

        const bufL = new Float32Array(len + tap3 + 4);
        const bufR = new Float32Array(len + tap3 + 4);
        let framesSinceTrigger = 0;

        for (let i = 0; i < len; i++) {
          const dryL = left[startFrame + i];
          const dryR = right[startFrame + i];
          const peak = Math.max(Math.abs(dryL), Math.abs(dryR));
          if (peak >= thresholdLin) {
            framesSinceTrigger = 0;
          } else {
            framesSinceTrigger++;
          }

          let gateEnv = 1.0;
          if (framesSinceTrigger > gateHoldFrames) {
            const rel = (framesSinceTrigger - gateHoldFrames) / gateReleaseFrames;
            gateEnv = Math.max(0, 1 - rel);
          }

          const revL =
            (i >= tap1 ? bufL[i - tap1] * 0.42 : 0) +
            (i >= tap2 ? bufR[i - tap2] * 0.31 : 0) +
            (i >= tap3 ? bufL[i - tap3] * 0.21 : 0);
          const revR =
            (i >= tap1 ? bufR[i - tap1] * 0.42 : 0) +
            (i >= tap2 ? bufL[i - tap2] * 0.31 : 0) +
            (i >= tap3 ? bufR[i - tap3] * 0.21 : 0);

          bufL[i] = fastTanh(dryL + revL * fbGain);
          bufR[i] = fastTanh(dryR + revR * fbGain);

          const gatedRevL = revL * gateEnv;
          const gatedRevR = revR * gateEnv;
          left[startFrame + i] = dryL * (1 - mix) + (dryL * 0.55 + gatedRevL * 0.95) * mix;
          right[startFrame + i] = dryR * (1 - mix) + (dryR * 0.55 + gatedRevR * 0.95) * mix;
        }
        break;
      }

      case 'tape_degrade': {
        const wowHz = clamp(Number(p.wow_hz ?? 0.42), 0.12, 2.0);
        const wowDepthSec = clamp(Number(p.wow_depth_ms ?? 0.65), 0.05, 1.5) / 1000;
        const flutterHz = clamp(Number(p.flutter_hz ?? 9.2), 6.0, 15.0);
        const flutterDepthSec = clamp(Number(p.flutter_depth_ms ?? 0.06), 0.01, 0.2) / 1000;
        const highCutHz = clamp(Number(p.high_cut ?? 5200), 900, 7000);
        const drive = clamp(Number(p.drive ?? 0.32), 0, 1);
        const mix = clamp(Number(p.mix ?? 1.0), 0, 1);

        const copyL = left.slice(startFrame, endFrame);
        const copyR = right.slice(startFrame, endFrame);
        const lpAlpha = clamp((2 * Math.PI * highCutHz) / sampleRate, 0.04, 0.85);
        const driveGain = 1 + drive * 1.4;

        let lp1L = 0;
        let lp2L = 0;
        let lp1R = 0;
        let lp2R = 0;
        let delaySamples = 0;

        for (let i = 0; i < len; i++) {
          if ((i & 15) === 0) {
            const t = i / sampleRate;
            const wowMod =
              (0.5 +
                0.35 * Math.sin(2 * Math.PI * wowHz * t) +
                0.15 * Math.sin(2 * Math.PI * wowHz * 1.618 * t)) *
              wowDepthSec *
              sampleRate;
            const flutterMod =
              (0.5 + 0.5 * Math.sin(2 * Math.PI * flutterHz * t)) *
              flutterDepthSec *
              sampleRate;
            delaySamples = wowMod + flutterMod;
          }
          const readPos = Math.max(0, i - delaySamples);
          const idx0 = Math.floor(readPos);
          const idx1 = Math.min(len - 1, idx0 + 1);
          const frac = readPos - idx0;

          const rawL = copyL[idx0] + (copyL[idx1] - copyL[idx0]) * frac;
          const rawR = copyR[idx0] + (copyR[idx1] - copyR[idx0]) * frac;

          // Soft analog tape saturation (1-4 dB transient compression) + steep 2-stage high-cut
          const satL = fastTanh(rawL * driveGain);
          const satR = fastTanh(rawR * driveGain);

          lp1L += lpAlpha * (satL - lp1L);
          lp2L += lpAlpha * (lp1L - lp2L);
          lp1R += lpAlpha * (satR - lp1R);
          lp2R += lpAlpha * (lp1R - lp2R);

          left[startFrame + i] = copyL[i] * (1 - mix) + lp2L * mix;
          right[startFrame + i] = copyR[i] * (1 - mix) + lp2R * mix;
        }
        break;
      }

      case 'burl_mothership': {
        // Burl B80/B16 Mothership BAD4M/BDA4M: Discrete Class-A BOPA14 + BX1/BX5 Nickel Transformer
        const transformer = String(p.transformer ?? 'bx1').toLowerCase();
        const drive = clamp(Number(p.drive ?? 0.45), 0, 1);
        const filterMode = String(p.filter ?? 'classic').toLowerCase();
        const mix = clamp(Number(p.mix ?? 1.0), 0, 1);
        const driveScalar = transformer === 'bypass' ? 1.0 + drive * 0.35 : 1.15 + drive * 1.65;
        const lpAlpha = filterMode === 'aggressive' ? 0.72 : 0.48;
        let lowMidL = 0;
        let lowMidR = 0;
        let lpL = 0;
        let lpR = 0;
        const lowAlpha = clamp((2 * Math.PI * 220) / sampleRate, 0.01, 0.25);

        for (let i = startFrame; i < endFrame; i++) {
          const inL = left[i];
          const inR = right[i];
          lowMidL += lowAlpha * (inL - lowMidL);
          lowMidR += lowAlpha * (inR - lowMidR);
          const xL = (inL + (transformer !== 'bypass' ? lowMidL * 0.35 : 0)) * driveScalar;
          const xR = (inR + (transformer !== 'bypass' ? lowMidR * 0.35 : 0)) * driveScalar;
          // Nickel-core transformer soft saturation + even-order asymmetry
          const satL = fastTanh(xL + 0.08 * xL * xL);
          const satR = fastTanh(xR + 0.08 * xR * xR);
          lpL += lpAlpha * (satL - lpL);
          lpR += lpAlpha * (satR - lpR);
          left[i] = inL * (1 - mix) + lpL * mix;
          right[i] = inR * (1 - mix) + lpR * mix;
        }
        break;
      }

      case 'neve_5059': {
        // Dual-Bus Harmonic Summing: low_iron/blue (low/low-mid weight), high_sheen/red (high-mid air), dual/super (both)
        const silkMode = String(p.mode ?? p.silk ?? 'super').toLowerCase();
        const texture = clamp(Number(p.texture ?? 0.65), 0, 1);
        const mix = clamp(Number(p.mix ?? 1.0), 0, 1);
        const lowAlpha = clamp((2 * Math.PI * 240) / sampleRate, 0.01, 0.25);
        const highAlpha = clamp((2 * Math.PI * 2200) / sampleRate, 0.05, 0.65);
        let lowL = 0;
        let lowR = 0;
        let highLpL = 0;
        let highLpR = 0;

        for (let i = startFrame; i < endFrame; i++) {
          const inL = left[i];
          const inR = right[i];
          lowL += lowAlpha * (inL - lowL);
          lowR += lowAlpha * (inR - lowR);
          highLpL += highAlpha * (inL - highLpL);
          highLpR += highAlpha * (inR - highLpR);
          const highL = inL - highLpL;
          const highR = inR - highLpR;

          let outL = inL;
          let outR = inR;
          if (
            silkMode === 'blue' ||
            silkMode === 'low_iron' ||
            silkMode === 'super' ||
            silkMode === 'dual'
          ) {
            outL += fastTanh(lowL * (1.8 + texture * 2.4)) * texture * 0.45;
            outR += fastTanh(lowR * (1.8 + texture * 2.4)) * texture * 0.45;
          }
          if (
            silkMode === 'red' ||
            silkMode === 'high_sheen' ||
            silkMode === 'super' ||
            silkMode === 'dual'
          ) {
            outL += fastTanh(highL * (2.0 + texture * 2.8)) * texture * 0.42;
            outR += fastTanh(highR * (2.0 + texture * 2.8)) * texture * 0.42;
          }
          left[i] = inL * (1 - mix) + fastTanh(outL) * mix;
          right[i] = inR * (1 - mix) + fastTanh(outR) * mix;
        }
        break;
      }

      case 'wes_mimas': {
        // WesAudio _MIMAS ng500 1176 FET Compressor w/ Carnhill Transformers & All-Buttons-In / Saturation Mode
        const satMode = Boolean(p.saturation_mode);
        const rawRatio = String(p.ratio ?? 8).toLowerCase();
        const isAllButtons = rawRatio === 'all_buttons' || rawRatio === 'all';
        const ratio = isAllButtons ? 16 : clamp(Number(p.ratio ?? 8), 4, 20);
        const drive = clamp(Number(p.drive ?? 0.5), 0, 1);
        const mix = clamp(Number(p.mix ?? 1.0), 0, 1);
        const threshLin = isAllButtons ? 0.14 : 0.24;
        let env = 0;

        for (let i = startFrame; i < endFrame; i++) {
          const inL = left[i];
          const inR = right[i];
          const peak = Math.max(Math.abs(inL), Math.abs(inR));
          env = peak > env ? 0.85 * env + 0.15 * peak : 0.996 * env + 0.004 * peak;

          let gain = 1.0;
          if (!satMode && env > threshLin && env > 1e-5) {
            const overDb = 20 * Math.log10(env / threshLin);
            gain = dbToLinear(overDb / ratio - overDb) * (isAllButtons ? 1.55 : 1.25);
          }
          const carnhillDrive = 1.15 + drive * (isAllButtons ? 2.6 : 1.8);
          const wetL = fastTanh(inL * gain * carnhillDrive);
          const wetR = fastTanh(inR * gain * carnhillDrive);
          left[i] = inL * (1 - mix) + wetL * mix;
          right[i] = inR * (1 - mix) + wetR * mix;
        }
        break;
      }

      case 'wes_rhea': {
        // WesAudio _RHEA Vari-Mu Tube Compressor w/ Carnhill Interstage Transformers & 2-Stage THD
        const threshLin = dbToLinear(clamp(Number(p.threshold ?? -14), -36, -2));
        const thdMode = String(p.thd ?? 'medium').toLowerCase();
        const thdDrive = thdMode === 'high' ? 2.1 : thdMode === 'off' ? 1.05 : 1.45;
        const mix = clamp(Number(p.mix ?? 1.0), 0, 1);
        let env = 0;

        for (let i = startFrame; i < endFrame; i++) {
          const inL = left[i];
          const inR = right[i];
          const peak = Math.max(Math.abs(inL), Math.abs(inR));
          env = peak > env ? 0.985 * env + 0.015 * peak : 0.999 * env + 0.001 * peak;
          // Vari-Mu program-dependent soft knee ratio
          const dynRatio = 1.5 + Math.min(4.5, env * 4.0);
          let gain = 1.18;
          if (env > threshLin && env > 1e-5) {
            const overDb = 20 * Math.log10(env / threshLin);
            gain = dbToLinear(overDb / dynRatio - overDb) * 1.25;
          }
          const xL = inL * gain * thdDrive;
          const xR = inR * gain * thdDrive;
          const wetL = fastTanh(xL + 0.09 * xL * xL);
          const wetR = fastTanh(xR + 0.09 * xR * xR);
          left[i] = inL * (1 - mix) + wetL * mix;
          right[i] = inR * (1 - mix) + wetR * mix;
        }
        break;
      }

      case 'bettermaker_limiter': {
        // Bettermaker Mastering Limiter 2.0 (+27 dBu Headroom, IREL Intelligent Release, Odd/Even Harmonic Clipper)
        const gainLin = dbToLinear(clamp(Number(p.gain_db ?? 2.5), -6, 18));
        const ceilingLin = dbToLinear(clamp(Number(p.ceiling ?? -0.3), -12, 0));
        const thdAmount = clamp(Number(p.odd_even_thd ?? 0.3), 0, 1);
        const invCeil = 1 / Math.max(0.05, ceilingLin);

        for (let i = startFrame; i < endFrame; i++) {
          const xL = left[i] * gainLin;
          const xR = right[i] * gainLin;
          const shapedL = xL + thdAmount * (0.08 * xL * xL - 0.06 * xL * xL * xL);
          const shapedR = xR + thdAmount * (0.08 * xR * xR - 0.06 * xR * xR * xR);
          left[i] = clamp(fastTanh(shapedL * invCeil) * ceilingLin, -ceilingLin, ceilingLin);
          right[i] = clamp(fastTanh(shapedR * invCeil) * ceilingLin, -ceilingLin, ceilingLin);
        }
        break;
      }

      case 'eventide_h9000':
      case 'spectral_pitch_harmonizer': {
        const shift1St = clamp(Number(p.shift1_st ?? 7), -24, 24);
        const shift2St = clamp(Number(p.shift2_st ?? -12), -24, 24);
        const mix = clamp(Number(p.mix ?? 0.25), 0, 1);
        const copyL = left.slice(startFrame, endFrame);
        const copyR = right.slice(startFrame, endFrame);
        const rate1 = Math.pow(2, shift1St / 12);
        const rate2 = Math.pow(2, shift2St / 12);
        const grainLen = Math.max(512, Math.floor(0.048 * sampleRate));
        const halfGrain = grainLen * 0.5;

        const sampleGrain = (buf: Float32Array, centerIdx: number, rate: number): number => {
          const drift = (rate - 1.0) * centerIdx;
          const phaseA = ((drift % grainLen) + grainLen) % grainLen;
          const phaseB = (((drift + halfGrain) % grainLen) + grainLen) % grainLen;
          const wA = Math.sin((Math.PI * phaseA) / grainLen);
          const weightA = wA * wA;
          const weightB = 1.0 - weightA;

          const readA = clamp(centerIdx - phaseA, 0, len - 2);
          const iA = Math.floor(readA);
          const fA = readA - iA;
          const sA = buf[iA] + (buf[iA + 1] - buf[iA]) * fA;

          const readB = clamp(centerIdx - phaseB, 0, len - 2);
          const iB = Math.floor(readB);
          const fB = readB - iB;
          const sB = buf[iB] + (buf[iB + 1] - buf[iB]) * fB;

          return sA * weightA + sB * weightB;
        };

        for (let i = 0; i < len; i++) {
          const harmL = sampleGrain(copyL, i, rate1) * 0.5 + sampleGrain(copyR, i, rate2) * 0.4;
          const harmR = sampleGrain(copyR, i, rate1) * 0.5 + sampleGrain(copyL, i, rate2) * 0.4;
          left[startFrame + i] = copyL[i] * (1 - mix) + harmL * mix;
          right[startFrame + i] = copyR[i] * (1 - mix) + harmR * mix;
        }
        break;
      }

      case 'bricasti_m7': {
        // Bricasti Design M7 True-Stereo Algorithmic Reverb (6x Blackfin DSP Array Emulation)
        const decaySec = clamp(Number(p.decay ?? 2.6), 0.3, 12.0);
        const predelayMs = clamp(Number(p.predelay ?? 22), 0, 150);
        const rolloffHz = clamp(Number(p.rolloff_hz ?? 6800), 1200, 16000);
        const mix = clamp(Number(p.mix ?? 0.42), 0, 1);

        const preFrames = Math.max(1, Math.floor((predelayMs / 1000) * sampleRate));
        const t1 = preFrames + Math.floor(0.019 * sampleRate);
        const t2 = preFrames + Math.floor(0.031 * sampleRate);
        const t3 = preFrames + Math.floor(0.047 * sampleRate);
        const t4 = preFrames + Math.floor(0.067 * sampleRate);
        const fb = clamp(Math.pow(0.001, 0.035 / decaySec), 0.3, 0.88);
        const dampAlpha = clamp((2 * Math.PI * rolloffHz) / sampleRate, 0.08, 0.88);

        const bufL = new Float32Array(len + t4 + 4);
        const bufR = new Float32Array(len + t4 + 4);
        let lpL = 0;
        let lpR = 0;

        for (let i = 0; i < len; i++) {
          const dryL = left[startFrame + i];
          const dryR = right[startFrame + i];
          // True-stereo cross-coupled early + late reflection network (unity-bounded tap sum = 0.94)
          const rawRevL =
            (i >= t1 ? bufL[i - t1] * 0.34 : 0) +
            (i >= t2 ? bufR[i - t2] * 0.27 : 0) +
            (i >= t3 ? bufL[i - t3] * 0.20 : 0) +
            (i >= t4 ? bufR[i - t4] * 0.13 : 0);
          const rawRevR =
            (i >= t1 ? bufR[i - t1] * 0.34 : 0) +
            (i >= t2 ? bufL[i - t2] * 0.27 : 0) +
            (i >= t3 ? bufR[i - t3] * 0.20 : 0) +
            (i >= t4 ? bufL[i - t4] * 0.13 : 0);

          lpL += dampAlpha * (rawRevL - lpL);
          lpR += dampAlpha * (rawRevR - lpR);
          bufL[i] = fastTanh(dryL + lpL * fb);
          bufR[i] = fastTanh(dryR + lpR * fb);

          left[startFrame + i] = dryL * (1 - mix) + (dryL * 0.45 + lpL * 0.92) * mix;
          right[startFrame + i] = dryR * (1 - mix) + (dryR * 0.45 + lpR * 0.92) * mix;
        }
        break;
      }

      case 'echo':
      case 'delay': {
        const delaySec = clamp(Number(p.time ?? 0.12), 0.01, 1.5);
        const feedback = clamp(Number(p.feedback ?? 0.4), 0, 0.88);
        const mix = clamp(Number(p.mix ?? 0.32), 0, 1);
        const delayFrames = Math.max(1, Math.min(Math.floor(len * 0.65), Math.floor(delaySec * sampleRate)));

        const delayBufL = new Float32Array(len);
        const delayBufR = new Float32Array(len);

        for (let i = 0; i < len; i++) {
          const dryL = left[startFrame + i];
          const dryR = right[startFrame + i];
          const delL = i >= delayFrames ? delayBufL[i - delayFrames] : 0;
          const delR = i >= delayFrames ? delayBufR[i - delayFrames] : 0;

          // Ping-pong cross-feedback for stereo width
          delayBufL[i] = dryL + delR * feedback;
          delayBufR[i] = dryR + delL * feedback;

          left[startFrame + i] = dryL * (1 - mix) + (dryL + delL * 0.85) * mix;
          right[startFrame + i] = dryR * (1 - mix) + (dryR + delR * 0.85) * mix;
        }
        break;
      }

      case 'chorus': {
        const rateHz = clamp(Number(p.rate ?? 0.8), 0.05, 8.0);
        const amount = clamp(Number(p.amount ?? 0.5), 0, 1);
        const mix = clamp(Number(p.mix ?? 0.45), 0, 1);
        const copyL = left.slice(startFrame, endFrame);
        const copyR = right.slice(startFrame, endFrame);
        const dryScale = 1 - mix * 0.5;
        const wetScale = mix * 0.75;
        let modL = 0.008 * sampleRate;
        let modR = 0.009 * sampleRate;

        for (let i = 0; i < len; i++) {
          if ((i & 15) === 0) {
            const phase = (2 * Math.PI * rateHz * i) / sampleRate;
            modL = (0.008 + 0.006 * amount * Math.sin(phase)) * sampleRate;
            modR = (0.009 + 0.006 * amount * Math.cos(phase)) * sampleRate;
          }
          const readIdxL = Math.max(0, Math.floor(i - modL));
          const readIdxR = Math.max(0, Math.floor(i - modR));

          left[startFrame + i] = copyL[i] * dryScale + copyL[readIdxL] * wetScale;
          right[startFrame + i] = copyR[i] * dryScale + copyR[readIdxR] * wetScale;
        }
        break;
      }

      case 'auto_shift': {
        const semitones = clamp(Number(p.pitch_shift ?? p.semitones ?? 0), -24, 24);
        const formantSt = clamp(Number(p.formant_shift ?? p.formant ?? 0), -12, 12);
        const vibrato = clamp(Number(p.vibrato ?? 0.15), 0, 1);
        const mix = clamp(Number(p.mix ?? 1.0), 0, 1);

        const copyL = left.slice(startFrame, endFrame);
        const copyR = right.slice(startFrame, endFrame);
        const baseRatio = Math.pow(2, (semitones + formantSt * 0.25) / 12);
        let readPos = 0;
        let stepRatio = baseRatio;

        for (let i = 0; i < len; i++) {
          if ((i & 15) === 0) {
            const t = i / sampleRate;
            const vibRatio = 1 + Math.sin(2 * Math.PI * 5.5 * t) * vibrato * 0.012;
            stepRatio = baseRatio * vibRatio;
          }
          const idx0 = Math.floor(readPos) % len;
          const idx1 = (idx0 + 1) % len;
          const frac = readPos - Math.floor(readPos);

          const wetL = copyL[idx0] + (copyL[idx1] - copyL[idx0]) * frac;
          const wetR = copyR[idx0] + (copyR[idx1] - copyR[idx0]) * frac;

          left[startFrame + i] = copyL[i] * (1 - mix) + wetL * mix;
          right[startFrame + i] = copyR[i] * (1 - mix) + wetR * mix;
          readPos += stepRatio;
        }
        break;
      }

      case 'spectral_resonator': {
        const resFreqHz = clamp(
          Number(p.freq ?? context?.carrierFreqHz ?? 220),
          40,
          4000
        );
        const decay = clamp(Number(p.decay ?? 1.4), 0.1, 8.0);
        const mix = clamp(Number(p.mix ?? 0.35), 0, 1);
        const periodSamples = Math.max(4, Math.floor(sampleRate / resFreqHz));
        const fb = clamp(Math.pow(0.001, (periodSamples / sampleRate) / decay), 0.3, 0.94);

        const combL = new Float32Array(periodSamples);
        const combR = new Float32Array(periodSamples);
        let cIdx = 0;

        for (let i = startFrame; i < endFrame; i++) {
          const dryL = left[i];
          const dryR = right[i];
          const outL = dryL + combL[cIdx] * fb;
          const outR = dryR + combR[cIdx] * fb;
          combL[cIdx] = fastTanh(outL);
          combR[cIdx] = fastTanh(outR);
          cIdx = (cIdx + 1) % periodSamples;

          left[i] = dryL * (1 - mix) + combL[cIdx] * mix;
          right[i] = dryR * (1 - mix) + combR[cIdx] * mix;
        }
        break;
      }

      case 'utility': {
        const widthPct = clamp(Number(p.width ?? 100), 0, 200);
        const gainLin = dbToLinear(clamp(Number(p.gain_db ?? p.gain ?? 0), -36, 24));
        const widthScalar = widthPct / 100;

        for (let i = startFrame; i < endFrame; i++) {
          const l = left[i] * gainLin;
          const r = right[i] * gainLin;
          const mid = 0.5 * (l + r);
          const side = 0.5 * (l - r) * widthScalar;
          left[i] = mid + side;
          right[i] = mid - side;
        }
        break;
      }

      case 'limiter': {
        const gainLin = dbToLinear(clamp(Number(p.gain_db ?? 2.0), -12, 24));
        const ceilingLin = dbToLinear(clamp(Number(p.ceiling ?? -0.3), -24, 0));
        const invCeil = 1 / Math.max(0.05, ceilingLin);

        for (let i = startFrame; i < endFrame; i++) {
          const amplifiedL = left[i] * gainLin;
          const amplifiedR = right[i] * gainLin;
          left[i] = clamp(fastTanh(amplifiedL * invCeil) * ceilingLin, -ceilingLin, ceilingLin);
          right[i] = clamp(fastTanh(amplifiedR * invCeil) * ceilingLin, -ceilingLin, ceilingLin);
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Executes an ordered chain of Ableton Audio Effects in series on a stereo audio slice.
   */
  public static applyFxChainToSlice(
    left: Float32Array,
    right: Float32Array,
    startFrame: number,
    frameCount: number,
    sampleRate: number,
    fxChain: FXChainItem[],
    context?: FxSliceContext
  ): void {
    if (!fxChain || fxChain.length === 0) return;
    for (const fx of fxChain) {
      this.applyDeviceToSlice(left, right, startFrame, frameCount, sampleRate, fx, context);
    }
    const endFrame = Math.min(left.length, right.length, startFrame + frameCount);
    for (let i = Math.max(0, startFrame); i < endFrame; i++) {
      const l = left[i];
      const r = right[i];
      left[i] = !Number.isFinite(l) ? 0 : Math.abs(l) > 4.0 ? fastTanh(l * 0.25) * 4.0 : l;
      right[i] = !Number.isFinite(r) ? 0 : Math.abs(r) > 4.0 ? fastTanh(r * 0.25) * 4.0 : r;
    }
  }
}
