import { describe, it, expect } from 'vitest';
import { AbletonSynthSuite } from '../src/audio/synths/AbletonSynthSuite';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('TDB-720: Ableton Flagship Synthesizer Suite (Operator, Meld, Drift, Analog, Collision, Tension, Electric)', () => {
  it('recognizes all 7 flagship Ableton synth engines and resolves their display specifications', () => {
    const patches = ['operator', 'meld', 'drift', 'analog', 'collision', 'tension', 'electric'];
    for (const p of patches) {
      expect(AbletonSynthSuite.isSupportedPatch(p)).toBe(true);
      const spec = AbletonSynthSuite.getEngineDisplaySpec(p);
      expect(spec.engineLabel.length).toBeGreaterThan(5);
      expect(spec.topologySummary.length).toBeGreaterThan(5);
    }
    expect(AbletonSynthSuite.isSupportedPatch('salamander_grand')).toBe(false);
  });

  it('synthesizes non-zero, bounded waveforms across Operator FM (cascade & additive), Meld Swarm, Drift, Collision, Tension, and Electric', () => {
    const engines = ['operator', 'meld', 'drift', 'analog', 'collision', 'tension', 'electric'] as const;

    for (const eng of engines) {
      const params = AbletonSynthSuite.resolveParams(eng);
      let energy = 0;
      for (let i = 1; i <= 64; i++) {
        const s = AbletonSynthSuite.computeSampleAtTime(i / 44100, 440, params);
        expect(Number.isFinite(s)).toBe(true);
        expect(Math.abs(s)).toBeLessThanOrEqual(2.0);
        energy += s * s;
      }
      expect(energy).toBeGreaterThan(0.01);
    }
  });

  it('compiles and exports a multi-track score featuring Operator, Meld, Drift, Collision, Tension, and Electric to stereo WAV', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Ableton Flagship Synth Showcase", tempo: 124, time: "4/4" }
        def fm_bell "Operator FM" style=synth patch="operator" env=@{algorithm: "4", ratioA: "1.0", ratioB: "3.5"}
        def swarm_pad "Meld Swarm" style=synth patch="meld" macros=@{swarm_spread: 75, harmonic_tilt: 60}
        def sub_bass "Drift Bass" style=synth patch="drift" macros=@{drift_amount: 45, cutoff: 80}
        def mallet "Collision Marimba" style=synth patch="collision"
        def pluck "Tension String" style=synth patch="tension"
        def epiano "Electric Tine" style=synth patch="electric"

        measure 1 {
          fm_bell: a5:4 e5:4 d5:2 |
          swarm_pad: [d4 f4 a4 c5]:1 |
          sub_bass: d2:8 d2:8 a1:8 a1:8 d2:4 a1:4 |
          mallet: d5:8 f5:8 a5:8 d6:8 a5:4 f5:4 |
          pluck: a3:4 d4:4 f4:2 |
          epiano: [f3 a3 c4 e4]:2 [g3 b3 d4 f4]:2 |
        }
      }
    `);

    expect(score.defs).toHaveLength(6);
    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBeGreaterThan(44100 * 2);
  });
});
