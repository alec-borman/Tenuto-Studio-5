import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import { IncrementalCompiler } from '../src/parser/IncrementalCompiler';
import { ASTSerializer } from '../src/parser/ASTSerializer';

describe('TDB-601: Full Tenuto 5.0 Document Compiler & LLM Sanitizer', () => {
  let parser: DocumentParser;
  let compiler: IncrementalCompiler;

  beforeEach(() => {
    parser = new DocumentParser();
    compiler = new IncrementalCompiler(new ASTSerializer());
  });

  it('strips LLM markdown code fences automatically on paste', () => {
    const llmPastedCode = `
\`\`\`tenuto
tenuto "5.0" {
  meta @{ title: "Gemini Sketch", tempo: 128, time: "4/4" }
  def lead "Synth Lead" style=synth patch="saw_lead"
  measure 1 {
    lead: c4:4 e g c5 |
  }
}
\`\`\`
    `;

    const score = compiler.compileDocument(llmPastedCode);
    expect(score.meta.title).toBe('Gemini Sketch');
    expect(score.meta.tempo).toBe(128);
    expect(score.defs.length).toBe(1);
    expect(score.events.length).toBe(4);
    expect(score.events[0].pitch.midi).toBe(60); // C4
    expect(score.events[1].pitch.midi).toBe(64); // E4 (sticky octave 4, sticky duration 1/4)
    expect(score.events[2].pitch.midi).toBe(67); // G4
    expect(score.events[3].pitch.midi).toBe(72); // C5
  });

  it('compiles chords, polyphonic voices, Euclidean rhythms, and DSP modifiers', () => {
    const code = `
      tenuto "5.0" {
        meta @{ title: "Neon Horizon", tempo: 110, time: "4/4" }
        def pno "Grand Piano" style=standard patch="salamander_grand"
        def drums "808 Kit" style=grid
        measure 1 {
          pno: <[ v1: c5:4.stacc d:4 e:2 | v2: [c3 g3]:1.fx(reverb, @{mix: 0.5}) ]>
          drums: (k):3/8
        }
      }
    `;

    const score = parser.compile(code);
    expect(score.defs.length).toBe(2);

    const pnoEvents = score.events.filter((e) => e.trackId === 'pno');
    // v1 has 3 melody notes, v2 has a 2-note chord = 5 note events
    expect(pnoEvents.length).toBe(5);
    expect(pnoEvents[0].physics?.articulation).toBe('stacc');

    const chordNotes = pnoEvents.filter((e) => e.voiceId === 'v2');
    expect(chordNotes.length).toBe(2);
    expect(chordNotes[0].pitch.midi).toBe(48); // C3
    expect(chordNotes[1].pitch.midi).toBe(55); // G3
    expect(chordNotes[0].physics?.fx?.[0]?.type).toBe('reverb');

    const drumEvents = score.events.filter((e) => e.trackId === 'drums');
    // (k):3/8 produces 3 hits and 5 rests (rests are not emitted as note events)
    expect(drumEvents.length).toBe(3);
    expect(drumEvents[0].pitch.midi).toBe(36); // Kick MIDI 36
  });
});
