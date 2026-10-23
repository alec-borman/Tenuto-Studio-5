import React from 'react';
import { PRESET_SCORES } from '../presets/presetScores';

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
  masterVolume?: number;
  onMasterVolumeChange?: (newVolume: number) => void;
  onSelectPreset?: (code: string) => void;
  onExportWav?: () => void;
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
  masterVolume = 125,
  onMasterVolumeChange,
  onSelectPreset,
  onExportWav,
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

        <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-md px-3 py-1 text-xs font-mono">
          <span className="text-slate-300 truncate max-w-[160px]">{title}</span>
          <span className="text-slate-700">|</span>
          <span className="text-emerald-400 font-semibold">{tempo} BPM</span>
          <span className="text-slate-500">{timeSignature}</span>
          <span className="text-slate-700">|</span>
          <span className="text-blue-400">
            M{measureNum}:{beatInMeasure}
          </span>
        </div>
      </div>

      {/* Right: Master Volume Boost & Export WAV */}
      <div className="flex items-center gap-3">
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
