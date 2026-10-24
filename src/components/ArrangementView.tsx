import React, { useMemo, useState } from 'react';
import { CompiledScore, TrackDefinition, LocatorDefinition, GroupDefinition } from '../parser/DocumentParser';
import { AtomicEvent } from '../parser/ASTSerializer';
import AutomationLaneEditor from './AutomationLaneEditor';
import { AutomationCurveType } from '../audio/AutomationEngine';

export interface ArrangementViewProps {
  score: CompiledScore | null;
  playheadBeat?: number;
  isPlaying?: boolean;
  mutedTracks?: string[];
  soloedTracks?: string[];
  loopStartMeasure?: number | null;
  loopEndMeasure?: number | null;
  onToggleTrackMute?: (trackId: string) => void;
  onToggleTrackSolo?: (trackId: string) => void;
  onSeekToMeasure?: (measureNumber: number) => void;
  onLoopRangeChange?: (startMeasure: number | null, endMeasure: number | null) => void;
  onAddLocator?: (name: string, measureNumber: number) => void;
  onOpenTrackInPianoRoll?: (trackId: string) => void;
  onCommitAutomation?: (
    trackId: string,
    measureNumber: number,
    param: string,
    values: number[],
    curve: AutomationCurveType
  ) => void;
}

const TRACK_COLORS = [
  '#3B82F6',
  '#A855F7',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
  '#EAB308',
];

export default function ArrangementView({
  score,
  playheadBeat = 0,
  isPlaying = false,
  mutedTracks = [],
  soloedTracks = [],
  loopStartMeasure = null,
  loopEndMeasure = null,
  onToggleTrackMute,
  onToggleTrackSolo,
  onSeekToMeasure,
  onLoopRangeChange,
  onAddLocator,
  onOpenTrackInPianoRoll,
  onCommitAutomation,
}: ArrangementViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [collapsedTracks, setCollapsedTracks] = useState<Record<string, boolean>>({});
  const [expandedAutomationTracks, setExpandedAutomationTracks] = useState<Record<string, boolean>>({});
  const [newLocatorMeasure, setNewLocatorMeasure] = useState<number>(1);

  const tracks: TrackDefinition[] = useMemo(() => {
    const defs = score?.defs || [];
    if (defs.length > 0) return defs;
    return [
      {
        id: 'pno',
        name: 'PNO',
        style: 'standard',
        patch: 'salamander_grand',
        volume: 100,
        pan: 0,
        fx: [],
      },
    ];
  }, [score]);

  const groups: GroupDefinition[] = useMemo(() => score?.groups || [], [score]);
  const locators: LocatorDefinition[] = useMemo(() => score?.locators || [], [score]);

  const totalMeasures = useMemo(() => {
    let maxM = 4;
    for (const ev of score?.events || []) {
      const m = ev.measureNumber || 1;
      if (m > maxM) maxM = m;
      const st = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const dur = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      const endM = Math.ceil(st + dur);
      if (endM > maxM) maxM = endM;
    }
    return Math.max(4, maxM);
  }, [score]);

  const eventsByTrackAndMeasure = useMemo(() => {
    const map = new Map<string, Map<number, AtomicEvent[]>>();
    for (const ev of score?.events || []) {
      if (ev.pitch?.isRest || ev.pitch?.isSpacer) continue;
      const tId = ev.trackId || 'pno';
      const stWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const mNum = ev.measureNumber || Math.floor(stWhole) + 1;
      let tMap = map.get(tId);
      if (!tMap) {
        tMap = new Map<number, AtomicEvent[]>();
        map.set(tId, tMap);
      }
      let arr = tMap.get(mNum);
      if (!arr) {
        arr = [];
        tMap.set(mNum, arr);
      }
      arr.push(ev);
    }
    return map;
  }, [score]);

  const measureWidthPx = 128;
  const headerWidthPx = 220;
  const playheadLeftPx = headerWidthPx + (playheadBeat / 4) * measureWidthPx;

  const toggleGroupFold = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleTrackFold = (trackId: string) => {
    setCollapsedTracks((prev) => ({ ...prev, [trackId]: !prev[trackId] }));
  };

  return (
    <div
      data-testid="arrangement-view-container"
      className="w-full h-full flex flex-col bg-slate-950 text-slate-200 font-mono text-xs overflow-hidden select-none"
    >
      {/* Top Arrangement Toolbar: Loop Brace, Locators & Tempo Map Info */}
      <div className="px-4 py-2 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
            Arrangement Timeline ({tracks.length} Tracks • {totalMeasures} Measures)
          </span>

          {/* Arrangement Loop Brace Controls */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[11px]">
            <span className="text-indigo-400 font-semibold">Loop Brace:</span>
            <label htmlFor="loop-start-input" className="sr-only">
              Loop Start Measure
            </label>
            <input
              id="loop-start-input"
              aria-label="Loop Start Measure"
              type="number"
              min={1}
              max={totalMeasures}
              value={loopStartMeasure ?? 1}
              onChange={(e) => {
                const start = Math.max(1, parseInt(e.target.value, 10) || 1);
                const end = Math.max(start, loopEndMeasure ?? totalMeasures);
                onLoopRangeChange?.(start, end);
              }}
              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-slate-200"
            />
            <span className="text-slate-500">to</span>
            <label htmlFor="loop-end-input" className="sr-only">
              Loop End Measure
            </label>
            <input
              id="loop-end-input"
              aria-label="Loop End Measure"
              type="number"
              min={1}
              max={totalMeasures}
              value={loopEndMeasure ?? totalMeasures}
              onChange={(e) => {
                const end = Math.max(1, parseInt(e.target.value, 10) || totalMeasures);
                const start = Math.min(end, loopStartMeasure ?? 1);
                onLoopRangeChange?.(start, end);
              }}
              className="w-12 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-center text-slate-200"
            />
            {loopStartMeasure !== null && loopEndMeasure !== null && (
              <button
                type="button"
                aria-label="Clear Loop Brace"
                onClick={() => onLoopRangeChange?.(null, null)}
                className="text-slate-400 hover:text-rose-400 px-1 cursor-pointer"
                title="Clear Loop Brace"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Locators Bar & + Add Locator */}
        <div className="flex items-center gap-2 flex-wrap">
          {locators.map((loc) => (
            <button
              key={loc.id}
              type="button"
              aria-label={`Jump to locator ${loc.name}`}
              onClick={() => onSeekToMeasure?.(loc.measureNumber)}
              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-300 text-[10px] font-semibold transition-colors cursor-pointer"
              title={`Seek to ${loc.name} (Measure ${loc.measureNumber})`}
            >
              ⚑ {loc.name} (M{loc.measureNumber})
            </button>
          ))}

          {onAddLocator && (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5">
              <span className="text-[10px] text-slate-500">@M</span>
              <input
                aria-label="New Locator Measure"
                type="number"
                min={1}
                max={totalMeasures + 8}
                value={newLocatorMeasure}
                onChange={(e) => setNewLocatorMeasure(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-10 bg-slate-900 border border-slate-700 rounded px-1 text-[10px] text-slate-200"
              />
              <button
                type="button"
                aria-label="Add Arrangement Locator"
                onClick={() => onAddLocator(`Section M${newLocatorMeasure}`, newLocatorMeasure)}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold px-1 cursor-pointer"
              >
                + Locator
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Scrollable Multi-Track Timeline */}
      <div className="flex-1 overflow-auto relative">
        <div
          className="relative min-w-full"
          style={{ width: `${headerWidthPx + totalMeasures * measureWidthPx + 40}px` }}
        >
          {/* Measure Ruler Row */}
          <div className="flex sticky top-0 z-10 bg-slate-900 border-b border-slate-800 h-8 items-center">
            <div
              className="shrink-0 px-3 font-semibold text-slate-400 text-[10px] uppercase tracking-wider border-r border-slate-800 h-full flex items-center justify-between"
              style={{ width: `${headerWidthPx}px` }}
            >
              <span>Tracks / Groups</span>
              <span>M / S</span>
            </div>

            <div className="flex relative h-full items-center">
              {Array.from({ length: totalMeasures }).map((_, idx) => {
                const mNum = idx + 1;
                const isInsideLoop =
                  loopStartMeasure !== null &&
                  loopEndMeasure !== null &&
                  mNum >= loopStartMeasure &&
                  mNum <= loopEndMeasure;
                const locAtMeasure = locators.find((l) => l.measureNumber === mNum);

                return (
                  <button
                    key={mNum}
                    type="button"
                    aria-label={`Seek to Measure ${mNum}`}
                    onClick={() => onSeekToMeasure?.(mNum)}
                    style={{ width: `${measureWidthPx}px` }}
                    className={`h-full border-r border-slate-800 px-2 flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isInsideLoop
                        ? 'bg-indigo-950/60 border-t-2 border-t-indigo-400 text-indigo-200'
                        : 'hover:bg-slate-800/60 text-slate-400'
                    }`}
                    title={`Click to seek to Measure ${mNum}`}
                  >
                    <span className="font-bold text-[10px]">M{mNum}</span>
                    {locAtMeasure && (
                      <span className="text-[9px] text-amber-400 truncate max-w-[76px]">
                        ⚑ {locAtMeasure.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Group Header Rows (if any groups exist) */}
          {groups.map((grp) => {
            const isCollapsed = Boolean(collapsedGroups[grp.id]);
            return (
              <div
                key={grp.id}
                data-testid={`arrangement-group-row-${grp.id}`}
                className="flex border-b border-slate-800 bg-slate-900/75 h-9 items-center"
              >
                <div
                  className="shrink-0 px-3 border-r border-slate-800 h-full flex items-center justify-between"
                  style={{ width: `${headerWidthPx}px` }}
                >
                  <button
                    type="button"
                    aria-label={`Toggle group ${grp.id}`}
                    onClick={() => toggleGroupFold(grp.id)}
                    className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px] cursor-pointer truncate"
                  >
                    <span>{isCollapsed ? '▶' : '▼'}</span>
                    <span className="truncate">{grp.name}</span>
                    <span className="text-[9px] text-slate-500">({grp.trackIds.length})</span>
                  </button>
                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                    Group
                  </span>
                </div>

                <div className="flex h-full items-center px-3 text-[10px] text-slate-400">
                  Group Bus: {grp.trackIds.join(', ')}{' '}
                  {grp.fx.length > 0 ? `• FX: ${grp.fx.join(' → ')}` : ''}
                </div>
              </div>
            );
          })}

          {/* Stacked Track Lanes */}
          {tracks.map((track, tIdx) => {
            if (track.groupId && collapsedGroups[track.groupId]) {
              return null;
            }

            const isMuted = mutedTracks.includes(track.id);
            const isSoloed = soloedTracks.includes(track.id);
            const isFolded = Boolean(collapsedTracks[track.id]);
            const rowHeightClass = isFolded ? 'h-9' : 'h-20';
            const color = TRACK_COLORS[tIdx % TRACK_COLORS.length];
            const trackMeasureMap = eventsByTrackAndMeasure.get(track.id);

            return (
              <React.Fragment key={track.id}>
              <div
                data-testid={`arrangement-track-lane-${track.id}`}
                className={`flex border-b border-slate-800/90 ${rowHeightClass} transition-all ${
                  isMuted ? 'opacity-50 bg-slate-950' : 'bg-slate-950/90'
                }`}
              >
                {/* Left Track Header */}
                <div
                  className="shrink-0 px-3 py-1.5 bg-slate-900 border-r border-slate-800 flex flex-col justify-between"
                  style={{ width: `${headerWidthPx}px`, borderLeft: `3px solid ${color}` }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        type="button"
                        aria-label={`Fold track ${track.id}`}
                        onClick={() => toggleTrackFold(track.id)}
                        className="text-slate-400 hover:text-white text-[10px] cursor-pointer"
                      >
                        {isFolded ? '▶' : '▼'}
                      </button>
                      <span
                        onClick={() => onOpenTrackInPianoRoll?.(track.id)}
                        className="font-bold text-slate-100 truncate cursor-pointer hover:text-blue-400"
                        title="Click to open track in Piano Roll"
                      >
                        {track.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Mute track ${track.id}`}
                        onClick={() => onToggleTrackMute?.(track.id)}
                        className={`w-5 h-5 rounded text-[10px] font-bold cursor-pointer border ${
                          isMuted
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title={`Mute ${track.name}`}
                      >
                        M
                      </button>
                      <button
                        type="button"
                        aria-label={`Solo track ${track.id}`}
                        onClick={() => onToggleTrackSolo?.(track.id)}
                        className={`w-5 h-5 rounded text-[10px] font-bold cursor-pointer border ${
                          isSoloed
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                        }`}
                        title={`Solo ${track.name}`}
                      >
                        S
                      </button>
                      <button
                        type="button"
                        aria-label={`Toggle automation lane for ${track.id}`}
                        onClick={() =>
                          setExpandedAutomationTracks((prev) => ({
                            ...prev,
                            [track.id]: !prev[track.id],
                          }))
                        }
                        className={`w-5 h-5 rounded text-[10px] font-bold cursor-pointer border ${
                          expandedAutomationTracks[track.id]
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                            : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-cyan-300'
                        }`}
                        title="Unfold Z-Axis Automation Lane"
                      >
                        A
                      </button>
                    </div>
                  </div>

                  {!isFolded && (
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="truncate">
                        {track.isReturn ? 'Return Bus' : `${track.style} • ${track.patch}`}
                      </span>
                      <span className="text-slate-500 shrink-0">
                        V:{track.volume} P:{track.pan}
                      </span>
                    </div>
                  )}
                </div>

                {/* Horizontal Measure Cells with Mini Note Previews */}
                <div className="flex relative h-full">
                  {Array.from({ length: totalMeasures }).map((_, mIdx) => {
                    const mNum = mIdx + 1;
                    const cellEvents = trackMeasureMap?.get(mNum) || [];

                    return (
                      <div
                        key={mNum}
                        style={{ width: `${measureWidthPx}px` }}
                        onClick={() => {
                          if (cellEvents.length > 0 && onOpenTrackInPianoRoll) {
                            onOpenTrackInPianoRoll(track.id);
                          }
                        }}
                        className="h-full border-r border-slate-800/70 p-1 relative flex flex-col justify-between"
                      >
                        {cellEvents.length > 0 && (
                          <div
                            className="w-full h-full rounded border px-1.5 py-1 flex flex-col justify-between cursor-pointer hover:brightness-110 transition-all overflow-hidden"
                            style={{
                              backgroundColor: `${color}22`,
                              borderColor: `${color}88`,
                            }}
                          >
                            <div className="flex items-center justify-between text-[9px] text-slate-200 font-semibold truncate">
                              <span>
                                {track.id} M{mNum}
                              </span>
                              <span className="text-slate-400">{cellEvents.length}n</span>
                            </div>

                            {!isFolded && (
                              <div className="relative w-full h-8 bg-slate-950/60 rounded overflow-hidden">
                                {cellEvents.slice(0, 24).map((ev, eIdx) => {
                                  const st = ev.startTime
                                    ? ev.startTime.numerator / ev.startTime.denominator
                                    : 0;
                                  const relBeat = Math.max(0, Math.min(0.95, st - (mNum - 1)));
                                  const dur = ev.duration
                                    ? ev.duration.numerator / ev.duration.denominator
                                    : 0.25;
                                  const widthPct = Math.max(6, Math.min(100, dur * 100));
                                  const midi = ev.pitch?.midi || 60;
                                  const bottomPct = Math.max(
                                    10,
                                    Math.min(85, ((midi - 36) / 60) * 100)
                                  );

                                  return (
                                    <div
                                      key={eIdx}
                                      style={{
                                        left: `${relBeat * 100}%`,
                                        width: `${widthPct}%`,
                                        bottom: `${bottomPct}%`,
                                        backgroundColor: color,
                                      }}
                                      className="absolute h-1 rounded-full"
                                    />
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {expandedAutomationTracks[track.id] && (
                <AutomationLaneEditor
                  trackId={track.id}
                  measureNumber={1}
                  lanes={score?.automationLanes || []}
                  onCommitAutomation={onCommitAutomation}
                />
              )}
              </React.Fragment>
            );
          })}

          {/* Synchronized Vertical Playhead Line */}
          {(isPlaying || playheadBeat > 0) && (
            <div
              data-testid="arrangement-playhead"
              style={{ left: `${playheadLeftPx}px` }}
              className="absolute top-0 bottom-0 w-0.5 bg-emerald-400 pointer-events-none z-20 shadow-[0_0_8px_#10b981]"
            />
          )}
        </div>
      </div>
    </div>
  );
}
