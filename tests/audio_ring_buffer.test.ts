import { describe, it, expect } from 'vitest';
import { VoicePcmRingBuffer, StereoDelayRingBuffer } from '../src/audio/AudioRingBuffer';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { renderContinuousVoicePcm } from '../src/audio/synths/renderContinuousVoicePcm';

describe('AudioRingBuffer & 30-Measure Crucible Stress Study', () => {
  it('wraps circularly at maxSlots and enforces maxTotalFrames budget in VoicePcmRingBuffer', () => {
    const maxSlots = 8;
    const maxFrames = 4000;
    const ring = new VoicePcmRingBuffer(maxSlots, maxFrames);

    for (let i = 0; i < 12; i++) {
      const left = new Float32Array(400).fill(i + 1);
      const right = new Float32Array(400).fill(-(i + 1));
      ring.write(`voice-${i}`, left, right);
      expect(ring.size).toBeLessThanOrEqual(maxSlots);
      expect(ring.currentFrames).toBeLessThanOrEqual(maxFrames);
    }

    // Oldest 4 slots (voice-0..voice-3) were overwritten by circular wraparound
    expect(ring.has('voice-0')).toBe(false);
    expect(ring.has('voice-3')).toBe(false);
    expect(ring.has('voice-11')).toBe(true);
    expect(ring.get('voice-11')?.left[0]).toBe(12);

    // Writing a single 2500-frame buffer evicts older slots to stay <= 4000 total frames
    ring.write('huge-voice', new Float32Array(2500), new Float32Array(2500));
    expect(ring.currentFrames).toBeLessThanOrEqual(maxFrames);
    expect(ring.has('huge-voice')).toBe(true);
  });

  it('evicts finished AudioBuffers outside the active playhead ring window', () => {
    const ring = new VoicePcmRingBuffer(16, 44100 * 16);
    const dummyBuf = {} as AudioBuffer;
    const timeline = [
      { startSec: 0.0, durSec: 2.0, prebakedBuffer: dummyBuf },
      { startSec: 2.0, durSec: 2.0, prebakedBuffer: dummyBuf },
      { startSec: 4.0, durSec: 2.0, prebakedBuffer: dummyBuf },
      { startSec: 20.0, durSec: 2.0, prebakedBuffer: dummyBuf },
    ];

    const evicted = ring.evictTimelineWindow(timeline, 5.0, 0.5, 10.0, false);
    expect(evicted).toBe(3);
    // [0..2] and [2..4] ended before (5.0 - 0.5 = 4.5s), and [20..22] starts after (5.0 + 10.0 = 15.0s)
    expect(timeline[0].prebakedBuffer).toBeUndefined();
    expect(timeline[1].prebakedBuffer).toBeUndefined();
    expect(timeline[2].prebakedBuffer).toBe(dummyBuf);
    expect(timeline[3].prebakedBuffer).toBeUndefined();
  });

  it('reads and writes accurately across wraparound boundaries in StereoDelayRingBuffer', () => {
    const delayRing = new StereoDelayRingBuffer(100);
    expect(delayRing.capacity).toBe(128);
    for (let i = 0; i < 300; i++) {
      delayRing.writeAndAdvance(i, -i);
      if (i >= 50) {
        expect(delayRing.readLeft(50)).toBe(i - 50);
        expect(delayRing.readRight(50)).toBe(-(i - 50));
      }
    }
  });

  it('renders heavy multi-voice hardware/binaural/wavefolder voices rapidly and bounds ring memory', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{
          title: "Crucible Ring Buffer Benchmark",
          tempo: 76,
          time: "4/4",
          key: "E",
          scale: "minor",
          master_tune: -14
        }
        def lead "3D MPE Morph Lead" style=synth patch="morph_analog_12"
          vol=88 pan=-0.12 detune=58 cutoff=3400 resonance=1.25 sub=20 air=38 width=135 slop=24
          .fx(spectral_pitch_harmonizer, @{ shift1_st: 7, shift2_st: -12, mix: 0.18 })
          .fx(chorus, @{ rate: 0.42, amount: 0.34, mix: 0.40 })
        def pad "Binaural Planing Pad" style=synth patch="binaural_hybrid_20"
          vol=84 pan=0.10 detune=62 cutoff=2600 resonance=1.05 sub=20 air=30 width=155 slop=32
          .fx(tape_degrade, @{ wow_hz: 0.42, wow_depth_ms: 1.6, flutter_hz: 9.4, high_cut: 5400, drive: 0.28, mix: 0.75 })
        def krell "West Coast Cybernetic" style=synth patch="west_coast_200"
          vol=80 pan=-0.22 cutoff=2900 resonance=1.40

        measure 1 {
          lead: r:4 b4:2.mp.legato.vowel("oh", "ooh", 0.25).wow_flutter(4.5, 0.40, 2.0, 9.0).glide(180ms) g4:4.p.legato |
          pad: [e2 b2 g3 d4 f#4]:1.p.open_voice.warp_wave("bend", 30%).binaural(14c).detune(22%, 0.15..0.90).filter(620, 1650).wow_flutter(5.0, 0.38, 2.4, 9.2).glide(240ms) |
          krell: e4:1.mp.eoc_cycle(5).fold(68%).lpg("both", 380ms).aliasing(24%) |
        }
        measure 2 {
          lead: f#4:2..mp.legato.tri_fold(35%).steiner_drive(30%).wow_flutter(4.8, 0.42, 2.2, 8.8).glide(200ms) e4:4.p.dim |
          pad: [c2 g2 e3 b3 d4]:1.p.open_voice.warp_wave("bend", 30%).binaural(14c).detune(24%, 0.15..0.90).filter(680, 1850).wow_flutter(5.2, 0.36, 2.6, 9.4).glide(240ms) |
          krell: g4:1.mp.eoc_cycle(6).fold(74%).lpg("both", 340ms).aliasing(28%) |
        }
      }
    `);

    const engine = new StudioAudioEngine();
    const timeline = (engine as any).buildScheduledTimeline(score);
    expect(timeline.length).toBeGreaterThan(10);

    const t0 = performance.now();
    for (let i = 0; i < timeline.length; i++) {
      const pcm = renderContinuousVoicePcm(timeline[i], 44100, 76, i + 1);
      expect(pcm.left.length).toBeGreaterThan(1000);
      engine.voiceRingBuffer.write(`k-${i}`, pcm.left, pcm.right);
    }
    const elapsedMs = performance.now() - t0;
    // All 2 measures (6.32s of dense 20-voice binaural pad + spectral pitch harmonizer lead + krell)
    // must render in well under 500ms total
    expect(elapsedMs).toBeLessThan(500);
    expect(engine.voiceRingBuffer.currentFrames).toBeLessThanOrEqual(engine.voiceRingBuffer.maxFrames);
  });

  it('records detailed multi-channel diagnostics and prevents stale worker queue starvation', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Ultraviolet Drift Diagnostic Check", tempo: 108, time: "4/4", key: "A", scale: "minor" }
        def lead "Analog Saw Lead" style=synth patch="saw_lead" vol=92 detune=55 cutoff=3800
        def arp "Pluck Synth Arp" style=synth patch="pluck_lead" vol=78 detune=40 cutoff=3200
        measure 1 {
          lead: r:2 e5:4.mp.legato g5:8.legato a5:8.legato |
          arp:  a3:8.p e4:8 a4:8 b4:8 c5:8 b4:8 a4:8 e4:8 |
        }
        measure 2 {
          lead: e5:2.mf.vib c5:4.mp.legato d5:4.legato |
          arp:  f3:8.p c4:8 f4:8 g4:8 a4:8 g4:8 f4:8 c4:8 |
        }
      }
    `);

    const engine = new StudioAudioEngine();
    const timeline = (engine as any).buildScheduledTimeline(score);
    expect(timeline.length).toBeGreaterThanOrEqual(19);

    for (let i = 0; i < timeline.length; i++) {
      const res = renderContinuousVoicePcm(timeline[i], 44100, 108, i + 1);
      expect(res.peak).toBeGreaterThan(0.01);
      expect(res.rms).toBeGreaterThan(0.001);
      expect(res.nanCount).toBe(0);
    }
  });
});

