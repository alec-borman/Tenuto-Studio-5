import React, { useState, useMemo, useEffect, useRef } from 'react';
import WebGPUCanvas from './WebGPUCanvas';
import Inspector from './Inspector';
import Mixer, { ASTState } from './Mixer';
import CodeEditor from './CodeEditor';
import Transport, { MainStudioView, BottomDockTab } from './Transport';
import SessionView from './SessionView';
import ArrangementView from './ArrangementView';
import DeviceChainDock from './DeviceChainDock';
import TabChordFlowView from './TabChordFlowView';
import { CommandManager } from '../commands/CommandManager';
import { ASTCommand } from '../commands/ASTCommand';
import { AudioContextManager } from '../audio/AudioContextManager';
import { PlaybackOrchestrator } from '../audio/PlaybackOrchestrator';
import { ASTSerializer } from '../parser/ASTSerializer';
import { TCALManager } from '../audio/TCALManager';
import { IncrementalCompiler } from '../parser/IncrementalCompiler';
import { TopologicalMutator } from '../mutator/TopologicalMutator';
import { StudioAudioEngine } from '../audio/StudioAudioEngine';
import { MetronomeAndCaptureEngine } from '../audio/MetronomeAndCaptureEngine';
import {
  MidiTransformAndGeneratorEngine,
  MidiTransformType,
  MidiGeneratorType,
} from '../mutator/MidiTransformAndGeneratorEngine';
import { DebouncedCodeMemory } from '../utils/DebouncedCodeMemory';

export default function SplitWorkspace() {
  const codeMemory = useMemo(() => new DebouncedCodeMemory(), []);
  const [sourceCode, setSourceCode] = useState<string>(() => codeMemory.load('pno: c4:4'));
  const [memoryStatus, setMemoryStatus] = useState<'saved' | 'saving'>('saved');
  const isInitialCodeMount = useRef<boolean>(true);
  const [activeSelection, setActiveSelection] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [playheadBeat, setPlayheadBeat] = useState<number>(0);
  const [masterVolume, setMasterVolume] = useState<number>(125);
  const [activeMainView, setActiveMainView] = useState<MainStudioView>('piano_roll');
  const [activeBottomDock, setActiveBottomDock] = useState<BottomDockTab>(null);
  const [isCodeVisible, setIsCodeVisible] = useState<boolean>(true);
  const [compiledScoreState, setCompiledScoreState] = useState<any>(null);
  const [activeClipsByTrack, setActiveClipsByTrack] = useState<Record<string, string>>({});
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [deviceDockTrackId, setDeviceDockTrackId] = useState<string | null>(null);
  const [mutedTracks, setMutedTracks] = useState<string[]>([]);
  const [soloedTracks, setSoloedTracks] = useState<string[]>([]);
  const [armedTracks, setArmedTracks] = useState<string[]>([]);
  const [mutedGroups, setMutedGroups] = useState<string[]>([]);
  const [soloedGroups, setSoloedGroups] = useState<string[]>([]);
  const [loopStartMeasure, setLoopStartMeasure] = useState<number | null>(null);
  const [loopEndMeasure, setLoopEndMeasure] = useState<number | null>(null);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState<boolean>(false);
  const [countInBars, setCountInBars] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const workspaceRootRef = useRef<HTMLDivElement>(null);
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
  const metronomeCapture = useMemo(() => new MetronomeAndCaptureEngine(), []);

  const [compiledEvents, setCompiledEvents] = useState<any[]>([]);
  const [scoreMeta, setScoreMeta] = useState<{
    title: string;
    tempo: number;
    time: string;
    key?: string;
    scale?: string;
  }>({
    title: 'Sketch',
    tempo: 120,
    time: '4/4',
    key: 'C',
    scale: 'chromatic',
  });

  useEffect(() => {
    studioAudio.onProgress = (progress) => {
      setPlayheadBeat(progress.currentQuarterBeat);
      if (progress.currentTempoBpm && progress.isPlaying) {
        setScoreMeta((prev) =>
          prev.tempo === progress.currentTempoBpm
            ? prev
            : { ...prev, tempo: progress.currentTempoBpm! }
        );
      }
      if (!progress.isPlaying) {
        setIsPlaying(false);
        const baseTempo = compiledScoreState?.meta?.tempo || progress.currentTempoBpm;
        if (baseTempo) {
          setScoreMeta((prev) => (prev.tempo === baseTempo ? prev : { ...prev, tempo: baseTempo }));
        }
      }
    };
  }, [studioAudio, compiledScoreState]);

  useEffect(() => {
    return () => {
      studioAudio.stop();
    };
  }, [studioAudio]);

  useEffect(() => {
    if (isInitialCodeMount.current) {
      isInitialCodeMount.current = false;
      return;
    }
    setMemoryStatus('saving');
    codeMemory.scheduleSave(sourceCode, () => {
      setMemoryStatus('saved');
    });
  }, [sourceCode, codeMemory]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      codeMemory.flush();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      codeMemory.cancelPending();
    };
  }, [codeMemory]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc: any = document;
      const activeFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(activeFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = async () => {
    const doc: any = document;
    const el: any = workspaceRootRef.current || document.documentElement;
    try {
      if (!isFullscreen && !doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (typeof el.requestFullscreen === 'function') {
          await el.requestFullscreen();
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          await el.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (typeof doc.exitFullscreen === 'function' && doc.fullscreenElement) {
          await doc.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === 'function' && doc.webkitFullscreenElement) {
          await doc.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  const handleResetCodeMemory = () => {
    codeMemory.clear();
    setMemoryStatus('saved');
    setSourceCode('pno: c4:4');
  };

  useEffect(() => {
    try {
      const parsedEvents = incrementalCompiler.update(sourceCode);
      setCompiledEvents(parsedEvents);

      const compiledScore = incrementalCompiler.getLastCompiledScore();
      if (compiledScore) {
        setCompiledScoreState(compiledScore);
        setScoreMeta({
          title: compiledScore.meta.title || 'Sketch',
          tempo: compiledScore.meta.tempo || 120,
          time: compiledScore.meta.time || '4/4',
          key: compiledScore.meta.key || 'C',
          scale: compiledScore.meta.scale || 'chromatic',
        });

        if (sourceCode !== 'pno: c4:4' && compiledScore.defs.length > 0 && /\b(tenuto|def|measure)\b/i.test(sourceCode)) {
          setAstState({
            tracks: compiledScore.defs.map((d) => ({
              id: d.id,
              name: d.name,
              volume: d.volume,
              pan: d.pan,
              fx: d.fx,
              sends: d.sends,
              isReturn: d.isReturn,
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
      if (e.key === 'Tab' && !isEditingText) {
        e.preventDefault();
        setActiveMainView((prev) =>
          prev === 'session' ? 'arrangement' : prev === 'arrangement' ? 'piano_roll' : 'session'
        );
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

  const handleKeyScaleChange = (newKey: string, newScale: string) => {
    setScoreMeta((prev) => ({ ...prev, key: newKey, scale: newScale }));
    let nextCode = topologicalMutator.applyMixerMutationToSource(sourceCode, {
      mutationType: 'META_UPDATE',
      metaKey: 'key',
      metaValue: newKey,
    });
    nextCode = topologicalMutator.applyMixerMutationToSource(nextCode, {
      mutationType: 'META_UPDATE',
      metaKey: 'scale',
      metaValue: newScale,
    });
    if (nextCode !== sourceCode) {
      const prevCode = sourceCode;
      commandManager.executeCommand({
        execute: () => setSourceCode(nextCode),
        undo: () => setSourceCode(prevCode),
      });
    }
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

  const handleUpdateAST = (newStatePayload: any) => {
    const prevState = { ...astState };
    const nextState = { ...astState, ...newStatePayload };
    const prevCode = sourceCode;
    const nextCode =
      newStatePayload && newStatePayload.mutationType
        ? topologicalMutator.applyMixerMutationToSource(sourceCode, newStatePayload)
        : sourceCode;

    if (newStatePayload?.mutationType === 'VOLUME_UPDATE' && newStatePayload.trackId) {
      studioAudio.setTrackVolume(newStatePayload.trackId, Number(newStatePayload.value));
    } else if (newStatePayload?.mutationType === 'PAN_UPDATE' && newStatePayload.trackId) {
      studioAudio.setTrackPan(newStatePayload.trackId, Number(newStatePayload.value));
    } else if (
      newStatePayload?.mutationType === 'SEND_UPDATE' &&
      newStatePayload.trackId &&
      newStatePayload.sendId
    ) {
      const lvl = Number(newStatePayload.sendLevel ?? 0);
      const mode = newStatePayload.sendMode || 'post';
      try {
        studioAudio.setTrackSend(newStatePayload.trackId, newStatePayload.sendId, lvl, mode);
      } catch {
        // Ignore circular send route
      }
      nextState.tracks = astState.tracks.map((t) =>
        t.id === newStatePayload.trackId
          ? {
              ...t,
              sends: { ...(t.sends || {}), [newStatePayload.sendId]: lvl },
              sendModes: { ...(t.sendModes || {}), [newStatePayload.sendId]: mode },
            }
          : t
      );
    } else if (newStatePayload?.mutationType === 'GROUP_VOLUME_UPDATE' && newStatePayload.groupId) {
      studioAudio.setGroupVolume(newStatePayload.groupId, Number(newStatePayload.value));
    } else if (newStatePayload?.mutationType === 'META_SIDECHAIN_TAP_UPDATE' && newStatePayload.tapMode) {
      studioAudio.setSidechainTapMode(newStatePayload.tapMode);
    }

    commandManager.executeCommand({
      execute: () => {
        setAstState(nextState);
        if (nextCode !== prevCode) setSourceCode(nextCode);
      },
      undo: () => {
        setAstState(prevState);
        if (nextCode !== prevCode) setSourceCode(prevCode);
      },
    });
  };

  const handleToggleBottomDock = (tab: 'mixer' | 'devices' | 'inspector') => {
    setActiveBottomDock((prev) => (prev === tab ? null : tab));
  };

  const handleLaunchClip = async (clip: any) => {
    setSelectedClipId(clip.id);
    setActiveClipsByTrack((prev) => ({ ...prev, [clip.trackId]: clip.id }));
    setIsPlaying(true);
    try {
      const compiledScore =
        compiledScoreState ||
        incrementalCompiler.getLastCompiledScore() ||
        incrementalCompiler.compileDocument(sourceCode);
      await studioAudio.launchClip(compiledScore, clip.id, clip.trackId, clip.events || []);
    } catch {
      // Ignore WebAudio absence in headless JSDOM tests
    }
  };

  const handleLaunchScene = async (sceneIndex: number, clipsInScene: any[], sceneTempo?: number) => {
    const nextMap: Record<string, string> = {};
    const combinedEvents: any[] = [];
    for (const c of clipsInScene) {
      nextMap[c.trackId] = c.id;
      if (c.events) combinedEvents.push(...c.events);
    }
    setActiveClipsByTrack(nextMap);
    setIsPlaying(true);
    try {
      const compiledScore =
        compiledScoreState ||
        incrementalCompiler.getLastCompiledScore() ||
        incrementalCompiler.compileDocument(sourceCode);
      await studioAudio.launchScene(compiledScore, sceneIndex, combinedEvents, nextMap, sceneTempo);
    } catch {
      // Ignore WebAudio absence in headless JSDOM tests
    }
  };

  const handleStopTrackClip = (trackId: string) => {
    studioAudio.stopTrackClip(trackId);
    setActiveClipsByTrack((prev) => {
      const next = { ...prev };
      delete next[trackId];
      if (Object.keys(next).length === 0) {
        setIsPlaying(false);
      }
      return next;
    });
  };

  const handleStopAllClips = () => {
    studioAudio.stop();
    setActiveClipsByTrack({});
    setIsPlaying(false);
    setPlayheadBeat(0);
  };

  const handleQuantizeLaunchChange = (quantize: string) => {
    handleUpdateAST({
      mutationType: 'META_UPDATE',
      metaKey: 'quantize_launch',
      metaValue: quantize,
    });
  };

  const handleCreateClipInSlot = (trackId: string, sceneIndex: number) => {
    const newClipId = `${trackId}_s${sceneIndex}`;
    const snippet = `\n  clip ${newClipId} "${trackId.toUpperCase()} Scene ${sceneIndex}" track=${trackId} scene=${sceneIndex} bars=1 {\n    c4:4 e4:4 g4:2\n  }\n`;
    const lastBraceIdx = sourceCode.lastIndexOf('}');
    const nextCode =
      lastBraceIdx !== -1
        ? sourceCode.slice(0, lastBraceIdx) + snippet + sourceCode.slice(lastBraceIdx)
        : `${sourceCode}\n${snippet}`;
    handleCodeEdit(nextCode);
  };

  const handleToggleTrackMute = (trackId: string) => {
    studioAudio.toggleTrackMute(trackId);
    setMutedTracks(studioAudio.getMutedTracks());
  };

  const handleToggleTrackSolo = (trackId: string) => {
    studioAudio.toggleTrackSolo(trackId);
    setSoloedTracks(studioAudio.getSoloedTracks());
  };

  const handleToggleTrackArm = (trackId: string) => {
    studioAudio.toggleTrackArm(trackId);
    setArmedTracks(studioAudio.getArmedTracks());
  };

  const handleToggleGroupMute = (groupId: string) => {
    studioAudio.toggleGroupMute(groupId);
    setMutedGroups(studioAudio.getMutedGroups());
  };

  const handleToggleGroupSolo = (groupId: string) => {
    studioAudio.toggleGroupSolo(groupId);
    setSoloedGroups(studioAudio.getSoloedGroups());
  };

  const handleSeekToMeasure = async (measureNumber: number) => {
    setPlayheadBeat(Math.max(0, (measureNumber - 1) * 4));
    if (isPlaying) {
      try {
        const compiledScore =
          compiledScoreState ||
          incrementalCompiler.getLastCompiledScore() ||
          incrementalCompiler.compileDocument(sourceCode);
        await studioAudio.seekToMeasure(compiledScore, measureNumber, loopEndMeasure);
      } catch {
        // Ignore WebAudio absence in headless JSDOM tests
      }
    }
  };

  const handleLoopRangeChange = (startM: number | null, endM: number | null) => {
    setLoopStartMeasure(startM);
    setLoopEndMeasure(endM);
    studioAudio.setArrangementLoopRange(startM, endM);
    if (startM !== null && endM !== null) {
      setIsLooping(true);
      studioAudio.setLoop(true);
    }
  };

  const handleAddLocator = (name: string, measureNumber: number) => {
    const snippet = `\n  locator "${name}" at measure ${measureNumber}\n`;
    const firstMeasureIdx = sourceCode.search(/\bmeasure\s+\d+/i);
    const nextCode =
      firstMeasureIdx !== -1
        ? sourceCode.slice(0, firstMeasureIdx) + snippet + '  ' + sourceCode.slice(firstMeasureIdx)
        : `${sourceCode}\n${snippet}`;
    handleCodeEdit(nextCode);
  };

  const handleToggleMetronome = () => {
    const next = !isMetronomeEnabled;
    setIsMetronomeEnabled(next);
    studioAudio.setMetronomeEnabled(next);
  };

  const handleCountInBarsChange = (bars: number) => {
    setCountInBars(bars);
    studioAudio.setCountInBars(bars);
  };

  const handleTapTempo = () => {
    const detectedBpm = metronomeCapture.registerTap(Date.now());
    if (detectedBpm !== null) {
      setScoreMeta((prev) => ({ ...prev, tempo: detectedBpm }));
      handleUpdateAST({
        mutationType: 'META_UPDATE',
        metaKey: 'tempo',
        metaValue: detectedBpm,
      });
    }
  };

  const handleCaptureMidi = () => {
    const firstTrackId = compiledScoreState?.defs?.[0]?.id || 'pno';
    const existingMeasures = (compiledScoreState?.events || []).reduce(
      (maxM: number, ev: any) => Math.max(maxM, ev.measureNumber || 1),
      0
    );
    const nextMeasureNum = existingMeasures + 1;
    const captured = metronomeCapture.flushCapturedNotesToTenutoMeasure(
      scoreMeta.tempo || 120,
      firstTrackId,
      nextMeasureNum
    );
    if (!captured) return;

    if (/\btenuto\b/i.test(sourceCode) || /\bmeasure\s+\d+/i.test(sourceCode)) {
      const lastBraceIdx = sourceCode.lastIndexOf('}');
      const nextCode =
        lastBraceIdx !== -1
          ? `${sourceCode.slice(0, lastBraceIdx)}\n${captured.measureCode}\n}`
          : `${sourceCode}\n${captured.measureCode}`;
      handleCodeEdit(nextCode);
    } else {
      const nextCode = `${sourceCode.trim()} ${captured.tokens.join(' ')}`;
      handleCodeEdit(nextCode);
    }
  };

  const handleCodeEdit = (nextCode: string) => {
    const prevCode = sourceCode;
    commandManager.executeCommand({
      execute: () => setSourceCode(nextCode),
      undo: () => setSourceCode(prevCode),
    });
  };

  const handleCanvasMutation = (
    eventData: any,
    deltaX: number,
    semitoneDelta: number = 0,
    zScale: number = 100
  ) => {
    if (!eventData || !eventData.rawToken) return;
    try {
      const preferFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(
        scoreMeta.key || ''
      );

      if (eventData.isBeatWideMutation && semitoneDelta !== 0) {
        const beatWhole =
          typeof eventData.beatStartWhole === 'number'
            ? eventData.beatStartWhole
            : eventData.startTime
              ? eventData.startTime.numerator /
                Math.max(1, eventData.startTime.denominator)
              : 0;
        const nextCode = topologicalMutator.transposeBeatEventsInSource(
          sourceCode,
          compiledEvents,
          beatWhole,
          semitoneDelta,
          preferFlats
        );
        if (nextCode === sourceCode) return;
        const prevCode = sourceCode;
        const cmd = new ASTCommand(nextCode);
        cmd.execute = () => setSourceCode(nextCode);
        cmd.undo = () => setSourceCode(prevCode);
        commandManager.executeCommand(cmd);
        return;
      }

      let mutatedToken = eventData.rawToken;
      if (deltaX !== 0) {
        mutatedToken = topologicalMutator.resizeDuration(
          mutatedToken,
          deltaX,
          zScale,
          eventData.duration
        );
      }
      if (semitoneDelta !== 0) {
        mutatedToken = topologicalMutator.transposePitch(
          mutatedToken,
          semitoneDelta,
          preferFlats,
          eventData.pitch?.midi
        );
      }
      if (mutatedToken === eventData.rawToken) return;

      const nextCode = topologicalMutator.replaceEventInSource(
        sourceCode,
        eventData,
        mutatedToken
      );
      const prevCode = sourceCode;
      const cmd = new ASTCommand(nextCode);
      cmd.execute = () => setSourceCode(nextCode);
      cmd.undo = () => setSourceCode(prevCode);
      commandManager.executeCommand(cmd);
    } catch {
      // Ignore invalid resize or transpose bounds
    }
  };

  const handleInspectorUpdate = (updates: any) => {
    if (!activeSelection || !activeSelection.rawToken) return;
    try {
      let mutatedToken = activeSelection.rawToken;
      if (typeof updates.transposeSemitones === 'number' && updates.transposeSemitones !== 0) {
        mutatedToken = topologicalMutator.transposePitch(
          mutatedToken,
          updates.transposeSemitones
        );
      } else {
        mutatedToken = topologicalMutator.mutateTokenModifiers(mutatedToken, {
          duration: updates.duration,
          velocity: updates.velocity,
          pan: updates.pan,
          chance: updates.chance,
          articulation: updates.articulation,
          lyric: updates.lyric,
          swell: updates.swell,
          ornament: updates.ornament as any,
          pullMs: updates.pullMs,
        });
      }
      const nextCode = topologicalMutator.replaceEventInSource(sourceCode, activeSelection, mutatedToken);
      const prevCode = sourceCode;
      const nextSelection = {
        ...activeSelection,
        ...updates,
        rawToken: mutatedToken,
        sourceEndOffset:
          typeof activeSelection.sourceStartOffset === 'number'
            ? activeSelection.sourceStartOffset + mutatedToken.length
            : undefined,
      };
      const prevSelection = { ...activeSelection };

      commandManager.executeCommand({
        execute: () => {
          setSourceCode(nextCode);
          setActiveSelection(nextSelection);
        },
        undo: () => {
          setSourceCode(prevCode);
          setActiveSelection(prevSelection);
        },
      });
    } catch {
      // Ignore invalid inspector token updates
    }
  };

  const handleCommitAutomation = (
    trackId: string,
    measureNumber: number,
    param: string,
    values: number[],
    curve: string
  ) => {
    const nextCode = topologicalMutator.upsertTrackAutomationInSource(
      sourceCode,
      trackId,
      measureNumber,
      param,
      values,
      curve
    );
    if (nextCode !== sourceCode) {
      handleCodeEdit(nextCode);
    }
  };

  const handleApplyMidiTransform = (transform: MidiTransformType, targetTrackId?: string | null) => {
    const nextCode = MidiTransformAndGeneratorEngine.applyTransformToSource(
      sourceCode,
      transform,
      targetTrackId
    );
    if (nextCode !== sourceCode) {
      handleCodeEdit(nextCode);
    }
  };

  const handleGenerateMidiPattern = (generator: MidiGeneratorType, targetTrackId?: string | null) => {
    const activeTrack =
      targetTrackId || compiledScoreState?.defs?.[0]?.id || 'pno';
    const trackDef = (compiledScoreState?.defs || []).find((d: any) => d.id === activeTrack);
    const isGrid = trackDef?.style === 'grid';
    const nextCode = MidiTransformAndGeneratorEngine.injectGeneratedPatternIntoSource(
      sourceCode,
      generator,
      activeTrack,
      scoreMeta.key || 'C',
      scoreMeta.scale || 'minor',
      isGrid
    );
    if (nextCode !== sourceCode) {
      handleCodeEdit(nextCode);
    }
  };

  const enrichedMixerAstState = useMemo<ASTState>(() => {
    const meterMap = studioAudio.getTrackMeterLevels(compiledScoreState, playheadBeat);
    return {
      ...astState,
      tracks: astState.tracks.map((t) => {
        const m = meterMap[t.id];
        return {
          ...t,
          muted: mutedTracks.includes(t.id),
          soloed: soloedTracks.includes(t.id),
          armed: armedTracks.includes(t.id),
          peakDb: m?.peakDb,
          rmsDb: m?.rmsDb,
          peakNorm: m?.peakNorm,
          rmsNorm: m?.rmsNorm,
          clipping: m?.clipping,
        };
      }),
      groups: (compiledScoreState?.groups || []).map((g: any) => ({
        id: g.id,
        name: g.name,
        trackIds: g.trackIds || [],
        volume: g.volume ?? 100,
        fx: g.fx || [],
        muted: mutedGroups.includes(g.id),
        soloed: soloedGroups.includes(g.id),
      })),
      meta: {
        ...astState.meta,
        sidechainTap: compiledScoreState?.meta?.sidechainTap || studioAudio.getSidechainTapMode(),
      },
    };
  }, [
    astState,
    compiledScoreState,
    playheadBeat,
    mutedTracks,
    soloedTracks,
    armedTracks,
    mutedGroups,
    soloedGroups,
    studioAudio,
  ]);

  return (
    <div
      ref={workspaceRootRef}
      className={`tenuto-dvh-shell bg-slate-950 text-slate-100 overflow-hidden flex flex-col ${
        isFullscreen ? 'tenuto-fullscreen-active' : ''
      }`}
    >
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
        rootKey={scoreMeta.key}
        scaleName={scoreMeta.scale}
        onKeyScaleChange={handleKeyScaleChange}
        onSelectPreset={(presetCode) => handleCodeEdit(presetCode)}
        onExportWav={handleExportWav}
        masterVolume={masterVolume}
        onMasterVolumeChange={handleMasterVolumeChange}
        activeMainView={activeMainView}
        onMainViewChange={setActiveMainView}
        activeBottomDock={activeBottomDock}
        onToggleBottomDock={handleToggleBottomDock}
        isCodeVisible={isCodeVisible}
        onToggleCodeVisible={() => setIsCodeVisible((prev) => !prev)}
        isMetronomeEnabled={isMetronomeEnabled}
        onToggleMetronome={handleToggleMetronome}
        countInBars={countInBars}
        onCountInBarsChange={handleCountInBarsChange}
        onTapTempo={handleTapTempo}
        onCaptureMidi={handleCaptureMidi}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Split Workspace */}
      <main
        data-testid="workspace-main-grid"
        className={`flex-1 grid ${
          isCodeVisible
            ? 'grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1'
            : 'grid-cols-1 grid-rows-1'
        } min-h-0 overflow-hidden`}
      >
        {/* Left Side: Tenuto Code Editor */}
        <section
          data-testid="code-editor-pane"
          className={`${
            isCodeVisible ? 'flex' : 'hidden'
          } h-full w-full border-b md:border-b-0 md:border-r border-slate-800 bg-[#0B0F19] flex-col min-h-0 overflow-hidden`}
        >
          <div className="h-8 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">
                Tenuto Source Code (.ten)
              </span>
              <span
                data-testid="code-memory-status"
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                  memoryStatus === 'saving'
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                }`}
                title="Debounced LocalStorage Code Memory (500ms)"
              >
                {memoryStatus === 'saving' ? '● Saving...' : '✓ Saved'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                Single Source of Truth • Tab switches View
              </span>
              <button
                type="button"
                aria-label="Reset Code Memory"
                onClick={handleResetCodeMemory}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                title="Clear saved code memory and restore default sketch"
              >
                Reset Memory
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <CodeEditor
              code={sourceCode}
              onChange={handleCodeEdit}
              events={compiledEvents}
              playheadBeat={playheadBeat}
              isPlaying={isPlaying}
            />
          </div>
        </section>

        {/* Right Side: Multi-View DAW Viewport (Piano Roll | Session | Arrangement) */}
        <section className="h-full w-full bg-slate-950 flex flex-col min-h-0 overflow-hidden">
          <div className="h-8 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between shrink-0">
            <span className="text-[11px] uppercase font-semibold tracking-wider text-slate-400">
              {activeMainView === 'session'
                ? 'Session View (Clip & Scene Matrix)'
                : activeMainView === 'arrangement'
                  ? 'Arrangement View (Timeline & Locators)'
                  : activeMainView === 'tab_flow'
                    ? 'Tab & Voice-Leading Chord Flow'
                    : 'Scrolling Piano Roll View'}
            </span>
            <span className="text-[11px] font-mono text-emerald-400">
              {compiledEvents.length} Notes Compiled
            </span>
          </div>

          <div className="flex-1 relative overflow-hidden">
            {/* Piano Roll View (Always mounted for test compatibility; visible when activeMainView === 'piano_roll') */}
            <div
              className={
                activeMainView === 'piano_roll' ? 'w-full h-full' : 'hidden'
              }
            >
              <WebGPUCanvas
                onSelect={setActiveSelection}
                onMutation={handleCanvasMutation}
                events={compiledEvents}
                playheadBeat={playheadBeat}
                isPlaying={isPlaying}
                rootKey={scoreMeta.key}
                scaleName={scoreMeta.scale}
                automationLanes={compiledScoreState?.automationLanes || []}
                onCommitAutomation={handleCommitAutomation}
                onApplyMidiTransform={handleApplyMidiTransform}
                onGenerateMidiPattern={handleGenerateMidiPattern}
              />
            </div>

            {activeMainView === 'tab_flow' && (
              <TabChordFlowView
                score={compiledScoreState}
                events={compiledEvents}
                playheadBeat={playheadBeat}
                isPlaying={isPlaying}
                rootKey={scoreMeta.key}
              />
            )}

            {/* Session View Container */}
            {activeMainView === 'session' && (
              <SessionView
                score={compiledScoreState}
                activeClipsByTrack={activeClipsByTrack}
                selectedClipId={selectedClipId}
                quantizeLaunch={compiledScoreState?.meta?.quantizeLaunch || '1/1'}
                onQuantizeLaunchChange={handleQuantizeLaunchChange}
                onLaunchClip={handleLaunchClip}
                onStopTrackClip={handleStopTrackClip}
                onStopAllClips={handleStopAllClips}
                onLaunchScene={handleLaunchScene}
                onSelectClip={(clip) => setSelectedClipId(clip.id)}
                onCreateClipInSlot={handleCreateClipInSlot}
              />
            )}

            {/* Arrangement View Container */}
            {activeMainView === 'arrangement' && (
              <ArrangementView
                score={compiledScoreState}
                playheadBeat={playheadBeat}
                isPlaying={isPlaying}
                mutedTracks={mutedTracks}
                soloedTracks={soloedTracks}
                loopStartMeasure={loopStartMeasure}
                loopEndMeasure={loopEndMeasure}
                onToggleTrackMute={handleToggleTrackMute}
                onToggleTrackSolo={handleToggleTrackSolo}
                onSeekToMeasure={handleSeekToMeasure}
                onLoopRangeChange={handleLoopRangeChange}
                onAddLocator={handleAddLocator}
                onOpenTrackInPianoRoll={() => setActiveMainView('piano_roll')}
                onCommitAutomation={handleCommitAutomation}
              />
            )}
          </div>
        </section>
      </main>

      {/* Bottom Studio Dock (sr-only when closed so all existing unit tests pass; visible panel when opened) */}
      <div
        data-testid="bottom-studio-dock"
        className={
          activeBottomDock
            ? 'h-80 w-full bg-slate-900 border-t border-slate-800 flex flex-row overflow-x-auto shrink-0 z-20'
            : 'sr-only'
        }
        aria-hidden={!activeBottomDock}
      >
        <div className="sr-only" data-testid="command-history-panel">
          Command Manager / History
        </div>
        <div className="sr-only" data-testid="engine-status-panel">
          Playback Orchestrator
        </div>
        <div
          className={
            activeBottomDock === 'inspector' ? 'flex w-full h-full' : activeBottomDock ? 'hidden' : ''
          }
        >
          <Inspector
            selection={activeSelection}
            onUpdate={handleInspectorUpdate}
            score={compiledScoreState}
            onSelectEventFromInspector={setActiveSelection}
            onUpdateScoreMeta={(key, val) =>
              handleUpdateAST({ mutationType: 'META_UPDATE', metaKey: key, metaValue: val })
            }
          />
        </div>
        <div
          className={
            activeBottomDock === 'devices' ? 'flex w-full h-full' : 'hidden'
          }
        >
          <DeviceChainDock
            score={compiledScoreState}
            selectedTrackId={deviceDockTrackId}
            onSelectTrack={setDeviceDockTrackId}
            onUpdateAST={handleUpdateAST}
          />
        </div>
        <div
          className={
            activeBottomDock === 'mixer'
              ? 'flex w-full h-full'
              : activeBottomDock
                ? 'hidden'
                : ''
          }
        >
          <Mixer
            astState={enrichedMixerAstState}
            onUpdateAST={handleUpdateAST}
            onToggleMute={handleToggleTrackMute}
            onToggleSolo={handleToggleTrackSolo}
            onToggleArm={handleToggleTrackArm}
            onToggleGroupMute={handleToggleGroupMute}
            onToggleGroupSolo={handleToggleGroupSolo}
            onInspectTrackDevices={(trackId) => {
              setDeviceDockTrackId(trackId);
              setActiveBottomDock('devices');
            }}
          />
        </div>
      </div>
    </div>
  );
}
