import { describe, it, expect, beforeEach } from 'vitest';
import {
  PitchEngine,
  parseScalaScl,
  isMidiInScale,
  quantizeMidiToScale,
} from '../src/parser/PitchEngine';
import { DocumentParser } from '../src/parser/DocumentParser';

describe('TDB-703: Global Scale Lock & Microtonal Tuning Engine (.scl / .tun)', () => {
  let engine: PitchEngine;
  let parser: DocumentParser;

  beforeEach(() => {
    engine = new PitchEngine();
    parser = new DocumentParser();
  });

  it('parses quarter-tone accidentals (qs, qf, tqs, tqf, x) and explicit cent offsets', () => {
    // A4 = 440 Hz
    const a4 = engine.parsePitch('a4');
    expect(a4.frequency).toBeCloseTo(440.0, 2);

    // Quarter-sharp A4 (aqs4 = +50 cents above A4 = 440 * 2^(0.5/12) ≈ 452.893 Hz)
    const aqs4 = engine.parsePitch('aqs4');
    expect(aqs4.midi).toBe(69);
    expect(aqs4.microtoneCents).toBe(50);
    expect(aqs4.frequency).toBeCloseTo(452.893, 2);

    // Quarter-flat A4 (aqf4 = -50 cents below A4 ≈ 427.474 Hz)
    const aqf4 = engine.parsePitch('aqf4');
    expect(aqf4.microtoneCents).toBe(-50);
    expect(aqf4.frequency).toBeCloseTo(427.474, 2);

    // Double-sharp C4 (cx4 = MIDI 62 = D4)
    const cx4 = engine.parsePitch('cx4');
    expect(cx4.midi).toBe(62);

    // Explicit cent deviation (c4+25c)
    const c4Plus25 = engine.parsePitch('c4+25c');
    expect(c4Plus25.midi).toBe(60);
    expect(c4Plus25.microtoneCents).toBe(25);
  });

  it('parses Scala (.scl) tuning definitions and evaluates Just Intonation and Bohlen-Pierce frequencies', () => {
    const sampleScl = `
! 5-limit_just.scl
5-Limit Just Intonation
 12
!
 16/15
 9/8
 6/5
 5/4
 4/3
 45/32
 3/2
 8/5
 5/3
 9/5
 15/8
 2/1
    `;
    const cents = parseScalaScl(sampleScl);
    expect(cents).toHaveLength(12);
    // 5/4 major third = 386.314 cents (pure major third vs 400c 12-TET)
    expect(cents[3]).toBeCloseTo(386.314, 2);
    // 3/2 perfect fifth = 701.955 cents
    expect(cents[6]).toBeCloseTo(701.955, 2);

    engine.setTuningConfiguration({
      system: 'just_intonation',
      rootKey: 'C',
      a4Hz: 440,
    });

    const c4 = engine.parsePitch('c4');
    const e4 = engine.parsePitch('e4');
    // In pure 5-limit Just Intonation rooted on C, E4 / C4 frequency ratio is exactly 5 / 4 = 1.25
    expect(e4.frequency / c4.frequency).toBeCloseTo(1.25, 4);
  });

  it('evaluates scale membership and quantizes out-of-scale pitches when scale_lock is enabled in meta', () => {
    expect(isMidiInScale(60, 'C', 'major')).toBe(true);  // C4
    expect(isMidiInScale(61, 'C', 'major')).toBe(false); // C#4
    expect(quantizeMidiToScale(61, 'C', 'major')).toBe(60);

    const score = parser.compile(`
      tenuto "6.0" {
        meta @{
          title: "Scale Lock & Just Tuning",
          tempo: 120,
          time: "4/4",
          key: "D",
          scale: "harmonic_minor",
          scale_lock: true,
          tuning: "just_intonation"
        }
        def lead "Synth" style=synth patch="saw_lead"
        measure 1 {
          lead: d4:4 eb4:4 f#4:4 a4:4 |
        }
      }
    `);

    expect(score.events).toHaveLength(4);
    // D harmonic minor has pitches D(2), E(4), F(5), G(7), A(9), Bb(10), C#(1)
    // eb4 (MIDI 63) and f#4 (MIDI 66) are out-of-scale and must snap into D harmonic minor
    for (const ev of score.events) {
      expect(isMidiInScale(ev.pitch.midi, 'D', 'harmonic_minor')).toBe(true);
    }
  });
});
