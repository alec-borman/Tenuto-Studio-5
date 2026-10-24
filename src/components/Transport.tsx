import React from 'react';
import { PRESET_SCORES } from '../presets/presetScores';

export type MainStudioView = 'piano_roll' | 'session' | 'arrangement';
export type BottomDockTab = 'mixer' | 'devices' | 'inspector' | null;

interface TransportProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onStop?: () => void;
  isLooping?: boolean;
  onToggleLoop?: () => void;
  tempo?: number;
  timeSignature?: string;
  title?: string;
  currentBeat?: number;
  rootKey?: string;
  scaleName?: string;
  onKeyScaleChange?: (newKey: string, newScale: string) => void;
  masterVolume?: number;
  onMasterVolumeChange?: (newVolume: number) => void;
  onSelectPreset?: (code: string) => void;
  onExportWav?: () => void;
  activeMainView?: MainStudioView;
  onMainViewChange?: (view: MainStudioView) => void;
  activeBottomDock?: BottomDockTab;
  onToggleBottomDock?: (tab: 'mixer' | 'devices' | 'inspector') => void;
  isCodeVisible?: boolean;
  onToggleCodeVisible?: () => void;
  isMetronomeEnabled?: boolean;
  onToggleMetronome?: () => void;
  countInBars?: number;
  onCountInBarsChange?: (bars: number) => void;
  onTapTempo?: () => void;
  onCaptureMidi?: () => void;
}

export default function Transport({
  isPlaying,
  onTogglePlay,
  onStop,
  isLooping = false,
  onToggleLoop,
  tempo = 120,
  timeSignature = '4/4',
  title = 'Untitled Score',
  currentBeat = 0,
  rootKey = 'C',
  scaleName = 'chromatic',
  onKeyScaleChange,
  masterVolume = 125,
  onMasterVolumeChange,
  onSelectPreset,
  onExportWav,
  activeMainView = 'piano_roll',
  onMainViewChange,
  activeBottomDock = null,
  onToggleBottomDock,
  isCodeVisible = true,
  onToggleCodeVisible,
  isMetronomeEnabled = false,
  onToggleMetronome,
  countInBars = 0,
  onCountInBarsChange,
  onTapTempo,
  onCaptureMidi,
}: TransportProps) {
  const measureNum = Math.floor(currentBeat / 4) + 1;
  const beatInMeasure = Math.floor(currentBeat % 4) + 1;
  const hasSecondTier = Boolean(
    onMainViewChange || onToggleBottomDock || onToggleCodeVisible
  );

  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 flex flex-col shrink-0 shadow-lg z-20 relative select-none">
      {/* Tier 1: Primary Transport, Score Status Pill, Master Volume & WAV Export */}
      <div className="min-h-12 w-full px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap">
        {/* Left: Brand & Demo Score Selector */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="font-ui text-xs font-semibold tracking-wider text-slate-200 flex items-center whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 shadow-[0_0_8px_#3b82f6]" />
            Tenuto<span className="text-blue-500 font-bold px-1">Studio</span>5
          </div>

          {onSelectPreset && (
            <select
              aria-label="Load Preset Song"
              defaultValue=""
              onChange={(e) => {
                const preset = PRESET_SCORES.find((p) => p.id === e.target.value);
                if (preset) onSelectPreset(preset.code);
              }}
              className="bg-slate-950 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs rounded-md px-2 py-1 outline-none focus:border-blue-500 transition-colors max-w-[210px] truncate cursor-pointer"
            >
              <option value="" disabled>
                Load Demo Score...
              </option>
              {PRESET_SCORES.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.title} ({preset.genre})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Center: Transport Action Buttons & Live Score Status Readout */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onTogglePlay}
            className={`${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
            } transition-colors shadow-md text-white font-bold py-1 px-5 rounded-md text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0`}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

          {onStop && (
            <button
              type="button"
              onClick={onStop}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold py-1 px-2.5 rounded-md text-xs uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Stop
            </button>
          )}

          {onToggleLoop && (
            <button
              type="button"
              onClick={onToggleLoop}
              className={`${
                isLooping
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              } border font-semibold py-1 px-2.5 rounded-md text-xs uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0`}
            >
              Loop
            </button>
          )}

          {onTapTempo && (
            <button
              type="button"
              aria-label="Tap Tempo"
              onClick={onTapTempo}
              className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold py-1 px-2 rounded-md text-xs uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Tap repeatedly to set project BPM"
            >
              Tap
            </button>
          )}

          {onToggleMetronome && (
            <button
              type="button"
              aria-label="Toggle Metronome"
              onClick={onToggleMetronome}
              className={`${
                isMetronomeEnabled
                  ? 'bg-amber-500/25 border-amber-500 text-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              } border font-semibold py-1 px-2 rounded-md text-xs uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0`}
              title="Toggle Metronome Click Track"
            >
              Click
            </button>
          )}

          {onCountInBarsChange && (
            <select
              aria-label="Count-In Bars"
              value={countInBars}
              onChange={(e) => onCountInBarsChange(parseInt(e.target.value, 10))}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-md px-1.5 py-1 outline-none cursor-pointer whitespace-nowrap shrink-0"
              title="Recording / Launch Count-In Bars"
            >
              <option value={0}>No Count-In</option>
              <option value={1}>1 Bar In</option>
              <option value={2}>2 Bars In</option>
              <option value={4}>4 Bars In</option>
            </select>
          )}

          {onCaptureMidi && (
            <button
              type="button"
              aria-label="Capture MIDI"
              onClick={onCaptureMidi}
              className="bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/50 text-purple-300 font-semibold py-1 px-2.5 rounded-md text-xs uppercase transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Retroactively capture notes into a new .ten measure"
            >
              Capture
            </button>
          )}

          {/* Compact Score Status Readout Pill */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs font-mono whitespace-nowrap shrink-0">
            <span className="text-slate-300 truncate max-w-[110px]" title={title}>
              {title}
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-emerald-400 font-semibold whitespace-nowrap">{tempo} BPM</span>
            <span className="text-slate-400 whitespace-nowrap">{timeSignature}</span>
            {onKeyScaleChange && (
              <>
                <span className="text-slate-700">|</span>
                <select
                  aria-label="Key Signature"
                  value={rootKey || 'C'}
                  onChange={(e) => onKeyScaleChange(e.target.value, scaleName || 'chromatic')}
                  className="bg-slate-900 border border-slate-700 text-amber-300 text-[11px] rounded px-1 py-0.5 outline-none cursor-pointer"
                >
                  {['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Scale Mode"
                  value={scaleName || 'chromatic'}
                  onChange={(e) => onKeyScaleChange(rootKey || 'C', e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-cyan-300 text-[11px] rounded px-1 py-0.5 outline-none cursor-pointer max-w-[115px]"
                >
                  <option value="chromatic">Chromatic</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                  <option value="harmonic_minor">Harmonic Minor</option>
                  <option value="dorian">Dorian</option>
                  <option value="phrygian">Phrygian</option>
                  <option value="lydian">Lydian</option>
                  <option value="mixolydian">Mixolydian</option>
                  <option value="minor_pentatonic">Minor Pentatonic</option>
                  <option value="blues">Blues</option>
                </select>
              </>
            )}
            <span className="text-slate-700">|</span>
            <span className="text-blue-400 font-semibold whitespace-nowrap">
              M{measureNum}:{beatInMeasure}
            </span>
          </div>
        </div>

        {/* Right: Master Volume & Export WAV */}
        <div className="flex items-center gap-2 shrink-0">
          {onMasterVolumeChange && (
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-md px-2 py-1 whitespace-nowrap">
              <label htmlFor="master-volume-slider" className="text-[11px] font-mono text-slate-400">
                Vol
              </label>
              <input
                id="master-volume-slider"
                type="range"
                aria-label="Master Volume"
                min="0"
                max="200"
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(parseInt(e.target.value, 10))}
                className="w-16 accent-blue-500 cursor-pointer"
              />
              <span className="text-[11px] font-mono text-slate-300 w-8 text-right">
                {masterVolume}%
              </span>
            </div>
          )}

          {onExportWav && (
            <button
              type="button"
              onClick={onExportWav}
              className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-xs font-semibold py-1 px-3 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Export WAV
            </button>
          )}
        </div>
      </div>

      {/* Tier 2: Dedicated Studio Navigation Bar (Code Toggle, Main View Switcher & Bottom Dock Switcher) */}
      {hasSecondTier && (
        <div className="h-9 w-full bg-slate-950/90 border-t border-slate-800/80 px-3 flex items-center justify-between gap-2">
          {/* Left: .ten Code Editor Pane Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleCodeVisible && (
              <button
                type="button"
                aria-label="Toggle Code Editor"
                onClick={onToggleCodeVisible}
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                  isCodeVisible !== false
                    ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Show/Hide Tenuto Code Editor"
              >
                {isCodeVisible !== false ? '◀ Hide .ten Code' : '▶ Show .ten Code'}
              </button>
            )}
          </div>

          {/* Center: Main Studio View Switcher (Piano Roll | Session | Arrangement) */}
          <div className="flex items-center gap-2 shrink-0">
            {onMainViewChange && (
              <div
                role="group"
                aria-label="Main Studio View Switcher"
                className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-[11px] font-mono whitespace-nowrap"
              >
                {(
                  [
                    { id: 'piano_roll', label: 'Piano Roll' },
                    { id: 'session', label: 'Session' },
                    { id: 'arrangement', label: 'Arrangement' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-label={`Switch to ${tab.label} View`}
                    onClick={() => onMainViewChange(tab.id)}
                    className={`px-3 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
                      (activeMainView || 'piano_roll') === tab.id
                        ? 'bg-blue-600 text-white font-semibold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Bottom Studio Dock Switcher (Mixer | Devices | Inspector) */}
          <div className="flex items-center gap-2 shrink-0">
            {onToggleBottomDock && (
              <div
                role="group"
                aria-label="Bottom Studio Dock Switcher"
                className="flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5 text-[11px] font-mono whitespace-nowrap"
              >
                <span className="text-[10px] text-slate-500 px-2 uppercase">Dock:</span>
                {(
                  [
                    { id: 'mixer', label: 'Mixer' },
                    { id: 'devices', label: 'Devices' },
                    { id: 'inspector', label: 'Inspector' },
                  ] as const
                ).map((dock) => (
                  <button
                    key={dock.id}
                    type="button"
                    aria-label={`Toggle ${dock.label} Dock`}
                    onClick={() => onToggleBottomDock(dock.id)}
                    className={`px-2.5 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
                      activeBottomDock === dock.id
                        ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {dock.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
