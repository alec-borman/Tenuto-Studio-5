import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SplitWorkspace from '../src/components/SplitWorkspace';
import App from '../src/App';
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

  it('rotates the interface into a vertical iPhone 15 Pro viewport (393x852 logical / 1179x2556 physical) and persists state', () => {
    window.localStorage.removeItem('tenuto_viewport_iphone15pro_v1');
    render(<App />);

    const viewportShell = screen.getByTestId('tenuto-app-viewport-shell');
    expect(viewportShell).toHaveAttribute('data-viewport-mode', 'desktop-landscape');

    const rotateBtn = screen.getByTestId('viewport-rotate-iphone15pro-btn');
    fireEvent.click(rotateBtn);

    expect(viewportShell).toHaveAttribute('data-viewport-mode', 'iphone-15-pro-portrait');
    expect(viewportShell).toHaveAttribute('data-logical-resolution', '393x852');
    expect(viewportShell).toHaveAttribute('data-native-resolution', '1179x2556');

    const viewportFrame = screen.getByTestId('tenuto-viewport-frame');
    expect(viewportFrame).toHaveStyle({ width: '393px', height: '852px' });
    expect(screen.getByTestId('iphone15pro-dynamic-island-bar')).toBeInTheDocument();
    expect(window.localStorage.getItem('tenuto_viewport_iphone15pro_v1')).toBe('true');

    // Visible floating Undo Rotation & Exit Fullscreen buttons are rendered
    const undoBtn = screen.getByTestId('undo-rotation-btn');
    const exitBtn = screen.getByTestId('exit-fullscreen-btn');
    expect(undoBtn).toBeInTheDocument();
    expect(exitBtn).toBeInTheDocument();

    // Clicking Undo Rotation restores desktop landscape mode
    fireEvent.click(undoBtn);
    expect(viewportShell).toHaveAttribute('data-viewport-mode', 'desktop-landscape');
    expect(window.localStorage.getItem('tenuto_viewport_iphone15pro_v1')).toBe('false');

    // Re-enter portrait mode and verify pressing Escape key immediately exits to desktop mode
    fireEvent.click(rotateBtn);
    expect(viewportShell).toHaveAttribute('data-viewport-mode', 'iphone-15-pro-portrait');
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(viewportShell).toHaveAttribute('data-viewport-mode', 'desktop-landscape');
    expect(window.localStorage.getItem('tenuto_viewport_iphone15pro_v1')).toBe('false');
  });

  it('supports native mobile long-press paste events on the editor textarea and one-tap clipboard paste via paste-ten-code-btn', async () => {
    window.localStorage.removeItem('tenuto_viewport_iphone15pro_v1');
    render(<App />);

    const textarea = screen.getByTestId('karaoke-code-textarea') as HTMLTextAreaElement;
    expect(textarea).toHaveStyle({ userSelect: 'text' });

    const pastedTenScore = `tenuto "6.0" {\n  meta @{ title: "Mobile Paste Test", tempo: 96, time: "4/4", key: "E", scale: "major" }\n  def gtr "Lead Guitar" style=synth patch="saw_lead"\n  measure 1 { gtr: e4:1 | }\n}`;
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: (type: string) => (type === 'text/plain' || type === 'text' ? pastedTenScore : ''),
      },
    });
    expect(textarea.value).toContain('Mobile Paste Test');

    // Verify one-tap clipboard paste button (paste-ten-code-btn)
    const clipScore = `tenuto "6.0" {\n  meta @{ title: "Clipboard Button Score", tempo: 110, time: "4/4", key: "A", scale: "minor" }\n  def gtr "Lead Guitar" style=synth patch="pluck_lead"\n  measure 1 { gtr: a3:1 | }\n}`;
    Object.assign(navigator, {
      clipboard: {
        readText: vi.fn().mockResolvedValue(clipScore),
      },
    });

    const pasteBtn = screen.getByTestId('paste-ten-code-btn');
    fireEvent.click(pasteBtn);

    await waitFor(() => {
      expect(textarea.value).toContain('Clipboard Button Score');
    });
  });
});

