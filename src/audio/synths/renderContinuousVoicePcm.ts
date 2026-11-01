import { ContinuousSynthEngine, ContinuousVoiceNote } from './ContinuousSynthEngine';
import { AbletonAudioFxEngine } from '../fx/AbletonAudioFxEngine';

/**
 * Pure (DOM-free) renderer for one ContinuousSynthEngine voice plus its `.fx(...)` chain.
 * Shared by the main-thread fallback and `voiceBakeWorker.ts` so both produce identical PCM.
 */
export function continuousVoiceFrameCount(
  item: ContinuousVoiceNote & { durSec: number },
  sampleRate: number
): number {
  const art = item.event.physics?.articulation;
  const relSec = art === 'stacc' || art === 'staccato' ? 0.14 : 0.28;
  const totalSec = Math.max(0.06, item.durSec + relSec);
  return Math.max(128, Math.floor(totalSec * sampleRate));
}

export function renderContinuousVoicePcm(
  item: ContinuousVoiceNote & { durSec: number; freq: number },
  sampleRate: number,
  tempoBpm: number,
  voiceSeed: number
): { left: Float32Array; right: Float32Array } {
  const frames = continuousVoiceFrameCount(item, sampleRate);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  ContinuousSynthEngine.renderVoiceIntoTrackStem(
    left,
    right,
    0,
    frames,
    sampleRate,
    tempoBpm,
    voiceSeed,
    item
  );
  const fxChain = AbletonAudioFxEngine.resolveActiveFxChain(item.def, item.event);
  if (fxChain.length > 0) {
    AbletonAudioFxEngine.applyFxChainToSlice(left, right, 0, frames, sampleRate, fxChain, {
      lyric: item.event.physics?.lyric,
      carrierFreqHz: item.freq,
    });
  }
  return { left, right };
}
