import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabChordFlowView, {
  detectChordSymbol,
  extractCodeChordSlices,
  buildTrueVoiceTrajectories,
  evaluateTrackedEventMidiAtWhole,
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

describe('TDB-733: True Multi-Instrument Voice-Leading Trajectories & Orb-to-Line Lock', () => {
  it('includes all instruments (including drums) and locks every playhead orb directly onto its trajectory line', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Multi-Track Lock Test", tempo: 128, time: "4/4", key: "D" }
        def saws  "Supersaw" style=synth patch="supersaw"
        def reese "Reese"    style=synth patch="reese_bass"
        def lead  "Lead"     style=synth patch="pluck_lead"
        def drums "Kit"      style=grid  patch="tenuto_808_kit"

        measure 1 {
          saws:  [d3 a3 d4 f#4 a4 c#5]:1.glide(160ms) |
          reese: d1:1.glide(160ms) |
          lead:  f#5:2 a5:2 |
          drums: k:4 s:4 k:4 s:4 |
        }
        measure 2 {
          saws:  [g2 d3 g3 b3 d4 f#4]:1 |
          reese: g0:1 |
          lead:  b5:1 |
          drums: k:4 s:4 k:4 s:4 |
        }
      }
    `);

    const trajectories = buildTrueVoiceTrajectories(score.events);
    expect(trajectories.length).toBeGreaterThan(10);

    // At beat 1.0 (wholeTime = 0.25), evaluateTrackedEventMidiAtWhole returns exact MIDI pitches
    const leadFirst = trajectories.find((t) => t.trackId === 'lead' && t.startWhole === 0)!;
    expect(evaluateTrackedEventMidiAtWhole(leadFirst, 0.25)).toBe(78); // F#5 = 78

    render(
      <TabChordFlowView
        events={score.events}
        isPlaying={true}
        playheadBeat={1.0}
        rootKey="D"
        score={score}
      />
    );

    // All 4 tracks (including drums!) are listed in the selector and pills
    expect(screen.getByText(/All \(4\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter chord flow by drums/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Filter chord flow by saws/i })).toBeInTheDocument();

    // Clicking 'lead' pill isolates only the lead track's notes (F#5 at beat 1.0)
    fireEvent.click(screen.getByRole('button', { name: /Filter chord flow by lead/i }));
    expect(screen.getByTestId('voice-orb-0')).toHaveTextContent('F♯5');
  });

  it('dynamically updates chord symbols when the user edits code in SplitWorkspace', () => {
    render(<SplitWorkspace />);
    fireEvent.click(screen.getByRole('button', { name: /Switch to Tab \/ Chord Flow View/i }));
    expect(screen.getByTestId('active-chord-symbol')).toHaveTextContent('C');

    const editor = screen.getByTestId('monaco-mock') as HTMLTextAreaElement;
    fireEvent.change(editor, { target: { value: 'pno: [f3 a3 c4 e4]:1' } });
    expect(screen.getByTestId('active-chord-symbol')).toHaveTextContent('Fmaj7');

    expect(detectChordSymbol([44, 51, 60, 67, 72], true).fullText).toBe('A♭maj7');
    expect(detectChordSymbol([43, 58, 63, 67, 70], true).fullText).toBe('E♭/G');
  });
});
