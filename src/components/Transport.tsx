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
  rootKey,
  scaleName,
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

  return (
    <header className="h-14 w-full bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 shadow-lg z-20 relative select-none">
      {/* Left: Brand & Demo Score Selector */}
      <div className="flex items-center gap-4">
        <div className="font-ui text-sm font-semibold tracking-wider text-slate-200 flex items-center">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-2 shadow-[0_0_8px_#3b82f6]" />
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
            className="bg-slate-950 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs rounded-md px-2.5 py-1.5 outline-none focus:border-blue-500 transition-colors"
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

        {onToggleCodeVisible && (
          <button
            type="button"
            aria-label="Toggle Code Editor"
            onClick={onToggleCodeVisible}
            className={`px-2.5 py-1 rounded text-xs font-mono font-semibold border transition-colors cursor-pointer ${
              isCodeVisible !== false
                ? 'bg-blue-600/20 border-blue-500/60 text-blue-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Show/Hide Tenuto Code Editor"
          >
            .ten Code
          </button>
        )}
      </div>

      {/* Center: Play, Stop, Loop & Live Measure/Beat Readout */}
      <div className="flex items-center gap-3">
        <button
          onClick={onTogglePlay}
          className={`${
            isPlaying ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
          } transition-colors shadow-md text-white font-bold py-1.5 px-7 rounded-md text-xs uppercase tracking-wider cursor-pointer`}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {onStop && (
          <button
            onClick={onStop}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold py-1.5 px-3.5 rounded-md text-xs uppercase transition-colors cursor-pointer"
          >
            Stop
          </button>
        )}

        {onToggleLoop && (
          <button
            onClick={onToggleLoop}
            className={`${
              isLooping
                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            } border font-semibold py-1.5 px-3 rounded-md text-xs uppercase transition-colors cursor-pointer`}
          >
            Loop
          </button>
        )}

        {onTapTempo && (
          <button
            type="button"
            aria-label="Tap Tempo"
            onClick={onTapTempo}
            className="bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold py-1.5 px-2.5 rounded-md text-xs uppercase transition-colors cursor-pointer"
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
                : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
            } border font-semibold py-1.5 px-2.5 rounded-md text-xs uppercase transition-colors cursor-pointer`}
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
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-md px-2 py-1.5 outline-none cursor-pointer"
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
            className="bg-purple-600/20 hover:bg-purple-600/35 border border-purple-500/50 text-purple-300 font-semibold py-1.5 px-2.5 rounded-md text-xs uppercase transition-colors cursor-pointer"
            title="Retroactively capture played notes into a new .ten measure"
          >
            Capture
          </button>
        )}

        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-md px-3 py-1 text-xs font-mono">
          <span className="text-slate-300 truncate max-w-[160px]">{title}</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-400 font-semibold">{tempo} BPM</span>
          <span className="text-slate-500">{timeSignature}</span>
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
                className="bg-slate-900 border border-slate-700 text-cyan-300 text-[11px] rounded px-1 py-0.5 outline-none cursor-pointer"
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
          <span className="text-blue-400">
            M{measureNum}:{beatInMeasure}
          </span>
        </div>
      </div>

      {/* Right: View Switcher, Bottom Dock Switcher, Master Volume Boost & Export WAV */}
      <div className="flex items-center gap-3">
        {onMainViewChange && (
          <div
            role="group"
            aria-label="Main Studio View Switcher"
            className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5 text-[11px] font-mono"
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
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                  (activeMainView || 'piano_roll') === tab.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {onToggleBottomDock && (
          <div
            role="group"
            aria-label="Bottom Studio Dock Switcher"
            className="flex items-center bg-slate-950 border border-slate-800 rounded-md p-0.5 text-[11px] font-mono"
          >
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
                className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                  activeBottomDock === dock.id
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {dock.label}
              </button>
            ))}
          </div>
        )}

        {onMasterVolumeChange && (
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1">
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
              className="w-20 accent-blue-500 cursor-pointer"
            />
            <span className="text-[11px] font-mono text-slate-300 w-9 text-right">{masterVolume}%</span>
          </div>
        )}

        {onExportWav && (
          <button
            onClick={onExportWav}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 text-xs font-semibold py-1.5 px-3.5 rounded-md transition-colors cursor-pointer"
          >
            Export WAV
          </button>
        )}
      </div>
    </header>
  );
}
