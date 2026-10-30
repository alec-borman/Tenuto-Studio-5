import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CodeEditor, {
  computeActiveKaraokeTokens,
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

describe('TDB-532, TDB-729 & TDB-731: Theater-Grade Playback Karaoke Spotlight & Highlighting', () => {
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

    // Measure 1 starts at line 5 ("measure 1 {") and stops at the next bracket/measure
    const range1 = findMeasureLineRange(code, 1);
    expect(range1).toBeDefined();
    expect(range1?.startLine).toBe(5);
    expect(range1?.endLine).toBe(7);

    // Measure 2 starts at line 8 ("measure 2 {") and goes to the closing measure/bracket boundary
    const range2 = findMeasureLineRange(code, 2);
    expect(range2?.startLine).toBe(8);
    expect(range2?.endLine).toBe(10);
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

    // Quantized midpoint check on c5:2 (at beat 1.0 = half-way through the 2-beat Duration)
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
