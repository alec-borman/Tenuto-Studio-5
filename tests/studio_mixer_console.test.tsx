import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Mixer, { ASTState } from '../src/components/Mixer';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import '@testing-library/jest-dom';

describe('TDB-711: Live Studio Mixer Console with Peak/RMS Metering & Split Stereo Pan', () => {
  it('renders Peak/RMS meters, dB readouts, Pan spinbutton, Split Stereo Pan mode, and M/S/Arm controls', () => {
    const mockASTState: ASTState = {
      tracks: [
        { id: 'lead', volume: 100, pan: -0.2, fx: ['eq_eight'], muted: false, soloed: true, armed: false },
      ],
      meta: { sidechain: null },
    };

    const onUpdateAST = vi.fn();
    const onToggleMute = vi.fn();
    const onToggleSolo = vi.fn();
    const onToggleArm = vi.fn();

    render(
      <Mixer
        astState={mockASTState}
        onUpdateAST={onUpdateAST}
        onToggleMute={onToggleMute}
        onToggleSolo={onToggleSolo}
        onToggleArm={onToggleArm}
      />
    );

    // Verify Peak/RMS meter and 0 dB readout render
    expect(screen.getByTestId('meter-lead')).toBeInTheDocument();
    expect(screen.getByTestId('peak-db-lead')).toHaveTextContent('0 dB');

    // Update stereo pan via spinbutton -> dispatches PAN_UPDATE
    const panInput = screen.getByRole('spinbutton', { name: /lead pan/i });
    fireEvent.change(panInput, { target: { value: '0.4' } });
    expect(onUpdateAST).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: 'lead',
        mutationType: 'PAN_UPDATE',
        value: 0.4,
      })
    );

    // Toggle Split Stereo Pan mode -> renders independent Left and Right pan spinbuttons
    fireEvent.click(screen.getByRole('button', { name: /Toggle split pan for lead/i }));
    expect(screen.getByRole('spinbutton', { name: /lead left pan/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /lead right pan/i })).toBeInTheDocument();

    // Test Mute, Solo, and Record Arm buttons
    fireEvent.click(screen.getByRole('button', { name: /Mute mixer track lead/i }));
    expect(onToggleMute).toHaveBeenCalledWith('lead');

    fireEvent.click(screen.getByRole('button', { name: /Solo mixer track lead/i }));
    expect(onToggleSolo).toHaveBeenCalledWith('lead');

    fireEvent.click(screen.getByRole('button', { name: /Arm mixer track lead/i }));
    expect(onToggleArm).toHaveBeenCalledWith('lead');
  });

  it('computes accurate Peak and RMS meter telemetry in StudioAudioEngine', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Meter Test", tempo: 120, time: "4/4" }
        def lead "Lead" style=synth patch="saw_lead"
        measure 1 { lead: c4:4 e4:4 g4:2 | }
      }
    `);

    const levels = engine.getTrackMeterLevels(score, 0);
    expect(levels.lead).toBeDefined();
    expect(levels.lead.peakNorm).toBeGreaterThan(0);

    // Muting the track drops meter output to -60 dB (0 norm)
    engine.toggleTrackMute('lead');
    const mutedLevels = engine.getTrackMeterLevels(score, 0);
    expect(mutedLevels.lead.peakDb).toBe(-60);
    expect(mutedLevels.lead.peakNorm).toBe(0);
  });
});
