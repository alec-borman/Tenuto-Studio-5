import { ContinuousSynthEngine, ContinuousVoiceNote } from './ContinuousSynthEngine';
import { AbletonAudioFxEngine } from '../fx/AbletonAudioFxEngine';

export interface PcmBufferStats {
  peak: number;
  rms: number;
  nanCount: number;
  nonZeroFrames: number;
}

export interface RenderedContinuousVoicePcm extends PcmBufferStats {
  left: Float32Array;
  right: Float32Array;
}

/**
 * Scrubs any NaN/Infinity values, soft-limits extreme runaway spikes (> 4.0) so WebAudio
 * filters/compressors never blow up, and computes Peak + RMS + non-zero frame counts.
 */
export function measureAndSanitizeStereoPcm(
  left: Float32Array,
  right: Float32Array
): PcmBufferStats {
  const len = Math.min(left.length, right.length);
  if (len === 0) {
    return { peak: 0, rms: 0, nanCount: 0, nonZeroFrames: 0 };
  }
  let peak = 0;
  let sumSq = 0;
  let nanCount = 0;
  let nonZeroFrames = 0;

  // 1st-order DC blocker (R=0.998 => ~14 Hz cutoff at 44.1kHz):
  // Eliminates wavefold / rectification / saturation DC offsets that rail speakers or compressors
  const R = 0.998;
  let prevXL = 0;
  let prevYL = 0;
  let prevXR = 0;
  let prevYR = 0;

  for (let i = 0; i < len; i++) {
    let l = left[i];
    let r = right[i];

    if (!Number.isFinite(l)) {
      l = 0;
      nanCount++;
    } else if (l > 4.0) {
      l = 4.0;
    } else if (l < -4.0) {
      l = -4.0;
    }

    if (!Number.isFinite(r)) {
      r = 0;
      nanCount++;
    } else if (r > 4.0) {
      r = 4.0;
    } else if (r < -4.0) {
      r = -4.0;
    }

    const yL = l - prevXL + R * prevYL;
    prevXL = l;
    prevYL = yL;
    left[i] = yL;

    const yR = r - prevXR + R * prevYR;
    prevXR = r;
    prevYR = yR;
    right[i] = yR;

    const absL = yL < 0 ? -yL : yL;
    const absR = yR < 0 ? -yR : yR;
    const maxLR = absL > absR ? absL : absR;
    if (maxLR > peak) peak = maxLR;
    if (maxLR > 1e-6) nonZeroFrames++;
    sumSq += 0.5 * (yL * yL + yR * yR);
  }

  const rms = Math.sqrt(sumSq / len);
  return { peak, rms, nanCount, nonZeroFrames };
}

/**
 * Pure PCM renderer for a single `ContinuousSynthEngine` voice + its active FX chain.
 * Runs identically on the main thread and inside `voiceBakeWorker`.
 */
export function renderContinuousVoicePcm(
  item: ContinuousVoiceNote,
  sampleRate: number,
  tempoBpm: number,
  voiceSeed: number
): RenderedContinuousVoicePcm {
  const rawRelease = Number(item.def?.env?.release);
  const baseReleaseSec = Math.min(0.45, Math.max(0.06, Number.isFinite(rawRelease) ? rawRelease * 0.25 : 0.14));
  const fxChain = AbletonAudioFxEngine.resolveActiveFxChain(item.def, item.event);
  let fxTailSec = 0;
  if (fxChain.length > 0) {
    for (let i = 0; i < fxChain.length; i++) {
      const fxType = fxChain[i].type.toLowerCase();
      if (fxType.includes('reverb') || fxType.includes('echo') || fxType.includes('delay')) {
        fxTailSec = 0.35;
        break;
      }
    }
  }
  const releaseTailSec = baseReleaseSec + fxTailSec;
  const totalFrames = Math.max(64, Math.ceil((item.durSec + releaseTailSec) * sampleRate));
  const noteFrames = Math.max(32, Math.ceil(item.durSec * sampleRate));
  const chL = new Float32Array(totalFrames);
  const chR = new Float32Array(totalFrames);

  ContinuousSynthEngine.renderVoiceIntoTrackStem(
    chL,
    chR,
    0,
    noteFrames,
    sampleRate,
    tempoBpm,
    voiceSeed,
    item
  );

  if (fxChain.length > 0) {
    const fastChain = fxChain.filter((f) => f.type !== 'vocoder');
    if (fastChain.length > 0) {
      AbletonAudioFxEngine.applyFxChainToSlice(chL, chR, 0, totalFrames, sampleRate, fastChain, {
        tempoBpm,
        carrierFreqHz: item.freq,
      });
    }
  }

  const stats = measureAndSanitizeStereoPcm(chL, chR);
  return {
    left: chL,
    right: chR,
    peak: stats.peak,
    rms: stats.rms,
    nanCount: stats.nanCount,
    nonZeroFrames: stats.nonZeroFrames,
  };
}
