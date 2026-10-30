import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabChordFlowView, {
  detectChordSymbol,
  computeGuitarVoicing,
  buildTrueVoiceTrajectories,
  evaluateTrackedEventMidiAtWhole,
  allocateNotesToTabStrings,
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

describe('TDB-733, TDB-736 & TDB-739: Multi-Instrument Tab Staff Lanes, Sub-Bass/Viola Fretboard Folding & Pitch-Accurate Lines', () => {
  it('folds low sub-bass (Bb0 = MIDI 22) and viola/cello (Bb1 = MIDI 34) notes onto playable fretboards so they never render empty', () => {
    const violaVoicing = computeGuitarVoicing([34], true); // Bb1 (MIDI 34)
    const violaFretted = violaVoicing.strings.filter((s) => typeof s.fret === 'number');
    expect(violaFretted.length).toBeGreaterThanOrEqual(1);
    expect(violaFretted[0].noteLabel).toBe('B♭');

    const subVoicing = computeGuitarVoicing([22], true); // Bb0 (MIDI 22)
    const subFretted = subVoicing.strings.filter((s) => typeof s.fret === 'number');
    expect(subFretted.length).toBeGreaterThanOrEqual(1);
    expect(subFretted[0].noteLabel).toBe('B♭');
  });

  it('renders a dedicated horizontal 6-string Tab Staff lane for each instrument and supports Pinch-to-Zoom and Fit All', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Multi-Track Tab Staff Test", tempo: 128, time: "4/4", key: "D" }
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

    const leadFirst = trajectories.find((t) => t.trackId === 'lead' && t.startWhole === 0)!;
    expect(evaluateTrackedEventMidiAtWhole(leadFirst, 0.25)).toBe(78); // F#5 = 78
    // Because f#5:2 is followed contiguously by a5:2 on 'lead', targetMidi links to 81 (A5)
    expect(leadFirst.targetMidi).toBe(81);

    const allocated = allocateNotesToTabStrings([50, 57, 62, 66, 69, 73]);
    expect(allocated.size).toBe(6);

    render(
      <TabChordFlowView
        events={score.events}
        isPlaying={true}
        playheadBeat={1.0}
        rootKey="D"
        score={score}
      />
    );

    expect(screen.getByText(/All \(4\)/i)).toBeInTheDocument();
    expect(screen.getByTestId('instrument-tab-staff-saws')).toBeInTheDocument();
    expect(screen.getByTestId('instrument-tab-staff-reese')).toBeInTheDocument();
    expect(screen.getByTestId('instrument-tab-staff-lead')).toBeInTheDocument();
    expect(screen.getByTestId('instrument-tab-staff-drums')).toBeInTheDocument();

    // Verify reese (d1 = MIDI 26) mini fretboard has a fretted circle dot
    const reeseFretboard = screen.getByTestId('mini-fretboard-reese');
    expect(reeseFretboard.querySelectorAll('circle').length).toBeGreaterThanOrEqual(1);

    const viewport = screen.getByTestId('tab-flow-scroll-viewport');
    expect(screen.getByRole('button', { name: /Tab Reset Zoom/i })).toHaveTextContent('100%');

    fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true });
    expect(screen.getByRole('button', { name: /Tab Reset Zoom/i })).not.toHaveTextContent('100%');

    fireEvent.click(screen.getByRole('button', { name: /Tab Reset Zoom/i }));
    expect(screen.getByRole('button', { name: /Tab Reset Zoom/i })).toHaveTextContent('100%');

    fireEvent.click(screen.getByRole('button', { name: /Fit All Tab View/i }));
    expect(screen.getByRole('button', { name: /Tab Reset Zoom/i })).not.toHaveTextContent('100%');

    fireEvent.click(screen.getByRole('button', { name: /Filter chord flow by lead/i }));
    expect(screen.getByTestId('instrument-tab-staff-lead')).toBeInTheDocument();
    expect(screen.queryByTestId('instrument-tab-staff-saws')).not.toBeInTheDocument();
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
