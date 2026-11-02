import React from 'react';
import { Smartphone } from 'lucide-react';
import { PRESET_SCORES } from '../presets/presetScores';

export type MainStudioView = 'piano_roll' | 'tab_flow' | 'session' | 'arrangement';
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
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  isIphonePortrait?: boolean;
  onToggleIphonePortrait?: () => void;
  onPredownloadScore?: () => void;
  predownloadState?: {
    status: 'idle' | 'downloading' | 'ready' | 'error';
    percent?: number;
    label?: string;
  };
  displayRefreshRateHz?: number;
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
  masterVolume = 80,
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
  isFullscreen = false,
  onToggleFullscreen,
  isIphonePortrait = false,
  onToggleIphonePortrait,
  onPredownloadScore,
  predownloadState,
  displayRefreshRateHz = 60,
}: TransportProps) {
  const measureNum = Math.floor(currentBeat / 4) + 1;
  const beatInMeasure = Math.floor(currentBeat % 4) + 1;
  const hasSecondTier = Boolean(
    onMainViewChange || onToggleBottomDock || onToggleCodeVisible || onKeyScaleChange
  );

  return (
    <header className="w-full bg-slate-900 border-b border-slate-800 flex flex-col shrink-0 shadow-lg z-20 relative select-none">
      {/* Tier 1: Studio Control Bar (Wraps cleanly inside 393px iPhone 15 Pro portrait frame without clipping) */}
      <div
        className={`${
          isIphonePortrait
            ? 'min-h-10 py-1.5 px-2 flex flex-wrap items-center justify-between gap-1.5'
            : 'h-11 px-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar'
        } w-full`}
      >
        {/* Left: Brand & Demo Score Selector */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="font-ui text-xs font-semibold tracking-wider text-slate-200 flex items-center whitespace-nowrap">
            <span className="w-2 h-2 rounded-full bg-blue-500 mr-1 shadow-[0_0_8px_#3b82f6]" />
            Tenuto<span className="text-blue-500 font-bold px-0.5">Studio</span>5
          </div>

          {onSelectPreset && (
            <select
              aria-label="Load Preset Song"
              defaultValue=""
              onChange={(e) => {
                const preset = PRESET_SCORES.find((p) => p.id === e.target.value);
                if (preset) onSelectPreset(preset.code);
              }}
              className={`bg-slate-950 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-md outline-none focus:border-blue-500 transition-colors truncate cursor-pointer ${
                isIphonePortrait
                  ? 'max-w-[118px] text-[11px] px-1.5 py-0.5'
                  : 'max-w-[200px] text-xs px-2 py-1'
              }`}
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

        {/* Center: Transport Action Buttons & Compact Clock Readout */}
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            className={`${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
            } transition-colors shadow-md text-white font-bold ${
              isIphonePortrait ? 'py-1 px-3 text-[11px]' : 'py-1 px-4 text-xs'
            } rounded-md uppercase tracking-wider cursor-pointer whitespace-nowrap shrink-0`}
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

          {/* Compact Clock & Tempo Pill */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs font-mono whitespace-nowrap shrink-0">
            {!hasSecondTier && (
              <>
                <span className="text-slate-300 truncate max-w-[140px]" title={title}>
                  {title}
                </span>
                <span className="text-slate-700">|</span>
              </>
            )}
            <span className="text-emerald-400 font-semibold whitespace-nowrap">{tempo} BPM</span>
            <span className="text-slate-400 whitespace-nowrap">{timeSignature}</span>
            <span className="text-slate-700">|</span>
            <span className="text-blue-400 font-semibold whitespace-nowrap">
              M{measureNum}:{beatInMeasure}
            </span>
            <span className="text-slate-700">|</span>
            <span
              data-testid="display-refresh-rate-badge"
              className="text-cyan-400 font-semibold whitespace-nowrap"
              title={`Display VSync Refresh Rate: ${displayRefreshRateHz} Hz (${(1000 / Math.max(1, displayRefreshRateHz)).toFixed(2)} ms/frame)`}
            >
              {displayRefreshRateHz} Hz
            </span>
          </div>
        </div>

        {/* Right: Master Volume, Rotate iPhone 15 Pro & Export WAV */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {onMasterVolumeChange && !isIphonePortrait && (
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

          {onPredownloadScore && (
            <button
              type="button"
              data-testid="predownload-score-btn"
              aria-label="Pre-Download Score Audio and Samples"
              disabled={predownloadState?.status === 'downloading'}
              onClick={onPredownloadScore}
              className={`border text-xs font-semibold py-1 px-2.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                predownloadState?.status === 'ready'
                  ? 'bg-teal-500/25 border-teal-400/60 text-teal-200'
                  : predownloadState?.status === 'downloading'
                    ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 cursor-wait'
                    : 'bg-sky-600/20 hover:bg-sky-600/30 border-sky-500/50 text-sky-200'
              }`}
              title="Pre-download all SoundFont samples and pre-bake all synth voices for offline / bad-internet playback"
            >
              {predownloadState?.status === 'downloading'
                ? `⏳ ${predownloadState.label || `Caching ${predownloadState.percent ?? 0}%...`}`
                : predownloadState?.status === 'ready'
                  ? '✓ Cached Offline'
                  : '⬇ Pre-Download'}
            </button>
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

          {onToggleIphonePortrait && (
            <button
              type="button"
              data-testid="viewport-rotate-iphone15pro-btn"
              aria-label="Rotate to iPhone 15 Pro Vertical Portrait Viewport"
              aria-pressed={isIphonePortrait}
              onClick={onToggleIphonePortrait}
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors border cursor-pointer whitespace-nowrap shrink-0 ${
                isIphonePortrait
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/50 shadow-xs'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Rotate interface to vertical 9:16 portrait resolution (393×852 logical / 1179×2556 native 3x)"
            >
              <Smartphone
                className={`w-3.5 h-3.5 transition-transform ${
                  isIphonePortrait ? 'rotate-0 text-cyan-300' : '-rotate-90 text-slate-400'
                }`}
              />
              <span>
                {isIphonePortrait ? 'Portrait 9:16 (1179×2556)' : 'Rotate Portrait 9:16'}
              </span>
            </button>
          )}

          {onToggleFullscreen && (
            <button
              type="button"
              aria-label="Toggle Fullscreen"
              onClick={onToggleFullscreen}
              className={`${
                isFullscreen
                  ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                  : 'bg-slate-950 hover:bg-slate-800 border-slate-700 text-slate-300'
              } border text-xs font-semibold py-1 px-2.5 rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0`}
              title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen Studio Mode'}
            >
              {isFullscreen ? '⤓ Exit Full' : '⛶ Fullscreen'}
            </button>
          )}
        </div>
      </div>

      {/* Tier 2: Dedicated Studio Navigation, Score Title, Key/Scale Lock & Bottom Dock Bar */}
      {hasSecondTier && (
        <div
          className={`${
            isIphonePortrait
              ? 'min-h-8 py-1 px-2 flex flex-wrap items-center justify-between gap-1'
              : 'h-9 px-3 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar'
          } w-full bg-slate-950/90 border-t border-slate-800/80`}
        >
          {/* Left: .ten Code Toggle, Active Score Title & Global Key/Scale Selectors */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded px-2.5 py-0.5 text-[11px] font-mono whitespace-nowrap">
              <span className="text-slate-400">Score:</span>
              <span className="text-slate-200 font-semibold truncate max-w-[220px]" title={title}>
                {title}
              </span>
            </div>

            {onKeyScaleChange && (
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-[11px] font-mono whitespace-nowrap">
                <span className="text-slate-400">Key:</span>
                <select
                  aria-label="Key Signature"
                  value={rootKey || 'C'}
                  onChange={(e) => onKeyScaleChange(e.target.value, scaleName || 'chromatic')}
                  className="bg-slate-950 border border-slate-700 text-amber-300 text-[11px] rounded px-1.5 py-0.2 outline-none cursor-pointer"
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
                  className="bg-slate-950 border border-slate-700 text-cyan-300 text-[11px] rounded px-1.5 py-0.2 outline-none cursor-pointer"
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
              </div>
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
                    { id: 'tab_flow', label: 'Tab / Chord Flow' },
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
