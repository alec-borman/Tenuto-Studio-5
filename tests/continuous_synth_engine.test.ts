import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/compiler/DocumentParser';
import { applyTemperamentAndMasterTune } from '../src/compiler/PitchEngine';
import {
  ContinuousSynthEngine,
  clampCurveWindowBeforeGlide,
  computeFormantVowelFrequencies,
} from '../src/audio/ContinuousSynthEngine';
import { AbletonAudioFxEngine } from '../src/audio/AbletonAudioFxEngine';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('TDB-750: Anti-Skip AudioParam Guard, Wavetable Cache & Voltage/Gesture Synth Expansion (v5.3.8)', () => {
  it('prevents setValueCurveAtTime / linearRampToValueAtTime collisions via clampCurveWindowBeforeGlide', () => {
    const win = clampCurveWindowBeforeGlide(2.0, 1.0, 0.25, 0.95, 0.14);
    expect(win.startSec).toBeGreaterThanOrEqual(2.25);
    // Must finish strictly before the glide ramp begins at (2.0 + 1.0 - 0.14 = 2.86s)
    expect(win.startSec + win.durationSec).toBeLessThanOrEqual(2.855);
  });

  it('subdivides steps via .ratchet(3, "up") and .ratchet(4, "down") with exact duration conservation and velocity curves', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Berlin Ratchet Test", tempo: 120, time: "4/4" }
        def seq "Step Sequencer" style=synth patch="pluck_lead"
        measure 1 {
          seq: c3:4.mf.ratchet(3, "up") g3:4.f.ratchet(4, "down") r:2 |
        }
      }
    `);

    const upPulses = score.events.slice(0, 3);
    expect(upPulses).toHaveLength(3);
    const upTotalDur = upPulses.reduce(
      (sum, ev) => sum + ev.duration.numerator / ev.duration.denominator,
      0
    );
    expect(upTotalDur).toBeCloseTo(0.25, 5);
    expect(upPulses[0].ratchet).toEqual({ count: 3, curve: 'up' });
    expect(upPulses[0].velocity!).toBeLessThan(upPulses[1].velocity!);
    expect(upPulses[1].velocity!).toBeLessThan(upPulses[2].velocity!);

    const downPulses = score.events.slice(3, 7);
    expect(downPulses).toHaveLength(4);
    const downTotalDur = downPulses.reduce(
      (sum, ev) => sum + ev.duration.numerator / ev.duration.denominator,
      0
    );
    expect(downTotalDur).toBeCloseTo(0.25, 5);
    expect(downPulses[0].ratchet).toEqual({ count: 4, curve: 'down' });
    expect(downPulses[0].velocity!).toBeGreaterThan(downPulses[1].velocity!);
    expect(downPulses[1].velocity!).toBeGreaterThan(downPulses[2].velocity!);
    expect(downPulses[2].velocity!).toBeGreaterThan(downPulses[3].velocity!);
  });

  it('expands parallel harmonic planing via .plane("m9") and strips the root via .rootless', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Parallel Chord Planing", tempo: 118, time: "4/4", key: "C", scale: "major", scale_lock: true }
        def pad "Planing Pad" style=synth patch="flutter_pad"
        measure 1 {
          pad: b3:2.plane("m9") b3:2.plane("m9").rootless |
        }
      }
    `);

    const beat1Voices = score.events.filter(
      (ev) => ev.startTime && ev.startTime.numerator === 0
    );
    // B3 minor 9th: B3 (59), D4 (62), F#4 (66), A4 (69), C#5 (73)
    expect(beat1Voices).toHaveLength(5);
    expect(beat1Voices.map((v) => v.pitch.midi)).toEqual([59, 62, 66, 69, 73]);
    expect(beat1Voices[0].noteNames).toEqual(['B3', 'D4', 'F#4', 'A4', 'C#5']);
    expect(beat1Voices[0].harmonicPlane).toBe('m9');

    const beat2Voices = score.events.filter(
      (ev) => ev.startTime && ev.startTime.numerator === 1 && ev.startTime.denominator === 2
    );
    // Rootless B3 minor 9th strips B3 (59) -> D4 (62), F#4 (66), A4 (69), C#5 (73)
    expect(beat2Voices).toHaveLength(4);
    expect(beat2Voices.map((v) => v.pitch.midi)).toEqual([62, 66, 69, 73]);
    expect(beat2Voices[0].noteNames).toEqual(['D4', 'F#4', 'A4', 'C#5']);
    expect(beat2Voices[0].rootlessVoicing).toBe(true);
  });

  it('parses .swarm, .vowel, .fold, .squeeze, .bend_voice and computes Carlos non-octave temperaments, formant vowels, and gated_reverb', async () => {
    expect(computeFormantVowelFrequencies('oh')).toEqual([490, 880]);
    expect(computeFormantVowelFrequencies('ooh')).toEqual([320, 800]);
    expect(ContinuousSynthEngine.computeFormantVowelFrequencies('a')).toEqual([730, 1090]);

    // Wendy Carlos Alpha (78.0c/step) & master_tune (-25c)
    const baseC4 = 261.625565;
    const tunedC4 = applyTemperamentAndMasterTune(baseC4, 60, '12tet', -25, 60);
    expect(tunedC4).toBeCloseTo(baseC4 * Math.pow(2, -25 / 1200), 4);

    const baseC5 = 523.25113;
    const alphaC5 = applyTemperamentAndMasterTune(baseC5, 72, 'carlos_alpha', 0, 60);
    // 12 steps above root in Carlos Alpha = 12 * 78c = 936c above C4 (or -264c relative to 12-TET C5)
    expect(alphaC5).toBeCloseTo(baseC5 * Math.pow(2, (12 * (78 - 100)) / 1200), 4);

    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{
          title: "Voltage and Gesture",
          tempo: 78,
          time: "4/4",
          temperament: "carlos_alpha",
          master_tune: -25
        }
        def swarm "Swarmatron" style=synth patch="swarmatron"
        def haunt "Boards Pad" style=synth patch="hauntology_pad"
        def krell "Buchla Krell" style=synth patch="buchla_krell" .fx(gated_reverb, @{ decay: 3.2, gate_ms: 160, mix: 0.55 })

        measure 1 {
          swarm: e3:1.swarm([0.2, 3.0, 0.5]) |
          haunt: [e3 b3 g4]:1.vowel("oh", "ooh", 0.2).squeeze(90%).bend_voice(1, 50c, 0.2..0.8) |
          krell: b3:1.fold(75%) |
        }
      }
    `);

    expect(score.meta.temperament).toBe('carlos_alpha');
    expect(score.meta.masterTune).toBe(-25);

    const swarmEv = score.events.find((e) => e.trackId === 'swarm')!;
    expect(swarmEv.swarmSpreadSemitones).toEqual([0.2, 3.0, 0.5]);

    const hauntEv = score.events.find((e) => e.trackId === 'haunt')!;
    expect(hauntEv.vowelFormant).toEqual({ from: 'oh', to: 'ooh', rateHz: 0.2 });
    expect(hauntEv.osmoseSqueeze).toBe(90);
    expect(hauntEv.voiceBend).toEqual({
      voiceIndex: 1,
      cents: 50,
      startWindow: 0.2,
      endWindow: 0.8,
    });

    const krellEv = score.events.find((e) => e.trackId === 'krell')!;
    expect(krellEv.wavefoldAmount).toBe(75);
    expect(AbletonAudioFxEngine.isSupportedFx('gated_reverb')).toBe(true);

    const engine = new StudioAudioEngine();
    const wav = await engine.exportWavBlob(score);
    expect(wav.type).toBe('audio/wav');
    expect(wav.size).toBeGreaterThan(44100 * 2);
  });
});
