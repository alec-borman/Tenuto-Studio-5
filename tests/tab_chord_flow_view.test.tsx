import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabChordFlowView, {
  detectChordSymbol,
  computeGuitarVoicing,
  buildTrueVoiceTrajectories,
  evaluateTrackedEventMidiAtWhole,
  allocateNotesToTabStrings,
  GUITAR_SCROLL_THEMES,
  buildCustomGuitarScrollPalette,
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

describe('TDB-733, TDB-736, TDB-739 & TDB-741: Detune-Only Tab Sliding, Sub-Bass Fretboard Folding & Proportional Beat Bars', () => {
  it('keeps normal contiguous notes 100% flat (no false sliding) and only slides/modulates when .detune or .glide is present', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Detune vs Plain Note Test", tempo: 68, time: "4/4" }
        def horns "French Horn Choir" style=standard patch="french_horn"
        def saws  "Ascendant Supersaw" style=synth patch="supersaw"
        measure 1 {
          horns: a4:2 b4:2 |
          saws:  [f3 c4 a4]:2.detune(85%, 0.3..0.9) [g3 d4 b4]:2 |
        }
      }
    `);

    const trajectories = buildTrueVoiceTrajectories(score.events);
    // Plain horn note a4:2 (MIDI 69) followed by b4:2 (MIDI 71) WITHOUT .detune or .glide must NOT slide:
    const hornFirst = trajectories.find((t) => t.trackId === 'horns' && t.startWhole === 0)!;
    expect(hornFirst.startMidi).toBe(69);
    expect(hornFirst.targetMidi).toBe(69);
    expect(hornFirst.hasGlide).toBe(false);
    // At 90% through the first half-note (wholeTime = 0.45), horn pitch stays 69 (A4), never sliding to 70/71
    expect(evaluateTrackedEventMidiAtWhole(hornFirst, 0.45)).toBe(69);

    // Saws note with .detune(85%, 0.3..0.9) DOES have hasDetune=true and slides to the next chord:
    const sawFirst = trajectories.find(
      (t) => t.trackId === 'saws' && t.startWhole === 0 && t.startMidi === 53
    )!;
    expect(sawFirst.hasDetune).toBe(true);
    expect(sawFirst.targetMidi).toBe(55);
  });

  it('folds low sub-bass (Bb0 = MIDI 22) and viola/cello (Bb1 = MIDI 34) notes onto playable fretboards so they never render empty', () => {
    const violaVoicing = computeGuitarVoicing([34], true);
    const violaFretted = violaVoicing.strings.filter((s) => typeof s.fret === 'number');
    expect(violaFretted.length).toBeGreaterThanOrEqual(1);
    expect(violaFretted[0].noteLabel).toBe('B♭');

    const subVoicing = computeGuitarVoicing([22], true);
    const subFretted = subVoicing.strings.filter((s) => typeof s.fret === 'number');
    expect(subFretted.length).toBeGreaterThanOrEqual(1);
    expect(subFretted[0].noteLabel).toBe('B♭');
  });

  it('renders dedicated 6-string Tab Staff lanes, detune shimmer waves, and supports Pinch-to-Zoom and Fit All', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Multi-Track Tab Staff Test", tempo: 128, time: "4/4", key: "D" }
        def saws  "Supersaw" style=synth patch="supersaw"
        def reese "Reese"    style=synth patch="reese_bass"
        def lead  "Lead"     style=synth patch="pluck_lead"
        def drums "Kit"      style=grid  patch="tenuto_808_kit"

        measure 1 {
          saws:  [d3 a3 d4 f#4 a4 c#5]:1.detune(85%, 0.3..0.9) |
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
    expect(screen.getAllByTestId('detune-wave-saws').length).toBeGreaterThanOrEqual(1);

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

  it('changes the Guitar Scroll color theme via preset selector and custom hex color picker', () => {
    const parser = new DocumentParser();
    const score = parser.compile('pno: [c4 e4 g4]:1');

    render(
      <TabChordFlowView
        events={score.events}
        isPlaying={false}
        playheadBeat={0}
        rootKey="C"
        score={score}
      />
    );

    const viewRoot = screen.getByTestId('tab-chord-flow-view');
    expect(viewRoot).toHaveAttribute('data-scroll-theme', 'sunset_amber');

    // 1. Switch to Midnight Indigo preset theme
    const themeSelect = screen.getByRole('combobox', { name: /Guitar Scroll Color Theme/i });
    fireEvent.change(themeSelect, { target: { value: 'midnight_indigo' } });
    expect(viewRoot).toHaveAttribute('data-scroll-theme', 'midnight_indigo');
    expect(viewRoot.style.background).toMatch(/#1D4ED8|rgb\(29,\s*78,\s*216\)/i);
    expect(GUITAR_SCROLL_THEMES.midnight_indigo.headerBg).toBe('#0F172A');

    // 2. Pick a custom hex color (#2563EB) via the Custom Guitar Scroll Color input
    const colorInput = screen.getByLabelText(/Custom Guitar Scroll Color/i);
    fireEvent.change(colorInput, { target: { value: '#2563eb' } });
    expect(viewRoot).toHaveAttribute('data-scroll-theme', 'custom');
    expect(viewRoot.style.background).toMatch(/#2563EB|rgb\(37,\s*99,\s*235\)/i);

    const customPalette = buildCustomGuitarScrollPalette('#2563eb');
    expect(customPalette.id).toBe('custom');
    expect(customPalette.primaryHex).toBe('#2563EB');
    expect(customPalette.backgroundGradient).toContain('#2563EB');
  });
});
