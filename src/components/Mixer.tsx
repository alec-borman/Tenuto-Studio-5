import React, { useState, useEffect } from 'react';

export interface MixerTrackState {
  id: string;
  name?: string;
  volume: number;
  pan?: number;
  panLeft?: number;
  panRight?: number;
  splitPan?: boolean;
  fx: string[];
  sends?: Record<string, number>;
  sendModes?: Record<string, 'pre' | 'post'>;
  muted?: boolean;
  soloed?: boolean;
  armed?: boolean;
  isReturn?: boolean;
  peakDb?: number;
  rmsDb?: number;
  peakNorm?: number;
  rmsNorm?: number;
  clipping?: boolean;
}

export interface MixerGroupState {
  id: string;
  name: string;
  trackIds: string[];
  volume: number;
  fx: string[];
  muted?: boolean;
  soloed?: boolean;
}

export interface ASTState {
  tracks: MixerTrackState[];
  groups?: MixerGroupState[];
  meta: {
    sidechain: string | null;
    sidechainTap?: 'pre_fx' | 'post_fx' | 'post_mixer' | string;
  };
}

interface MixerProps {
  astState: ASTState;
  onUpdateAST: (payload: any) => void;
  onToggleMute?: (trackId: string) => void;
  onToggleSolo?: (trackId: string) => void;
  onToggleArm?: (trackId: string) => void;
  onToggleGroupMute?: (groupId: string) => void;
  onToggleGroupSolo?: (groupId: string) => void;
}

const ABLETON_FX_OPTIONS = [
  { value: 'reverb', label: 'Reverb' },
  { value: 'delay', label: 'Delay' },
  { value: 'chorus', label: 'Chorus' },
  { value: 'eq_eight', label: 'EQ Eight' },
  { value: 'auto_filter', label: 'Auto Filter' },
  { value: 'compressor', label: 'Compressor' },
  { value: 'glue_compressor', label: 'Glue Compressor' },
  { value: 'multiband_dynamics', label: 'Multiband Dynamics (OTT)' },
  { value: 'drum_buss', label: 'Drum Buss' },
  { value: 'roar', label: 'Roar Saturator' },
  { value: 'saturator', label: 'Saturator' },
  { value: 'hybrid_reverb', label: 'Hybrid Reverb' },
  { value: 'echo', label: 'Echo' },
  { value: 'auto_shift', label: 'Auto Shift' },
  { value: 'vocoder', label: 'Vocoder' },
  { value: 'spectral_resonator', label: 'Spectral Resonator' },
  { value: 'utility', label: 'Utility' },
  { value: 'limiter', label: 'Limiter' },
];

export function midiVolumeToDbString(volMidi: number): string {
  if (volMidi <= 0) return '-∞ dB';
  const db = 20 * Math.log10(volMidi / 100);
  const rounded = Number(db.toFixed(1));
  return `${rounded > 0 ? '+' : ''}${rounded} dB`;
}

export default function Mixer({
  astState,
  onUpdateAST,
  onToggleMute,
  onToggleSolo,
  onToggleArm,
  onToggleGroupMute,
  onToggleGroupSolo,
}: MixerProps) {
  const [localVolumes, setLocalVolumes] = useState<Record<string, number>>({});
  const [localPans, setLocalPans] = useState<Record<string, number>>({});
  const [splitPanModeByTrack, setSplitPanModeByTrack] = useState<Record<string, boolean>>({});
  const [peakHoldByTrack, setPeakHoldByTrack] = useState<Record<string, number>>({});
  const [collapsedMixerGroups, setCollapsedMixerGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const updatedVolumes: Record<string, number> = {};
    const updatedPans: Record<string, number> = {};
    astState.tracks.forEach((t) => {
      updatedVolumes[t.id] = t.volume;
      updatedPans[t.id] = t.pan ?? 0;
    });
    setLocalVolumes(updatedVolumes);
    setLocalPans(updatedPans);
  }, [astState.tracks]);

  return (
    <div className="flex flex-col bg-slate-900 text-slate-200 border-t border-slate-800 p-4 shrink-0 shadow-lg z-10 w-full overflow-x-auto min-h-[280px] select-none">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Stateless Mixer
        </h2>
        <span className="text-[11px] font-mono text-slate-500">
          {astState.tracks.length} Channel Strips • Peak / RMS Metering
        </span>
      </div>

      <div className="flex flex-row gap-4 mb-2">
        {/* Global Routing Block */}
        <div className="flex flex-col bg-slate-950 p-3 rounded border border-slate-800 shrink-0 w-44">
          <h3 className="text-xs font-semibold mb-2 text-slate-400 uppercase">Routing Matrix</h3>
          <label htmlFor="global-sidechain" className="block text-xs mb-1 text-slate-500">
            Global Sidechain Trigger
          </label>
          <select
            id="global-sidechain"
            aria-label="808_Sub sidechain"
            value={astState.meta.sidechain || ''}
            onChange={(e) =>
              onUpdateAST({
                mutationType: 'META_SIDECHAIN_UPDATE',
                source: e.target.value,
                target: '808_Sub',
                expectedSyntax: `meta @{ sidechain: "${e.target.value}" }`,
              })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
          >
            <option value="">None</option>
            <option value="Drum_Bus">Drum_Bus</option>
            <option value="vox">vox</option>
            {astState.tracks
              .filter((t) => t.id !== 'vox' && t.id !== 'Drum_Bus')
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
          </select>

          <label htmlFor="sidechain-tap-select" className="block text-xs mt-2 mb-1 text-slate-500">
            Sidechain Tap Point
          </label>
          <select
            id="sidechain-tap-select"
            aria-label="Sidechain Tap Point"
            value={astState.meta.sidechainTap || 'post_fx'}
            onChange={(e) =>
              onUpdateAST({
                mutationType: 'META_SIDECHAIN_TAP_UPDATE',
                tapMode: e.target.value,
                expectedSyntax: `meta @{ sidechain_tap: "${e.target.value}" }`,
              })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 text-amber-300 font-mono"
          >
            <option value="pre_fx">Pre-FX</option>
            <option value="post_fx">Post-FX</option>
            <option value="post_mixer">Post-Mixer</option>
          </select>

          <button
            type="button"
            aria-label="Add Return Track"
            onClick={() => {
              const returnCount = astState.tracks.filter((t) => t.isReturn).length;
              const nextId =
                returnCount === 0 ? 'rev_bus' : returnCount === 1 ? 'dly_bus' : `ret_${returnCount + 1}`;
              const nextName =
                returnCount === 0
                  ? 'Hall Return'
                  : returnCount === 1
                    ? 'Delay Return'
                    : `Return ${returnCount + 1}`;
              onUpdateAST({
                mutationType: 'ADD_RETURN_TRACK',
                returnId: nextId,
                returnName: nextName,
                fxType: returnCount === 1 ? 'echo' : 'hybrid_reverb',
              });
            }}
            className="mt-3 w-full py-1 px-2 rounded bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/50 text-purple-300 text-[11px] font-mono font-semibold transition-colors cursor-pointer"
          >
            + Add Return Bus
          </button>
        </div>

        {/* Group Bus Channel Strips */}
        {(astState.groups || []).map((grp) => {
          const isFolded = Boolean(collapsedMixerGroups[grp.id]);
          return (
            <div
              key={grp.id}
              data-testid={`mixer-group-strip-${grp.id}`}
              className="flex flex-col justify-between bg-slate-950/95 p-2.5 rounded border-2 border-amber-500/40 w-36 shrink-0"
            >
              <div>
                <div className="w-full flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
                  <button
                    type="button"
                    aria-label={`Fold mixer group ${grp.id}`}
                    onClick={() =>
                      setCollapsedMixerGroups((prev) => ({ ...prev, [grp.id]: !prev[grp.id] }))
                    }
                    className="flex items-center gap-1 text-xs font-mono font-bold text-amber-300 truncate cursor-pointer"
                    title="Fold / Unfold Member Tracks in Mixer"
                  >
                    <span>{isFolded ? '▶' : '▼'}</span>
                    <span className="truncate">{grp.id}</span>
                  </button>
                  <span className="text-[9px] uppercase px-1 rounded bg-amber-500/20 text-amber-300">
                    GRP ({grp.trackIds.length})
                  </span>
                </div>

                <div className="text-[10px] font-mono text-slate-400 truncate mb-2">
                  {grp.name}
                </div>

                {/* Group FX List */}
                <div className="w-full flex flex-col gap-1 mb-2 max-h-16 overflow-y-auto">
                  {grp.fx.map((fx, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800 text-[10px] text-center py-0.5 px-1 rounded truncate border border-slate-700 text-amber-200 font-mono"
                    >
                      {fx}
                    </div>
                  ))}
                </div>
              </div>

              {/* Group Volume Spinbutton */}
              <div className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 my-2">
                <label
                  htmlFor={`grp-vol-${grp.id}`}
                  className="block text-[9px] font-mono text-slate-400 uppercase mb-1"
                >
                  Group Vol ({midiVolumeToDbString(grp.volume)})
                </label>
                <input
                  id={`grp-vol-${grp.id}`}
                  type="number"
                  aria-label={`${grp.id} group volume`}
                  min={0}
                  max={127}
                  value={grp.volume}
                  onChange={(e) => {
                    const nextVol = Math.max(0, Math.min(127, parseInt(e.target.value, 10) || 0));
                    onUpdateAST({
                      groupId: grp.id,
                      mutationType: 'GROUP_VOLUME_UPDATE',
                      value: nextVol,
                      expectedSyntax: `var ${grp.id}_vol = ${nextVol}`,
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-xs font-mono text-center text-amber-300"
                />
              </div>

              {/* Group Mute & Solo Buttons */}
              <div className="w-full grid grid-cols-2 gap-1 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  aria-label={`Mute mixer group ${grp.id}`}
                  onClick={() => onToggleGroupMute?.(grp.id)}
                  className={`py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                    grp.muted
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  M
                </button>
                <button
                  type="button"
                  aria-label={`Solo mixer group ${grp.id}`}
                  onClick={() => onToggleGroupSolo?.(grp.id)}
                  className={`py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                    grp.soloed
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                >
                  S
                </button>
              </div>
            </div>
          );
        })}

        {/* Channel Strips */}
        {astState.tracks.map((track) => {
          const parentGroup = (astState.groups || []).find((g) => g.trackIds.includes(track.id));
          if (parentGroup && collapsedMixerGroups[parentGroup.id]) {
            return null;
          }
          const currentVol =
            localVolumes[track.id] !== undefined ? localVolumes[track.id] : track.volume;
          const currentPan =
            localPans[track.id] !== undefined ? localPans[track.id] : (track.pan ?? 0);
          const isSplitPan = Boolean(splitPanModeByTrack[track.id] || track.splitPan);
          const peakNorm = track.peakNorm ?? Math.min(1, (currentVol / 127) * 0.72);
          const rmsNorm = track.rmsNorm ?? peakNorm * 0.78;
          const peakDb =
            track.peakDb ??
            (currentVol > 0 ? Number((20 * Math.log10(currentVol / 100)).toFixed(1)) : -60);
          const heldPeakDb =
            peakHoldByTrack[track.id] !== undefined
              ? Math.max(peakHoldByTrack[track.id], peakDb)
              : peakDb;

          return (
            <div
              key={track.id}
              data-testid={`mixer-strip-${track.id}`}
              className="flex flex-col items-center bg-slate-950 p-2.5 rounded border border-slate-800 w-36 shrink-0"
            >
              {/* Track Header */}
              <div className="w-full flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800">
                <span className="text-xs font-mono font-bold text-slate-200 truncate">
                  {track.id}
                </span>
                {track.isReturn && (
                  <span className="text-[9px] uppercase px-1 rounded bg-purple-500/20 text-purple-300">
                    RTN
                  </span>
                )}
              </div>

              {/* FX Rack */}
              <div className="w-full flex flex-col gap-1 mb-2 h-16 overflow-y-auto">
                {track.fx.map((fx, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800 text-[10px] text-center py-0.5 px-1 rounded truncate border border-slate-700 text-cyan-300 font-mono"
                  >
                    {fx}
                  </div>
                ))}
                <div className="relative group">
                  <button
                    type="button"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-[10px] text-center py-0.5 rounded border border-slate-700 border-dashed text-slate-400"
                    aria-label={`Add FX to ${track.id}`}
                    title="Click to mount effect"
                  >
                    [ + FX ]
                  </button>
                  <select
                    className="absolute opacity-0 group-hover:opacity-100 inset-0 w-full h-full cursor-pointer z-10"
                    aria-label={`FX for ${track.id}`}
                    onChange={(e) => {
                      if (e.target.value) {
                        onUpdateAST({
                          trackId: track.id,
                          mutationType: 'ADD_FX',
                          fxType: e.target.value,
                          expectedSyntax: `.fx(${e.target.value}, @{mix: 0.5})`,
                        });
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">Select...</option>
                    {ABLETON_FX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} aria-label={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stereo Pan / Split Stereo Pan Controls (Spinbuttons so Volume remains the sole role="slider") */}
              <div className="w-full bg-slate-900/90 border border-slate-800 rounded px-1.5 py-1 mb-2 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-slate-400 uppercase">
                    {isSplitPan ? 'Split L/R' : 'Pan'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Toggle split pan for ${track.id}`}
                    onClick={() =>
                      setSplitPanModeByTrack((prev) => ({ ...prev, [track.id]: !prev[track.id] }))
                    }
                    className="text-[9px] font-mono text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    {isSplitPan ? 'Stereo' : 'Split'}
                  </button>
                </div>

                {!isSplitPan ? (
                  <div className="flex items-center justify-between gap-1">
                    <input
                      type="number"
                      aria-label={`${track.id} pan`}
                      step={0.1}
                      min={-1}
                      max={1}
                      value={currentPan}
                      onChange={(e) => {
                        const nextPan = Math.max(
                          -1,
                          Math.min(1, parseFloat(e.target.value) || 0)
                        );
                        setLocalPans((prev) => ({ ...prev, [track.id]: nextPan }));
                        onUpdateAST({
                          trackId: track.id,
                          mutationType: 'PAN_UPDATE',
                          value: nextPan,
                          expectedSyntax: `pan=${nextPan}`,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-center text-amber-300"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      type="number"
                      aria-label={`${track.id} left pan`}
                      step={0.1}
                      min={-1}
                      max={1}
                      defaultValue={track.panLeft ?? -1}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[9px] font-mono text-center text-amber-300"
                    />
                    <input
                      type="number"
                      aria-label={`${track.id} right pan`}
                      step={0.1}
                      min={-1}
                      max={1}
                      defaultValue={track.panRight ?? 1}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[9px] font-mono text-center text-amber-300"
                    />
                  </div>
                )}
              </div>

              {/* Sends Matrix (Send A / Return Buses) */}
              {!track.isReturn && (
                <div className="w-full bg-slate-900/80 border border-slate-800 rounded px-1.5 py-1 mb-1.5 flex flex-col gap-1">
                  {(() => {
                    const returnIds = Array.from(
                      new Set([
                        ...astState.tracks.filter((t) => t.isReturn).map((t) => t.id),
                        ...Object.keys(track.sends || {}),
                        'rev_bus',
                      ])
                    ).slice(0, 2);

                    return returnIds.map((retId, sIdx) => {
                      const sendLetter = String.fromCharCode(65 + sIdx);
                      const sendVal = track.sends?.[retId] ?? 0;
                      const sendMode = track.sendModes?.[retId] || 'post';

                      return (
                        <div key={retId} className="flex items-center justify-between gap-1">
                          <span
                            className="text-[9px] font-mono text-purple-300 truncate max-w-[44px]"
                            title={`Send ${sendLetter} (${retId})`}
                          >
                            {sendLetter}:{retId}
                          </span>
                          <input
                            type="number"
                            aria-label={`${track.id} send ${retId}`}
                            step={0.05}
                            min={0}
                            max={1}
                            value={sendVal}
                            onChange={(e) => {
                              const nextLvl = Math.max(
                                0,
                                Math.min(1, parseFloat(e.target.value) || 0)
                              );
                              onUpdateAST({
                                trackId: track.id,
                                mutationType: 'SEND_UPDATE',
                                sendId: retId,
                                sendLevel: nextLvl,
                                sendMode,
                                expectedSyntax: `sends=@{${retId}: ${nextLvl}}`,
                              });
                            }}
                            className="w-12 bg-slate-950 border border-slate-700 rounded px-1 py-0.2 text-[9px] font-mono text-center text-purple-200"
                          />
                          <button
                            type="button"
                            aria-label={`Toggle send mode ${retId} for ${track.id}`}
                            onClick={() => {
                              const nextMode = sendMode === 'post' ? 'pre' : 'post';
                              onUpdateAST({
                                trackId: track.id,
                                mutationType: 'SEND_UPDATE',
                                sendId: retId,
                                sendLevel: sendVal,
                                sendMode: nextMode,
                              });
                            }}
                            className={`px-1 rounded text-[8px] font-mono uppercase cursor-pointer border ${
                              sendMode === 'pre'
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400'
                            }`}
                            title="Toggle Pre-Fader / Post-Fader Send"
                          >
                            {sendMode}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Fader + Dual Peak/RMS Meter Area */}
              <div className="w-full flex items-center justify-between px-1 my-1 h-28">
                {/* Volume Fader (Sole role="slider" on the channel strip) */}
                <div className="flex-1 flex items-center justify-center">
                  <label className="sr-only" htmlFor={`vol-${track.id}`}>
                    {track.id} volume
                  </label>
                  <input
                    id={`vol-${track.id}`}
                    type="range"
                    aria-label={`${track.id} volume`}
                    min="0"
                    max="127"
                    className="w-20 rotate-[270deg] accent-blue-500 cursor-pointer"
                    value={currentVol}
                    onChange={(e) => {
                      setLocalVolumes((prev) => ({
                        ...prev,
                        [track.id]: parseInt(e.target.value, 10),
                      }));
                    }}
                    onMouseUp={(e) => {
                      const finalVal =
                        localVolumes[track.id] !== undefined
                          ? localVolumes[track.id]
                          : parseInt((e.target as any).value, 10);
                      onUpdateAST({
                        trackId: track.id,
                        mutationType: 'VOLUME_UPDATE',
                        value: finalVal,
                        expectedSyntax: `var ${track.id}_vol = ${finalVal}`,
                      });
                    }}
                  />
                </div>

                {/* Vertical Peak & RMS Level Meter Bar */}
                <div
                  data-testid={`meter-${track.id}`}
                  onClick={() =>
                    setPeakHoldByTrack((prev) => ({ ...prev, [track.id]: -60 }))
                  }
                  className="w-5 h-24 bg-slate-900 border border-slate-800 rounded p-0.5 flex flex-row gap-0.5 items-end relative cursor-pointer"
                  title="Peak / RMS Level Meter (Click to reset Peak Hold)"
                >
                  {/* RMS Bar */}
                  <div
                    style={{ height: `${Math.round(rmsNorm * 100)}%` }}
                    className="flex-1 bg-emerald-500/80 rounded-xs transition-all"
                  />
                  {/* Peak Bar */}
                  <div
                    style={{ height: `${Math.round(peakNorm * 100)}%` }}
                    className={`flex-1 rounded-xs transition-all ${
                      track.clipping || peakDb > 0 ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                  />
                </div>
              </div>

              {/* Volume & Peak Hold dB Readout */}
              <div className="w-full flex items-center justify-between text-[10px] font-mono px-1 mb-1.5">
                <span className="text-slate-400">{currentVol}</span>
                <span
                  data-testid={`peak-db-${track.id}`}
                  className={heldPeakDb > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}
                >
                  {midiVolumeToDbString(currentVol)}
                </span>
              </div>

              {/* Channel Activator (Mute), Solo & Record Arm Buttons */}
              <div className="w-full grid grid-cols-3 gap-1 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  aria-label={`Mute mixer track ${track.id}`}
                  onClick={() => onToggleMute?.(track.id)}
                  className={`py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                    track.muted
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Track Mute"
                >
                  M
                </button>
                <button
                  type="button"
                  aria-label={`Solo mixer track ${track.id}`}
                  onClick={() => onToggleSolo?.(track.id)}
                  className={`py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                    track.soloed
                      ? 'bg-sky-500 text-slate-950 border-sky-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                  }`}
                  title="Track Solo"
                >
                  S
                </button>
                <button
                  type="button"
                  aria-label={`Arm mixer track ${track.id}`}
                  onClick={() => onToggleArm?.(track.id)}
                  className={`py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${
                    track.armed
                      ? 'bg-rose-600 text-white border-rose-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-rose-300'
                  }`}
                  title="Record Arm Track"
                >
                  ●
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
