import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ArrangementView from '../src/components/ArrangementView';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import '@testing-library/jest-dom';

describe('TDB-709: Arrangement View Multi-Track Timeline, Locators & Loop Brace', () => {
  it('renders stacked track lanes, group folders, clickable locators, and loop brace controls', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Arrangement Test", tempo: 120, time: "4/4" }
        def lead "Lead Synth" style=synth patch="wavetable" group="synth_bus"
        def drums "909 Kit" style=grid patch="tenuto_808_kit"
        group synth_bus "Synth Group" tracks=[lead]

        locator "Intro" at measure 1
        locator "Main Drop" at measure 3

        measure 1 {
          lead: c4:4 e4:4 g4:2 |
          drums: k:4 s:4 k:4 s:4 |
        }
        measure 2 {
          lead: a4:2 g4:2 |
        }
        measure 3 {
          drums: k:8 k:8 s:4 k:8 k:8 s:4 |
        }
      }
    `);

    const onSeekToMeasure = vi.fn();
    const onToggleTrackMute = vi.fn();
    const onToggleTrackSolo = vi.fn();
    const onLoopRangeChange = vi.fn();
    const onAddLocator = vi.fn();

    render(
      <ArrangementView
        score={score}
        playheadBeat={4}
        mutedTracks={[]}
        soloedTracks={[]}
        loopStartMeasure={1}
        loopEndMeasure={3}
        onToggleTrackMute={onToggleTrackMute}
        onToggleTrackSolo={onToggleTrackSolo}
        onSeekToMeasure={onSeekToMeasure}
        onLoopRangeChange={onLoopRangeChange}
        onAddLocator={onAddLocator}
      />
    );

    // Verify group row and track lanes render
    expect(screen.getByTestId('arrangement-group-row-synth_bus')).toBeInTheDocument();
    expect(screen.getByTestId('arrangement-track-lane-lead')).toBeInTheDocument();
    expect(screen.getByTestId('arrangement-track-lane-drums')).toBeInTheDocument();

    // Click 'Main Drop' locator -> seeks to Measure 3
    fireEvent.click(screen.getByRole('button', { name: /Jump to locator Main Drop/i }));
    expect(onSeekToMeasure).toHaveBeenCalledWith(3);

    // Click Mute and Solo on 'lead'
    fireEvent.click(screen.getByRole('button', { name: /Mute track lead/i }));
    expect(onToggleTrackMute).toHaveBeenCalledWith('lead');

    fireEvent.click(screen.getByRole('button', { name: /Solo track lead/i }));
    expect(onToggleTrackSolo).toHaveBeenCalledWith('lead');

    // Add a new locator at Measure 2
    const locMeasureInput = screen.getByRole('spinbutton', { name: /New Locator Measure/i });
    fireEvent.change(locMeasureInput, { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Add Arrangement Locator/i }));
    expect(onAddLocator).toHaveBeenCalledWith('Section M2', 2);

    // Fold group 'synth_bus' -> hides member track 'lead'
    fireEvent.click(screen.getByRole('button', { name: /Toggle group synth_bus/i }));
    expect(screen.queryByTestId('arrangement-track-lane-lead')).not.toBeInTheDocument();
  });

  it('toggles track mute/solo and sets arrangement loop ranges in StudioAudioEngine', () => {
    const engine = new StudioAudioEngine();

    expect(engine.toggleTrackMute('lead')).toBe(true);
    expect(engine.getMutedTracks()).toContain('lead');
    expect(engine.toggleTrackMute('lead')).toBe(false);
    expect(engine.getMutedTracks()).not.toContain('lead');

    expect(engine.toggleTrackSolo('drums')).toBe(true);
    expect(engine.getSoloedTracks()).toContain('drums');

    engine.setArrangementLoopRange(2, 4);
    expect(engine.getArrangementLoopRange()).toEqual({ startMeasure: 2, endMeasure: 4 });
  });
});
