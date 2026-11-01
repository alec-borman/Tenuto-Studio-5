/// <reference lib="webworker" />
import { renderContinuousVoicePcm } from './synths/renderContinuousVoicePcm';

/**
 * Off-main-thread synth voice renderer. The scheduler posts upcoming ContinuousSynthEngine voices
 * here so heavy DSP (50–300 ms per voice) never blocks the lookahead timer.
 */
self.onmessage = (e: MessageEvent) => {
  const { jobId, item, sampleRate, tempoBpm, voiceSeed } = e.data;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const { left, right, peak, rms, nanCount, nonZeroFrames } = renderContinuousVoicePcm(
      item,
      sampleRate,
      tempoBpm,
      voiceSeed
    );
    const bakeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    (self as unknown as Worker).postMessage(
      { jobId, left, right, peak, rms, nanCount, nonZeroFrames, bakeMs },
      [left.buffer, right.buffer]
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      jobId,
      error: String((err as { message?: string })?.message || err),
    });
  }
};
