import { TCALManager } from './TCALManager';
import { AudioContextManager } from './AudioContextManager';

export class PlaybackOrchestrator {
  constructor(
    private tcal: TCALManager,
    private audioCtx: AudioContextManager
  ) {}

  public async compileAndPlay(compiledEvents: any[]): Promise<void> {
    if (!compiledEvents || compiledEvents.length === 0) return;

    const validEvents: Array<{ startTick: number; atomicEvent: any }> = [];
    const sampleRate = this.audioCtx?.sampleRate || 48000;
    const tempo = 120;
    const ticksPerSecond = 1920 * (tempo / 60);

    for (const atomicEvent of compiledEvents) {
      if (!atomicEvent?.pitch || atomicEvent.pitch.midi === null || atomicEvent.pitch.isRest || atomicEvent.pitch.isSpacer) {
        continue;
      }

      const startTime = atomicEvent.startTime || { numerator: 0, denominator: 1 };
      const num = startTime.numerator * 1920;
      const den = startTime.denominator;

      if (num % den === 0) {
        const startTick = num / den;
        validEvents.push({ startTick, atomicEvent });
        await this.tcal.requestAudioBuffer('salamander_grand', atomicEvent.pitch.midi);
      } else {
        console.warn(
          `[PlaybackOrchestrator] Non‑exact tick for event ${atomicEvent.rawToken || JSON.stringify(atomicEvent)}; deferring to scheduler.`
        );
      }
    }

    if (validEvents.length > 255) {
      throw new Error('Exceeded maximum of 255 events.');
    }

    const buffer: any = this.audioCtx.allocateSharedMemory(validEvents.length);
    if (!buffer || !(buffer instanceof SharedArrayBuffer || buffer instanceof ArrayBuffer)) {
      return;
    }

    const writeIndexView = new Uint32Array(buffer, 0, 1);
    const eventsView = new Float64Array(buffer, 8);

    let enqueued = 0;
    for (const { startTick, atomicEvent } of validEvents) {
      const startSample = sampleRate * (startTick / ticksPerSecond);

      const durNum = atomicEvent.duration.numerator * 1920;
      const durDen = atomicEvent.duration.denominator;
      const durationSamples = sampleRate * (durNum / durDen / ticksPerSecond);

      const offset = enqueued * 4;
      eventsView[offset] = startSample;
      eventsView[offset + 1] = durationSamples;
      eventsView[offset + 2] = atomicEvent.pitch.frequency;
      eventsView[offset + 3] = 1.0;

      enqueued++;
    }

    if (buffer instanceof SharedArrayBuffer) {
      Atomics.store(writeIndexView, 0, enqueued);
    } else {
      writeIndexView[0] = enqueued;
    }
  }
}
