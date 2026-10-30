import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CodeEditor, {
  computeActiveKaraokeTokens,
  extractCoreNoteAndDurationToken,
  findMeasureLineRange,
  computeActiveMeasureScrollTarget,
} from '../src/components/CodeEditor';
import { DocumentParser } from '../src/parser/DocumentParser';
import '@testing-library/jest-dom';

const mockRevealLineInCenter = vi.fn();
const mockRevealLinesInCenter = vi.fn();
const mockDeltaDecorations = vi.fn(() => ['dec-1']);

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, onChange, defaultLanguage, onMount }: any) => {
    React.useEffect(() => {
      if (onMount) {
        onMount(
          {
            deltaDecorations: mockDeltaDecorations,
            revealLineInCenter: mockRevealLineInCenter,
            revealLinesInCenter: mockRevealLinesInCenter,
            getModel: () => null,
          },
          {
            Range: class {
              constructor(
                public startLineNumber: number,
                public startColumn: number,
                public endLineNumber: number,
                public endColumn: number
              ) {}
            },
          }
        );
      }
    }, [onMount]);

    return (
      <textarea
        data-testid="monaco-mock"
        aria-label="Tenuto Source Editor"
        data-language={defaultLanguage}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  },
}));

describe('TDB-532, TDB-729, TDB-731, TDB-734 & TDB-735: Theater-Grade Playback Karaoke Spotlight & Always-Centered Measure Scrolling', () => {
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
  });

  it('correctly maps the line boundaries and vertical center of any active measure and scrolls it to the center on every measure transition', () => {
    const code = [
      'tenuto "6.0" {',
      '  meta @{ title: "Symphony of Horizon", tempo: 132 }',
      '  def saws "Heaven Saws" style=synth patch="supersaw"',
      '  def reese "Reese Bass" style=synth patch="reese_bass"',
      '  measure 1 {',
      '    saws: [d3 a3 d4 e4 f#4 a4 c#5]:1 |',
      '    reese: d1:1 |',
      '  }',
      '  measure 2 {',
      '    saws: [g2 d3 g3 b3 d4 f#4]:1 |',
      '    reese: g1:1 |',
      '  }',
      '}',
    ].join('\n');

    const parser = new DocumentParser();
    const score = parser.compile(code);

    const range1 = findMeasureLineRange(code, 1);
    expect(range1).toEqual({ startLine: 5, endLine: 8 });

    const range2 = findMeasureLineRange(code, 2);
    expect(range2).toEqual({ startLine: 9, endLine: 12 });

    const tokensM1 = computeActiveKaraokeTokens(score.events, 1.0, true);
    const targetM1 = computeActiveMeasureScrollTarget(code, tokensM1);
    expect(targetM1).toEqual({
      measureNumber: 1,
      startLine: 5,
      endLine: 8,
      centerLine: 7, // Math.round((5 + 8) / 2) = 7
    });

    const { rerender } = render(
      <CodeEditor
        code={code}
        events={score.events}
        isPlaying={true}
        onChange={vi.fn()}
        playheadBeat={1.0}
      />
    );

    expect(mockRevealLinesInCenter).toHaveBeenCalledWith(5, 8, 0);
    expect(mockRevealLineInCenter).toHaveBeenCalledWith(7, 0);

    // Advance playhead to Measure 2 (beat 5.0) -> immediately centers Measure 2 (lines 9..12, centerLine 11)
    rerender(
      <CodeEditor
        code={code}
        events={score.events}
        isPlaying={true}
        onChange={vi.fn()}
        playheadBeat={5.0}
      />
    );

    expect(mockRevealLinesInCenter).toHaveBeenCalledWith(9, 12, 0);
    expect(mockRevealLineInCenter).toHaveBeenCalledWith(11, 0);
  });

  it('computes 0%..100% intra-token progress wipes and spotlight overlays for active tokens', () => {
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
    expect(screen.getByTestId('karaoke-pill-lead')).toHaveTextContent('c5:2.lyric("Sky")');
    expect(screen.getByTestId('karaoke-fill-lead')).toHaveStyle({ width: '50%' });
  });
});
