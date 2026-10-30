import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CodeEditor, {
  computeActiveKaraokeTokens,
  extractCoreNoteAndDurationToken,
  findMeasureLineRange,
} from '../src/components/CodeEditor';
import { DocumentParser } from '../src/parser/DocumentParser';
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

describe('TDB-532, TDB-729, TDB-731 & TDB-734: Surgical Core-Note-Only Playback Highlighting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('MUST render the Monaco Editor component mapped to the Tenuto language', () => {
    render(<CodeEditor code="pno: c4:4" onChange={vi.fn()} />);

    const editor = screen.getByTestId('monaco-mock');
    expect(editor).toBeInTheDocument();
    expect(editor).toHaveAttribute('data-language', 'tenuto');
    expect(editor).toHaveValue('pno: c4:4');
  });

  it('MUST trigger the onChange callback deterministically upon editor mutation', () => {
    const mockOnChange = vi.fn();
    render(<CodeEditor code="pno: c4:4" onChange={mockOnChange} />);

    const editor = screen.getByTestId('monaco-mock');
    fireEvent.change(editor, { target: { value: 'pno: c4:8' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('pno: c4:8');
  });

  it('extracts strictly the core pitch/chord + duration token without modifier chains (TDB-734)', () => {
    expect(
      extractCoreNoteAndDurationToken(
        'd1:1.mp.cresc.detune(76%, 0.25..0.90).warble(24, 1.6).drive([0.25, 0.62]).glide(200ms)'
      )
    ).toBe('d1:1');

    expect(
      extractCoreNoteAndDurationToken(
        '[f#3 c#4 f#4 a4 c#5]:1.p.cresc.open_voice.detune([0, 78, 25]).flutter(18, 5.2)'
      )
    ).toBe('[f#3 c#4 f#4 a4 c#5]:1');

    expect(extractCoreNoteAndDurationToken('f#2:2..mp.vib')).toBe('f#2:2.');
    expect(extractCoreNoteAndDurationToken('c#3:8')).toBe('c#3:8');
  });

  it('advances across multiple notes on the same line, skips rests, and ignores %% comments (TDB-734)', () => {
    const parser = new DocumentParser();
    const rawCode = [
      'tenuto "6.0" {',
      '  meta @{ title: "Obsidian & Gold", tempo: 124, time: "4/4" }',
      '  def pad "Flutter Pad" style=synth patch="flutter_pad"',
      '  def reese "Reese" style=synth patch="reese_bass"',
      '  def cello "Cello" style=standard patch="cello"',
      '  def lead "Lead" style=synth patch="pluck_lead"',
      '  def tpt "Trumpet" style=standard patch="trumpet"',
      '  %% SECTION I: D1:1 AND F#2:8 COMMENT TEST',
      '  measure 1 {',
      '    pad: [f#3 c#4 f#4 a4 c#5]:1.p.cresc.open_voice.detune([0, 78, 25]) |',
      '    reese: d1:1.mp.cresc.detune(76%, 0.25..0.90).warble(24, 1.6).glide(200ms) |',
      '    cello: f#2:8.mp c#3:8 f#3:8 a3:8 g#3:8 f#3:8 c#3:8 a2:8 |',
      '    lead: r:2 c#5:2.p.cresc.vib(5.5Hz, 0.28st) |',
      '    tpt: r:1 |',
      '  }',
      '}',
    ].join('\r\n');

    const score = parser.compile(rawCode);

    // At Beat 0 (first eighth note = 0.0 whole notes):
    // - pad plays `[f#3 c#4 f#4 a4 c#5]:1`
    // - reese plays `d1:1`
    // - cello plays `f#2:8` (1st eighth note)
    // - lead is resting (`r:2`), so `lead` MUST NOT be highlighted at beat 0!
    // - tpt is resting (`r:1`), so `tpt` MUST NOT be highlighted!
    const activeBeat0 = computeActiveKaraokeTokens(score.events, 0.0, true);
    const byTrack0 = Object.fromEntries(activeBeat0.map((t) => [t.trackId, t]));

    expect(byTrack0.pad.coreToken).toBe('[f#3 c#4 f#4 a4 c#5]:1');
    expect(byTrack0.pad.line).toBe(10);

    expect(byTrack0.reese.coreToken).toBe('d1:1');
    expect(byTrack0.reese.line).toBe(11);
    expect(byTrack0.reese.endCol - byTrack0.reese.col).toBe('d1:1'.length);

    expect(byTrack0.cello.coreToken).toBe('f#2:8');
    expect(byTrack0.cello.line).toBe(12);

    expect(byTrack0.lead).toBeUndefined();
    expect(byTrack0.tpt).toBeUndefined();

    // At Beat 0.5 (second eighth note = 0.125 whole notes):
    // - cello advances to `c#3:8` on the same line (line 12) at a later column
    const activeBeatHalf = computeActiveKaraokeTokens(score.events, 0.5, true);
    const byTrackHalf = Object.fromEntries(activeBeatHalf.map((t) => [t.trackId, t]));
    expect(byTrackHalf.cello.coreToken).toBe('c#3:8');
    expect(byTrackHalf.cello.line).toBe(12);
    expect(byTrackHalf.cello.col).toBeGreaterThan(byTrack0.cello.col);

    // At Beat 2.0 (second half of measure = 0.5 whole notes):
    // - lead finishes `r:2` and highlights `c#5:2` (core token without `.p.cresc.vib(...)`)
    const activeBeat2 = computeActiveKaraokeTokens(score.events, 2.0, true);
    const byTrack2 = Object.fromEntries(activeBeat2.map((t) => [t.trackId, t]));
    expect(byTrack2.lead).toBeDefined();
    expect(byTrack2.lead.coreToken).toBe('c#5:2');
    expect(byTrack2.lead.line).toBe(13);
  });

  it('correctly maps the line boundaries of any active measure with findMeasureLineRange', () => {
    const code = `
      tenuto "6.0" {
        meta @{ title: "Symphony of Horizon", tempo: 132 }
        def saws "Heaven Saws" style=synth patch="supersaw"
        measure 1 {
          saws: [d3 a3 d4 e4 f#4 a4 c#5]:1 |
        }
        measure 2 {
          saws: [g2 d3 g3 b3 d4 f#4]:2 |
        }
      }
    `;

    const range1 = findMeasureLineRange(code, 1);
    expect(range1).toBeDefined();
    expect(range1?.startLine).toBe(5);
    expect(range1?.endLine).toBe(6);

    const range2 = findMeasureLineRange(code, 2);
    expect(range2?.startLine).toBe(8);
    expect(range2?.endLine).toBe(9);
  });

  it('computes 0%..100% intra-token progress wipes and renders coreToken in the ribbon', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Visual Sweep Check", tempo: 120, time: "4/4" }
        def lead "Lead" style=synth patch="supersaw"
        measure 1 {
          lead: c5:2.lyric("Sky") e5:2.lyric("High") |
        }
      }
    `);

    const activeAtBeat1 = computeActiveKaraokeTokens(score.events, 1.0, true);
    expect(activeAtBeat1).toHaveLength(1);
    expect(activeAtBeat1[0].rawToken).toBe('c5:2.lyric("Sky")');
    expect(activeAtBeat1[0].coreToken).toBe('c5:2');
    expect(activeAtBeat1[0].lyric).toBe('Sky');
    expect(activeAtBeat1[0].progressPct).toBe(50);

    render(
      <CodeEditor
        code="lead: c5:2.lyric('Sky')"
        events={score.events}
        isPlaying={true}
        onChange={vi.fn()}
        playheadBeat={1.0}
      />
    );

    expect(screen.getByTestId('karaoke-code-ribbon')).toBeInTheDocument();
    expect(screen.getByTestId('karaoke-pill-lead')).toHaveTextContent('c5:2');
    expect(screen.getByTestId('karaoke-fill-lead')).toHaveStyle({ width: '50%' });
  });
});
