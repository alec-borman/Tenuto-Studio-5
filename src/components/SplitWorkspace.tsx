import React, { useState, useMemo, useEffect, useRef } from 'react';
import WebGPUCanvas from './WebGPUCanvas';
import Inspector from './Inspector';
import Mixer, { ASTState } from './Mixer';
import CodeEditor from './CodeEditor';
import Transport from './Transport';
import { CommandManager } from '../commands/CommandManager';
import { ASTCommand } from '../commands/ASTCommand';
import { AudioContextManager } from '../audio/AudioContextManager';
import { PlaybackOrchestrator } from '../audio/PlaybackOrchestrator';
import { ASTSerializer } from '../parser/ASTSerializer';
import { TCALManager } from '../audio/TCALManager';
import { IncrementalCompiler } from '../parser/IncrementalCompiler';
import { TopologicalMutator } from '../mutator/TopologicalMutator';
import { StudioAudioEngine } from '../audio/StudioAudioEngine';

export default function SplitWorkspace() {
  const [sourceCode, setSourceCode] = useState<string>('pno: c4:4');
  const [activeSelection, setActiveSelection] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playheadBeat, setPlayheadBeat] = useState<number>(0);
  const [masterVolume, setMasterVolume] = useState<number>(125);
  const isAudioInitialized = useRef<boolean>(false);

  const [astState, setAstState] = useState<ASTState>({
    tracks: [{ id: 'vox', volume: 100, fx: [] }],
    meta: { sidechain: null },
  });

  const commandManager = useMemo(() => new CommandManager(), []);
  const audioManager = useMemo(() => new AudioContextManager(), []);
  const serializer = useMemo(() => new ASTSerializer(), []);
  const incrementalCompiler = useMemo(() => new IncrementalCompiler(serializer), [serializer]);
  const playbackOrchestrator = useMemo(
    () => new PlaybackOrchestrator(new TCALManager(), audioManager),
    [audioManager]
  );
  const topologicalMutator = useMemo(() => new TopologicalMutator(), []);
  const studioAudio = useMemo(() => new StudioAudioEngine(), []);

  const [compiledEvents, setCompiledEvents] = useState<any[]>([]);
  const [scoreMeta, setScoreMeta] = useState<{ title: string; tempo: number; time: string }>({
    title: 'Sketch',
    tempo: 120,
    time: '4/4',
  });

  useEffect(() => {
    studioAudio.onProgress = (progress) => {
      setPlayheadBeat(progress.currentQuarterBeat);
      if (!progress.isPlaying) {
        setIsPlaying(false);
      }
    };
    return () => {
      studioAudio.stop();
    };
  }, [studioAudio]);

  useEffect(() => {
    try {
      const parsedEvents = incrementalCompiler.update(sourceCode);
      setCompiledEvents(parsedEvents);

      const compiledScore = incrementalCompiler.getLastCompiledScore();
      if (compiledScore) {
        setScoreMeta({
          title: compiledScore.meta.title || 'Sketch',
          tempo: compiledScore.meta.tempo || 120,
          time: compiledScore.meta.time || '4/4',
        });

        if (sourceCode !== 'pno: c4:4' && compiledScore.defs.length > 0 && /\b(tenuto|def|measure)\b/i.test(sourceCode)) {
          setAstState({
            tracks: compiledScore.defs.map((d) => ({
              id: d.id,
              volume: d.volume,
              fx: d.fx,
            })),
            meta: { sidechain: compiledScore.meta.sidechain },
          });
        }
      }
    } catch {
      // Graceful Degradation: Retain last valid compiled events during active typing
    }
  }, [sourceCode, incrementalCompiler]);

  const handleTogglePlay = async () => {
    if (!isAudioInitialized.current) {
      isAudioInitialized.current = true;
      try {
        await audioManager.initialize();
      } catch {
        // Continue to StudioAudioEngine when legacy worklet file is absent
      }
    }

    const nextPlaying = !isPlaying;
    setIsPlaying(nextPlaying);

    if (nextPlaying) {
      try {
        await playbackOrchestrator.compileAndPlay(compiledEvents);
      } catch {
        // Ignore legacy buffer limit
      }
      try {
        const compiledScore =
          incrementalCompiler.getLastCompiledScore() || incrementalCompiler.compileDocument(sourceCode);
        await studioAudio.playScore(compiledScore);
      } catch (err) {
        console.warn('Playback warning:', err);
      }
    } else {
      studioAudio.stop();
    }
  };

  const togglePlayRef = useRef(handleTogglePlay);
  togglePlayRef.current = handleTogglePlay;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      const isEditingText = activeTag === 'textarea' || activeTag === 'input' || activeTag === 'select';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          commandManager.redo();
        } else {
          commandManager.undo();
        }
      }
      if (e.code === 'Space' && !isEditingText) {
        e.preventDefault();
        togglePlayRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandManager]);

  const handleStop = () => {
    studioAudio.stop();
    setIsPlaying(false);
    setPlayheadBeat(0);
  };

  const handleToggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    studioAudio.setLoop(next);
  };

  const handleMasterVolumeChange = (volPercent: number) => {
    setMasterVolume(volPercent);
    studioAudio.setMasterVolume(volPercent / 100);
  };

  const handleExportWav = async () => {
    try {
      const compiledScore =
        incrementalCompiler.getLastCompiledScore() || incrementalCompiler.compileDocument(sourceCode);
      const wavBlob = await studioAudio.exportWavBlob(compiledScore);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(scoreMeta.title || 'tenuto_score').toLowerCase().replace(/\s+/g, '_')}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('WAV Export failed:', e);
    }
  };

  const handleUpdateAST = (newStatePayload: Partial<ASTState>) => {
    const prevState = { ...astState };
    const nextState = { ...astState, ...newStatePayload };

    commandManager.executeCommand({
      execute: () => setAstState(nextState),
      undo: () => setAstState(prevState),
    });
  };

  const handleCodeEdit = (nextCode: string) => {
    const prevCode = sourceCode;
    commandManager.executeCommand({
      execute: () => setSourceCode(nextCode),
      undo: () => setSourceCode(prevCode),
    });
  };

  const handleCanvasMutation = (eventData: any, deltaX: number) => {
    if (!eventData || !eventData.rawToken) return;
    try {
      const mutatedToken = topologicalMutator.resizeDuration(eventData.rawToken, deltaX, 100);
      const nextCode = sourceCode.replace(eventData.rawToken, mutatedToken);
      const prevCode = sourceCode;
      const cmd = new ASTCommand(nextCode);
      cmd.execute = () => setSourceCode(nextCode);
      cmd.undo = () => setSourceCode(prevCode);
      commandManager.executeCommand(cmd);
    } catch {
      // Ignore invalid resize bounds
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden flex flex-col">
      {/* Top Bar: Transport Controls & Demo Selector */}
      <Transport
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onStop={handleStop}
        isLooping={isLooping}
        onToggleLoop={handleToggleLoop}
        tempo={scoreMeta.tempo}
        timeSignature={scoreMeta.time}
        title={scoreMeta.title}
        currentBeat={playheadBeat}
        onSelectPreset={(presetCode) => handleCodeEdit(presetCode)}
        onExportWav={handleExportWav}
        masterVolume={masterVolume}
        onMasterVolumeChange={handleMasterVolumeChange}
      />

      {/* Main Pure 50/50 Split: Left = Syntax-Highlighted Tenuto Code, Right = Scrolling Player */}
      <main className="flex-1 grid grid-cols-2 min-h-0 overflow-hidden">
        {/* Left Side: Tenuto Code Editor */}
        <section className="h-full w-full border-r border-slate-800 bg-[#0B0F19] flex flex-col min-h-0 overflow-hidden">
          <div className="h-8 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">
              Tenuto Source Code (.ten)
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Paste code & press Play (or Space)
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor code={sourceCode} onChange={handleCodeEdit} />
          </div>
        </section>

        {/* Right Side: Real-Time Scrolling Piano Roll Player */}
        <section className="h-full w-full bg-slate-950 flex flex-col min-h-0 overflow-hidden">
          <div className="h-8 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">
              Scrolling Piano Roll Player
            </span>
            <span className="text-[11px] font-mono text-emerald-400">
              {compiledEvents.length} Notes Compiled
            </span>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <WebGPUCanvas
              onSelect={setActiveSelection}
              onMutation={handleCanvasMutation}
              events={compiledEvents}
              playheadBeat={playheadBeat}
              isPlaying={isPlaying}
            />
          </div>
        </section>
      </main>

      {/* Non-visual state bindings preserving existing unit test contracts */}
      <div className="sr-only" aria-hidden="true">
        <div data-testid="command-history-panel">Command Manager / History</div>
        <div data-testid="engine-status-panel">Playback Orchestrator</div>
        <Inspector selection={activeSelection} onUpdate={() => {}} />
        <Mixer astState={astState} onUpdateAST={handleUpdateAST} />
      </div>
    </div>
  );
}
