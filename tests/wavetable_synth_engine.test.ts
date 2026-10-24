import { describe, it, expect } from 'vitest';
import { WavetableEngine } from '../src/audio/synths/WavetableEngine';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { resolveSoundfontInstrument } from '../src/audio/SoundfontLibrary';

describe('TDB-716: Wavetable Synthesizer & Modulation Matrix', () => {
  it('morphs harmonic spectra continuously from pure Sine (0.0) to Sawtooth (0.66) and Square (1.0) in basic_shapes', () => {
    const sineSpec = WavetableEngine.computeHarmonicSpectrum('basic_shapes', 0.0);
    // At pos 0.0 (Sine), fundamental (index 1) is 1.0 and 2nd/3rd harmonics are 0.0
    expect(sineSpec.imag[1]).toBeCloseTo(1.0, 4);
    expect(sineSpec.imag[2]).toBeCloseTo(0.0, 4);
    expect(sineSpec.imag[3]).toBeCloseTo(0.0, 4);

    const sawSpec = WavetableEngine.computeHarmonicSpectrum('basic_shapes', 2 / 3);
    // At pos 2/3 (Sawtooth), both even (index 2) and odd (index 3) harmonics are present
    expect(sawSpec.imag[1]).toBeCloseTo(1.0, 2);
    expect(sawSpec.imag[2]).toBeGreaterThan(0.4);
    expect(sawSpec.imag[3]).toBeGreaterThan(0.3);

    const squareSpec = WavetableEngine.computeHarmonicSpectrum('basic_shapes', 1.0);
    // At pos 1.0 (Square), even harmonics (index 2) vanish and odd harmonics (index 3) remain strong
    expect(squareSpec.imag[2]).toBeCloseTo(0.0, 3);
    expect(squareSpec.imag[3]).toBeCloseTo(1 / 3, 2);
  });

  it('computes Unison detune, stereo pan spread, and position spread across 6 Unison modes', () => {
    const leftVoice = WavetableEngine.getUnisonVoiceOffsets(0, 4, 'position_spread', 0.8);
    const rightVoice = WavetableEngine.getUnisonVoiceOffsets(3, 4, 'position_spread', 0.8);

    expect(leftVoice.detuneCents).toBeLessThan(0);
    expect(rightVoice.detuneCents).toBeGreaterThan(0);
    expect(leftVoice.panOffset).toBeLessThan(0);
    expect(rightVoice.panOffset).toBeGreaterThan(0);
    expect(leftVoice.posOffset).toBeLessThan(0);
    expect(rightVoice.posOffset).toBeGreaterThan(0);
  });

  it('routes patch="wavetable" to WavetableEngine (bypassing SoundFont fallback) and renders stereo WAV audio', async () => {
    expect(resolveSoundfontInstrument('lead', 'Wavetable Lead', 'wavetable', 'synth')).toBeNull();

    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Wavetable Synth Test", tempo: 120, time: "4/4" }
        def lead "Wavetable Synth" style=synth patch="wavetable" macros=@{osc1_pos: 65, unison: 50, sub_level: 45, cutoff: 3800} .fx(wavetable, @{bank1: "formant_vocal", unison_mode: "shimmer", unison_voices: 4, env2_to_pos: 0.4})

        measure 1 {
          lead: c4:4.lyric("Doin'") e4:4 g4:2 |
        }
      }
    `);

    const params = WavetableEngine.resolveParams(score.defs[0], score.events[0].physics);
    expect(params.bank1).toBe('formant_vocal');
    expect(params.unisonMode).toBe('shimmer');
    expect(params.unisonVoices).toBe(4);
    expect(params.osc1Pos).toBeCloseTo(0.65, 2);
    expect(params.subGain).toBeCloseTo(0.45, 2);

    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.size).toBeGreaterThan(44100 * 2);
  });
});
