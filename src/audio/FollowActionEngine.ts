import { AtomicEvent } from '../parser/ASTSerializer';
import { ClipDefinition, FollowActionConfig } from '../parser/DocumentParser';

export interface FollowActionResolution {
  chosenBranch: 'A' | 'B';
  action: string;
  targetClip: ClipDefinition | null;
}

export class FollowActionEngine {
  /**
   * Deterministic pseudo-random generator in [0, 1) seeded by an integer index
   * so probability and velocity ranges behave reproducibly in unit tests and exports.
   */
  public static seededRandom(seed: number): number {
    const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
  }

  /**
   * Resolves which Follow Action branch ('A' or 'B') fires and which target ClipDefinition
   * on the same track should launch next (or `null` if the action is `'stop'`).
   *
   * @param currentClip The currently playing clip containing `followAction`.
   * @param trackClips All clips belonging to the same track, ordered by sceneIndex.
   * @param branchRoll0to100 Optional roll in [0, 100) for branch selection.
   * @param targetRoll0to1 Optional roll in [0, 1) for `'any'` / `'other'` selection.
   */
  public static resolveNextClip(
    currentClip: ClipDefinition,
    trackClips: ClipDefinition[],
    branchRoll0to100?: number,
    targetRoll0to1?: number
  ): FollowActionResolution {
    const follow: FollowActionConfig | undefined = currentClip.followAction;
    if (!follow || trackClips.length === 0) {
      return { chosenBranch: 'A', action: 'play_again', targetClip: currentClip };
    }

    const totalChance = Math.max(1, (follow.chanceA ?? 100) + (follow.chanceB ?? 0));
    const thresholdA = ((follow.chanceA ?? 100) / totalChance) * 100;
    const roll = branchRoll0to100 !== undefined ? branchRoll0to100 : Math.random() * 100;

    const chosenBranch: 'A' | 'B' = roll < thresholdA ? 'A' : 'B';
    const rawAction = chosenBranch === 'A' ? follow.actionA : follow.actionB;
    const action = (rawAction || 'none').trim().toLowerCase();

    const ordered = [...trackClips].sort((a, b) => (a.sceneIndex ?? 0) - (b.sceneIndex ?? 0));
    const currentIdx = ordered.findIndex((c) => c.id === currentClip.id);
    const safeIdx = currentIdx !== -1 ? currentIdx : 0;
    const pickRoll = targetRoll0to1 !== undefined ? targetRoll0to1 : Math.random();

    if (action === 'stop') {
      return { chosenBranch, action: 'stop', targetClip: null };
    }

    if (action === 'none' || action === 'play_again' || action === 'again') {
      return { chosenBranch, action, targetClip: currentClip };
    }

    if (action === 'first') {
      return { chosenBranch, action, targetClip: ordered[0] };
    }

    if (action === 'last') {
      return { chosenBranch, action, targetClip: ordered[ordered.length - 1] };
    }

    if (action === 'next') {
      const nextIdx = (safeIdx + 1) % ordered.length;
      return { chosenBranch, action, targetClip: ordered[nextIdx] };
    }

    if (action === 'prev' || action === 'previous') {
      const prevIdx = (safeIdx - 1 + ordered.length) % ordered.length;
      return { chosenBranch, action, targetClip: ordered[prevIdx] };
    }

    if (action === 'any') {
      const anyIdx = Math.min(ordered.length - 1, Math.floor(pickRoll * ordered.length));
      return { chosenBranch, action, targetClip: ordered[anyIdx] };
    }

    if (action === 'other') {
      if (ordered.length <= 1) {
        return { chosenBranch, action, targetClip: currentClip };
      }
      const others = ordered.filter((c) => c.id !== currentClip.id);
      const otherIdx = Math.min(others.length - 1, Math.floor(pickRoll * others.length));
      return { chosenBranch, action, targetClip: others[otherIdx] };
    }

    return { chosenBranch, action, targetClip: currentClip };
  }

  /**
   * Evaluates Ableton Live 12 note-level probability rules across a list of AtomicEvents:
   * 1. `.pick_one` chord groups: Among simultaneous notes on the same track/voice marked `pickOne`,
   *    selects exactly one note from the chord group.
   * 2. `.chance(N%)`: Filters out notes whose probability roll exceeds `N`.
   * 3. `.vel_range(low, high)`: Randomizes `physics.velocity` within `[low, high]`.
   */
  public static evaluateNoteProbabilities(
    events: AtomicEvent[],
    customRng?: (seedIndex: number) => number
  ): AtomicEvent[] {
    const rng = customRng || FollowActionEngine.seededRandom;

    // Pass 1: Group simultaneous `.pick_one` chord notes by (trackId, voiceId, startTime)
    const pickOneGroups = new Map<string, AtomicEvent[]>();
    const nonPickOneEvents: AtomicEvent[] = [];

    for (const ev of events) {
      if (ev.physics?.pickOne && ev.startTime) {
        const key = `${ev.trackId || 'pno'}:${ev.voiceId || 'v1'}:${ev.startTime.numerator}/${ev.startTime.denominator}`;
        let group = pickOneGroups.get(key);
        if (!group) {
          group = [];
          pickOneGroups.set(key, group);
        }
        group.push(ev);
      } else {
        nonPickOneEvents.push(ev);
      }
    }

    const afterPickOne: AtomicEvent[] = [...nonPickOneEvents];
    let groupSeed = 1;
    for (const group of pickOneGroups.values()) {
      if (group.length === 1) {
        afterPickOne.push(group[0]);
      } else if (group.length > 1) {
        const roll = rng(groupSeed * 37);
        const chosenIdx = Math.min(group.length - 1, Math.floor(roll * group.length));
        afterPickOne.push(group[chosenIdx]);
      }
      groupSeed++;
    }

    // Restore chronological order by startTime
    afterPickOne.sort((a, b) => {
      const stA = a.startTime ? a.startTime.numerator / a.startTime.denominator : 0;
      const stB = b.startTime ? b.startTime.numerator / b.startTime.denominator : 0;
      return stA - stB;
    });

    // Pass 2: Evaluate `.chance(N%)` and `.vel_range(low, high)`
    const finalEvents: AtomicEvent[] = [];
    for (let i = 0; i < afterPickOne.length; i++) {
      const ev = afterPickOne[i];
      const chance = ev.physics?.chance;

      if (chance !== undefined && chance < 100) {
        if (chance <= 0) continue;
        const rollPct = rng(i + 101) * 100;
        if (rollPct >= chance) {
          continue;
        }
      }

      if (ev.physics?.velocityRange) {
        const [low, high] = ev.physics.velocityRange;
        const velRoll = rng(i + 503);
        const resolvedVel = Math.round(low + (high - low) * velRoll);
        finalEvents.push({
          ...ev,
          physics: {
            ...ev.physics,
            velocity: resolvedVel,
          },
        });
      } else {
        finalEvents.push(ev);
      }
    }

    return finalEvents;
  }
}
