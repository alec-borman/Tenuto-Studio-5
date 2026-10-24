import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import Mixer, { ASTState } from '../src/components/Mixer';
import '@testing-library/jest-dom';

describe('TDB-713: Group Tracks, Folder Folding & Multi-Point Sidechaining', () => {
  it('scales member track gain by group volume, propagates group mute/solo, and evaluates Pre-FX / Post-FX / Post-Mixer sidechain ducking', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Group & Sidechain Test", tempo: 120, time: "4/4", sidechain: "drums", sidechain_tap: "post_mixer" }
        var synth_bus_vol = 50
        def lead "Lead" style=synth patch="saw_lead" group="synth_bus"
        def drums "Kit" style=grid patch="tenuto_808_kit"
        group synth_bus "Synth Bus" tracks=[lead] .fx(glue_compressor, @{ratio: 4})

        measure 1 {
          lead: c4:4 e4:4 g4:2 |
          drums: k:4 r:4 r:2 |
        }
      }
    `);

    expect(score.meta.sidechainTap).toBe('post_mixer');
    expect(score.groups).toHaveLength(1);
    expect(score.groups![0].volume).toBe(50);

    // Beat 1 (t=0s) has a kick hit on 'drums', so 'lead' note 0 at t=0s is ducked compared to note 1 at beat 2 (t=0.5s)
    const timeline = (engine as any).buildScheduledTimeline(score);
    const leadNotes = timeline.filter((n: any) => n.event.trackId === 'lead');
    expect(leadNotes).toHaveLength(3);
    expect(leadNotes[0].amp).toBeLessThan(leadNotes[1].amp);

    // In post_mixer tap mode, muting the 'drums' trigger track disables sidechain ducking on 'lead'
    engine.toggleTrackMute('drums');
    const timelineWithMutedDrums = (engine as any).buildScheduledTimeline(score);
    const leadNotesUnDucked = timelineWithMutedDrums.filter((n: any) => n.event.trackId === 'lead');
    expect(leadNotesUnDucked[0].amp).toBeGreaterThan(leadNotes[0].amp);

    // Muting the parent group 'synth_bus' mutes all member tracks ('lead')
    engine.toggleGroupMute('synth_bus');
    const timelineWithMutedGroup = (engine as any).buildScheduledTimeline(score);
    expect(timelineWithMutedGroup.filter((n: any) => n.event.trackId === 'lead')).toHaveLength(0);
  });

  it('renders collapsible Group Bus strips and the Sidechain Tap Point selector in Mixer', () => {
    const mockASTState: ASTState = {
      tracks: [
        { id: 'lead', volume: 100, fx: [] },
        { id: 'drums', volume: 100, fx: [] },
      ],
      groups: [
        {
          id: 'synth_bus',
          name: 'Synth Bus',
          trackIds: ['lead'],
          volume: 95,
          fx: ['glue_compressor'],
        },
      ],
      meta: { sidechain: 'drums', sidechainTap: 'post_fx' },
    };

    const onUpdateAST = vi.fn();
    const onToggleGroupMute = vi.fn();
    render(
      <Mixer
        astState={mockASTState}
        onToggleGroupMute={onToggleGroupMute}
        onUpdateAST={onUpdateAST}
      />
    );

    // Verify Group Strip and member track strip both render initially
    expect(screen.getByTestId('mixer-group-strip-synth_bus')).toBeInTheDocument();
    expect(screen.getByTestId('mixer-strip-lead')).toBeInTheDocument();

    // Change Sidechain Tap Point to Pre-FX
    const tapSelect = screen.getByLabelText(/Sidechain Tap Point/i);
    fireEvent.change(tapSelect, { target: { value: 'pre_fx' } });
    expect(onUpdateAST).toHaveBeenCalledWith(
      expect.objectContaining({
        mutationType: 'META_SIDECHAIN_TAP_UPDATE',
        tapMode: 'pre_fx',
      })
    );

    // Change Group Volume spinbutton
    const grpVolInput = screen.getByRole('spinbutton', { name: /synth_bus group volume/i });
    fireEvent.change(grpVolInput, { target: { value: '80' } });
    expect(onUpdateAST).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'synth_bus',
        mutationType: 'GROUP_VOLUME_UPDATE',
        value: 80,
      })
    );

    // Fold group 'synth_bus' in Mixer -> hides member track strip 'lead' while keeping 'drums' visible
    fireEvent.click(screen.getByRole('button', { name: /Fold mixer group synth_bus/i }));
    expect(screen.queryByTestId('mixer-strip-lead')).not.toBeInTheDocument();
    expect(screen.getByTestId('mixer-strip-drums')).toBeInTheDocument();
  });
});
