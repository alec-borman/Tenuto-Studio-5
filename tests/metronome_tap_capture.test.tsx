import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MetronomeAndCaptureEngine } from '../src/audio/MetronomeAndCaptureEngine';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
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

describe('TDB-710: Metronome, Count-In, Tap Tempo & Capture MIDI', () => {
  it('calculates accurate BPM from consecutive Tap Tempo timestamps', () => {
    const engine = new MetronomeAndCaptureEngine();

    // First tap returns null; subsequent taps at 500ms intervals = 120 BPM
    expect(engine.registerTap(1000)).toBeNull();
    expect(engine.registerTap(1500)).toBe(120);
    expect(engine.registerTap(2000)).toBe(120);

    // Pause > 2200ms resets the tap window; 400ms intervals = 150 BPM
    expect(engine.registerTap(5000)).toBeNull();
    expect(engine.registerTap(5400)).toBe(150);
  });

  it('builds a metronome click schedule with count-in bars and downbeat accents', () => {
    const schedule = MetronomeAndCaptureEngine.buildMetronomeSchedule(8, 120, '4/4', 1);
    // 1 bar count-in (4 beats) + 8 score beats = 12 click events
    expect(schedule).toHaveLength(12);
    expect(schedule[0].isCountIn).toBe(true);
    expect(schedule[0].isDownbeat).toBe(true);
    expect(schedule[0].frequencyHz).toBe(1320);
    expect(schedule[1].isDownbeat).toBe(false);
    expect(schedule[1].frequencyHz).toBe(880);
    expect(schedule[4].isCountIn).toBe(false);
    expect(schedule[4].measureNumber).toBe(1);
  });

  it('quantizes captured MIDI notes into a 4/4 .ten measure and injects code via Capture MIDI button in SplitWorkspace', () => {
    const capture = new MetronomeAndCaptureEngine();
    capture.recordNoteInput({ midi: 60, velocity: 100, timestampMs: 0, durationMs: 500 });
    capture.recordNoteInput({ midi: 64, velocity: 100, timestampMs: 500, durationMs: 500 });
    expect(capture.getCapturedNoteCount()).toBe(2);

    const flushed = capture.flushCapturedNotesToTenutoMeasure(120, 'lead', 2);
    expect(flushed).not.toBeNull();
    // Two quarter notes (c4:4 e4:4) + auto-padded half-note rest (r:2) = 4.0 beats
    expect(flushed!.tokens).toEqual(['c4:4', 'e4:4', 'r:2']);
    expect(flushed!.measureCode).toContain('measure 2');
    expect(capture.getCapturedNoteCount()).toBe(0);

    const audio = new StudioAudioEngine();
    audio.setMetronomeEnabled(true);
    audio.setCountInBars(2);
    expect(audio.getMetronomeEnabled()).toBe(true);
    expect(audio.getCountInBars()).toBe(2);

    render(<SplitWorkspace />);
    const editor = screen.getByTestId('monaco-mock') as HTMLTextAreaElement;
    expect(editor.value).toBe('pno: c4:4');

    // Toggle Metronome & Count-In
    fireEvent.click(screen.getByRole('button', { name: /Toggle Metronome/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /Count-In Bars/i }), {
      target: { value: '2' },
    });

    // Click Capture MIDI -> appends captured motif tokens to the active score
    fireEvent.click(screen.getByRole('button', { name: /Capture MIDI/i }));
    expect(editor.value).toContain('c4:4 e4:4 g4:4 c5:4');
  });
});
