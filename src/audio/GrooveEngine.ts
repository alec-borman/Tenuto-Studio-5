import { GrooveDefinition } from '../parser/DocumentParser';

export interface GrooveAdjustedNote {
  startSec: number;
  velocity: number;
}

export class GrooveEngine {
  /**
   * Applies an Ableton Groove Pool definition (`base`, `quantizePercent`, `timingPercent`,
   * `randomPercent`, `velocityPercent`) to a note's logical start position (`startWhole`),
   * returning its adjusted physical `startSec` and `velocity` (1..127).
   */
  public static applyGrooveToEvent(
    groove: GrooveDefinition,
    startWhole: number,
    baseStartSec: number,
    baseVelocity: number,
    tempoBpm: number,
    seedIndex: number = 0
  ): GrooveAdjustedNote {
    const secPerWhole = (60 / (tempoBpm || 120)) * 4;
    const baseStr = (groove.base || '1/16').trim();
    const slashIdx = baseStr.indexOf('/');
    const stepDenom = slashIdx !== -1 ? parseInt(baseStr.slice(slashIdx + 1), 10) || 16 : 16;
    const stepWhole = 1 / stepDenom;

    // 1. Grid Quantization (`quantizePercent`: 0..100%)
    const nearestStepIndex = Math.round(startWhole / stepWhole);
    const quantizedWhole = nearestStepIndex * stepWhole;
    const quantizeRatio = Math.max(0, Math.min(1, (groove.quantizePercent ?? 100) / 100));
    let groovedWhole = startWhole + (quantizedWhole - startWhole) * quantizeRatio;

    // 2. Swing / Timing Offset (`timingPercent`: 0..100% delays odd-numbered subdivision steps)
    const isOffbeatStep = Math.abs(nearestStepIndex % 2) === 1;
    const timingRatio = Math.max(-1, Math.min(1, (groove.timingPercent ?? 0) / 100));
    if (isOffbeatStep && timingRatio !== 0) {
      // At 100% timing, offbeat 16th shifts by 1/3 of a step (triplet MPC 66% swing)
      groovedWhole += stepWhole * 0.34 * timingRatio;
    }

    // 3. Deterministic Human Micro-Timing Jitter (`randomPercent`: 0..100%)
    const randomRatio = Math.max(0, Math.min(1, (groove.randomPercent ?? 0) / 100));
    let jitterSec = 0;
    if (randomRatio > 0) {
      const pseudoRand = Math.sin((seedIndex + 1) * 12.9898 + startWhole * 78.233) * 43758.5453;
      const bipolar = (pseudoRand - Math.floor(pseudoRand)) * 2 - 1;
      jitterSec = bipolar * 0.012 * randomRatio; // Up to ±12ms at 100% random
    }

    // 4. Velocity Groove Accent (`velocityPercent`: -100..100%)
    const velRatio = Math.max(-1, Math.min(1, (groove.velocityPercent ?? 0) / 100));
    let adjustedVelocity = baseVelocity;
    if (velRatio !== 0) {
      const accentSign = isOffbeatStep ? -0.14 : 0.14;
      adjustedVelocity = Math.max(
        1,
        Math.min(127, Math.round(baseVelocity * (1 + accentSign * velRatio)))
      );
    }

    const wholeDeltaSec = (groovedWhole - startWhole) * secPerWhole;
    const finalStartSec = Math.max(0, baseStartSec + wholeDeltaSec + jitterSec);

    return {
      startSec: finalStartSec,
      velocity: adjustedVelocity,
    };
  }
}
