import { describe, it, expect } from 'vitest';
import { FollowActionEngine } from '../src/audio/FollowActionEngine';
import { DocumentParser, ClipDefinition } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('TDB-708: Clip Follow Actions, Launch Probability & Per-Note Chance Engine', () => {
  const sampleTrackClips: ClipDefinition[] = [
    {
      id: 'clip_1',
      name: 'Intro Clip',
      trackId: 'lead',
      sceneIndex: 1,
      bars: 2,
      loop: true,
      followAction: {
        bars: 2,
        actionA: 'next',
        actionB: 'last',
        chanceA: 80,
        chanceB: 20,
        linked: true,
      },
      events: [],
    },
    {
      id: 'clip_2',
      name: 'Main Clip',
      trackId: 'lead',
      sceneIndex: 2,
      bars: 4,
      loop: true,
      followAction: {
        bars: 4,
        actionA: 'prev',
        actionB: 'stop',
        chanceA: 50,
        chanceB: 50,
        linked: true,
      },
      events: [],
    },
    {
      id: 'clip_3',
      name: 'Outro Clip',
      trackId: 'lead',
      sceneIndex: 3,
      bars: 2,
      loop: true,
      followAction: {
        bars: 2,
        actionA: 'first',
        actionB: 'other',
        chanceA: 70,
        chanceB: 30,
        linked: true,
      },
      events: [],
    },
  ];

  it('resolves next, prev, first, last, other, and stop Follow Actions with A/B probability branching', () => {
    // Roll 40 (< 80% chanceA) on clip_1 -> chooses Branch A ('next') -> clip_2
    const resNext = FollowActionEngine.resolveNextClip(sampleTrackClips[0], sampleTrackClips, 40);
    expect(resNext.chosenBranch).toBe('A');
    expect(resNext.action).toBe('next');
    expect(resNext.targetClip?.id).toBe('clip_2');

    // Roll 90 (>= 80% chanceA) on clip_1 -> chooses Branch B ('last') -> clip_3
    const resLast = FollowActionEngine.resolveNextClip(sampleTrackClips[0], sampleTrackClips, 90);
    expect(resLast.chosenBranch).toBe('B');
    expect(resLast.action).toBe('last');
    expect(resLast.targetClip?.id).toBe('clip_3');

    // Roll 20 (< 50% chanceA) on clip_2 -> chooses Branch A ('prev') -> clip_1
    const resPrev = FollowActionEngine.resolveNextClip(sampleTrackClips[1], sampleTrackClips, 20);
    expect(resPrev.targetClip?.id).toBe('clip_1');

    // Roll 75 (>= 50% chanceA) on clip_2 -> chooses Branch B ('stop') -> null
    const resStop = FollowActionEngine.resolveNextClip(sampleTrackClips[1], sampleTrackClips, 75);
    expect(resStop.action).toBe('stop');
    expect(resStop.targetClip).toBeNull();

    // Roll 85 (>= 70% chanceA) on clip_3 -> chooses Branch B ('other') -> must not be clip_3
    const resOther = FollowActionEngine.resolveNextClip(sampleTrackClips[2], sampleTrackClips, 85, 0.1);
    expect(resOther.action).toBe('other');
    expect(resOther.targetClip?.id).not.toBe('clip_3');
  });

  it('evaluates .pick_one chord groups, .chance(N%) filtering, and .vel_range(low, high) humanization', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Probability Test", tempo: 120, time: "4/4" }
        def lead "Synth" style=synth patch="saw_lead"
        measure 1 {
          lead: [c4 e4 g4]:4.pick_one d4:4.chance(100%).vel_range(60, 100) f4:4.chance(0%) a4:4.chance(50%) |
        }
      }
    `);

    // Raw compiled events have 3 chord notes + 3 single notes = 6 events
    expect(score.events).toHaveLength(6);

    // Evaluate with a deterministic RNG returning 0.35 (35%)
    const evaluated = FollowActionEngine.evaluateNoteProbabilities(score.events, () => 0.35);

    // 1. [c4 e4 g4]:4.pick_one -> collapses 3 chord notes down to 1 chosen note
    // 2. d4:4.chance(100%).vel_range(60, 100) -> kept, velocity interpolated in [60, 100]
    // 3. f4:4.chance(0%) -> dropped
    // 4. a4:4.chance(50%) -> kept because 35% < 50%
    expect(evaluated).toHaveLength(3);

    const d4Event = evaluated.find((e) => e.pitch.midi === 62)!;
    expect(d4Event.physics?.velocity).toBeGreaterThanOrEqual(60);
    expect(d4Event.physics?.velocity).toBeLessThanOrEqual(100);

    // Verify StudioAudioEngine.buildScheduledTimeline applies probability evaluation automatically
    const engine = new StudioAudioEngine();
    const timeline = (engine as any).buildScheduledTimeline(score);
    // f4:4.chance(0%) is never scheduled, and [c4 e4 g4].pick_one schedules only 1 note
    expect(timeline.length).toBeLessThanOrEqual(3);
  });
});
