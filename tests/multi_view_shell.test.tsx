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

  it('opens the Ableton Device Chain & Macro Rack dock and mutates .ten patch and macro code', () => {
    render(<SplitWorkspace />);

    const editor = screen.getByTestId('monaco-mock') as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: {
        value: `tenuto "6.0" {\n  meta @{ title: "Device Rack Test", tempo: 120, time: "4/4" }\n  def lead "Lead Synth" style=synth patch="wavetable" .fx(roar, @{drive: 0.4})\n  measure 1 { lead: c4:4 e4:4 g4:2 | }\n}`,
      },
    });

    // Open Devices dock
    fireEvent.click(screen.getByRole('button', { name: /Toggle Devices Dock/i }));
    expect(screen.getByTestId('device-chain-dock')).toBeInTheDocument();
    expect(screen.getByTestId('instrument-device-card-lead')).toBeInTheDocument();
    expect(screen.getByTestId('fx-device-card-roar')).toBeInTheDocument();

    // Change macro cutoff value -> writes macros=@{cutoff: 95} into .ten source code
    const cutoffMacro = screen.getByRole('spinbutton', { name: /Macro cutoff for lead/i });
    fireEvent.change(cutoffMacro, { target: { value: '95' } });
    expect(editor.value).toContain('macros=@{cutoff: 95}');
  });

  it('toggles Fullscreen Studio Mode and switches panes via the Mobile Bottom Navigation Bar', () => {
    render(<SplitWorkspace />);

    const root = screen.getByTestId('studio-workspace-root');
    expect(root).not.toHaveClass('tenuto-fullscreen-active');

    // Click Fullscreen button in Transport -> activates fullscreen studio class
    const fsBtn = screen.getByRole('button', { name: /Toggle Fullscreen/i });
    fireEvent.click(fsBtn);
    expect(root).toHaveClass('tenuto-fullscreen-active');

    // Click Fullscreen button again -> exits fullscreen
    fireEvent.click(fsBtn);
    expect(root).not.toHaveClass('tenuto-fullscreen-active');

    // Verify Mobile Bottom Navigation Bar renders and switches views/docks
    const mobileNav = screen.getByTestId('mobile-bottom-nav');
    expect(mobileNav).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mobile View Tab Flow/i }));
    expect(screen.getByTestId('tab-chord-flow-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mobile View Code Editor/i }));
    expect(screen.getByTestId('code-editor-pane')).not.toHaveClass('hidden');

    fireEvent.click(screen.getByRole('button', { name: /Mobile Dock Mixer/i }));
    expect(screen.getByTestId('bottom-studio-dock')).not.toHaveClass('sr-only');
  });
});

