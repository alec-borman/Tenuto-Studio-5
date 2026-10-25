import React, { useState } from 'react';
import { CompiledScore } from '../parser/DocumentParser';

export interface SelectionData {
  type: string;
  duration: string;
  velocity: number;
  line: number;
  col: number;
  rawToken?: string;
  trackId?: string;
  articulation?: string;
  chance?: number;
  pan?: number;
  lyric?: string;
  swell?: 'crescendo' | 'diminuendo' | '';
  ornament?: string;
  pullMs?: number;
  transposeSemitones?: number;
  sourceStartOffset?: number;
  sourceEndOffset?: number;
}

interface InspectorProps {
  selection?: SelectionData | null;
  onUpdate?: (updates: Partial<SelectionData>) => void;
  score?: CompiledScore | null;
  onSelectEventFromInspector?: (eventSelection: SelectionData) => void;
  onUpdateScoreMeta?: (metaKey: string, metaValue: string | number | boolean) => void;
}

export default function Inspector({
  selection,
  onUpdate,
  score,
  onSelectEventFromInspector,
  onUpdateScoreMeta,
}: InspectorProps) {
  const [filterTrackId, setFilterTrackId] = useState<string>('');
  const [eventCursorIdx, setEventCursorIdx] = useState<number>(0);

  const allEvents = score?.events || [];
  const filteredEvents = filterTrackId
    ? allEvents.filter((e) => (e.trackId || 'pno') === filterTrackId)
    : allEvents;

  const selectEventAt = (idx: number) => {
    if (filteredEvents.length === 0 || !onSelectEventFromInspector) return;
    const clampedIdx = ((idx % filteredEvents.length) + filteredEvents.length) % filteredEvents.length;
    setEventCursorIdx(clampedIdx);
    const ev = filteredEvents[clampedIdx];
    const orn = ev.physics?.trill
      ? 'trill'
      : ev.physics?.vibrato
        ? 'vib'
        : ev.physics?.mordent
          ? 'mordent'
          : ev.physics?.arp
            ? 'arp'
            : ev.physics?.pedal
              ? 'ped'
              : ev.physics?.fermata
                ? 'fermata'
                : '';

    onSelectEventFromInspector({
      type: 'PitchLit',
      duration: `${ev.duration?.numerator || 1}/${ev.duration?.denominator || 4}`,
      velocity: ev.physics?.velocity ?? 80,
      articulation: ev.physics?.articulation || '',
      chance: ev.physics?.chance ?? 100,
      pan: ev.physics?.pan ?? 0,
      lyric: ev.physics?.lyric || '',
      swell: ev.physics?.swell || '',
      ornament: orn,
      pullMs: ev.physics?.pullMs ?? (ev.physics?.pushMs ? -ev.physics.pushMs : 0),
      line: ev.line ?? 1,
      col: ev.col ?? 1,
      rawToken: ev.rawToken,
      trackId: ev.trackId,
      sourceStartOffset: ev.sourceStartOffset,
      sourceEndOffset: ev.sourceEndOffset,
    });
  };

  if (!selection) {
    return (
      <div
        data-testid="inspector-empty-state"
        className="flex flex-col justify-between w-full h-full bg-slate-900 text-slate-200 font-mono text-xs p-3 overflow-y-auto select-none"
      >
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Studio Score & Note Inspector
            </h2>
            <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              {allEvents.length} Compiled Notes Available
            </span>
          </div>

          {filteredEvents.length > 0 && onSelectEventFromInspector && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Inspector Track Filter"
                value={filterTrackId}
                onChange={(e) => {
                  setFilterTrackId(e.target.value);
                  setEventCursorIdx(0);
                }}
                className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-[11px] text-amber-300 outline-none cursor-pointer"
              >
                <option value="">All Tracks ({score?.defs?.length || 1})</option>
                {(score?.defs || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id} ({d.name})
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label="Inspect First Note"
                onClick={() => selectEventAt(0)}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] cursor-pointer shadow-xs"
              >
                Inspect Note #1 →
              </button>
            </div>
          )}
        </div>

        {/* Global Score & Microtonal Tuning Settings Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-auto">
          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
            <label htmlFor="insp-tempo-input" className="block text-[10px] text-slate-400 mb-1">
              Project Tempo (BPM)
            </label>
            <input
              id="insp-tempo-input"
              type="number"
              aria-label="Inspector Tempo BPM"
              min={20}
              max={300}
              value={score?.meta?.tempo ?? 120}
              onChange={(e) =>
                onUpdateScoreMeta?.('tempo', Math.max(20, parseInt(e.target.value, 10) || 120))
              }
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
            <label htmlFor="insp-time-select" className="block text-[10px] text-slate-400 mb-1">
              Time Signature
            </label>
            <select
              id="insp-time-select"
              aria-label="Inspector Time Signature"
              value={score?.meta?.time || '4/4'}
              onChange={(e) => onUpdateScoreMeta?.('time', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200"
            >
              <option value="4/4">4/4</option>
              <option value="3/4">3/4</option>
              <option value="6/8">6/8</option>
              <option value="5/4">5/4</option>
              <option value="7/8">7/8</option>
            </select>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
            <label htmlFor="insp-tuning-select" className="block text-[10px] text-slate-400 mb-1">
              Microtonal Tuning (.scl)
            </label>
            <select
              id="insp-tuning-select"
              aria-label="Inspector Tuning System"
              value={score?.meta?.tuning || '12tet'}
              onChange={(e) => onUpdateScoreMeta?.('tuning', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300"
            >
              <option value="12tet">12-TET Standard</option>
              <option value="just_intonation">5-Limit Just Intonation</option>
              <option value="pythagorean">Pythagorean</option>
              <option value="meantone">Quarter-Comma Meantone</option>
              <option value="19tet">19-TET Microtonal</option>
              <option value="24tet">24-TET Quarter-Tone</option>
              <option value="31tet">31-TET Huygens</option>
              <option value="bohlen_pierce">Bohlen-Pierce (Tritave)</option>
              <option value="slendro">Gamelan Slendro</option>
              <option value="pelog">Gamelan Pelog</option>
            </select>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded p-2.5">
            <label htmlFor="insp-quant-select" className="block text-[10px] text-slate-400 mb-1">
              Session Launch Quantize
            </label>
            <select
              id="insp-quant-select"
              aria-label="Inspector Launch Quantize"
              value={score?.meta?.quantizeLaunch || '1/1'}
              onChange={(e) => onUpdateScoreMeta?.('quantize_launch', e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300"
            >
              <option value="none">None</option>
              <option value="1/8">1/8 Note</option>
              <option value="1/4">1/4 Beat</option>
              <option value="1/2">1/2 Bar</option>
              <option value="1/1">1 Bar (1/1)</option>
              <option value="2/1">2 Bars</option>
            </select>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded p-2.5 flex flex-col justify-between">
            <span className="block text-[10px] text-slate-400">Scale Lock Enforcement</span>
            <button
              type="button"
              aria-label="Toggle Global Scale Lock"
              onClick={() =>
                onUpdateScoreMeta?.('scale_lock', !Boolean(score?.meta?.scaleLock))
              }
              className={`w-full py-1 rounded text-xs font-bold border cursor-pointer ${
                score?.meta?.scaleLock
                  ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {score?.meta?.scaleLock ? 'Scale Lock: ON' : 'Scale Lock: OFF'}
            </button>
          </div>
        </div>

        <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 flex items-center justify-between">
          <span>Tip: Click any note on the Piano Roll or click "Inspect Note #1 →" above to edit individual note tokens.</span>
          <span>Tenuto 6.0 Bi-Directional AST Inspector</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between w-full bg-slate-900 border-l border-slate-700 h-full text-slate-200 px-3 py-2 shrink-0 shadow-lg z-10 overflow-y-auto select-none">
      {/* Top Bar: Active Token Info, Prev/Next Note Stepper & Line/Col Origin */}
      <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Context Inspector
          </h2>
          {selection.trackId && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40">
              Track: {selection.trackId}
            </span>
          )}
          {selection.rawToken && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-amber-300 border border-slate-800">
              Token: {selection.rawToken}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {filteredEvents.length > 0 && onSelectEventFromInspector && (
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] font-mono">
              <button
                type="button"
                aria-label="Inspect Previous Note"
                onClick={() => selectEventAt(eventCursorIdx - 1)}
                className="px-1.5 py-0.2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                ◀ Prev Note
              </button>
              <span className="text-slate-500 px-1">
                #{eventCursorIdx + 1}/{filteredEvents.length}
              </span>
              <button
                type="button"
                aria-label="Inspect Next Note"
                onClick={() => selectEventAt(eventCursorIdx + 1)}
                className="px-1.5 py-0.2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                Next Note ▶
              </button>
            </div>
          )}

          <div className="text-xs text-slate-400 font-mono">
            Line: {selection.line}, Col: {selection.col}
          </div>
        </div>
      </div>

      {/* Main 8-Card Note Parameter Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2.5 items-stretch my-auto">
        {/* 1. Duration Selector */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <label htmlFor="duration-select" className="block text-[10px] mb-1 text-slate-400 font-mono">
            Duration
          </label>
          <select
            id="duration-select"
            aria-label="Duration"
            value={selection.duration}
            onChange={(e) => onUpdate?.({ duration: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 font-mono text-emerald-300"
          >
            <option value="1/1">1/1 (Whole)</option>
            <option value="1/2">1/2 (Half)</option>
            <option value="1/4">1/4 (Quarter)</option>
            <option value="1/8">1/8 (Eighth)</option>
            <option value="1/16">1/16 (Sixteenth)</option>
          </select>
        </div>

        {/* 2. Velocity Slider + Dynamic Presets */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <label htmlFor="velocity-slider" className="block text-[10px] mb-0.5 text-slate-400 font-mono">
            Velocity: {selection.velocity}
          </label>
          <input
            id="velocity-slider"
            type="range"
            aria-label="Velocity"
            min="0"
            max="127"
            value={selection.velocity}
            onChange={(e) => onUpdate?.({ velocity: parseInt(e.target.value, 10) })}
            className="w-full accent-blue-500 cursor-pointer my-1"
          />
          <div className="grid grid-cols-6 gap-0.5 text-[8px] font-mono">
            {[
              { label: 'pp', v: 40 },
              { label: 'p', v: 60 },
              { label: 'mp', v: 75 },
              { label: 'mf', v: 90 },
              { label: 'f', v: 105 },
              { label: 'ff', v: 120 },
            ].map((dyn) => (
              <button
                key={dyn.label}
                type="button"
                onClick={() => onUpdate?.({ velocity: dyn.v })}
                className="bg-slate-900 hover:bg-blue-600/30 border border-slate-800 rounded py-0.2 text-slate-300 cursor-pointer"
              >
                {dyn.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Pitch Transpose Buttons */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <span className="block text-[10px] mb-1 text-slate-400 font-mono">Pitch Transpose</span>
          <div className="grid grid-cols-4 gap-1 font-mono text-[11px]">
            {[
              { label: '-12', delta: -12 },
              { label: '-1', delta: -1 },
              { label: '+1', delta: 1 },
              { label: '+12', delta: 12 },
            ].map((btn) => (
              <button
                key={btn.label}
                type="button"
                aria-label={`Transpose ${btn.label} semitones`}
                onClick={() => onUpdate?.({ transposeSemitones: btn.delta })}
                className="bg-slate-900 hover:bg-blue-600/30 border border-slate-700 text-slate-200 py-1 rounded cursor-pointer font-semibold"
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Articulation Selector */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <label htmlFor="articulation-select" className="block text-[10px] mb-1 text-slate-400 font-mono">
            Articulation
          </label>
          <select
            id="articulation-select"
            aria-label="Articulation"
            value={selection.articulation || ''}
            onChange={(e) => onUpdate?.({ articulation: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 font-mono text-cyan-300"
          >
            <option value="">Standard (None)</option>
            <option value="stacc">Staccato (.stacc)</option>
            <option value="legato">Legato (.legato)</option>
            <option value="marc">Marcato (.marc)</option>
            <option value="ten">Tenuto (.ten)</option>
            <option value="pizz">Pizzicato (.pizz)</option>
          </select>
        </div>

        {/* 5. Ornaments & Expression (.vib, .trill, .arp, .ped, .fermata) */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <label htmlFor="ornament-select" className="block text-[10px] mb-1 text-slate-400 font-mono">
            Ornament / Pedal
          </label>
          <select
            id="ornament-select"
            aria-label="Note Ornament"
            value={selection.ornament || ''}
            onChange={(e) => onUpdate?.({ ornament: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 font-mono text-amber-300"
          >
            <option value="">None</option>
            <option value="vib">Vibrato (.vib)</option>
            <option value="trill">Trill (.trill)</option>
            <option value="mordent">Mordent (.mordent)</option>
            <option value="trem">Tremolo (.trem)</option>
            <option value="arp">Rolled Chord (.arp)</option>
            <option value="ped">Sustain Pedal (.ped)</option>
            <option value="fermata">Fermata Hold (.fermata)</option>
          </select>
        </div>

        {/* 6. Dynamic Swell Hairpin (.cresc / .dim) */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <label htmlFor="swell-select" className="block text-[10px] mb-1 text-slate-400 font-mono">
            Dynamic Swell
          </label>
          <select
            id="swell-select"
            aria-label="Dynamic Swell"
            value={selection.swell || ''}
            onChange={(e) =>
              onUpdate?.({ swell: e.target.value as 'crescendo' | 'diminuendo' | '' })
            }
            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs outline-none focus:border-blue-500 font-mono text-pink-300"
          >
            <option value="">Flat (No Swell)</option>
            <option value="crescendo">&lt; Crescendo (.cresc)</option>
            <option value="diminuendo">&gt; Diminuendo (.dim)</option>
          </select>
        </div>

        {/* 7. Note Probability (Chance %) & Micro-Timing Pocket (ms) */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <label htmlFor="chance-input" className="text-[9px] text-slate-400 font-mono">
              Chance%
            </label>
            <input
              id="chance-input"
              type="number"
              aria-label="Note Chance"
              min={0}
              max={100}
              value={selection.chance ?? 100}
              onChange={(e) =>
                onUpdate?.({
                  chance: Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)),
                })
              }
              className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-purple-300 text-center"
            />
          </div>
          <div className="flex items-center justify-between gap-1 mt-1">
            <label htmlFor="pocket-input" className="text-[9px] text-slate-400 font-mono">
              Pocket ms
            </label>
            <input
              id="pocket-input"
              type="number"
              aria-label="Micro-timing Offset ms"
              min={-50}
              max={50}
              value={selection.pullMs ?? 0}
              onChange={(e) =>
                onUpdate?.({ pullMs: parseInt(e.target.value, 10) || 0 })
              }
              className="w-14 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[10px] font-mono text-amber-300 text-center"
            />
          </div>
        </div>

        {/* 8. Sung Lyric (.lyric("...")) */}
        <div className="bg-slate-950 border border-slate-800 rounded p-2 flex flex-col justify-between">
          <label htmlFor="lyric-input" className="block text-[10px] mb-1 text-slate-400 font-mono">
            Sung Lyric (.lyric)
          </label>
          <input
            id="lyric-input"
            type="text"
            aria-label="Note Lyric"
            placeholder="e.g. Doin'"
            value={selection.lyric || ''}
            onChange={(e) => onUpdate?.({ lyric: e.target.value })}
            className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs font-mono text-emerald-300"
          />
        </div>
      </div>

      {/* Footer Bar */}
      <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-500 font-mono flex items-center justify-between">
        <span>Bi-Directional AST Token Binding Active</span>
        <button
          type="button"
          aria-label="Return to Score Inspector"
          onClick={() => onSelectEventFromInspector?.(null as any)}
          className="text-blue-400 hover:text-blue-300 cursor-pointer"
        >
          ← Back to Global Score & Tuning Settings
        </button>
      </div>
    </div>
  );
}
