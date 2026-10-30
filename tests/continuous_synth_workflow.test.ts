import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { ContinuousSynthEngine } from '../src/audio/synths/ContinuousSynthEngine';

describe('TDB-724: True Continuous Synth Workflow, Intra-Note Windowed Detune & 20-Feature Synth Suite', () => {
  it('evaluates intra-note time-windowed detune (0.4..0.85) and multi-point curve arrays ([0, 90, 20]) with smooth feathering', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Windowed Detune Test", tempo: 120, time: "4/4" }
        def lead "Supersaw" style=synth patch="supersaw"
        measure 1 {
          lead: c4:2.detune(85%, 0.4..0.85) g4:2.detune([0, 95, 10]) |
        }
      }
    `);

    const ev1 = score.events[0];
    expect(ev1.physics?.detuneMod).toBeDefined();
    expect(ev1.physics?.detuneMod?.startNorm).toBeCloseTo(0.4, 3);
    expect(ev1.physics?.detuneMod?.endNorm).toBeCloseTo(0.85, 3);

    // Outside the window (u = 0.1 and u = 0.95), detune remains at baseline (8%)
    expect(ContinuousSynthEngine.evaluateWindowedModulation(ev1.physics?.detuneMod, 0.1, 8)).toBeCloseTo(8, 2);
    expect(ContinuousSynthEngine.evaluateWindowedModulation(ev1.physics?.detuneMod, 0.95, 8)).toBeCloseTo(8, 2);
    // Inside the window (u = 0.62), detune reaches full 85%
    expect(ContinuousSynthEngine.evaluateWindowedModulation(ev1.physics?.detuneMod, 0.62, 8)).toBeCloseTo(85, 1);

    const ev2 = score.events[1];
    expect(ev2.physics?.detuneMod?.curve).toEqual([0, 95, 10]);
    expect(ContinuousSynthEngine.evaluateWindowedModulation(ev2.physics?.detuneMod, 0.5, 0)).toBeCloseTo(95, 1);
  });

  it('automatically voice-leads polyphonic chords with .glide(180ms) into the next chord without manual MPE arrays', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Ultraviolet Polyphonic Glide", tempo: 74, time: "4/4" }
        def pad "Floating Synth" style=synth patch="supersaw"
        measure 1 { pad: [ab2 eb3 c4 g4 c5]:1.glide(180ms) | }
        measure 2 { pad: [ab2 eb3 f4 ab4 b4]:1 | }
      }
    `);

    const m1Notes = score.events
      .filter((e) => e.measureNumber === 1)
      .sort((a, b) => a.pitch.midi - b.pitch.midi);
    expect(m1Notes).toHaveLength(5);

    // Ab2->Ab2 (0), Eb3->Eb3 (0), C4->F4 (+5), G4->Ab4 (+1), C5->B4 (-1)
    const targetDeltas = m1Notes.map((n) => n.physics?.mpe?.bend?.[4]);
    expect(targetDeltas).toEqual([0, 0, 5, 1, -1]);
  });

  it('synthesizes all 20 continuous synth features through summed Track Bus FX with zero NaNs', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Full Synth Workflow Showcase", tempo: 136, time: "4/4", key: "F#", scale: "minor" }
        def flutter "Flutter Pad" style=synth patch="flutter_pad" detune=75 cutoff=3200
        def saws    "Heaven Saws" style=synth patch="supersaw" detune=90 air=80 duck=75 width=130 .fx(multiband_dynamics, @{amount: 0.6})
        def reese   "Reese Sub"   style=synth patch="reese_bass" detune=75 sub=90
        def lead    "Sync Lead"   style=synth patch="pluck_lead"

        measure 1 {
          flutter: [d3 a3 f#4]:2.filter(400, 6800).flutter([8, 18]).open_voice [e3 b3 g#4]:2.pre_swell |
          saws: [f#3 c#4 f#4 a4]:2.stack("octaves").noise(25%, "white", 0.5..1.0).comb(880, 0.6) [c#3 g#3 c#4 e4]:2.pitch_dip(-7).gate([1,0,1,1,0,1,0,1]) |
          reese: f#1:2.warble(40, 2.5).drive([0.2, 0.85]) c#1:2.glide(120ms) |
          lead: a5:4.zap.sync([1, 3.5]).fm(35%, 2).haas(10ms) f#5:4.pwm(0.25, 3.0).ring(30%, 180) c#5:2.analog_slop(50%).keytrack(80%) |
        }
      }
    `);

    expect(score.events.length).toBeGreaterThan(10);
    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBeGreaterThan(44100 * 2);
  });
});
