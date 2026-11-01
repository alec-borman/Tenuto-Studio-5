/// <reference lib="webworker" />
import { renderContinuousVoicePcm } from './synths/renderContinuousVoicePcm';

/**
 * Off-main-thread synth voice renderer. The scheduler posts upcoming ContinuousSynthEngine voices
 * here so heavy DSP (50–300 ms per voice) never blocks the 25 ms lookahead timer.
 */
self.onmessage = (e: MessageEvent) => {
  const { jobId, item, sampleRate, tempoBpm, voiceSeed } = e.data;
  try {
    const { left, right } = renderContinuousVoicePcm(item, sampleRate, tempoBpm, voiceSeed);
    (self as any).postMessage({ jobId, left, right }, [left.buffer, right.buffer]);
  } catch (err) {
    (self as any).postMessage({ jobId, error: String((err as any)?.message || err) });
  }
};
