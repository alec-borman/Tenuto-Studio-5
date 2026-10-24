import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('TDB-706: Multi-View Studio Shell & Tab View Switcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('switches between Piano Roll, Session View, and Arrangement View via toolbar buttons and the Tab key', () => {
    render(<SplitWorkspace />);

    // Default view is Piano Roll
    expect(screen.getByText(/Scrolling Piano Roll View/i)).toBeInTheDocument();

    // Press Tab key (outside text input) -> switches to Session View
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
    expect(screen.getByTestId('session-view-container')).toBeInTheDocument();

    // Press Tab key again -> switches to Arrangement View
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab' });
    expect(screen.getByTestId('arrangement-view-container')).toBeInTheDocument();

    // Click Piano Roll view button -> switches back to Piano Roll
    fireEvent.click(screen.getByRole('button', { name: /Switch to Piano Roll View/i }));
    expect(screen.getByText(/Scrolling Piano Roll View/i)).toBeInTheDocument();
  });

  it('toggles the Bottom Studio Dock (Mixer, Devices, Inspector) and the Left Code Editor pane', () => {
    render(<SplitWorkspace />);

    const bottomDock = screen.getByTestId('bottom-studio-dock');
    expect(bottomDock).toHaveClass('sr-only');

    // Open Mixer dock
    fireEvent.click(screen.getByRole('button', { name: /Toggle Mixer Dock/i }));
    expect(bottomDock).not.toHaveClass('sr-only');

    // Click Mixer dock button again to collapse
    fireEvent.click(screen.getByRole('button', { name: /Toggle Mixer Dock/i }));
    expect(bottomDock).toHaveClass('sr-only');

    // Toggle Code Editor visibility
    const codePane = screen.getByTestId('code-editor-pane');
    expect(codePane).not.toHaveClass('hidden');
    fireEvent.click(screen.getByRole('button', { name: /Toggle Code Editor/i }));
    expect(codePane).toHaveClass('hidden');
  });
});
