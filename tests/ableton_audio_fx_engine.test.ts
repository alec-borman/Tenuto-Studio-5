import { describe, it, expect } from 'vitest';
import {
  AbletonAudioFxEngine,
  ABLETON_AUDIO_FX_NAMES,
  VOCODER_20_BAND_CENTERS_HZ,
} from '../src/audio/fx/AbletonAudioFxEngine';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('TDB-722: Ableton Audio Effects DSP Engine & 20-Band Talking Vocoder', () => {
  it('recognizes all 18 Ableton Audio Effects and exposes the 20-band Talking Vocoder filterbank centers', () => {
    expect(ABLETON_AUDIO_FX_NAMES).toHaveLength(18);
    expect(VOCODER_20_BAND_CENTERS_HZ).toHaveLength(20);
    expect(VOCODER_20_BAND_CENTERS_HZ[0]).toBe(90);
    expect(VOCODER_20_BAND_CENTERS_HZ[19]).toBe(9600);

    for (const fxName of ABLETON_AUDIO_FX_NAMES) {
      expect(AbletonAudioFxEngine.isSupportedFx(fxName)).toBe(true);
    }
    expect(AbletonAudioFxEngine.isSupportedFx('ott')).toBe(true);
    expect(AbletonAudioFxEngine.normalizeFxType('ott')).toBe('multiband_dynamics');
  });

  it('processes stereo audio slices across all 18 Ableton Audio Effects with non-zero finite output and zero NaNs', () => {
    const sampleRate = 44100;
    const frames = 2048;

    for (const fxName of ABLETON_AUDIO_FX_NAMES) {
      const left = new Float32Array(frames);
      const right = new Float32Array(frames);

      // Seed rich saw-like harmonic chord carrier
      for (let i = 0; i < frames; i++) {
        const t = i / sampleRate;
        const sig =
          0.35 * Math.sin(2 * Math.PI * 220 * t) +
          0.25 * Math.sin(2 * Math.PI * 440 * t) +
          0.15 * Math.sin(2 * Math.PI * 880 * t) +
          0.1 * Math.sin(2 * Math.PI * 1760 * t);
        left[i] = sig;
        right[i] = sig * 0.92;
      }

      AbletonAudioFxEngine.applyFxChainToSlice(
        left,
        right,
        0,
        frames,
        sampleRate,
        [{ type: fxName, params: {} }],
        { lyric: 'Harder', carrierFreqHz: 220 }
      );

      let energy = 0;
      for (let i = 0; i < frames; i++) {
        expect(Number.isFinite(left[i])).toBe(true);
        expect(Number.isFinite(right[i])).toBe(true);
        energy += left[i] * left[i] + right[i] * right[i];
      }
      expect(energy).toBeGreaterThan(0.05);
    }
  });

  it('imprints distinct formant spectral envelopes onto carrier chords via the 20-Band Talking Vocoder for different lyrics', () => {
    const sampleRate = 44100;
    const frames = 4096;

    const makeCarrier = () => {
      const l = new Float32Array(frames);
      const r = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const t = i / sampleRate;
        // Rich multi-harmonic sawtooth carrier
        let s = 0;
        for (let h = 1; h <= 16; h++) {
          s += Math.sin(2 * Math.PI * 146.83 * h * t) / h;
        }
        l[i] = s * 0.35;
        r[i] = s * 0.35;
      }
      return { l, r };
    };

    const bow1 = makeCarrier();
    const bow2 = makeCarrier();

    AbletonAudioFxEngine.applyTalkingVocoderToSlice(
      bow1.l,
      bow1.r,
      0,
      frames,
      sampleRate,
      'doin',
      { depth: 1.2, mix: 1.0 }
    );
    AbletonAudioFxEngine.applyTalkingVocoderToSlice(
      bow2.l,
      bow2.r,
      0,
      frames,
      sampleRate,
      'right',
      { depth: 1.2, mix: 1.0 }
    );

    let diffEnergy = 0;
    for (let i = 0; i < frames; i++) {
      const d = bow1.l[i] - bow2.l[i];
      diffEnergy += d * d;
    }
    expect(diffEnergy).toBeGreaterThan(0.01);
  });

  it('compiles and exports a multi-track score featuring Talking Vocoder (.fx(vocoder).lyric(...)), OTT, Drum Buss, and Roar to stereo WAV', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "3.0" {
        meta @{ title: "Daft Vocoder & Ableton FX Showcase", tempo: 124, time: "4/4" }
        def talk_lead "Talking Robot" style=synth patch="wavetable" fx=@{ vocoder: @{ bands: 20, depth: 1.1, mix: 0.95 }, multiband_dynamics: @{ amount: 0.5 } }
        def acid_bass "Roar Bass" style=synth patch="analog" fx=@{ auto_filter: @{ cutoff: 1400, res: 0.6, drive: 4.5 }, roar: @{ drive: 0.5, feedback: 0.25 } }
        def drums "808 Kit" style=grid patch="tenuto_808_kit" fx=@{ drum_buss: @{ drive: 0.4, crunch: 0.3, boom_amount: 0.5 }, glue_compressor: @{ threshold: -10, makeup: 3 } }

        measure 1 {
          talk_lead: [d4 f4 a4 c5]:4.fx(vocoder).lyric("Harder") [g3 b3 d4 f4]:4.fx(vocoder).lyric("Better") [a3 c4 e4 g4]:4.fx(vocoder).lyric("Faster") [d4 f4 a4]:4.fx(vocoder).lyric("Stronger") |
          acid_bass: d2:8 d2:8 a1:8 a1:8 g1:4 a1:4 |
          drums: k:4 s:4 k:4 s:4 |
        }
      }
    `);

    expect(score.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBeGreaterThan(44100 * 2);
  });
});
