import React, { useState, useMemo, useEffect } from 'react';
import {
  AutomationLane,
  AutomationCurveType,
  interpolateCurveValue,
  normalizeCurveType,
} from '../audio/AutomationEngine';

export interface AutomationLaneEditorProps {
  trackId: string;
  measureNumber?: number;
  lanes?: AutomationLane[];
  onCommitAutomation?: (
    trackId: string,
    measureNumber: number,
    param: string,
    values: number[],
    curve: AutomationCurveType
  ) => void;
}

const AUTOMATION_PARAMS = [
  { id: 'cutoff', label: 'Filter Cutoff (Hz)', defaultValues: [400, 3200], min: 60, max: 16000, step: 50 },
  { id: 'volume', label: 'Track Volume (0-127)', defaultValues: [60, 110], min: 0, max: 127, step: 1 },
  { id: 'pan', label: 'Stereo Pan (-1..+1)', defaultValues: [-0.5, 0.5], min: -1, max: 1, step: 0.1 },
  { id: 'resonance', label: 'Filter Resonance', defaultValues: [20, 90], min: 0, max: 127, step: 1 },
  { id: 'reverb_send', label: 'Reverb Send', defaultValues: [20, 100], min: 0, max: 127, step: 1 },
  { id: 'delay_send', label: 'Delay Send', defaultValues: [0, 85], min: 0, max: 127, step: 1 },
];

export default function AutomationLaneEditor({
  trackId,
  measureNumber = 1,
  lanes = [],
  onCommitAutomation,
}: AutomationLaneEditorProps) {
  const trackLanes = useMemo(
    () => lanes.filter((l) => l.trackId === trackId),
    [lanes, trackId]
  );

  const [selectedParam, setSelectedParam] = useState<string>(
    trackLanes[0]?.param || 'cutoff'
  );

  const activeLane = useMemo(
    () => trackLanes.find((l) => l.param === selectedParam),
    [trackLanes, selectedParam]
  );

  const paramMeta = useMemo(
    () => AUTOMATION_PARAMS.find((p) => p.id === selectedParam) || AUTOMATION_PARAMS[0],
    [selectedParam]
  );

  const initialPoints = useMemo(() => {
    if (activeLane && activeLane.segments.length > 0) {
      const pts = [activeLane.segments[0].startValue];
      for (const seg of activeLane.segments) {
        pts.push(seg.endValue);
      }
      return pts;
    }
    return [...paramMeta.defaultValues];
  }, [activeLane, paramMeta]);

  const [points, setPoints] = useState<number[]>(initialPoints);
  const [curveType, setCurveType] = useState<AutomationCurveType>(
    activeLane?.segments[0]?.curve || 's_curve'
  );

  useEffect(() => {
    setPoints(initialPoints);
    if (activeLane?.segments[0]?.curve) {
      setCurveType(activeLane.segments[0].curve);
    }
  }, [initialPoints, activeLane]);

  const handlePointChange = (index: number, nextVal: number) => {
    const clamped = Math.max(paramMeta.min, Math.min(paramMeta.max, nextVal));
    const nextPts = points.map((p, idx) => (idx === index ? clamped : p));
    setPoints(nextPts);
    onCommitAutomation?.(trackId, measureNumber, selectedParam, nextPts, curveType);
  };

  const handleCurveChange = (nextCurve: AutomationCurveType) => {
    const norm = normalizeCurveType(nextCurve);
    setCurveType(norm);
    onCommitAutomation?.(trackId, measureNumber, selectedParam, points, norm);
  };

  const handleAddBreakpoint = () => {
    const lastVal = points[points.length - 1] ?? paramMeta.defaultValues[0];
    const nextPts = [...points, lastVal];
    setPoints(nextPts);
    onCommitAutomation?.(trackId, measureNumber, selectedParam, nextPts, curveType);
  };

  // Sample SVG polyline coordinates across the breakpoint segments
  const svgWidth = 420;
  const svgHeight = 56;
  const { polylinePoints, nodeCoords } = useMemo(() => {
    if (points.length === 0) return { polylinePoints: '', nodeCoords: [] };
    const span = Math.max(1e-6, paramMeta.max - paramMeta.min);
    const valToY = (v: number) => {
      const norm = Math.max(0, Math.min(1, (v - paramMeta.min) / span));
      return Math.round((1 - norm) * (svgHeight - 12) + 6);
    };

    const coords = points.map((v, idx) => ({
      x:
        points.length === 1
          ? svgWidth / 2
          : Math.round((idx / (points.length - 1)) * (svgWidth - 20) + 10),
      y: valToY(v),
      val: v,
    }));

    if (points.length === 1) {
      const y = valToY(points[0]);
      return {
        polylinePoints: `10,${y} ${svgWidth - 10},${y}`,
        nodeCoords: coords,
      };
    }

    const samples: string[] = [];
    const numSegs = points.length - 1;
    const stepsPerSeg = 16;
    for (let s = 0; s < numSegs; s++) {
      const v0 = points[s];
      const v1 = points[s + 1];
      const x0 = coords[s].x;
      const x1 = coords[s + 1].x;
      for (let k = 0; k <= stepsPerSeg; k++) {
        const t = k / stepsPerSeg;
        const interpVal = interpolateCurveValue(v0, v1, t, curveType);
        const x = (x0 + (x1 - x0) * t).toFixed(1);
        const y = valToY(interpVal).toFixed(1);
        samples.push(`${x},${y}`);
      }
    }

    return {
      polylinePoints: samples.join(' '),
      nodeCoords: coords,
    };
  }, [points, curveType, paramMeta]);

  return (
    <div
      data-testid={`automation-lane-editor-${trackId}`}
      className="w-full bg-slate-900/95 border-t border-slate-800 px-3 py-2 flex items-center justify-between gap-4 font-mono text-xs select-none"
    >
      {/* Left: Parameter & Curve Shape Selectors */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
          Z-Lane: {trackId}
        </span>

        <select
          aria-label={`Automation parameter for ${trackId}`}
          value={selectedParam}
          onChange={(e) => setSelectedParam(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200 outline-none cursor-pointer"
        >
          {AUTOMATION_PARAMS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <select
          aria-label={`Automation curve shape for ${trackId}`}
          value={curveType}
          onChange={(e) => handleCurveChange(e.target.value as AutomationCurveType)}
          className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-amber-300 outline-none cursor-pointer"
        >
          <option value="linear">Linear</option>
          <option value="s_curve">S-Curve (Bezier)</option>
          <option value="exp">Exponential</option>
          <option value="log">Logarithmic</option>
          <option value="step">Step Hold</option>
        </select>
      </div>

      {/* Center: Interactive SVG Bezier Curve Preview */}
      <div className="flex-1 flex items-center justify-center min-w-[220px] overflow-hidden">
        <svg
          width={svgWidth}
          height={svgHeight}
          className="bg-slate-950 border border-slate-800 rounded block max-w-full"
          aria-label={`Automation curve canvas for ${trackId}`}
        >
          <line
            x1={0}
            y1={svgHeight / 2}
            x2={svgWidth}
            y2={svgHeight / 2}
            stroke="#1E293B"
            strokeDasharray="3,3"
          />
          {polylinePoints && (
            <polyline
              fill="none"
              stroke="#06B6D4"
              strokeWidth={2}
              points={polylinePoints}
            />
          )}
          {nodeCoords.map((pt, idx) => (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill="#F8FAFC"
              stroke="#06B6D4"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>

      {/* Right: Breakpoint Node Spinbuttons & + Point Button */}
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
        {points.map((ptVal, idx) => (
          <div key={idx} className="flex items-center gap-0.5 bg-slate-950 border border-slate-800 rounded px-1 py-0.5">
            <span className="text-[9px] text-slate-500">P{idx + 1}:</span>
            <input
              type="number"
              aria-label={`${trackId} automation point ${idx + 1}`}
              step={paramMeta.step}
              min={paramMeta.min}
              max={paramMeta.max}
              value={ptVal}
              onChange={(e) => handlePointChange(idx, parseFloat(e.target.value) || 0)}
              className="w-14 bg-slate-900 border border-slate-700 rounded px-1 text-[10px] text-cyan-300 text-center"
            />
          </div>
        ))}

        <button
          type="button"
          aria-label={`Add automation breakpoint for ${trackId}`}
          onClick={handleAddBreakpoint}
          className="px-2 py-0.5 rounded bg-cyan-600/20 hover:bg-cyan-600/35 border border-cyan-500/50 text-cyan-300 text-[10px] font-semibold cursor-pointer"
        >
          + Point
        </button>
      </div>
    </div>
  );
}
