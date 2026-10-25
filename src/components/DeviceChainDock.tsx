import React, { useState, useEffect } from 'react';
import { CompiledScore, TrackDefinition } from '../parser/DocumentParser';
import { AbletonSynthSuite } from '../audio/synths/AbletonSynthSuite';

export interface DeviceChainDockProps {
  score: CompiledScore | null;
  selectedTrackId?: string | null;
  onSelectTrack?: (trackId: string) => void;
  onUpdateAST: (payload: any) => void;
}

const PATCH_CATALOG = [
  {
    group: 'Ableton Flagship Synths',
    options: [
      'wavetable',
      'operator',
      'meld',
      'drift',
      'analog',
      'collision',
      'tension',
      'electric',
      'granulator',
      'saw_lead',
      'warm_pad',
      'string_pad',
      '808_sub',
    ],
  },
  {
    group: 'Keyboards & Mallets',
    options: [
      'salamander_grand',
      'acoustic_grand_piano',
      'rhodes',
      'dx7',
      'harpsichord',
      'church_organ',
      'vibraphone',
      'marimba',
      'celesta',
    ],
  },
  {
    group: 'Orchestral Strings & Harp',
    options: [
      'violin',
      'viola',
      'cello',
      'contrabass',
      'string_ensemble_1',
      'chamber_strings',
      'pizzicato_strings',
      'orchestral_harp',
      'timpani',
    ],
  },
  {
    group: 'Winds, Brass & Choir',
    options: [
      'flute',
      'piccolo',
      'oboe',
      'english_horn',
      'clarinet',
      'bassoon',
      'french_horn',
      'trumpet',
      'trombone',
      'tuba',
      'brass_section',
      'choir_aahs',
      'voice_oohs',
    ],
  },
  { group: 'Drums & Percussion', options: ['tenuto_808_kit', 'taiko_drum'] },
];

const DEFAULT_MACRO_KEYS = [
  { key: 'cutoff', label: 'Filter Cutoff', defaultVal: 72 },
  { key: 'resonance', label: 'Resonance', defaultVal: 30 },
  { key: 'osc1_pos', label: 'Wave Pos 1', defaultVal: 50 },
  { key: 'unison', label: 'Unison Spread', defaultVal: 35 },
  { key: 'sub_level', label: 'Sub Gain', defaultVal: 40 },
  { key: 'attack', label: 'Env Attack', defaultVal: 20 },
  { key: 'decay', label: 'Env Decay', defaultVal: 55 },
  { key: 'env_to_pos', label: 'Env -> Morph', defaultVal: 45 },
];

const MACRO_PRESETS: Record<string, Record<string, number>> = {
  warm_analog: { cutoff: 58, resonance: 24, osc1_pos: 40, unison: 30 },
  bright_lead: { cutoff: 108, resonance: 45, osc1_pos: 82, unison: 65 },
  deep_sub: { cutoff: 34, resonance: 18, sub_level: 95, unison: 10 },
};

const FX_DEVICE_DEFAULTS: Record<string, Record<string, number | string>> = {
  eq_eight: { low_cut: 100, bell1_freq: 1200, bell1_db: 2.0, high_shelf_db: 1.5 },
  auto_filter: { cutoff: 2400, res: 0.4, drive: 3.0, mix: 1.0 },
  compressor: { threshold: -14, ratio: 4, attack: 10, release: 120 },
  glue_compressor: { threshold: -10, ratio: 4, makeup: 3, mix: 0.8 },
  multiband_dynamics: { amount: 0.5, low_gain: 2.0, high_gain: 2.5 },
  drum_buss: { drive: 0.35, crunch: 0.25, boom_amount: 0.45 },
  roar: { drive: 0.4, feedback: 0.2, mix: 0.85 },
  saturator: { drive: 6.0, mix: 0.8 },
  hybrid_reverb: { decay: 3.2, predelay: 18, mix: 0.45 },
  echo: { time: 0.375, feedback: 0.4, mix: 0.32 },
  reverb: { mix: 0.45, decay: 2.4 },
  delay: { mix: 0.3, time: 0.375 },
  chorus: { rate: 0.6, amount: 0.5, mix: 0.45 },
  auto_shift: { formant_shift: 0, vibrato: 0.15, mix: 1.0 },
  vocoder: { bands: 20, depth: 1.0, mix: 0.9 },
  spectral_resonator: { decay: 1.4, mix: 0.35 },
  utility: { width: 100, gain_db: 0 },
  limiter: { ceiling: -0.3, gain_db: 2.0 },
};

function renderDeviceDspCurvePath(fxType: string, params: Record<string, any>): string {
  const type = fxType.toLowerCase();
  if (type.includes('eq')) {
    const bellDb = Number(params.bell1_db ?? 2);
    const shelfDb = Number(params.high_shelf_db ?? 1.5);
    const midY = Math.max(6, Math.min(34, 20 - bellDb * 2));
    const endY = Math.max(6, Math.min(34, 20 - shelfDb * 2));
    return `M 4 34 Q 18 20, 40 20 Q 75 ${midY}, 110 20 L 156 ${endY}`;
  }
  if (type.includes('filter')) {
    const cut = Number(params.cutoff ?? 2400);
    const cutX = Math.max(25, Math.min(135, Math.round((Math.log10(Math.max(80, cut)) - 1.9) * 48)));
    return `M 4 14 L ${cutX - 12} 14 Q ${cutX} 6, ${cutX + 18} 35 L 156 35`;
  }
  if (type.includes('comp') || type.includes('limiter') || type.includes('dynamics')) {
    return `M 4 36 L 78 18 L 156 10`;
  }
  if (type.includes('roar') || type.includes('saturat') || type.includes('drum_buss')) {
    return `M 4 35 C 45 35, 55 6, 156 6`;
  }
  // Reverb / Echo / Delay exponential decay envelope
  return `M 4 34 L 14 6 Q 55 24, 156 35`;
}

export default function DeviceChainDock({
  score,
  selectedTrackId,
  onSelectTrack,
  onUpdateAST,
}: DeviceChainDockProps) {
  const tracks: TrackDefinition[] = score?.defs?.length
    ? score.defs
    : [
        {
          id: 'pno',
          name: 'Grand Piano',
          style: 'standard',
          patch: 'salamander_grand',
          volume: 100,
          pan: 0,
          fx: [],
          fxChain: [],
        },
      ];

  const [activeTrackId, setActiveTrackId] = useState<string>(
    selectedTrackId || tracks[0]?.id || 'pno'
  );

  useEffect(() => {
    if (selectedTrackId && tracks.some((t) => t.id === selectedTrackId)) {
      setActiveTrackId(selectedTrackId);
    } else if (!tracks.some((t) => t.id === activeTrackId)) {
      setActiveTrackId(tracks[0]?.id || 'pno');
    }
  }, [selectedTrackId, tracks, activeTrackId]);

  const activeTrack = tracks.find((t) => t.id === activeTrackId) || tracks[0];
  const engineSpec = AbletonSynthSuite.getEngineDisplaySpec(activeTrack.patch);

  const fxChainItems =
    activeTrack?.fxChain && activeTrack.fxChain.length > 0
      ? activeTrack.fxChain
      : (activeTrack?.fx || []).map((fxName) => ({
          type: fxName,
          params: FX_DEVICE_DEFAULTS[fxName] || { mix: 0.5 },
        }));

  // Compute ADSR SVG polyline from active track macros
  const attackX = 8 + Math.round(((activeTrack.macros?.attack ?? 20) / 127) * 38);
  const decayX = attackX + 12 + Math.round(((activeTrack.macros?.decay ?? 55) / 127) * 38);
  const sustainY = 10 + Math.round((1 - (activeTrack.macros?.sub_level ?? 70) / 127) * 20);
  const adsrPoints = `6,34 ${attackX},6 ${decayX},${sustainY} 125,${sustainY} 154,34`;

  return (
    <div
      data-testid="device-chain-dock"
      className="flex flex-row w-full h-full bg-slate-900 text-slate-200 font-mono text-xs overflow-hidden select-none"
    >
      {/* Left Rail: Track Selector for Device Chain Inspection */}
      <div className="w-48 bg-slate-950 border-r border-slate-800 p-2 flex flex-col gap-1 overflow-y-auto shrink-0">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5 px-1">
          Device Chain Track ({tracks.length})
        </div>
        {tracks.map((t) => {
          const isSelected = t.id === activeTrack.id;
          return (
            <button
              key={t.id}
              type="button"
              aria-label={`Select device chain for ${t.id}`}
              onClick={() => {
                setActiveTrackId(t.id);
                onSelectTrack?.(t.id);
              }}
              className={`w-full text-left px-2 py-1 rounded flex items-center justify-between gap-1 transition-colors cursor-pointer border ${
                isSelected
                  ? 'bg-indigo-600/25 border-indigo-500 text-white font-bold'
                  : 'bg-slate-900/70 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <span className="truncate text-[11px]">{t.name || t.id}</span>
              <span className="text-[9px] px-1 py-0.2 rounded bg-slate-950 text-slate-400 shrink-0">
                {t.id}
              </span>
            </button>
          );
        })}
      </div>

      {/* Horizontal Ableton Device Rack Stream */}
      <div className="flex-1 flex flex-row items-stretch gap-2.5 p-2.5 overflow-x-auto overflow-y-hidden">
        {/* Card 1: Instrument / Patch Engine Device + Live ADSR Envelope Display */}
        <div
          data-testid={`instrument-device-card-${activeTrack.id}`}
          className="w-64 bg-slate-950 border border-slate-800 rounded-md p-2.5 flex flex-col justify-between shrink-0 shadow-md"
        >
          <div>
            <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
                Instrument ({activeTrack.style})
              </span>
              <span className="text-[11px] font-bold text-amber-400">{activeTrack.id}</span>
            </div>

            <label
              htmlFor={`device-patch-select-${activeTrack.id}`}
              className="block text-[9px] text-slate-400 mb-0.5"
            >
              Active Synth / SoundFont Patch
            </label>
            <select
              id={`device-patch-select-${activeTrack.id}`}
              aria-label={`Patch for ${activeTrack.id}`}
              value={activeTrack.patch || 'salamander_grand'}
              onChange={(e) =>
                onUpdateAST({
                  trackId: activeTrack.id,
                  mutationType: 'PATCH_UPDATE',
                  patchName: e.target.value,
                })
              }
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 outline-none focus:border-blue-500 cursor-pointer mb-2"
            >
              {PATCH_CATALOG.map((grp) => (
                <optgroup key={grp.group} label={grp.group}>
                  {grp.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            <div
              data-testid={`synth-topology-spec-${activeTrack.id}`}
              className="bg-slate-900/90 border border-slate-800 rounded px-2 py-1 mb-1.5"
            >
              <div className="text-[9px] font-bold text-cyan-300 truncate">
                {engineSpec.engineLabel}
              </div>
              <div className="text-[8px] text-slate-400 truncate">
                {engineSpec.topologySummary}
              </div>
            </div>

            {/* Visual ADSR Envelope Display */}
            <div className="bg-slate-900/90 border border-slate-800 rounded p-1.5 mb-1.5">
              <div className="flex items-center justify-between text-[8px] text-slate-400 mb-0.5">
                <span>ADSR / Harmonic Contour</span>
                <span className="text-blue-400">{activeTrack.patch}</span>
              </div>
              <svg width={160} height={38} className="w-full h-9 block bg-slate-950 rounded">
                <polyline
                  fill="rgba(59,130,246,0.18)"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  points={adsrPoints}
                />
              </svg>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-800 text-[9px] text-slate-400">
            <div className="bg-slate-900 rounded px-1.5 py-1">
              <div className="text-slate-500">Group Bus</div>
              <div className="text-slate-200 font-semibold truncate">
                {activeTrack.groupId || 'Master'}
              </div>
            </div>
            <div className="bg-slate-900 rounded px-1.5 py-1">
              <div className="text-slate-500">Groove Pool</div>
              <div className="text-slate-200 font-semibold truncate">
                {activeTrack.groove || 'Straight'}
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: 8-Macro Rack Controls + Macro Variations (`macros=@{...}`) */}
        {!activeTrack.isReturn && (
          <div
            data-testid={`macro-rack-card-${activeTrack.id}`}
            className="w-76 bg-slate-950 border border-slate-800 rounded-md p-2.5 flex flex-col justify-between shrink-0 shadow-md"
          >
            <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-800">
              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                8-Macro Controls
              </span>
              <div className="flex items-center gap-1">
                {Object.entries(MACRO_PRESETS).map(([presetId, presetMap]) => (
                  <button
                    key={presetId}
                    type="button"
                    aria-label={`Apply macro preset ${presetId}`}
                    onClick={() => {
                      const firstKey = Object.keys(presetMap)[0];
                      onUpdateAST({
                        trackId: activeTrack.id,
                        mutationType: 'MACRO_UPDATE',
                        macroKey: firstKey,
                        macroValue: presetMap[firstKey],
                      });
                    }}
                    className="px-1.5 py-0.2 rounded bg-slate-900 hover:bg-purple-600/30 border border-slate-800 text-[8px] text-purple-300 cursor-pointer"
                  >
                    {presetId.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {DEFAULT_MACRO_KEYS.map((m) => {
                const currentVal = activeTrack.macros?.[m.key] ?? m.defaultVal;
                const fillPct = Math.max(0, Math.min(100, Math.round((currentVal / 127) * 100)));
                return (
                  <div
                    key={m.key}
                    className="bg-slate-900 border border-slate-800 rounded p-1 flex flex-col items-center"
                  >
                    <span
                      className="text-[8px] text-slate-400 truncate w-full text-center"
                      title={m.label}
                    >
                      {m.key}
                    </span>
                    <div className="w-full h-1 bg-slate-950 rounded overflow-hidden my-1">
                      <div
                        style={{ width: `${fillPct}%` }}
                        className="h-full bg-purple-500"
                      />
                    </div>
                    <input
                      type="number"
                      aria-label={`Macro ${m.key} for ${activeTrack.id}`}
                      min={0}
                      max={127}
                      value={currentVal}
                      onChange={(e) => {
                        const nextVal = Math.max(
                          0,
                          Math.min(127, parseInt(e.target.value, 10) || 0)
                        );
                        onUpdateAST({
                          trackId: activeTrack.id,
                          mutationType: 'MACRO_UPDATE',
                          macroKey: m.key,
                          macroValue: nextVal,
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.2 text-[9px] text-center text-purple-300 font-bold"
                    />
                  </div>
                );
              })}
            </div>

            <div className="pt-1 border-t border-slate-800 text-[9px] text-slate-500 flex items-center justify-between">
              <span>Target: {activeTrack.id}</span>
              <span>macros=@&#123;...&#125;</span>
            </div>
          </div>
        )}

        {/* Cards 3+: Mounted Audio FX Device Cards with Interactive DSP Curve SVG */}
        {fxChainItems.map((fxItem, idx) => {
          const defaultParams = FX_DEVICE_DEFAULTS[fxItem.type] || { mix: 0.5 };
          const mergedParams: Record<string, any> = {
            ...defaultParams,
            ...(fxItem.params || {}),
          };
          const curvePath = renderDeviceDspCurvePath(fxItem.type, mergedParams);

          return (
            <div
              key={`${fxItem.type}-${idx}`}
              data-testid={`fx-device-card-${fxItem.type}`}
              className="w-56 bg-slate-950 border border-cyan-500/40 rounded-md p-2.5 flex flex-col justify-between shrink-0 shadow-md"
            >
              <div>
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-800">
                  <span className="text-[10px] font-bold text-cyan-300 uppercase truncate">
                    FX {idx + 1}: {fxItem.type}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove FX ${fxItem.type} from ${activeTrack.id}`}
                    onClick={() =>
                      onUpdateAST({
                        trackId: activeTrack.id,
                        mutationType: 'REMOVE_FX',
                        fxType: fxItem.type,
                      })
                    }
                    className="text-slate-500 hover:text-rose-400 text-xs font-bold px-1 cursor-pointer"
                    title="Remove Device from Chain"
                  >
                    ✕
                  </button>
                </div>

                {/* Live DSP Transfer / Frequency Curve Preview */}
                <svg
                  width={160}
                  height={38}
                  className="w-full h-8 bg-slate-900 border border-slate-800 rounded mb-1.5 block"
                >
                  <path
                    d={curvePath}
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth={2}
                  />
                </svg>

                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(mergedParams)
                    .slice(0, 4)
                    .map(([paramKey, paramVal]) => (
                      <div
                        key={paramKey}
                        className="bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 flex flex-col"
                      >
                        <span className="text-[8px] text-slate-400 truncate">
                          {paramKey}
                        </span>
                        <input
                          type={typeof paramVal === 'number' ? 'number' : 'text'}
                          aria-label={`${activeTrack.id} ${fxItem.type} ${paramKey}`}
                          step={0.1}
                          value={paramVal}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const parsed =
                              typeof paramVal === 'number' ? parseFloat(raw) || 0 : raw;
                            const nextParams = { ...mergedParams, [paramKey]: parsed };
                            onUpdateAST({
                              trackId: activeTrack.id,
                              mutationType: 'UPDATE_FX_PARAM',
                              fxType: fxItem.type,
                              fxParams: nextParams,
                            });
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-1 py-0.2 text-[9px] text-center text-cyan-200"
                        />
                      </div>
                    ))}
                </div>
              </div>

              <div className="pt-1 border-t border-slate-800 text-[8px] text-slate-500 truncate">
                .fx({fxItem.type}, @&#123;...&#125;)
              </div>
            </div>
          );
        })}

        {/* Add Audio FX Device Card */}
        <div className="w-48 bg-slate-950/60 border border-dashed border-slate-700 rounded-md p-2.5 flex flex-col items-center justify-center gap-2 shrink-0">
          <span className="text-[10px] font-semibold text-slate-400 uppercase text-center">
            + Append Audio Effect
          </span>
          <select
            aria-label={`Add effect device to ${activeTrack.id}`}
            defaultValue=""
            onChange={(e) => {
              const fxType = e.target.value;
              if (fxType) {
                const defaultParams = FX_DEVICE_DEFAULTS[fxType] || { mix: 0.5 };
                onUpdateAST({
                  trackId: activeTrack.id,
                  mutationType: 'ADD_FX',
                  fxType,
                  fxParams: defaultParams,
                });
                e.target.value = '';
              }
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 outline-none cursor-pointer"
          >
            <option value="" disabled>
              Select Ableton FX...
            </option>
            {Object.keys(FX_DEVICE_DEFAULTS).map((fxKey) => (
              <option key={fxKey} value={fxKey}>
                {fxKey}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
