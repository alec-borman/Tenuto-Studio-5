import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DebouncedCodeMemory,
  TENUTO_CODE_STORAGE_KEY,
} from '../src/utils/DebouncedCodeMemory';
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

describe('TDB-732: Debounced Code Memory & Auto-Restore Across Refreshes', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.useRealTimers();
  });

  it('debounces rapid code edits and writes to localStorage only once after 500ms of idle time', () => {
    const memory = new DebouncedCodeMemory(TENUTO_CODE_STORAGE_KEY, 500);
    const onSaved = vi.fn();

    memory.scheduleSave('pno: c4:4 d4:4', onSaved);
    vi.advanceTimersByTime(250);
    expect(window.localStorage.getItem(TENUTO_CODE_STORAGE_KEY)).toBeNull();

    // User types again before 500ms -> resets debounce timer
    memory.scheduleSave('pno: c4:4 d4:4 e4:2', onSaved);
    vi.advanceTimersByTime(300);
    expect(window.localStorage.getItem(TENUTO_CODE_STORAGE_KEY)).toBeNull();

    // Advance remaining 200ms -> commits final code to localStorage
    vi.advanceTimersByTime(200);
    expect(window.localStorage.getItem(TENUTO_CODE_STORAGE_KEY)).toBe('pno: c4:4 d4:4 e4:2');
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith('pno: c4:4 d4:4 e4:2');
  });

  it('flushes pending debounced edits immediately on window beforeunload (fast refresh)', () => {
    const memory = new DebouncedCodeMemory(TENUTO_CODE_STORAGE_KEY, 500);
    memory.scheduleSave('saws: [d3 a3 d4 f#4]:1');
    expect(memory.hasPendingSave()).toBe(true);
    expect(window.localStorage.getItem(TENUTO_CODE_STORAGE_KEY)).toBeNull();

    // Simulate fast browser refresh before 500ms elapses
    memory.flush();
    expect(memory.hasPendingSave()).toBe(false);
    expect(window.localStorage.getItem(TENUTO_CODE_STORAGE_KEY)).toBe('saws: [d3 a3 d4 f#4]:1');
  });

  it('restores saved code across SplitWorkspace remounts (page refresh) and resets via Reset Memory button', () => {
    const { unmount } = render(<SplitWorkspace />);
    const editor = screen.getByTestId('monaco-mock') as HTMLTextAreaElement;
    expect(editor.value).toBe('pno: c4:4');

    // Type new score into editor -> status shows Saving... during debounce window
    fireEvent.change(editor, {
      target: { value: 'lead: a4:4 c5:4 e5:2' },
    });
    expect(screen.getByTestId('code-memory-status')).toHaveTextContent(/Saving/i);

    // Advance 500ms debounce timer -> commits to localStorage and shows Saved
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('code-memory-status')).toHaveTextContent(/Saved/i);
    expect(window.localStorage.getItem(TENUTO_CODE_STORAGE_KEY)).toBe('lead: a4:4 c5:4 e5:2');

    // Unmount and mount a fresh SplitWorkspace (simulating a browser refresh)
    unmount();
    render(<SplitWorkspace />);
    const refreshedEditor = screen.getByTestId('monaco-mock') as HTMLTextAreaElement;
    expect(refreshedEditor.value).toBe('lead: a4:4 c5:4 e5:2');

    // Click 'Reset Memory' -> clears localStorage and restores default 'pno: c4:4'
    fireEvent.click(screen.getByRole('button', { name: /Reset Code Memory/i }));
    expect(refreshedEditor.value).toBe('pno: c4:4');
    expect(window.localStorage.getItem(TENUTO_CODE_STORAGE_KEY)).toBeNull();
  });
});
