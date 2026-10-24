import { AtomicEvent } from '../parser/ASTSerializer';

export type AutomationCurveType = 'linear' | 'exp' | 'log' | 's_curve' | 'step';

export interface AutomationSegment {
  startWhole: number;
  endWhole: number;
  startValue: number;
  endValue: number;
  curve: AutomationCurveType;
}

export interface AutomationLane {
  trackId: string;
  param: string;
  controller?: number;
  segments: AutomationSegment[];
}

export const CC_TO_PARAM_MAP: Record<number, string> = {
  1: 'mod_wheel',
  7: 'volume',
  10: 'pan',
  11: 'expression',
  71: 'resonance',
  74: 'cutoff',
  91: 'reverb_send',
  93: 'delay_send',
};

export function normalizeCurveType(rawCurve?: string): AutomationCurveType {
  const clean = (rawCurve || 'linear').trim().toLowerCase();
  if (clean === 'exp' || clean === 'exponential') return 'exp';
  if (clean === 'log' || clean === 'logarithmic') return 'log';
  if (clean === 's_curve' || clean === 'scurve' || clean === 's-curve' || clean === 'smooth') return 's_curve';
  if (clean === 'step' || clean === 'hold') return 'step';
  return 'linear';
}

export function resolveAutomationParamName(
  rawParam: string,
  controller?: number
): { param: string; controller?: number } {
  if (controller !== undefined && Number.isFinite(controller)) {
    return {
      param: CC_TO_PARAM_MAP[controller] || `cc:${controller}`,
      controller,
    };
  }

  const clean = rawParam.trim().toLowerCase();
  const ccMatch = clean.match(/^cc:(\d+)$/);
  if (ccMatch) {
    const ccNum = parseInt(ccMatch[1], 10);
    return {
      param: CC_TO_PARAM_MAP[ccNum] || `cc:${ccNum}`,
      controller: ccNum,
    };
  }

  if (clean === 'vol' || clean === 'gain') return { param: 'volume' };
  if (clean === 'filter_cutoff' || clean === 'filter.cutoff') return { param: 'cutoff' };
  if (clean === 'res' || clean === 'filter_res' || clean === 'filter.resonance') return { param: 'resonance' };

  return { param: clean };
}

/**
 * Evaluates a normalized curve progress `tNormalized` in [0, 1] between `startValue` and `endValue`.
 */
export function interpolateCurveValue(
  startValue: number,
  endValue: number,
  tNormalized: number,
  curve: AutomationCurveType
): number {
  const t = Math.max(0, Math.min(1, tNormalized));
  if (curve === 'step') {
    return t >= 1 ? endValue : startValue;
  }

  let shaped = t;
  if (curve === 'exp') {
    shaped = (Math.exp(3 * t) - 1) / (Math.exp(3) - 1);
  } else if (curve === 'log') {
    shaped = Math.log(1 + (Math.exp(3) - 1) * t) / 3;
  } else if (curve === 's_curve') {
    shaped = t * t * (3 - 2 * t);
  }

  return startValue + (endValue - startValue) * shaped;
}

/**
 * Compiles `.cc(controller, [values], curve)` and `.automate(param, [values], curve)`
 * modifiers from a stream of AtomicEvents into per-track, per-parameter AutomationLanes.
 */
export function compileAutomationLanes(events: AtomicEvent[]): AutomationLane[] {
  const lanesMap = new Map<string, AutomationLane>();

  for (const ev of events) {
    const specs =
      ev.physics?.automations && ev.physics.automations.length > 0
        ? ev.physics.automations
        : ev.physics?.cc
          ? [
              {
                param: `cc:${ev.physics.cc.controller}`,
                controller: ev.physics.cc.controller,
                values: ev.physics.cc.values,
                curve: ev.physics.cc.curve,
              },
            ]
          : [];

    if (specs.length === 0) continue;

    const trackId = ev.trackId || 'pno';
    const startWhole = ev.startTime
      ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator)
      : 0;
    const durWhole = ev.duration
      ? ev.duration.numerator / Math.max(1, ev.duration.denominator)
      : 0.25;

    if (!Number.isFinite(startWhole) || !Number.isFinite(durWhole) || durWhole <= 0) continue;

    for (const spec of specs) {
      if (!spec.values || spec.values.length === 0) continue;
      const { param, controller } = resolveAutomationParamName(spec.param, spec.controller);
      const curve = normalizeCurveType(spec.curve);
      const key = `${trackId}::${param}`;

      let lane = lanesMap.get(key);
      if (!lane) {
        lane = {
          trackId,
          param,
          controller,
          segments: [],
        };
        lanesMap.set(key, lane);
      }

      if (spec.values.length === 1) {
        lane.segments.push({
          startWhole,
          endWhole: startWhole + durWhole,
          startValue: spec.values[0],
          endValue: spec.values[0],
          curve: 'step',
        });
      } else {
        const numSegments = spec.values.length - 1;
        const segDur = durWhole / numSegments;
        for (let i = 0; i < numSegments; i++) {
          lane.segments.push({
            startWhole: startWhole + i * segDur,
            endWhole: startWhole + (i + 1) * segDur,
            startValue: spec.values[i],
            endValue: spec.values[i + 1],
            curve,
          });
        }
      }
    }
  }

  const lanes = Array.from(lanesMap.values());
  for (const lane of lanes) {
    lane.segments.sort((a, b) => a.startWhole - b.startWhole || a.endWhole - b.endWhole);
  }
  return lanes;
}

/**
 * Evaluates an AutomationLane at an arbitrary rational whole-note position `timeWhole`.
 */
export function evaluateAutomationLaneAt(
  lane: AutomationLane | undefined,
  timeWhole: number
): number | undefined {
  if (!lane || lane.segments.length === 0 || !Number.isFinite(timeWhole)) {
    return undefined;
  }

  const segs = lane.segments;
  if (timeWhole <= segs[0].startWhole) {
    return segs[0].startValue;
  }

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const isLast = i === segs.length - 1;
    const withinEnd = isLast ? timeWhole <= seg.endWhole : timeWhole < seg.endWhole;

    if (timeWhole >= seg.startWhole && withinEnd) {
      const span = seg.endWhole - seg.startWhole;
      if (span <= 1e-9) return seg.endValue;
      const tNorm = (timeWhole - seg.startWhole) / span;
      return interpolateCurveValue(seg.startValue, seg.endValue, tNorm, seg.curve);
    }

    if (!isLast && timeWhole >= seg.endWhole && timeWhole < segs[i + 1].startWhole) {
      return seg.endValue;
    }
  }

  return segs[segs.length - 1].endValue;
}

/**
 * Maps a raw automation value (either 0..127 MIDI CC 74 or direct Hz 60..16000) to filter cutoff in Hz.
 */
export function ccOrValueToCutoffHz(val: number): number {
  if (!Number.isFinite(val)) return 2400;
  if (val > 127) {
    return Math.max(60, Math.min(16000, val));
  }
  const norm = Math.max(0, Math.min(1, val / 127));
  return 180 * Math.pow(12000 / 180, norm);
}

/**
 * Maps a raw automation value (either 0..127 MIDI CC 10 or normalized -1..1) to stereo pan in [-1, 1].
 */
export function ccOrValueToPan(val: number, isMidiCc: boolean = false): number {
  if (!Number.isFinite(val)) return 0;
  if (isMidiCc || val > 1.0001) {
    const delta = val - 64;
    const mapped = delta >= 0 ? delta / 63 : delta / 64;
    return Math.max(-1, Math.min(1, mapped));
  }
  return Math.max(-1, Math.min(1, val));
}

/**
 * Maps a raw automation value (either 0..127 MIDI CC 7/11 or normalized 0..1.5) to an amplitude scalar.
 */
export function ccOrValueToVolumeScalar(val: number, isMidiCc: boolean = false): number {
  if (!Number.isFinite(val)) return 1.0;
  if (isMidiCc || val > 1.5) {
    const norm = Math.max(0, Math.min(127, val)) / 127;
    return Math.max(0.05, Math.min(1.4, 0.05 + 1.25 * Math.pow(norm, 0.85)));
  }
  return Math.max(0.05, Math.min(1.4, val));
}
