import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import WebGPUCanvas from '../src/components/WebGPUCanvas';
import '@testing-library/jest-dom';

const MULTI_TEMPO_CATHEDRAL_SCORE = `
tenuto "5.0" {
  meta @{ title: "Chronos & The Sovereign Cathedral", tempo: 116, time: "4/4" }
  def vln1 "1st Violins" style=standard patch="violin"
  def brass "Brass" style=standard patch="french_horn"

  measure 1 {
    vln1: d4:2 a4:2 |
    brass: [d3 a3 d4]:1 |
  }
  measure 2 {
    meta @{ tempo: 124 }
    vln1: a4:4 b4:4 cs5:4 d5:4 |
    brass: [a2 e3 a3]:1 |
  }
  measure 3 {
    meta @{ tempo: 68 }
    vln1: f4:2 a4:2 |
    brass: [bb2 f3 d4]:1 |
  }
  measure 4 {
    meta @{ tempo: 132 }
    vln1: d5:4 e5:4 f5:4 g5:4 |
    brass: [d3 a3 d4]:1 |
  }
  measure 5 {
    meta @{ tempo: 92 }
    vln1: d6:1.fermata |
    brass: [d2 a2 d3 f3 a3 d4]:1.fermata |
  }
}
`;

const CATHEDRAL_16M_TEMPO_MAP = [
  { startWhole: 0, tempo: 116 },
  { startWhole: 4, tempo: 124 },
  { startWhole: 8, tempo: 68 },
  { startWhole: 12, tempo: 132 },
  { startWhole: 15, tempo: 92 },
];

describe('TDB-715-SYNC: Piecewise Tempo-Map Playhead Synchronization & Active Note Illumination', () => {
  it('accurately inverts wholeNoteToSeconds via secondsToWholeNote across 5 tempo changes (116 -> 124 -> 68 -> 132 -> 92 BPM)', () => {
    const engine = new StudioAudioEngine();
    const baseTempo = 116;

    // Test round-trip bijection at key measure boundaries and fractional beats:
    // M1 (0.0), M5 (4.0), M9 (8.0), M11.5 (10.5 in 68 BPM Adagietto), M13 (12.0), M16 (15.0)
    const testWholeNotes = [0, 1.5, 4.0, 6.25, 8.0, 10.5, 12.0, 14.75, 15.5, 16.0];

    for (const whole of testWholeNotes) {
      const sec = engine.wholeNoteToSeconds(whole, baseTempo, CATHEDRAL_16M_TEMPO_MAP);
      const recoveredWhole = engine.secondsToWholeNote(sec, baseTempo, CATHEDRAL_16M_TEMPO_MAP);
      expect(recoveredWhole).toBeCloseTo(whole, 5);
    }
  });

  it('prevents playhead runaway during slow 68 BPM Adagietto (M9-M12) and resolves active tempo per measure', () => {
    const engine = new StudioAudioEngine();
    const baseTempo = 116;

    // Exact time when M9 starts (wholeNote = 8.0) and M13 starts (wholeNote = 12.0)
    const m9StartSec = engine.wholeNoteToSeconds(8.0, baseTempo, CATHEDRAL_16M_TEMPO_MAP);
    const m11MidSec = engine.wholeNoteToSeconds(10.0, baseTempo, CATHEDRAL_16M_TEMPO_MAP);
    const m13StartSec = engine.wholeNoteToSeconds(12.0, baseTempo, CATHEDRAL_16M_TEMPO_MAP);

    // At M11 (middle of the 68 BPM section), playhead must be at wholeNote 10.0 (beat 40),
    // NOT racing ahead at 116 BPM!
    const wholeAtM11 = engine.secondsToWholeNote(m11MidSec, baseTempo, CATHEDRAL_16M_TEMPO_MAP);
    expect(wholeAtM11).toBeCloseTo(10.0, 4);
    expect(engine.getTempoAtWholeNote(wholeAtM11, baseTempo, CATHEDRAL_16M_TEMPO_MAP)).toBe(68);

    expect(engine.getTempoAtWholeNote(0, baseTempo, CATHEDRAL_16M_TEMPO_MAP)).toBe(116);
    expect(engine.getTempoAtWholeNote(4.5, baseTempo, CATHEDRAL_16M_TEMPO_MAP)).toBe(124);
    expect(engine.getTempoAtWholeNote(8.0, baseTempo, CATHEDRAL_16M_TEMPO_MAP)).toBe(68);
    expect(engine.getTempoAtWholeNote(12.5, baseTempo, CATHEDRAL_16M_TEMPO_MAP)).toBe(132);
    expect(engine.getTempoAtWholeNote(15.2, baseTempo, CATHEDRAL_16M_TEMPO_MAP)).toBe(92);
    expect(m13StartSec - m9StartSec).toBeCloseTo(4 * ((60 / 68) * 4), 3);
  });

  it('extends totalSeconds for .fermata on the final measure while keeping totalQuarterBeats clamped to logical measure end', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(MULTI_TEMPO_CATHEDRAL_SCORE);

    const { totalQuarterBeats, totalSeconds } = engine.calculateScoreDuration(score);
    // 5 measures * 4 beats = 20 quarter beats logical grid length
    expect(totalQuarterBeats).toBe(20);

    // Physical audio duration includes the 1.65x fermata hold on the final measure
    const unheld5WholeSec = engine.wholeNoteToSeconds(5, score.meta.tempo, score.meta.tempoMap);
    expect(totalSeconds).toBeGreaterThan(unheld5WholeSec);
  });

  it('illuminates active notes under the playhead on the Piano Roll without unmounting static content', () => {
    const parser = new DocumentParser();
    const score = parser.compile(MULTI_TEMPO_CATHEDRAL_SCORE);

    render(React.createElement(WebGPUCanvas, { events: score.events, isPlaying: true, playheadBeat: 1.0 }));
    const overlay = screen.getByTestId('active-notes-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.querySelectorAll('rect').length).toBeGreaterThan(0);
  });
});
