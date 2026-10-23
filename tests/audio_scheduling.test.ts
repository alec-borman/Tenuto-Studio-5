import { describe, it, expect, vi } from 'vitest';
import { AudioContextManager } from '../src/audio/AudioContextManager';
import { PlaybackOrchestrator } from '../src/audio/PlaybackOrchestrator';
import { TCALManager } from '../src/audio/TCALManager';

vi.mock('../src/audio/TCALManager');

vi.stubGlobal('registerProcessor', vi.fn());
vi.stubGlobal(
  'AudioWorkletProcessor',
  class {
    port = { onmessage: null as any };
    constructor() {}
  }
);

describe('TDB-603: Audio Event Scheduler', () => {
  it('schedules events and the processor outputs the correct sine wave', async () => {
    const { TenutoProcessor } = await import('../src/audio/TenutoProcessor');

    let capturedBuffer: SharedArrayBuffer | null = null;
    (global as any).AudioContext = class {
      sampleRate = 48000;
      audioWorklet = {
        addModule: vi.fn().mockResolvedValue(undefined),
      };
    };
    (global as any).AudioWorkletNode = class {
      port = {
        postMessage: (msg: any) => {
          if (msg.type === 'INIT_BUFFER') {
            capturedBuffer = msg.buffer;
          }
        },
      };
    };

    const audio = new AudioContextManager();
    await audio.initialize();

    const tcal = new TCALManager();
    tcal.requestAudioBuffer = vi.fn().mockReturnValue(new ArrayBuffer(0));
    const orch = new PlaybackOrchestrator(tcal, audio);

    // Two events: a C4 eighth note at tick 0 (duration 3000 samples), and a D4 quarter note at tick 480 (startSample 6000)
    const events = [
      {
        pitch: { midi: 60, frequency: 261.63 },
        duration: { numerator: 1, denominator: 8 },
        startTime: { numerator: 0, denominator: 1 },
      },
      {
        pitch: { midi: 62, frequency: 293.66 },
        duration: { numerator: 1, denominator: 4 },
        startTime: { numerator: 1, denominator: 4 },
      },
    ];

    await orch.compileAndPlay(events);

    const processor = new TenutoProcessor();
    processor.port.onmessage({
      data: { type: 'INIT_BUFFER', buffer: capturedBuffer },
    } as any);

    const chunkSize = 8000;
    const outputs = [[new Float32Array(chunkSize)]];
    (global as any).sampleRate = 48000;

    processor.process([], outputs, {});
    const channel = outputs[0][0];

    // First note is active around sample 100
    expect(channel[100]).not.toBe(0);
    // Silence between note 1 (ends at 3000) and note 2 (starts at 6000)
    expect(channel[5999]).toBeCloseTo(0, 5);
    // Second note starts at sample 6000
    expect(channel[6000]).not.toBe(0);
  });
});
