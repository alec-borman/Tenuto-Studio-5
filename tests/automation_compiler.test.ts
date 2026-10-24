import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import {
  interpolateCurveValue,
  evaluateAutomationLaneAt,
  ccOrValueToCutoffHz,
  ccOrValueToPan,
} from '../src/audio/AutomationEngine';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('TDB-704: Continuous Automation & Clip Envelope Compiler', () => {
  it('compiles .cc() and .automate() modifiers into multi-segment AutomationLanes', () => {
    const source = `tenuto "5.0" {
  meta @{ title: "Automation Suite", tempo: 120, time: "4/4" }
  def lead "Lead Synth" style=synth patch="saw_lead"

  measure 1 {
    lead: {
      v1: c4:4 e4:4 g4:4 c5:4 |
      v2: s:1.cc(74, [20, 120], "exp").automate("pan", [-0.8, 0.0, 0.8], "s_curve") |
    }
  }
}`;

    const parser = new DocumentParser();
    const compiled = parser.compile(source);

    expect(compiled.diagnostics).toHaveLength(0);
    expect(compiled.automationLanes).toBeDefined();
    expect(compiled.automationLanes!.length).toBe(2);

    const cutoffLane = compiled.automationLanes!.find(
      (l) => l.trackId === 'lead' && l.param === 'cutoff'
    );
    expect(cutoffLane).toBeDefined();
    expect(cutoffLane!.controller).toBe(74);
    expect(cutoffLane!.segments).toHaveLength(1);
    expect(cutoffLane!.segments[0]).toEqual({
      startWhole: 0,
      endWhole: 1,
      startValue: 20,
      endValue: 120,
      curve: 'exp',
    });

    const panLane = compiled.automationLanes!.find(
      (l) => l.trackId === 'lead' && l.param === 'pan'
    );
    expect(panLane).toBeDefined();
    expect(panLane!.segments).toHaveLength(2);
    expect(panLane!.segments[0].startWhole).toBeCloseTo(0, 5);
    expect(panLane!.segments[0].endWhole).toBeCloseTo(0.5, 5);
    expect(panLane!.segments[0].startValue).toBeCloseTo(-0.8, 5);
    expect(panLane!.segments[0].endValue).toBeCloseTo(0.0, 5);
    expect(panLane!.segments[0].curve).toBe('s_curve');

    expect(panLane!.segments[1].startWhole).toBeCloseTo(0.5, 5);
    expect(panLane!.segments[1].endWhole).toBeCloseTo(1.0, 5);
    expect(panLane!.segments[1].startValue).toBeCloseTo(0.0, 5);
    expect(panLane!.segments[1].endValue).toBeCloseTo(0.8, 5);
  });

  it('evaluates linear, exp, log, s_curve, and step interpolation curves accurately', () => {
    expect(interpolateCurveValue(0, 100, 0.5, 'linear')).toBeCloseTo(50, 3);
    expect(interpolateCurveValue(0, 100, 0.5, 'exp')).toBeLessThan(30);
    expect(interpolateCurveValue(0, 100, 0.5, 'log')).toBeGreaterThan(70);
    expect(interpolateCurveValue(0, 100, 0.5, 's_curve')).toBeCloseTo(50, 3);
    expect(interpolateCurveValue(0, 100, 0.25, 's_curve')).toBeLessThan(25);
    expect(interpolateCurveValue(0, 100, 0.75, 's_curve')).toBeGreaterThan(75);
    expect(interpolateCurveValue(20, 90, 0.5, 'step')).toBe(20);
    expect(interpolateCurveValue(20, 90, 1.0, 'step')).toBe(90);

    expect(ccOrValueToCutoffHz(127)).toBeCloseTo(12000, 0);
    expect(ccOrValueToCutoffHz(0)).toBeCloseTo(180, 0);
    expect(ccOrValueToCutoffHz(3200)).toBe(3200);
    expect(ccOrValueToPan(0, true)).toBeCloseTo(-1, 2);
    expect(ccOrValueToPan(64, true)).toBeCloseTo(0, 2);
    expect(ccOrValueToPan(127, true)).toBeCloseTo(1, 2);
  });

  it('modulates scheduled note volume, stereo pan, and filter cutoff in StudioAudioEngine', () => {
    const source = `tenuto "5.0" {
  meta @{ title: "Engine Automation Test", tempo: 120, time: "4/4" }
  def lead "Lead Synth" style=synth patch="saw_lead"

  measure 1 {
    lead: {
      v1: c4:4 e4:4 g4:4 c5:4 |
      v2: s:1.cc(7, [25, 127], "linear").cc(10, [0, 127], "linear").automate("cutoff", [300, 6300], "linear") |
    }
  }
}`;

    const parser = new DocumentParser();
    const score = parser.compile(source);
    const engine = new StudioAudioEngine();
    const timeline = (engine as any).buildScheduledTimeline(score);

    expect(timeline).toHaveLength(4);

    // Note 1 (beat 1) vs Note 4 (beat 4): volume, pan, and filter cutoff must ramp upward
    const firstNote = timeline[0];
    const lastNote = timeline[3];

    expect(firstNote.amp).toBeLessThan(lastNote.amp);
    expect(firstNote.pan).toBeLessThan(-0.5);
    expect(lastNote.pan).toBeGreaterThan(0.4);
    expect(firstNote.cutoffHzOverride).toBeDefined();
    expect(lastNote.cutoffHzOverride).toBeDefined();
    expect(firstNote.cutoffHzOverride).toBeLessThan(1500);
    expect(lastNote.cutoffHzOverride).toBeGreaterThan(4500);

    const cutLane = score.automationLanes!.find((l) => l.param === 'cutoff');
    expect(evaluateAutomationLaneAt(cutLane, 0.5)).toBeCloseTo(3300, 1);
  });
});
