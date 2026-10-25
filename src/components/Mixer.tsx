import React, { useState, useEffect, useRef } from 'react';

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
  onInspectTrackDevices?: (trackId: string) => void;
}

type MixerFilterMode = 'all' | 'groups' | 'tracks' | 'returns';

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
  onInspectTrackDevices,
}: MixerProps) {
  const [localVolumes, setLocalVolumes] = useState<Record<string, number>>({});
  const [localPans, setLocalPans] = useState<Record<string, number>>({});
  const [splitPanModeByTrack, setSplitPanModeByTrack] = useState<Record<string, boolean>>({});
  const [peakHoldByTrack, setPeakHoldByTrack] = useState<Record<string, number>>({});
  const [collapsedMixerGroups, setCollapsedMixerGroups] = useState<Record<string, boolean>>({});
  const [filterMode, setFilterMode] = useState<MixerFilterMode>('all');
  const stripsScrollRef = useRef<HTMLDivElement>(null);

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

  const groupList = astState.groups || [];
  const returnTracks = astState.tracks.filter((t) => t.isReturn);
  const regularTracks = astState.tracks.filter((t) => !t.isReturn);

  const visibleGroups =
    filterMode === 'all' || filterMode === 'groups' ? groupList : [];
  const visibleTracks = astState.tracks.filter((t) => {
    if (filterMode === 'groups') return false;
    if (filterMode === 'returns') return Boolean(t.isReturn);
    if (filterMode === 'tracks') return !t.isReturn;
    return true;
  });

  // Compute aggregate Master Peak & RMS from active tracks
  const masterPeakNorm = Math.min(
    1,
    astState.tracks.reduce((maxP, t) => Math.max(maxP, t.peakNorm ?? 0.55), 0.45)
  );
  const masterRmsNorm = masterPeakNorm * 0.78;

  return (
    <div className="flex flex-col bg-slate-900 text-slate-200 px-3 py-2 shrink-0 shadow-lg z-10 w-full h-full overflow-hidden select-none">
      {/* Compact Top Console Header: Title, Category Filters & Horizontal Scroll Controls */}
      <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Stateless Mixer
          </h2>

          {/* Strip Category Filter Pills */}
          <div
            role="group"
            aria-label="Mixer Channel Filter"
            className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-[10px] font-mono"
          >
            {(
              [
                { id: 'all', label: `All (${groupList.length + astState.tracks.length})` },
                { id: 'groups', label: `Groups (${groupList.length})` },
                { id: 'tracks', label: `Tracks (${regularTracks.length})` },
                { id: 'returns', label: `Returns (${returnTracks.length})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-label={`Filter mixer by ${f.id}`}
                onClick={() => setFilterMode(f.id)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  filterMode === f.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
            Click any FX badge to open in Devices Rack • Peak / RMS Metering
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Scroll Mixer Left"
              onClick={() =>
                stripsScrollRef.current?.scrollBy({ left: -280, behavior: 'smooth' })
              }
              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-[10px] font-mono cursor-pointer"
              title="Scroll Mixer Strips Left"
            >
              ◀
            </button>
            <button
              type="button"
              aria-label="Scroll Mixer Right"
              onClick={() =>
                stripsScrollRef.current?.scrollBy({ left: 280, behavior: 'smooth' })
              }
              className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-white text-[10px] font-mono cursor-pointer"
              title="Scroll Mixer Strips Right"
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      {/* Main Horizontal Console Strip Area (Fits 100% inside h-full with zero vertical clipping) */}
      <div
        ref={stripsScrollRef}
        className="flex-1 flex flex-row items-stretch gap-2.5 overflow-x-auto overflow-y-hidden pb-1 min-h-0"
      >
        {/* Global Routing & Sidechain Matrix Block */}
        <div className="flex flex-col justify-between bg-slate-950 p-2.5 rounded border border-slate-800 shrink-0 w-40">
          <div>
            <h3 className="text-[10px] font-bold mb-1.5 text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-1">
              Routing Matrix
            </h3>
            <label htmlFor="global-sidechain" className="block text-[10px] mb-0.5 text-slate-400">
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
              className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 font-mono"
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

            <label
              htmlFor="sidechain-tap-select"
              className="block text-[10px] mt-2 mb-0.5 text-slate-400"
            >
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
              className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 text-amber-300 font-mono"
            >
              <option value="pre_fx">Pre-FX</option>
              <option value="post_fx">Post-FX</option>
              <option value="post_mixer">Post-Mixer</option>
            </select>
          </div>

          <button
            type="button"
            aria-label="Add Return Track"
            onClick={() => {
              const returnCount = astState.tracks.filter((t) => t.isReturn).length;
              const nextId =
                returnCount === 0
                  ? 'rev_bus'
                  : returnCount === 1
                    ? 'dly_bus'
                    : `ret_${returnCount + 1}`;
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
            className="w-full py-1 px-2 rounded bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/50 text-purple-300 text-[10px] font-mono font-semibold transition-colors cursor-pointer"
          >
            + Add Return Bus
          </button>
        </div>

        {/* Group Bus Channel Strips */}
        {visibleGroups.map((grp) => {
          const isFolded = Boolean(collapsedMixerGroups[grp.id]);
          return (
            <div
              key={grp.id}
              data-testid={`mixer-group-strip-${grp.id}`}
              className="flex flex-col justify-between bg-slate-950/95 p-2 rounded border-2 border-amber-500/40 w-36 shrink-0"
            >
              <div>
                <div className="w-full flex items-center justify-between mb-1 pb-1 border-b border-slate-800">
                  <button
                    type="button"
                    aria-label={`Fold mixer group ${grp.id}`}
                    onClick={() =>
                      setCollapsedMixerGroups((prev) => ({ ...prev, [grp.id]: !prev[grp.id] }))
                    }
                    className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-300 truncate cursor-pointer"
                    title="Fold / Unfold Member Tracks in Mixer"
                  >
                    <span>{isFolded ? '▶' : '▼'}</span>
                    <span className="truncate">{grp.id}</span>
                  </button>
                  <span className="text-[8px] uppercase px-1 rounded bg-amber-500/20 text-amber-300 shrink-0">
                    GRP ({grp.trackIds.length})
                  </span>
                </div>

                <div className="text-[9px] font-mono text-slate-400 truncate mb-1">
                  {grp.name}
                </div>

                {/* Group FX List */}
                <div className="w-full flex flex-col gap-0.5 mb-1 max-h-11 overflow-y-auto">
                  {grp.fx.map((fx, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-800 text-[9px] text-center py-0.5 px-1 rounded truncate border border-slate-700 text-amber-200 font-mono"
                    >
                      {fx}
                    </div>
                  ))}
                </div>
              </div>

              {/* Group Volume Spinbutton */}
              <div className="w-full bg-slate-900 border border-slate-800 rounded p-1 my-1">
                <label
                  htmlFor={`grp-vol-${grp.id}`}
                  className="block text-[8px] font-mono text-slate-400 uppercase mb-0.5"
                >
                  Grp Vol ({midiVolumeToDbString(grp.volume)})
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
                  className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-center text-amber-300"
                />
              </div>

              {/* Group Mute & Solo Buttons (Always visible at bottom) */}
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

        {/* Track & Return Channel Strips */}
        {visibleTracks.map((track) => {
          const parentGroup = groupList.find((g) => g.trackIds.includes(track.id));
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
              className="flex flex-col justify-between bg-slate-950 p-2 rounded border border-slate-800 w-36 shrink-0"
            >
              {/* Top Section: Header, FX Slot, Pan & Sends */}
              <div className="w-full flex flex-col gap-1">
                {/* Track Header */}
                <div className="w-full flex items-center justify-between pb-0.5 border-b border-slate-800">
                  <button
                    type="button"
                    onClick={() => onInspectTrackDevices?.(track.id)}
                    className="text-[11px] font-mono font-bold text-slate-100 hover:text-blue-400 truncate cursor-pointer text-left"
                    title={`Open ${track.id} in Devices Rack`}
                  >
                    {track.id}
                  </button>
                  {track.isReturn ? (
                    <span className="text-[8px] uppercase px-1 rounded bg-purple-500/20 text-purple-300">
                      RTN
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Open devices for ${track.id}`}
                      onClick={() => onInspectTrackDevices?.(track.id)}
                      className="text-[8px] font-mono px-1 rounded bg-slate-900 hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 border border-slate-800 cursor-pointer"
                      title="Inspect Track Device Chain"
                    >
                      FX ↗
                    </button>
                  )}
                </div>

                {/* Compact FX Rack */}
                <div className="w-full flex flex-col gap-0.5 max-h-10 overflow-y-auto">
                  {track.fx.map((fx, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => onInspectTrackDevices?.(track.id)}
                      className="bg-slate-800 hover:bg-slate-700 text-[9px] text-center py-0.2 px-1 rounded truncate border border-slate-700 text-cyan-300 font-mono cursor-pointer"
                      title={`Click to edit ${fx} parameters in Devices Dock`}
                    >
                      {fx}
                    </button>
                  ))}
                  <div className="relative group">
                    <button
                      type="button"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-[9px] text-center py-0.2 rounded border border-slate-700 border-dashed text-slate-400"
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

                {/* Compact Stereo Pan / Split Stereo Pan */}
                <div className="w-full bg-slate-900/90 border border-slate-800 rounded px-1.5 py-0.5 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    aria-label={`Toggle split pan for ${track.id}`}
                    onClick={() =>
                      setSplitPanModeByTrack((prev) => ({ ...prev, [track.id]: !prev[track.id] }))
                    }
                    className="text-[8px] font-mono text-blue-400 hover:text-blue-300 uppercase cursor-pointer shrink-0"
                    title="Toggle Stereo / Split L-R Pan"
                  >
                    {isSplitPan ? 'L/R' : 'Pan'}
                  </button>

                  {!isSplitPan ? (
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
                      className="w-16 bg-slate-950 border border-slate-700 rounded px-1 py-0.2 text-[9px] font-mono text-center text-amber-300"
                    />
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <input
                        type="number"
                        aria-label={`${track.id} left pan`}
                        step={0.1}
                        min={-1}
                        max={1}
                        defaultValue={track.panLeft ?? -1}
                        className="w-10 bg-slate-950 border border-slate-700 rounded px-0.5 text-[8px] font-mono text-center text-amber-300"
                      />
                      <input
                        type="number"
                        aria-label={`${track.id} right pan`}
                        step={0.1}
                        min={-1}
                        max={1}
                        defaultValue={track.panRight ?? 1}
                        className="w-10 bg-slate-950 border border-slate-700 rounded px-0.5 text-[8px] font-mono text-center text-amber-300"
                      />
                    </div>
                  )}
                </div>

                {/* Compact Sends Matrix (Send A / B) */}
                {!track.isReturn && (
                  <div className="w-full bg-slate-900/80 border border-slate-800 rounded px-1 py-0.5 flex flex-col gap-0.5">
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
                          <div key={retId} className="flex items-center justify-between gap-0.5">
                            <span
                              className="text-[8px] font-mono text-purple-300 truncate max-w-[38px]"
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
                              className="w-11 bg-slate-950 border border-slate-700 rounded px-0.5 text-[8px] font-mono text-center text-purple-200"
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
                              className={`px-1 rounded text-[7px] font-mono uppercase cursor-pointer border ${
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
              </div>

              {/* Middle Section: Fader + Dual Peak/RMS Meter Area (Compact h-16 so bottom buttons never clip) */}
              <div className="w-full flex items-center justify-between px-1 my-0.5 h-16">
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
                    className="w-14 rotate-[270deg] accent-blue-500 cursor-pointer"
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
                  className="w-4 h-14 bg-slate-900 border border-slate-800 rounded p-0.5 flex flex-row gap-0.5 items-end relative cursor-pointer"
                  title="Peak / RMS Level Meter (Click to reset Peak Hold)"
                >
                  <div
                    style={{ height: `${Math.round(rmsNorm * 100)}%` }}
                    className="flex-1 bg-emerald-500/80 rounded-xs transition-all"
                  />
                  <div
                    style={{ height: `${Math.round(peakNorm * 100)}%` }}
                    className={`flex-1 rounded-xs transition-all ${
                      track.clipping || peakDb > 0 ? 'bg-rose-500' : 'bg-emerald-400'
                    }`}
                  />
                </div>
              </div>

              {/* Bottom Section: Volume/dB Readout + M / S / Arm Buttons */}
              <div className="w-full flex flex-col gap-1">
                <div className="w-full flex items-center justify-between text-[9px] font-mono px-0.5">
                  <span className="text-slate-400">V:{currentVol}</span>
                  <span
                    data-testid={`peak-db-${track.id}`}
                    className={heldPeakDb > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}
                  >
                    {midiVolumeToDbString(currentVol)}
                  </span>
                </div>

                <div className="w-full grid grid-cols-3 gap-1 pt-0.5 border-t border-slate-800">
                  <button
                    type="button"
                    aria-label={`Mute mixer track ${track.id}`}
                    onClick={() => onToggleMute?.(track.id)}
                    className={`py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer ${
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
                    className={`py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer ${
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
                    className={`py-0.5 rounded text-[9px] font-mono font-bold border cursor-pointer ${
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
            </div>
          );
        })}

        {/* Master Stereo Bus Strip (Uses spinbutton/readout so track faders remain the sole role="slider" elements) */}
        <div
          data-testid="mixer-master-strip"
          className="flex flex-col justify-between bg-slate-950 p-2 rounded border-2 border-emerald-500/40 w-32 shrink-0 ml-auto"
        >
          <div>
            <div className="w-full flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
              <span className="text-[11px] font-mono font-bold text-emerald-400">MASTER</span>
              <span className="text-[8px] uppercase px-1 rounded bg-emerald-500/20 text-emerald-300">
                BUS
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-400 mb-1">
              2.4s Hall + Limiter
            </div>
          </div>

          <div className="w-full flex items-center justify-center gap-2 my-1 h-20">
            <div className="w-6 h-18 bg-slate-900 border border-slate-800 rounded p-0.5 flex flex-row gap-0.5 items-end">
              <div
                style={{ height: `${Math.round(masterRmsNorm * 100)}%` }}
                className="flex-1 bg-emerald-500/80 rounded-xs"
              />
              <div
                style={{ height: `${Math.round(masterPeakNorm * 100)}%` }}
                className="flex-1 bg-emerald-400 rounded-xs"
              />
            </div>
          </div>

          <div className="w-full pt-1 border-t border-slate-800 text-center font-mono text-[9px] text-emerald-300">
            -0.9 dBFS Lim
          </div>
        </div>
      </div>
    </div>
  );
}
