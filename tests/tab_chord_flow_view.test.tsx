import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabChordFlowView, {
  detectChordSymbol,
  extractCodeChordSlices,
} from '../src/components/TabChordFlowView';
import { DocumentParser } from '../src/parser/DocumentParser';
import SplitWorkspace from '../src/components/SplitWorkspace';
import '@testing-library/jest-dom';

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, defaultLanguage }: any) => (
    <textarea
      data-testid="monaco-mock"
      aria-label="Tenuto Source Editor"
      data-language={defaultLanguage}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

HTMLCanvasElement.prototype.getContext = vi.fn();

describe('TDB-730: Dynamic Code-Driven Tab & Voice-Leading Chord Flow View', () => {
  it('dynamically extracts chord symbols, voice-leading orbs, and fretboard voicings from whatever .ten code is playing', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Live Code Progression", tempo: 120, time: "4/4", key: "D" }
        def saws "Supersaw" style=synth patch="supersaw"
        measure 1 {
          saws: [d3 a3 d4 f#4 a4 c#5]:2 [b2 f#3 b3 d4 f#4 a4]:2 |
        }
        measure 2 {
          saws: [g2 d3 g3 b3 d4 f#4]:2 [a2 e3 a3 c#4 e4 g4]:2 |
        }
      }
    `);

    const slices = extractCodeChordSlices(score.events, false);
    expect(slices).toHaveLength(4);
    expect(slices[0].symbol.fullText).toBe('Dmaj7');
    expect(slices[1].symbol.fullText).toBe('Bm7');
    expect(slices[2].symbol.fullText).toBe('Gmaj7');
    expect(slices[3].symbol.fullText).toBe('A7');

    // At playheadBeat = 0.5 (Beat 1 of Measure 1), active chord is Dmaj7
    const { rerender } = render(
      <TabChordFlowView
        events={score.events}
        isPlaying={true}
        playheadBeat={0.5}
        rootKey="D"
        score={score}
      />
    );
    expect(screen.getByTestId('active-chord-symbol')).toHaveTextContent('Dmaj7');

    // At playheadBeat = 2.5 (Beat 3 of Measure 1), active chord updates dynamically to Bm7
    rerender(
      <TabChordFlowView
        events={score.events}
        isPlaying={true}
        playheadBeat={2.5}
        rootKey="D"
        score={score}
      />
    );
    expect(screen.getByTestId('active-chord-symbol')).toHaveTextContent('Bm7');

    // At playheadBeat = 6.5 (Beat 3 of Measure 2), active chord updates dynamically to A7
    rerender(
      <TabChordFlowView
        events={score.events}
        isPlaying={true}
        playheadBeat={6.5}
        rootKey="D"
        score={score}
      />
    );
    expect(screen.getByTestId('active-chord-symbol')).toHaveTextContent('A7');
  });

  it('updates live when the user types new chords into the Code Editor in SplitWorkspace', () => {
    render(<SplitWorkspace />);

    // Switch to Tab / Chord Flow View
    fireEvent.click(screen.getByRole('button', { name: /Switch to Tab \/ Chord Flow View/i }));
    expect(screen.getByTestId('tab-chord-flow-view')).toBeInTheDocument();

    // Default code is 'pno: c4:4' -> displays 'C'
    expect(screen.getByTestId('active-chord-symbol')).toHaveTextContent('C');

    // User types an Fmaj7 chord into the editor -> view immediately updates to 'Fmaj7'
    const editor = screen.getByTestId('monaco-mock') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'pno: [f3 a3 c4 e4]:1' } });
    expect(screen.getByTestId('active-chord-symbol')).toHaveTextContent('Fmaj7');
  });

  it('also recognizes slash inversions (Eb/G) and jazz chords (Abmaj7, Abm6, Bb7sus) when written in code', () => {
    expect(detectChordSymbol([44, 51, 60, 67, 72], true).fullText).toBe('A♭maj7');
    expect(detectChordSymbol([44, 51, 65, 68, 71], true).fullText).toBe('A♭m6');
    expect(detectChordSymbol([43, 58, 63, 67, 70], true).fullText).toBe('E♭/G');
    expect(detectChordSymbol([46, 53, 63, 68, 72], true).fullText).toBe('B♭7sus');
  });
});
