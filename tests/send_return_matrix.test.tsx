import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SpatialAudioMatrix } from '../src/audio/SpatialAudioMatrix';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { DocumentParser } from '../src/parser/DocumentParser';
import Mixer, { ASTState } from '../src/components/Mixer';
import '@testing-library/jest-dom';

describe('TDB-712: Send & Return Tracks (bus:// Routing Matrix)', () => {
  it('registers track sends in SpatialAudioMatrix, enforces E4001 cycle detection, and computes Pre vs Post-Fader send gains', () => {
    const matrix = new SpatialAudioMatrix();

    const route = matrix.registerTrackSend('lead', 'rev_bus', 0.5, 'post');
    expect(route).toEqual({
      sourceBusId: 'bus://lead',
      targetBusId: 'bus://rev_bus',
      level: 0.5,
      mode: 'post',
    });
    expect(matrix.getTrackSends('lead')).toHaveLength(1);

    // Attempting to route rev_bus back into lead must throw E4001: Circular Routing Detected
    expect(() => matrix.registerTrackSend('rev_bus', 'lead', 0.3)).toThrowError(
      /E4001: Circular Routing Detected/
    );

    // Post-fader send scales with track fader volume (at volume 50/100, 0.5 send -> 0.25 effective gain)
    expect(SpatialAudioMatrix.computeEffectiveSendGain(0.5, 'post', 50, false)).toBeCloseTo(0.25, 3);
    // Pre-fader send bypasses track fader volume (at volume 0/100, 0.5 send -> still 0.5 effective gain!)
    expect(SpatialAudioMatrix.computeEffectiveSendGain(0.5, 'pre', 0, false)).toBeCloseTo(0.5, 3);
    // Muted track drops send gain to 0
    expect(SpatialAudioMatrix.computeEffectiveSendGain(0.5, 'pre', 100, true)).toBe(0);
  });

  it('wires return buses and sends in StudioAudioEngine and renders Send controls and + Add Return Bus in Mixer', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Send Return Test", tempo: 120, time: "4/4" }
        return rev_bus "Hall Return" .fx(hybrid_reverb, @{mix: 1.0})
        def lead "Lead Synth" style=synth patch="saw_lead" sends=@{rev_bus: 0.6}
        measure 1 { lead: c4:4 e4:4 g4:2 | }
      }
    `);

    const timeline = (engine as any).buildScheduledTimeline(score);
    expect(timeline).toHaveLength(3);
    expect(timeline[0].reverbSendGain).toBeCloseTo(0.6, 2);

    const mockASTState: ASTState = {
      tracks: [
        { id: 'lead', volume: 100, fx: [], sends: { rev_bus: 0.4 }, sendModes: { rev_bus: 'post' } },
        { id: 'rev_bus', volume: 100, fx: ['hybrid_reverb'], isReturn: true },
      ],
      meta: { sidechain: null },
    };

    const onUpdateAST = vi.fn();
    render(<Mixer astState={mockASTState} onUpdateAST={onUpdateAST} />);

    // Update send level for lead -> rev_bus
    const sendInput = screen.getByRole('spinbutton', { name: /lead send rev_bus/i });
    fireEvent.change(sendInput, { target: { value: '0.75' } });
    expect(onUpdateAST).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: 'lead',
        mutationType: 'SEND_UPDATE',
        sendId: 'rev_bus',
        sendLevel: 0.75,
      })
    );

    // Toggle Pre/Post send mode
    fireEvent.click(screen.getByRole('button', { name: /Toggle send mode rev_bus for lead/i }));
    expect(onUpdateAST).toHaveBeenCalledWith(
      expect.objectContaining({
        trackId: 'lead',
        mutationType: 'SEND_UPDATE',
        sendId: 'rev_bus',
        sendMode: 'pre',
      })
    );

    // Click '+ Add Return Bus'
    fireEvent.click(screen.getByRole('button', { name: /Add Return Track/i }));
    expect(onUpdateAST).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'ADD_RETURN_TRACK',
      })
    );
  });
});
