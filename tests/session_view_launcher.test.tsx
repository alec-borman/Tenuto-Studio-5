import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SessionView from '../src/components/SessionView';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import '@testing-library/jest-dom';

describe('TDB-707: Session View Clip Matrix & Quantized Scene Launcher', () => {
  it('renders a 2D track-by-scene matrix from explicit scenes and clips and dispatches clip and scene launches', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Session Launch Test", tempo: 124, time: "4/4", quantize_launch: "1/1" }
        def lead "Lead Synth" style=synth patch="wavetable"
        def drums "909 Kit" style=grid patch="tenuto_808_kit"

        scene 1 "Intro" @{ tempo: 124 } {
          lead: c4:4 e4:4 g4:2 @follow @{bars: 4, actionA: "next"}
          drums: k:4 s:4 k:4 s:4 |
        }

        scene 2 "Drop" @{ tempo: 128 } {
          drums: k:8 k:8 s:4 k:8 k:8 s:4 |
        }
      }
    `);

    const onLaunchClip = vi.fn();
    const onLaunchScene = vi.fn();
    const onStopTrackClip = vi.fn();
    const onCreateClipInSlot = vi.fn();

    render(
      <SessionView
        score={score}
        activeClipsByTrack={{ lead: 'scene_1_lead' }}
        quantizeLaunch="1/1"
        onLaunchClip={onLaunchClip}
        onStopTrackClip={onStopTrackClip}
        onStopAllClips={vi.fn()}
        onLaunchScene={onLaunchScene}
        onCreateClipInSlot={onCreateClipInSlot}
      />
    );

    // Verify both scene rows render
    expect(screen.getByTestId('session-scene-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('session-scene-row-2')).toBeInTheDocument();

    // Launch individual clip scene_1_drums
    fireEvent.click(screen.getByRole('button', { name: /Launch clip scene_1_drums/i }));
    expect(onLaunchClip).toHaveBeenCalledWith(expect.objectContaining({ id: 'scene_1_drums', trackId: 'drums' }));

    // Launch Scene 2 row
    fireEvent.click(screen.getByRole('button', { name: /Launch scene 2/i }));
    expect(onLaunchScene).toHaveBeenCalledWith(2, expect.any(Array), 128);

    // Scene 2 has an empty slot on 'lead' -> click '+ Clip' to inject code into that slot
    fireEvent.click(screen.getByRole('button', { name: /Create clip on lead scene 2/i }));
    expect(onCreateClipInSlot).toHaveBeenCalledWith('lead', 2);

    // Stop track lead
    fireEvent.click(screen.getByRole('button', { name: /^Stop track lead$/i }));
    expect(onStopTrackClip).toHaveBeenCalledWith('lead');
  });

  it('auto-synthesizes virtual launchable scene rows when a score only contains linear measure blocks', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "Linear Measure Score", tempo: 120, time: "4/4" }
        def pno "Piano" style=standard patch="salamander_grand"
        measure 1 { pno: c4:4 d4:4 e4:4 f4:4 | }
        measure 2 { pno: g4:2 c5:2 | }
      }
    `);

    render(
      <SessionView
        score={score}
        activeClipsByTrack={{}}
        onLaunchClip={vi.fn()}
        onStopTrackClip={vi.fn()}
        onStopAllClips={vi.fn()}
        onLaunchScene={vi.fn()}
      />
    );

    expect(screen.getByTestId('session-scene-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('session-scene-row-2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch clip virtual_m1_pno/i })).toBeInTheDocument();
  });

  it('computes accurate quantization boundaries in StudioAudioEngine', () => {
    const engine = new StudioAudioEngine();
    expect(engine.computeQuantizeDelaySec('none', 120)).toBe(0);
    expect(engine.computeQuantizeDelaySec('1/1', 120)).toBe(0); // When stopped, launches immediately (0s delay)
  });
});
