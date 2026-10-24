import { describe, it, expect, beforeEach } from 'vitest';
import { TopologicalMutator } from '../src/mutator/TopologicalMutator';
import { DocumentParser } from '../src/parser/DocumentParser';

describe('TDB-702: Surgical Bi-Directional AST Code Mutator', () => {
  let mutator: TopologicalMutator;
  let parser: DocumentParser;

  beforeEach(() => {
    mutator = new TopologicalMutator();
    parser = new DocumentParser();
  });

  it('preserves chained dot modifiers and ties when resizing a token duration', () => {
    const resized = mutator.resizeDuration('c4:4.stacc.vol(95).pan(-0.3)~', 12.5, 100);
    expect(resized).toBe('c4:3/8.stacc.vol(95).pan(-0.3)~');
  });

  it('transposes single notes and multi-note chords while preserving durations and modifiers', () => {
    expect(mutator.transposePitch('c4:8.stacc.mf', 2)).toBe('d4:8.stacc.mf');
    expect(mutator.transposePitch('eb4:4.vib', -2, true)).toBe('db4:4.vib');
    expect(mutator.transposePitch('[c4 e4 g4]:2.fx(reverb, @{mix: 0.4})', 2)).toBe(
      '[d4 f#4 a4]:2.fx(reverb, @{mix: 0.4})'
    );
  });

  it('surgically patches duration, velocity, pan, chance, and articulation on a token', () => {
    const token = 'a4:4.stacc.mf.pan(-0.2)';
    const updated = mutator.mutateTokenModifiers(token, {
      duration: '1/8',
      velocity: 112,
      pan: 0.45,
      chance: 80,
      articulation: 'legato',
    });
    expect(updated).toBe('a4:8.legato.pan(0.45).vol(112).chance(80%)');
  });

  it('replaces the exact token instance at its character span in a multi-measure score without touching earlier identical tokens or comments', () => {
    const source = `tenuto "6.0" {
  %% User comment that must be preserved!
  meta @{ title: "Span Test", tempo: 120, time: "4/4" }
  def pno "Grand Piano" style=standard patch="salamander_grand"

  measure 1 {
    pno: c4:4 d4:4 e4:4 f4:4 |
  }

  measure 2 {
    pno: c4:4 g4:4 a4:4 b4:4 |
  }
}`;

    const compiled = parser.compile(source);
    const measure1C4 = compiled.events.find((e) => e.measureNumber === 1 && e.rawToken === 'c4:4')!;
    const measure2C4 = compiled.events.find((e) => e.measureNumber === 2 && e.rawToken === 'c4:4')!;

    expect(measure1C4.sourceStartOffset).toBeDefined();
    expect(measure2C4.sourceStartOffset).toBeGreaterThan(measure1C4.sourceStartOffset!);

    // Mutate ONLY the c4:4 in Measure 2 to c5:8
    const nextSource = mutator.replaceEventInSource(source, measure2C4, 'c5:8');

    expect(nextSource).toContain('%% User comment that must be preserved!');
    expect(nextSource).toContain('measure 1 {\n    pno: c4:4 d4:4 e4:4 f4:4 |');
    expect(nextSource).toContain('measure 2 {\n    pno: c5:8 g4:4 a4:4 b4:4 |');
  });

  it('surgically mutates meta, track volume, pan, sends, and FX chains in source code while preserving comments', () => {
    const initial = `tenuto "6.0" {
  %% Keep header comment
  meta @{ title: "Mix Test", tempo: 120, time: "4/4" }
  def vox "Lead Vocal" style=standard patch="voice_oohs"
  measure 1 {
    vox: c5:1 |
  }
}`;

    const withSidechain = mutator.applyMixerMutationToSource(initial, {
      mutationType: 'META_SIDECHAIN_UPDATE',
      source: 'Drum_Bus',
    });
    expect(withSidechain).toContain('sidechain: "Drum_Bus"');
    expect(withSidechain).toContain('%% Keep header comment');

    const withVol = mutator.applyMixerMutationToSource(withSidechain, {
      mutationType: 'VOLUME_UPDATE',
      trackId: 'vox',
      value: 110,
    });
    expect(withVol).toContain('var vox_vol = 110');

    const withFx = mutator.applyMixerMutationToSource(withVol, {
      mutationType: 'ADD_FX',
      trackId: 'vox',
      fxType: 'reverb',
      fxParams: { mix: 0.5 },
    });
    expect(withFx).toContain('def vox "Lead Vocal" style=standard patch="voice_oohs" .fx(reverb, @{mix: 0.5})');

    const withSend = mutator.applyMixerMutationToSource(withFx, {
      mutationType: 'SEND_UPDATE',
      trackId: 'vox',
      sendId: 'rev_bus',
      sendLevel: 0.65,
    });
    expect(withSend).toContain('sends=@{rev_bus: 0.65}');
  });
});
