import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArrangementView from '../src/components/ArrangementView';
import WebGPUCanvas from '../src/components/WebGPUCanvas';
import { DocumentParser } from '../src/parser/DocumentParser';
import { TopologicalMutator } from '../src/mutator/TopologicalMutator';
import '@testing-library/jest-dom';

HTMLCanvasElement.prototype.getContext = vi.fn();

describe('TDB-714: Interactive Bezier Automation Lanes (Track & Clip Envelopes)', () => {
  it('unfolds Z-axis automation lanes in ArrangementView, edits breakpoints and curve shapes, and mutates .ten source code', () => {
    const parser = new DocumentParser();
    const mutator = new TopologicalMutator();

    const initialSource = `tenuto "6.0" {
  meta @{ title: "Automation Lane Test", tempo: 120, time: "4/4" }
  def lead "Lead Synth" style=synth patch="saw_lead"

  measure 1 {
    lead: c4:4 e4:4 g4:2 |
  }
}`;

    const score = parser.compile(initialSource);
    const onCommitAutomation = vi.fn();

    render(
      <ArrangementView score={score} onCommitAutomation={onCommitAutomation} />
    );

    // Click 'A' button on 'lead' track header to unfold the Z-axis automation lane
    fireEvent.click(screen.getByRole('button', { name: /Toggle automation lane for lead/i }));
    expect(screen.getByTestId('automation-lane-editor-lead')).toBeInTheDocument();

    // Change curve shape to 'exp'
    fireEvent.change(screen.getByRole('combobox', { name: /Automation curve shape for lead/i }), {
      target: { value: 'exp' },
    });
    expect(onCommitAutomation).toHaveBeenCalledWith('lead', 1, 'cutoff', [400, 3200], 'exp');

    // Edit Breakpoint 2 value to 4800 Hz
    fireEvent.change(screen.getByRole('spinbutton', { name: /lead automation point 2/i }), {
      target: { value: '4800' },
    });
    expect(onCommitAutomation).toHaveBeenCalledWith('lead', 1, 'cutoff', [400, 4800], 'exp');

    // Add a 3rd breakpoint (+ Point)
    fireEvent.click(screen.getByRole('button', { name: /Add automation breakpoint for lead/i }));
    expect(onCommitAutomation).toHaveBeenCalledWith('lead', 1, 'cutoff', [400, 4800, 4800], 'exp');

    // Verify TopologicalMutator writes the exact .automate(...) voice into the .ten source code
    const mutatedSource = mutator.upsertTrackAutomationInSource(
      initialSource,
      'lead',
      1,
      'cutoff',
      [400, 4800, 1200],
      's_curve'
    );
    expect(mutatedSource).toContain('.automate("cutoff", [400, 4800, 1200], "s_curve")');

    // Re-compile the mutated source and verify the automation lane compiles with 2 segments
    const recompiled = parser.compile(mutatedSource);
    expect(recompiled.automationLanes).toHaveLength(1);
    expect(recompiled.automationLanes![0].segments).toHaveLength(2);
  });

  it('toggles the Clip Envelope Editor drawer inside WebGPUCanvas Piano Roll', () => {
    const parser = new DocumentParser();
    const score = parser.compile('pno: c4:4 e4:4 g4:2');
    const onCommitAutomation = vi.fn();

    render(
      <WebGPUCanvas
        events={score.events}
        automationLanes={score.automationLanes}
        onCommitAutomation={onCommitAutomation}
      />
    );

    // Click 'Clip Env' button in Piano Roll toolbar
    fireEvent.click(screen.getByRole('button', { name: /Toggle Clip Envelope Editor/i }));
    expect(screen.getByTestId('automation-lane-editor-pno')).toBeInTheDocument();
  });
});
