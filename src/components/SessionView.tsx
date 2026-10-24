import React, { useMemo } from 'react';
import { CompiledScore, ClipDefinition, TrackDefinition } from '../parser/DocumentParser';
import { AtomicEvent } from '../parser/ASTSerializer';
import { FollowActionEngine } from '../audio/FollowActionEngine';

export interface SessionViewProps {
  score: CompiledScore | null;
  activeClipsByTrack: Record<string, string>;
  selectedClipId?: string | null;
  quantizeLaunch?: string;
  onQuantizeLaunchChange?: (quantize: string) => void;
  onLaunchClip: (clip: ClipDefinition) => void;
  onStopTrackClip: (trackId: string) => void;
  onStopAllClips: () => void;
  onLaunchScene: (sceneIndex: number, clips: ClipDefinition[], sceneTempo?: number) => void;
  onSelectClip?: (clip: ClipDefinition) => void;
  onCreateClipInSlot?: (trackId: string, sceneIndex: number) => void;
  onTriggerFollowAction?: (clip: ClipDefinition, nextClip: ClipDefinition | null) => void;
}

interface NormalizedSceneRow {
  index: number;
  name: string;
  tempo?: number;
  time?: string;
  clipsByTrack: Record<string, ClipDefinition>;
}

const TRACK_ACCENTS = [
  '#3B82F6',
  '#A855F7',
  '#10B981',
  '#F59E0B',
  '#EC4899',
  '#06B6D4',
  '#8B5CF6',
  '#EAB308',
];

export default function SessionView({
  score,
  activeClipsByTrack,
  selectedClipId,
  quantizeLaunch = '1/1',
  onQuantizeLaunchChange,
  onLaunchClip,
  onStopTrackClip,
  onStopAllClips,
  onLaunchScene,
  onSelectClip,
  onCreateClipInSlot,
  onTriggerFollowAction,
}: SessionViewProps) {
  const tracks: TrackDefinition[] = useMemo(() => {
    const defs = score?.defs?.filter((d) => !d.isReturn) || [];
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

  // Build normalized scene rows: use explicit `scenes`/`clips` if present, or synthesize
  // virtual scene rows from `measure` numbers so every score is launchable in Session View.
  const sceneRows: NormalizedSceneRow[] = useMemo(() => {
    if (!score) return [];

    if (score.scenes && score.scenes.length > 0) {
      const clipsList = score.clips || [];
      return score.scenes.map((sc) => {
        const clipsByTrack: Record<string, ClipDefinition> = {};
        for (const clip of clipsList) {
          if (clip.sceneIndex === sc.index || sc.clipIds.includes(clip.id)) {
            clipsByTrack[clip.trackId] = clip;
          }
        }
        return {
          index: sc.index,
          name: sc.name || `Scene ${sc.index}`,
          tempo: sc.tempo,
          time: sc.time,
          clipsByTrack,
        };
      });
    }

    // Fallback: synthesize virtual Session scenes from measure numbers (up to 16 scenes)
    const measureNums = Array.from(
      new Set((score.events || []).map((e) => e.measureNumber || 1))
    ).sort((a, b) => a - b);

    const effectiveMeasures = measureNums.length > 0 ? measureNums.slice(0, 16) : [1];

    return effectiveMeasures.map((mNum, idx) => {
      const clipsByTrack: Record<string, ClipDefinition> = {};
      for (const track of tracks) {
        const trackEvents = (score.events || []).filter(
          (e) => (e.trackId || 'pno') === track.id && (e.measureNumber || 1) === mNum
        );
        if (trackEvents.length > 0) {
          const minWhole = Math.min(
            ...trackEvents.map((e) =>
              e.startTime ? e.startTime.numerator / e.startTime.denominator : 0
            )
          );
          const normalizedEvents: AtomicEvent[] = trackEvents.map((ev) => {
            const st = ev.startTime
              ? ev.startTime.numerator / ev.startTime.denominator
              : 0;
            const relWhole = Math.max(0, st - minWhole);
            return {
              ...ev,
              startTime: { numerator: Math.round(relWhole * 64), denominator: 64 },
            };
          });

          clipsByTrack[track.id] = {
            id: `virtual_m${mNum}_${track.id}`,
            name: `M${mNum} ${track.id}`,
            trackId: track.id,
            sceneIndex: idx + 1,
            bars: 1,
            loop: true,
            events: normalizedEvents,
          };
        }
      }
      return {
        index: idx + 1,
        name: `Measure ${mNum}`,
        clipsByTrack,
      };
    });
  }, [score, tracks]);

  return (
    <div
      data-testid="session-view-container"
      className="w-full h-full flex flex-col bg-slate-950 text-slate-200 font-mono text-xs overflow-hidden select-none"
    >
      {/* Session View Header & Quantize Launch Bar */}
      <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-200 uppercase tracking-wider text-[11px]">
            Session Clip Matrix ({sceneRows.length} Scenes × {tracks.length} Tracks)
          </span>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-1.5">
            <label htmlFor="session-quantize-select" className="text-[11px] text-slate-400">
              Launch Quantize:
            </label>
            <select
              id="session-quantize-select"
              aria-label="Launch Quantization"
              value={quantizeLaunch}
              onChange={(e) => onQuantizeLaunchChange?.(e.target.value)}
              className="bg-slate-950 border border-slate-700 text-emerald-400 text-[11px] rounded px-2 py-0.5 outline-none cursor-pointer"
            >
              <option value="none">None</option>
              <option value="1/8">1/8</option>
              <option value="1/4">1/4</option>
              <option value="1/2">1/2</option>
              <option value="1/1">1 Bar (1/1)</option>
              <option value="2/1">2 Bars</option>
              <option value="4/1">4 Bars</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          aria-label="Stop All Session Clips"
          onClick={onStopAllClips}
          className="px-3 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/50 text-rose-300 text-[11px] font-semibold transition-colors cursor-pointer"
        >
          ■ Stop All Clips
        </button>
      </div>

      {/* 2D Track-by-Scene Clip Matrix */}
      <div className="flex-1 overflow-auto p-3">
        <table className="w-full border-collapse table-fixed min-w-[640px]">
          <thead>
            <tr>
              {tracks.map((track, tIdx) => {
                const color = TRACK_ACCENTS[tIdx % TRACK_ACCENTS.length];
                return (
                  <th
                    key={track.id}
                    className="p-1.5 text-left bg-slate-900 border border-slate-800 align-top"
                  >
                    <div
                      className="h-1 w-full rounded-full mb-1.5"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-slate-100 truncate">{track.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400">
                        {track.id}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {track.style} • {track.patch}
                    </div>
                  </th>
                );
              })}

              {/* Master Scene Column Header */}
              <th className="w-44 p-1.5 text-left bg-slate-900/95 border border-slate-800 align-top">
                <div className="h-1 w-full rounded-full mb-1.5 bg-emerald-500" />
                <div className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                  Master Scenes
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">Row Launchers</div>
              </th>
            </tr>
          </thead>

          <tbody>
            {sceneRows.map((scene) => {
              const rowClips = Object.values(scene.clipsByTrack);
              return (
                <tr key={scene.index} data-testid={`session-scene-row-${scene.index}`}>
                  {tracks.map((track, tIdx) => {
                    const clip = scene.clipsByTrack[track.id];
                    const isActive = activeClipsByTrack[track.id] === clip?.id && Boolean(clip);
                    const isSelected = selectedClipId === clip?.id && Boolean(clip);
                    const accent = TRACK_ACCENTS[tIdx % TRACK_ACCENTS.length];

                    if (!clip) {
                      return (
                        <td
                          key={track.id}
                          className="p-1 bg-slate-950/60 border border-slate-800/80 h-14 align-middle"
                        >
                          <div className="w-full h-full flex items-center justify-between px-2 rounded bg-slate-900/30 hover:bg-slate-900/70 transition-colors">
                            <button
                              type="button"
                              aria-label={`Stop track ${track.id} in scene ${scene.index}`}
                              onClick={() => onStopTrackClip(track.id)}
                              className="text-slate-600 hover:text-slate-300 text-[11px] cursor-pointer"
                              title="Stop Clip on Track"
                            >
                              ■
                            </button>
                            {onCreateClipInSlot && (
                              <button
                                type="button"
                                aria-label={`Create clip on ${track.id} scene ${scene.index}`}
                                onClick={() => onCreateClipInSlot(track.id, scene.index)}
                                className="text-[10px] text-slate-500 hover:text-blue-400 font-semibold cursor-pointer"
                              >
                                + Clip
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={track.id}
                        className="p-1 bg-slate-950 border border-slate-800 h-14 align-middle"
                      >
                        <div
                          onClick={() => onSelectClip?.(clip)}
                          className={`w-full h-full rounded px-2 py-1.5 flex items-center justify-between gap-2 cursor-pointer transition-all border ${
                            isActive
                              ? 'bg-emerald-950/60 border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.25)]'
                              : isSelected
                                ? 'bg-slate-800 border-blue-400'
                                : 'bg-slate-900 hover:bg-slate-800/80 border-slate-700/80'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              type="button"
                              aria-label={`Launch clip ${clip.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onLaunchClip(clip);
                              }}
                              className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 cursor-pointer transition-colors ${
                                isActive
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 hover:bg-blue-600 text-white'
                              }`}
                              style={!isActive ? { borderLeft: `3px solid ${accent}` } : undefined}
                              title={`Launch Clip: ${clip.name}`}
                            >
                              ▶
                            </button>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-100 truncate text-[11px]">
                                {clip.name}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                <span>{clip.bars}b</span>
                                <span>•</span>
                                <span>{clip.events.length} ev</span>
                                {clip.followAction && (
                                  <button
                                    type="button"
                                    aria-label={`Trigger follow action for ${clip.id}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const trackClips = sceneRows
                                        .map((r) => r.clipsByTrack[track.id])
                                        .filter(Boolean) as ClipDefinition[];
                                      const res = FollowActionEngine.resolveNextClip(clip, trackClips);
                                      if (onTriggerFollowAction) {
                                        onTriggerFollowAction(clip, res.targetClip);
                                      } else if (res.targetClip) {
                                        onLaunchClip(res.targetClip);
                                      } else if (res.action === 'stop') {
                                        onStopTrackClip(track.id);
                                      }
                                    }}
                                    className="px-1 py-0.2 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 font-semibold cursor-pointer"
                                    title={`Follow Action (${clip.followAction.bars}b): ${clip.followAction.actionA} (${clip.followAction.chanceA}%) / ${clip.followAction.actionB} (${clip.followAction.chanceB}%)`}
                                  >
                                    → {clip.followAction.actionA} ({clip.followAction.chanceA}%)
                                  </button>
                                )}
                                {clip.events.some(
                                  (ev) => ev.physics?.chance !== undefined || ev.physics?.pickOne
                                ) && (
                                  <span
                                    className="px-1 rounded bg-purple-500/20 text-purple-300 text-[9px]"
                                    title="Contains Note Probability / Chance Groups"
                                  >
                                    🎲 %
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isActive && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">
                              Active
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}

                  {/* Master Scene Launch Cell */}
                  <td className="p-1 bg-slate-900/60 border border-slate-800 h-14 align-middle">
                    <div className="w-full h-full flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800">
                      <div className="min-w-0">
                        <div className="font-bold text-emerald-300 truncate text-[11px]">
                          {scene.index}. {scene.name}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {scene.tempo ? `${scene.tempo} BPM` : `${rowClips.length} Clips`}
                        </div>
                      </div>
                      <button
                        type="button"
                        aria-label={`Launch scene ${scene.index}`}
                        onClick={() => onLaunchScene(scene.index, rowClips, scene.tempo)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer shrink-0 shadow-sm"
                        title={`Launch Scene ${scene.index}: ${scene.name}`}
                      >
                        ▶ Scene
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Bottom Track Stop Row */}
            <tr>
              {tracks.map((track) => (
                <td key={track.id} className="p-1.5 bg-slate-900 border border-slate-800">
                  <button
                    type="button"
                    aria-label={`Stop track ${track.id}`}
                    onClick={() => onStopTrackClip(track.id)}
                    className="w-full py-1 rounded bg-slate-950 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-[10px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    ■ Stop {track.id}
                  </button>
                </td>
              ))}
              <td className="p-1.5 bg-slate-900 border border-slate-800 text-center">
                <span className="text-[10px] text-slate-500 uppercase">Track Stop Bar</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
