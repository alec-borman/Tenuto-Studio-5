import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CodeEditor, { computeActiveKaraokeTokens } from '../src/components/CodeEditor';
import { DocumentParser } from '../src/parser/DocumentParser';
import '@testing-library/jest-dom';

// Mock Monaco Editor for deterministic JSDOM testing to avoid Web Worker crashes
vi.mock('@monaco-editor/react', () => {
  return {
    default: ({ value, onChange, defaultLanguage }: any) => (
      <textarea
        data-testid="monaco-mock"
        aria-label="Tenuto Source Editor"
        data-language={defaultLanguage}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  };
});

describe('TDB-532 & TDB-729: The Monaco Editor Matrix & Karaoke Real-Time Code Highlighting', () => {
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

    // Simulate user typing in the Monaco instance
    fireEvent.change(editor, { target: { value: 'pno: c4:8' } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith('pno: c4:8');
  });

  it('highlights active .ten code tokens in Karaoke mode with smooth 0%..100% intra-token progress sweep', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Karaoke Test", tempo: 120, time: "4/4" }
        def lead "Lead" style=synth patch="supersaw"
        def bass "Bass" style=synth patch="reese_bass"
        measure 1 {
          lead: c5:2.lyric("Sky") e5:2.lyric("High") |
          bass: [c2 c3]:1 |
        }
      }
    `);

    // At beat 1.0 (25% through the whole note and 50% through the first half note c5:2)
    const activeAtBeat1 = computeActiveKaraokeTokens(score.events, 1.0, true);
    expect(activeAtBeat1).toHaveLength(2);

    const leadTok = activeAtBeat1.find((t) => t.trackId === 'lead')!;
    const bassTok = activeAtBeat1.find((t) => t.trackId === 'bass')!;
    expect(leadTok.rawToken).toBe('c5:2.lyric("Sky")');
    expect(leadTok.lyric).toBe('Sky');
    expect(leadTok.progressPct).toBe(50);

    // Chord [c2 c3]:1 is deduplicated to a single token span at 25% progress
    expect(bassTok.rawToken).toBe('[c2 c3]:1');
    expect(bassTok.progressPct).toBe(25);

    render(
      <CodeEditor
        code="lead: c5:2"
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
