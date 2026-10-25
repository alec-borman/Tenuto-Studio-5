import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MidiTransformAndGeneratorEngine } from '../src/mutator/MidiTransformAndGeneratorEngine';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { DocumentParser } from '../src/parser/DocumentParser';
import WebGPUCanvas from '../src/components/WebGPUCanvas';
import '@testing-library/jest-dom';

HTMLCanvasElement.prototype.getContext = vi.fn();

describe('TDB-723: Ableton Live 12 MIDI Transformations, Scale-Locked Generators & MPE Expression', () => {
  it('applies Live 12 Arpeggiate, Strum, Connect Legato, Ornament, and Humanize transformations to .ten code', () => {
    const chordSource = 'pno: [c4 e4 g4 b4]:2';
    const arpeggiated = MidiTransformAndGeneratorEngine.applyTransformToSource(
      chordSource,
      'arpeggiate'
    );
    expect(arpeggiated).toBe('pno: c4:16 e4 g4 b4 c4 e4 g4 b4');

    const strummed = MidiTransformAndGeneratorEngine.applyTransformToSource(chordSource, 'strum');
    expect(strummed).toBe('pno: [c4 e4 g4 b4]:2.arp');

    const melodySource = 'lead: c4:4 d4:4 e4:2';
    const connected = MidiTransformAndGeneratorEngine.applyTransformToSource(
      melodySource,
      'connect_legato'
    );
    expect(connected).toContain('c4:4.legato');
    expect(connected).toContain('d4:4.legato');

    const ornamented = MidiTransformAndGeneratorEngine.applyTransformToSource(
      melodySource,
      'ornament'
    );
    expect(ornamented).toContain('c4:4.mordent');
    expect(ornamented).toContain('e4:2.vib');
  });

  it('generates valid scale-locked Stacks, Seed Melody, and Rhythm patterns that compile cleanly', () => {
    const parser = new DocumentParser();
    for (const genType of ['stacks', 'seed_melody', 'rhythm_groove'] as const) {
      const injected = MidiTransformAndGeneratorEngine.injectGeneratedPatternIntoSource(
        `tenuto "6.0" {\n  meta @{ title: "Gen Test", tempo: 120, time: "4/4", key: "D", scale: "harmonic_minor" }\n  def lead "Lead" style=synth patch="wavetable"\n  measure 1 { lead: d4:1 | }\n}`,
        genType,
        'lead',
        'D',
        'harmonic_minor'
      );
      expect(injected).toContain('measure 2');
      const compiled = parser.compile(injected);
      expect(compiled.events.length).toBeGreaterThan(2);
    }
  });

  it('evaluates 3D MPE bend, slide, and pressure envelopes and renders MPE curves and MIDI Tools bar in WebGPUCanvas', async () => {
    const mpeSpec = { bend: [0, 12, 0], slide: [20, 120], pressure: [50, 127] };
    const startEval = StudioAudioEngine.evaluateMpeAtNormalizedTime(mpeSpec, 0.0);
    const midEval = StudioAudioEngine.evaluateMpeAtNormalizedTime(mpeSpec, 0.5);
    const endEval = StudioAudioEngine.evaluateMpeAtNormalizedTime(mpeSpec, 1.0);

    expect(startEval.bendSemitones).toBeCloseTo(0, 3);
    expect(midEval.bendSemitones).toBeCloseTo(12, 3);
    expect(endEval.bendSemitones).toBeCloseTo(0, 3);
    expect(endEval.slideNorm).toBeGreaterThan(startEval.slideNorm);
    expect(endEval.pressureScalar).toBeGreaterThan(startEval.pressureScalar);

    const parser = new DocumentParser();
    const score = parser.compile(
      'lead: d5:2.mpe(@{bend: [0, 12, 0], slide: [30, 110], pressure: [70, 120]}) f5:2'
    );

    const onApplyMidiTransform = vi.fn();
    const onGenerateMidiPattern = vi.fn();

    render(
      <WebGPUCanvas
        events={score.events}
        onApplyMidiTransform={onApplyMidiTransform}
        onGenerateMidiPattern={onGenerateMidiPattern}
        rootKey="D"
        scaleName="harmonic_minor"
      />
    );

    // MPE curve overlay is rendered on the first note
    expect(screen.getByTestId('mpe-curve-0')).toBeInTheDocument();

    // Open MIDI Tools toolbar and trigger Transform + Generator
    fireEvent.click(screen.getByRole('button', { name: /Toggle MIDI Tools/i }));
    expect(screen.getByTestId('midi-tools-bar')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /MIDI Transform Arpeggiate/i }));
    expect(onApplyMidiTransform).toHaveBeenCalledWith('arpeggiate', null);

    fireEvent.click(screen.getByRole('button', { name: /MIDI Generator \+ Gen Stacks/i }));
    expect(onGenerateMidiPattern).toHaveBeenCalledWith('stacks', null);
  });
});
