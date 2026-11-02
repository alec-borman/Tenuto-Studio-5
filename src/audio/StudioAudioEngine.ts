import { CompiledScore, TrackDefinition, ClipDefinition } from '../parser/DocumentParser';
import { AtomicEvent } from '../parser/ASTSerializer';
import {
  SoundfontBankLoader,
  resolveSoundfontInstrument,
  isSustainingOrchestralInstrument,
  isEnsembleSectionTrack,
} from './SoundfontLibrary';
import {
  AutomationLane,
  compileAutomationLanes,
  evaluateAutomationLaneAt,
  ccOrValueToCutoffHz,
  ccOrValueToPan,
  ccOrValueToVolumeScalar,
} from './AutomationEngine';
import { GrooveEngine } from './GrooveEngine';
import { PhonemeEngine } from './PhonemeEngine';
import { FollowActionEngine } from './FollowActionEngine';
import { MetronomeAndCaptureEngine } from './MetronomeAndCaptureEngine';
import { SpatialAudioMatrix, SendTapMode } from './SpatialAudioMatrix';
import { WavetableEngine } from './synths/WavetableEngine';
import { AbletonSynthSuite } from './synths/AbletonSynthSuite';
import { SamplerAndDrumRackEngine } from './synths/SamplerAndDrumRackEngine';
import { ContinuousSynthEngine } from './synths/ContinuousSynthEngine';
import { renderContinuousVoicePcm } from './synths/renderContinuousVoicePcm';
import { AbletonAudioFxEngine } from './fx/AbletonAudioFxEngine';
import { VoiceBakePool } from './VoiceBakePool';
import { VoicePcmRingBuffer } from './AudioRingBuffer';
import { playbackDiag } from './PlaybackDiagnostics';
import { estimateRefreshRateFromDeltas } from '../utils/useDisplayRefreshRate';

export interface PlaybackProgress {
  isPlaying: boolean;
  currentQuarterBeat: number;
  totalQuarterBeats: number;
  currentTimeSec: number;
  totalDurationSec: number;
  currentTempoBpm?: number;
  currentRefreshRateHz?: number;
}

interface ScheduledNoteEvent {
  event: AtomicEvent;
  def?: TrackDefinition;
  startSec: number;
  durSec: number;
  freq: number;
  midi: number;
  gridKey?: string;
  style: string;
  patch: string;
  sfInstrument?: string | null;
  amp: number;
  startAmp: number;
  endAmp: number;
  swell?: 'crescendo' | 'diminuendo';
  pan: number;
  isPhraseContinuation?: boolean;
  hasNextConnectedNote?: boolean;
  noteIndexInTrack?: number;
  isEnsembleSection?: boolean;
  normalizedVelocity?: number;
  cutoffHzOverride?: number;
  reverbSendGain?: number;
  chordVoices?: Array<{
    freq: number;
    midi: number;
    amp: number;
    mpeBend?: number[];
  }>;
  prebakedBuffer?: AudioBuffer;
  pcmStats?: { peak: number; rms: number; nanCount: number };
  cacheKey?: string;
  isBaked?: boolean;
  voiceSeed?: number;
}

interface ActiveVoiceCleanup {
  fadeOutAndStop: (now: number) => void;
  stopAndDisconnect: () => void;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterDcFilter: BiquadFilterNode | null = null;
  private dryBus: GainNode | null = null;
  private drumBus: GainNode | null = null;
  private reverbSendBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private dryAnalyser: AnalyserNode | null = null;
  private drumAnalyser: AnalyserNode | null = null;
  private analyserScratch: Float32Array = new Float32Array(256);
  private activeVoices: Set<ActiveVoiceCleanup> = new Set();
  private activeVoiceMeta: Map<ActiveVoiceCleanup, { startTime: number; endTime: number }> =
    new Map();
  private activeChokeGroups: Map<string, ActiveVoiceCleanup> = new Map();
  private rafId: number | null = null;
  private schedulerIntervalId: number | null = null;
  private startContextTime: number = 0;
  private scoreDurationSec: number = 0;
  private totalQuarterBeats: number = 4;
  private tempoBpm: number = 120;
  private isPlaying: boolean = false;
  private isLooping: boolean = false;
  private trackVolumes: Map<string, number> = new Map();
  private mutedTracks: Set<string> = new Set();
  private soloedTracks: Set<string> = new Set();
  private trackPans: Map<string, number> = new Map();
  private armedTracks: Set<string> = new Set();
  private groupVolumes: Map<string, number> = new Map();
  private mutedGroups: Set<string> = new Set();
  private soloedGroups: Set<string> = new Set();
  private sidechainTapMode: 'pre_fx' | 'post_fx' | 'post_mixer' = 'post_fx';
  private polyphonyScalar: number = 1.0;
  private masterVolumeScalar: number = 0.8;

  private scheduledTimeline: ScheduledNoteEvent[] = [];
  private prebakedScoreSignature: string | null = null;
  private cachedMasterMixBuffer: AudioBuffer | null = null;
  private cachedMasterMixSignature: string | null = null;
  private nextScheduleIndex: number = 0;
  private activeClipIdsByTrack: Map<string, string> = new Map();
  private queuedClipIdsByTrack: Map<string, string> = new Map();
  private loopStartMeasure: number | null = null;
  private loopEndMeasure: number | null = null;
  private isMetronomeEnabled: boolean = false;
  private countInBars: number = 0;
  private trackSends: Map<string, Map<string, { level: number; mode: SendTapMode }>> = new Map();
  /** Off-main-thread synth renderer. `undefined` = not created yet, `null` = unavailable (falls back to main thread). */
  private bakePool: VoiceBakePool | null | undefined = undefined;
  private pendingBakes: Set<ScheduledNoteEvent> = new Set();
  private pendingBakeKeys: Map<string, Promise<void>> = new Map();
  private voicesAwaitingBake: Set<ScheduledNoteEvent> = new Set();
  private drumBufferCache: Map<string, AudioBuffer> = new Map();
  public readonly voiceRingBuffer = new VoicePcmRingBuffer(512, 48000 * 600);
  private static readonly MAX_BAKES_IN_FLIGHT = 48;

  public routingMatrix = new SpatialAudioMatrix();
  public soundfontLoader = new SoundfontBankLoader();
  public onProgress?: (progress: PlaybackProgress) => void;
  public onClipFollowTransition?: (trackId: string, nextClip: ClipDefinition | null) => void;

  public setMasterVolume(scalar: number): void {
    this.masterVolumeScalar = Math.max(0, Math.min(2.5, scalar));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(0.48 * this.masterVolumeScalar, this.ctx.currentTime || 0);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolumeScalar;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || (this.ctx.state as string) === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.rebuildMasterChain(this.ctx);
    } else if (!this.masterGain || !this.dryBus || !this.drumBus) {
      this.rebuildMasterChain(this.ctx);
    } else {
      this.masterGain.gain.setValueAtTime(
        0.48 * this.masterVolumeScalar,
        this.ctx.currentTime || 0
      );
    }
    return this.ctx;
  }

  /**
   * Synchronously creates and unlocks the WebAudio `AudioContext` inside the immediate
   * DOM click/keydown user-gesture stack frame before any `await` boundary can expire
   * Chrome/Safari/Electron user-activation permissions.
   */
  public unlockAudioContext(): AudioContext | null {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
        const resumePromise = ctx.resume();
        if (resumePromise && typeof resumePromise.catch === 'function') {
          resumePromise.catch(() => {});
        }
      }
      if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
        const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
        const silentSrc = ctx.createBufferSource();
        silentSrc.buffer = silentBuf;
        silentSrc.connect(ctx.destination);
        silentSrc.start(0);
      }
      return ctx;
    } catch {
      return null;
    }
  }

  /**
   * Builds a strictly feed-forward master bus DAG:
   *   Voices -> dryBus  ----(dry)----> masterGain -> compressor -> destination
   *                \---(send)---> reverbSendBus -> reverbNode -> reverbWetGain -^
   *   Drums  -> drumBus ---(dry)----> masterGain
   *                \---(room)---> reverbSendBus
   * Because masterGain and reverbWetGain NEVER connect back to dryBus or drumBus,
   * positive feedback loops are structurally impossible.
   */
  private rebuildMasterChain(ctx: AudioContext): void {
    try {
      this.dryBus?.disconnect();
      this.drumBus?.disconnect();
      this.reverbSendBus?.disconnect();
      this.reverbNode?.disconnect();
      this.reverbWetGain?.disconnect();
      this.masterGain?.disconnect();
      this.masterDcFilter?.disconnect();
      this.compressorNode?.disconnect();
      this.masterAnalyser?.disconnect();
      this.dryAnalyser?.disconnect();
      this.drumAnalyser?.disconnect();
    } catch {
      // Ignore disconnect errors on old nodes
    }

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.48 * this.masterVolumeScalar;

    let masterOutputNode: AudioNode = this.masterGain;
    if (typeof ctx.createBiquadFilter === 'function') {
      const dcFilter = ctx.createBiquadFilter();
      dcFilter.type = 'highpass';
      const now = ctx.currentTime || 0;
      dcFilter.frequency?.setValueAtTime?.(22, now);
      dcFilter.Q?.setValueAtTime?.(0.707, now);
      this.masterGain.connect(dcFilter);
      masterOutputNode = dcFilter;
      this.masterDcFilter = dcFilter;
    } else {
      this.masterDcFilter = null;
    }

    if (typeof (ctx as unknown as { createDynamicsCompressor?: unknown }).createDynamicsCompressor === 'function') {
      const comp = ctx.createDynamicsCompressor();
      const now = ctx.currentTime || 0;
      comp.threshold?.setValueAtTime?.(-2.4, now);
      comp.knee?.setValueAtTime?.(6, now);
      comp.ratio?.setValueAtTime?.(12.0, now);
      comp.attack?.setValueAtTime?.(0.002, now);
      comp.release?.setValueAtTime?.(0.18, now);
      comp.connect(ctx.destination);
      masterOutputNode.connect(comp);
      this.compressorNode = comp;
    } else {
      masterOutputNode.connect(ctx.destination);
      this.compressorNode = null;
    }

    this.dryBus = ctx.createGain();
    this.dryBus.gain.value = 1.0;
    this.dryBus.connect(this.masterGain);

    this.drumBus = ctx.createGain();
    this.drumBus.gain.value = 1.0;
    this.drumBus.connect(this.masterGain);

    // Attach lightweight real-time AnalyserNode taps so F12 logs show live hardware dBFS/Peak/RMS
    if (typeof (ctx as unknown as { createAnalyser?: unknown }).createAnalyser === 'function') {
      try {
        this.masterAnalyser = ctx.createAnalyser();
        this.masterAnalyser.fftSize = 256;
        (this.compressorNode ?? this.masterGain).connect(this.masterAnalyser);

        this.dryAnalyser = ctx.createAnalyser();
        this.dryAnalyser.fftSize = 256;
        this.dryBus.connect(this.dryAnalyser);

        this.drumAnalyser = ctx.createAnalyser();
        this.drumAnalyser.fftSize = 256;
        this.drumBus.connect(this.drumAnalyser);
      } catch {
        this.masterAnalyser = null;
        this.dryAnalyser = null;
        this.drumAnalyser = null;
      }
    } else {
      this.masterAnalyser = null;
      this.dryAnalyser = null;
      this.drumAnalyser = null;
    }

    this.reverbSendBus = ctx.createGain();
    this.reverbSendBus.gain.value = 0.14;

    if (typeof (ctx as unknown as { createConvolver?: unknown }).createConvolver === 'function') {
      this.reverbNode = this.createImpulseReverb(ctx, 0.95, 3.2);
      this.reverbWetGain = ctx.createGain();
      this.reverbWetGain.gain.value = 0.18;

      this.dryBus.connect(this.reverbSendBus);
      const drumRoom = ctx.createGain();
      drumRoom.gain.value = 0.08;
      this.drumBus.connect(drumRoom);
      drumRoom.connect(this.reverbSendBus);

      this.reverbSendBus.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbWetGain);
      this.reverbWetGain.connect(this.masterGain);
    } else {
      this.reverbNode = null;
      this.reverbWetGain = null;
    }
  }

  private readAnalyserStats(analyser: AnalyserNode | null): {
    peak: number;
    rms: number;
    nanCount: number;
  } {
    if (!analyser || typeof analyser.getFloatTimeDomainData !== 'function') {
      return { peak: 0, rms: 0, nanCount: 0 };
    }
    try {
      const bins = analyser.fftSize || 256;
      if (this.analyserScratch.length < bins) {
        this.analyserScratch = new Float32Array(bins);
      }
      analyser.getFloatTimeDomainData(this.analyserScratch);
      let peak = 0;
      let sumSq = 0;
      let nanCount = 0;
      for (let i = 0; i < bins; i++) {
        const v = this.analyserScratch[i];
        if (!Number.isFinite(v)) {
          nanCount++;
          continue;
        }
        const a = v < 0 ? -v : v;
        if (a > peak) peak = a;
        sumSq += v * v;
      }
      return {
        peak,
        rms: Math.sqrt(sumSq / bins),
        nanCount,
      };
    } catch {
      return { peak: 0, rms: 0, nanCount: 0 };
    }
  }

  private sampleHardwareSignalTelemetry(
    nowCtxSec: number,
    playheadSec: number,
    measure: number,
    beat: number
  ): void {
    if (!this.masterAnalyser) return;
    const master = this.readAnalyserStats(this.masterAnalyser);
    const dry = this.readAnalyserStats(this.dryAnalyser);
    const drum = this.readAnalyserStats(this.drumAnalyser);
    const compRed =
      this.compressorNode && typeof this.compressorNode.reduction === 'number'
        ? this.compressorNode.reduction
        : 0;

    // Count how many scheduled voices are actively sounding right now (startTime <= nowCtxSec <= endTime - 0.15)
    let audibleVoices = 0;
    for (const meta of this.activeVoiceMeta.values()) {
      if (meta.startTime <= nowCtxSec + 0.01 && meta.endTime - 0.25 >= nowCtxSec) {
        audibleVoices++;
      }
    }

    const masterDb =
      master.peak <= 0.000001 ? -120 : Math.round(20 * Math.log10(master.peak) * 10) / 10;

    playbackDiag.recordSignalSample({
      playheadSec,
      measure,
      beat,
      masterPeak: master.peak,
      masterRms: master.rms,
      masterDb,
      dryPeak: dry.peak,
      dryRms: dry.rms,
      drumPeak: drum.peak,
      compReductionDb: compRed,
      nanSamples: master.nanCount + dry.nanCount + drum.nanCount,
      activeVoices: this.activeVoices.size,
      audibleVoices,
    });
  }

  /**
   * Generates a warm, wood-paneled Concertgebouw Hall stereo impulse response:
   * - Discrete lateral early reflections at 19ms, 34ms, 53ms, and 79ms
   * - Exponentially damped 2.1s diffuse tail filtered through a warm 2.4kHz low-pass filter
   *   so strings, brass, and woodwinds blend into a lush acoustic room with zero metallic fizz.
   */
  private createImpulseReverb(ctx: BaseAudioContext, seconds: number = 2.1, decay: number = 3.4): ConvolverNode {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate || 44100;
    const length = Math.floor(rate * seconds);
    const impulse = ctx.createBuffer(2, length, rate);

    const earlyReflections = [
      { delaySec: 0.019, gainL: 0.24, gainR: 0.16 },
      { delaySec: 0.034, gainL: 0.15, gainR: 0.22 },
      { delaySec: 0.053, gainL: 0.18, gainR: 0.14 },
      { delaySec: 0.079, gainL: 0.12, gainR: 0.16 },
    ];

    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      let lp1 = 0;
      let lp2 = 0;
      const preDelaySamples = Math.floor(0.015 * rate);

      for (let i = preDelaySamples; i < length; i++) {
        const progress = (i - preDelaySamples) / Math.max(1, length - preDelaySamples);
        const rawNoise = Math.random() * 2 - 1;
        // Progressive air-absorption low-pass filter: darker as tail decays
        const cutoffAlpha = Math.max(0.06, 0.28 * (1 - 0.65 * progress));
        lp1 += cutoffAlpha * (rawNoise - lp1);
        lp2 += cutoffAlpha * (lp1 - lp2);
        data[i] = lp2 * Math.pow(1 - progress, decay) * 0.26;
      }

      for (const er of earlyReflections) {
        const idx = Math.floor(er.delaySec * rate);
        if (idx < length) {
          data[idx] += ch === 0 ? er.gainL : er.gainR;
        }
      }
    }

    convolver.buffer = impulse;
    return convolver;
  }

  public setTrackVolume(trackId: string, volumeMidi: number): void {
    this.trackVolumes.set(trackId, Math.max(0, Math.min(127, volumeMidi)));
  }

  public setTrackPan(trackId: string, panValue: number): void {
    this.trackPans.set(trackId, Math.max(-1, Math.min(1, panValue)));
  }

  public getTrackPan(trackId: string): number {
    return this.trackPans.get(trackId) ?? 0;
  }

  public toggleTrackArm(trackId: string): boolean {
    if (this.armedTracks.has(trackId)) {
      this.armedTracks.delete(trackId);
      return false;
    }
    this.armedTracks.add(trackId);
    return true;
  }

  public getArmedTracks(): string[] {
    return Array.from(this.armedTracks);
  }

  public setGroupVolume(groupId: string, volumeMidi: number): void {
    this.groupVolumes.set(groupId, Math.max(0, Math.min(127, volumeMidi)));
  }

  public getGroupVolume(groupId: string): number {
    return this.groupVolumes.get(groupId) ?? 100;
  }

  public toggleGroupMute(groupId: string): boolean {
    if (this.mutedGroups.has(groupId)) {
      this.mutedGroups.delete(groupId);
      return false;
    }
    this.mutedGroups.add(groupId);
    return true;
  }

  public toggleGroupSolo(groupId: string): boolean {
    if (this.soloedGroups.has(groupId)) {
      this.soloedGroups.delete(groupId);
      return false;
    }
    this.soloedGroups.add(groupId);
    return true;
  }

  public getMutedGroups(): string[] {
    return Array.from(this.mutedGroups);
  }

  public getSoloedGroups(): string[] {
    return Array.from(this.soloedGroups);
  }

  public setSidechainTapMode(mode: 'pre_fx' | 'post_fx' | 'post_mixer'): void {
    this.sidechainTapMode = mode;
  }

  public getSidechainTapMode(): 'pre_fx' | 'post_fx' | 'post_mixer' {
    return this.sidechainTapMode;
  }

  /**
   * Computes the sidechain ducking gain scalar (in [0.22, 1.0]) at `noteStartSec`
   * when a sidechain trigger transient fires near `noteStartSec`:
   * - `'pre_fx'`: Fixed raw trigger velocity (ignores source track fader and mute)
   * - `'post_fx'`: Scaled by source event velocity & FX drive (ignores source track fader)
   * - `'post_mixer'`: Scaled by source track fader volume (and disabled if source track is muted)
   */
  public computeSidechainDuckScalar(
    noteStartSec: number,
    triggerEvents: Array<{ timeSec: number; velocity: number; sourceTrackVol: number; sourceMuted: boolean }>,
    tapMode: 'pre_fx' | 'post_fx' | 'post_mixer' = this.sidechainTapMode
  ): number {
    if (triggerEvents.length === 0) return 1.0;

    let maxDuckDepth = 0;
    for (const trig of triggerEvents) {
      const dt = noteStartSec - trig.timeSec;
      if (dt >= -0.01 && dt <= 0.24) {
        if (tapMode === 'post_mixer' && trig.sourceMuted) continue;

        let triggerStrength = Math.max(0.2, Math.min(1.0, trig.velocity / 127));
        if (tapMode === 'pre_fx') {
          triggerStrength = Math.max(0.65, triggerStrength);
        } else if (tapMode === 'post_mixer') {
          triggerStrength *= Math.max(0, Math.min(1.27, trig.sourceTrackVol / 100));
        }

        // Fast attack (0..15ms) and exponential release (15..240ms)
        const envelope = dt <= 0.015 ? 1.0 : Math.exp(-(dt - 0.015) / 0.11);
        const depth = 0.68 * triggerStrength * envelope;
        if (depth > maxDuckDepth) {
          maxDuckDepth = depth;
        }
      }
    }

    return Math.max(0.22, 1.0 - maxDuckDepth);
  }

  public setTrackSend(
    trackId: string,
    returnBusId: string,
    level: number,
    mode: SendTapMode = 'post'
  ): void {
    this.routingMatrix.registerTrackSend(trackId, returnBusId, level, mode);
    let map = this.trackSends.get(trackId);
    if (!map) {
      map = new Map();
      this.trackSends.set(trackId, map);
    }
    map.set(returnBusId, { level: Math.max(0, Math.min(1, level)), mode });
  }

  public getTrackSend(
    trackId: string,
    returnBusId: string
  ): { level: number; mode: SendTapMode } | undefined {
    return this.trackSends.get(trackId)?.get(returnBusId);
  }

  /**
   * Computes deterministic Peak and RMS meter levels (in dBFS, -60 to +6 dB) and normalized
   * meter fill (0..1) for each track at `currentQuarterBeat`.
   */
  public getTrackMeterLevels(
    score: CompiledScore | null,
    currentQuarterBeat: number = 0
  ): Record<string, { peakDb: number; rmsDb: number; peakNorm: number; rmsNorm: number; clipping: boolean }> {
    const levels: Record<
      string,
      { peakDb: number; rmsDb: number; peakNorm: number; rmsNorm: number; clipping: boolean }
    > = {};
    if (!score) return levels;

    const currentWhole = Math.max(0, currentQuarterBeat / 4);

    // Single pass over score.events instead of O(defs * events) nested loops
    const activeEnergyByTrack = new Map<string, number>();
    for (const ev of score.events) {
      if (!ev || ev.pitch?.isRest || ev.pitch?.isSpacer) continue;
      const st = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const dur = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (currentWhole >= st - 0.02 && currentWhole <= st + dur + 0.08) {
        const vel = (ev.physics?.velocity ?? 90) / 127;
        const progress = Math.max(0, Math.min(1, (currentWhole - st) / Math.max(0.05, dur)));
        const decay = Math.exp(-progress * 1.4);
        const tId = ev.trackId || 'pno';
        activeEnergyByTrack.set(tId, (activeEnergyByTrack.get(tId) || 0) + vel * decay);
      }
    }

    for (const def of score.defs) {
      const isMuted =
        this.mutedTracks.has(def.id) ||
        (this.soloedTracks.size > 0 && !this.soloedTracks.has(def.id));

      if (isMuted) {
        levels[def.id] = { peakDb: -60, rmsDb: -60, peakNorm: 0, rmsNorm: 0, clipping: false };
        continue;
      }

      const volMidi = this.trackVolumes.get(def.id) ?? def.volume ?? 100;
      const faderScalar = (volMidi / 100) * this.masterVolumeScalar;
      const activeEnergy = activeEnergyByTrack.get(def.id) || 0;

      if (!this.isPlaying && activeEnergy === 0) {
        // Static preview level based on track fader volume when idle
        const idleNorm = Math.max(0, Math.min(1, (volMidi / 127) * 0.65));
        const idleDb = idleNorm > 0.01 ? Math.max(-48, Math.round(20 * Math.log10(idleNorm))) : -60;
        levels[def.id] = {
          peakDb: idleDb,
          rmsDb: Math.max(-60, idleDb - 4),
          peakNorm: idleNorm,
          rmsNorm: idleNorm * 0.78,
          clipping: idleDb > 0,
        };
        continue;
      }

      const peakLinear = Math.min(1.4, activeEnergy * faderScalar);
      const rmsLinear = peakLinear * 0.72;
      const peakDb =
        peakLinear > 0.001 ? Math.max(-60, Math.min(6, Number((20 * Math.log10(peakLinear)).toFixed(1)))) : -60;
      const rmsDb =
        rmsLinear > 0.001 ? Math.max(-60, Math.min(6, Number((20 * Math.log10(rmsLinear)).toFixed(1)))) : -60;
      const peakNorm = Math.max(0, Math.min(1, (peakDb + 60) / 66));
      const rmsNorm = Math.max(0, Math.min(1, (rmsDb + 60) / 66));

      levels[def.id] = {
        peakDb,
        rmsDb,
        peakNorm,
        rmsNorm,
        clipping: peakDb > 0.0,
      };
    }

    return levels;
  }

  public setLoop(loop: boolean): void {
    this.isLooping = loop;
  }

  public setMetronomeEnabled(enabled: boolean): void {
    this.isMetronomeEnabled = Boolean(enabled);
  }

  public getMetronomeEnabled(): boolean {
    return this.isMetronomeEnabled;
  }

  public setCountInBars(bars: number): void {
    this.countInBars = Math.max(0, Math.min(8, Math.round(bars)));
  }

  public getCountInBars(): number {
    return this.countInBars;
  }

  private scheduleMetronomeClick(
    ctx: BaseAudioContext,
    startSec: number,
    frequencyHz: number,
    isDownbeat: boolean
  ): void {
    if (!this.masterGain) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isDownbeat ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(frequencyHz, startSec);
    osc.frequency.exponentialRampToValueAtTime(frequencyHz * 0.65, startSec + 0.032);

    const peak = isDownbeat ? 0.35 : 0.2;
    gain.gain.setValueAtTime(0.0001, startSec);
    gain.gain.linearRampToValueAtTime(peak, startSec + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.038);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(startSec);
    osc.stop(startSec + 0.045);
  }

  public toggleTrackMute(trackId: string): boolean {
    if (this.mutedTracks.has(trackId)) {
      this.mutedTracks.delete(trackId);
      return false;
    }
    this.mutedTracks.add(trackId);
    return true;
  }

  public toggleTrackSolo(trackId: string): boolean {
    if (this.soloedTracks.has(trackId)) {
      this.soloedTracks.delete(trackId);
      return false;
    }
    this.soloedTracks.add(trackId);
    return true;
  }

  public getMutedTracks(): string[] {
    return Array.from(this.mutedTracks);
  }

  public getSoloedTracks(): string[] {
    return Array.from(this.soloedTracks);
  }

  public setArrangementLoopRange(startMeasure: number | null, endMeasure: number | null): void {
    if (startMeasure !== null && endMeasure !== null && startMeasure >= 1 && endMeasure >= startMeasure) {
      this.loopStartMeasure = Math.round(startMeasure);
      this.loopEndMeasure = Math.round(endMeasure);
    } else {
      this.loopStartMeasure = null;
      this.loopEndMeasure = null;
    }
  }

  public getArrangementLoopRange(): { startMeasure: number | null; endMeasure: number | null } {
    return {
      startMeasure: this.loopStartMeasure,
      endMeasure: this.loopEndMeasure,
    };
  }

  /**
   * Starts or seeks playback from a specific 1-based `measureNumber` (and optionally stops at `endMeasure`).
   */
  public async seekToMeasure(
    score: CompiledScore,
    measureNumber: number,
    endMeasure?: number | null
  ): Promise<void> {
    const startWholeOffset = Math.max(0, measureNumber - 1);
    const maxWholeOffset =
      endMeasure && endMeasure >= measureNumber ? endMeasure : Infinity;

    const shiftedEvents: AtomicEvent[] = [];
    for (const ev of score.events) {
      const st = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      if (st + 1e-6 >= startWholeOffset && st < maxWholeOffset - 1e-6) {
        const shiftedWhole = Math.max(0, st - startWholeOffset);
        shiftedEvents.push({
          ...ev,
          startTime: {
            numerator: Math.round(shiftedWhole * 1920),
            denominator: 1920,
          },
        });
      }
    }

    const subScore: CompiledScore = {
      ...score,
      events: shiftedEvents,
    };
    await this.playScore(subScore);
  }

  public wholeNoteToSeconds(
    wholeNote: number,
    baseTempo: number,
    tempoMap?: Array<{ startWhole: number; tempo: number }>
  ): number {
    if (!Number.isFinite(wholeNote) || wholeNote <= 0) return 0;
    if (!tempoMap || tempoMap.length === 0) {
      return wholeNote * ((60 / baseTempo) * 4);
    }

    let elapsedSec = 0;
    let cursorWhole = 0;
    let currentTempo = baseTempo;

    for (let i = 0; i < tempoMap.length; i++) {
      const entry = tempoMap[i];
      if (entry.startWhole <= cursorWhole) {
        currentTempo = entry.tempo > 0 ? entry.tempo : currentTempo;
        continue;
      }
      if (wholeNote <= entry.startWhole) {
        break;
      }
      const segWhole = entry.startWhole - cursorWhole;
      elapsedSec += segWhole * ((60 / currentTempo) * 4);
      cursorWhole = entry.startWhole;
      currentTempo = entry.tempo > 0 ? entry.tempo : currentTempo;
    }

    if (wholeNote > cursorWhole) {
      elapsedSec += (wholeNote - cursorWhole) * ((60 / currentTempo) * 4);
    }
    return elapsedSec;
  }

  /**
   * Piecewise inverse of `wholeNoteToSeconds`: converts elapsed playback time (`elapsedSec`)
   * back into exact whole-note score position across any number of `meta @{ tempo: ... }` changes.
   */
  public secondsToWholeNote(
    elapsedSec: number,
    baseTempo: number,
    tempoMap?: Array<{ startWhole: number; tempo: number }>
  ): number {
    if (!Number.isFinite(elapsedSec) || elapsedSec <= 0) return 0;
    const safeBaseTempo = baseTempo > 0 ? baseTempo : 120;
    if (!tempoMap || tempoMap.length === 0) {
      return elapsedSec / ((60 / safeBaseTempo) * 4);
    }

    let remainingSec = elapsedSec;
    let cursorWhole = 0;
    let currentTempo = safeBaseTempo;

    for (let i = 0; i < tempoMap.length; i++) {
      const entry = tempoMap[i];
      if (entry.startWhole <= cursorWhole) {
        currentTempo = entry.tempo > 0 ? entry.tempo : currentTempo;
        continue;
      }
      const segWhole = entry.startWhole - cursorWhole;
      const secPerWhole = (60 / currentTempo) * 4;
      const segSec = segWhole * secPerWhole;

      if (remainingSec <= segSec) {
        return cursorWhole + remainingSec / secPerWhole;
      }

      remainingSec -= segSec;
      cursorWhole = entry.startWhole;
      currentTempo = entry.tempo > 0 ? entry.tempo : currentTempo;
    }

    const finalSecPerWhole = (60 / currentTempo) * 4;
    return cursorWhole + remainingSec / finalSecPerWhole;
  }

  /**
   * Returns the active tempo (BPM) at a given whole-note position in the score.
   */
  public getTempoAtWholeNote(
    wholeNote: number,
    baseTempo: number,
    tempoMap?: Array<{ startWhole: number; tempo: number }>
  ): number {
    let activeTempo = baseTempo > 0 ? baseTempo : 120;
    if (!tempoMap || tempoMap.length === 0) return activeTempo;

    for (let i = 0; i < tempoMap.length; i++) {
      const entry = tempoMap[i];
      if (wholeNote + 1e-6 >= entry.startWhole && entry.tempo > 0) {
        activeTempo = entry.tempo;
      } else if (wholeNote + 1e-6 < entry.startWhole) {
        break;
      }
    }
    return activeTempo;
  }

  public calculateScoreDuration(score: CompiledScore): { totalQuarterBeats: number; totalSeconds: number } {
    const tempo = Number(score.meta?.tempo) || 120;
    let maxLogicalWhole = 0;
    let maxPhysicalWhole = 0;

    for (const ev of score.events) {
      const start = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const dur = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (Number.isFinite(start) && Number.isFinite(dur)) {
        if (start + dur > maxLogicalWhole) {
          maxLogicalWhole = start + dur;
        }
        const physicalDur = ev.physics?.fermata ? dur * 1.65 : dur;
        if (start + physicalDur > maxPhysicalWhole) {
          maxPhysicalWhole = start + physicalDur;
        }
      }
    }

    if (maxLogicalWhole <= 0) maxLogicalWhole = 0.25;
    if (maxPhysicalWhole <= 0) maxPhysicalWhole = 0.25;
    return {
      totalQuarterBeats: maxLogicalWhole * 4,
      totalSeconds: this.wholeNoteToSeconds(maxPhysicalWhole, tempo, score.meta?.tempoMap),
    };
  }

  /**
   * Evaluates a note's MPE (MIDI Polyphonic Expression) `bend` (semitones), `slide` (0..127),
   * and `pressure` (0..127) breakpoint arrays at normalized note progress `u` in `[0, 1]`.
   */
  public static evaluateMpeAtNormalizedTime(
    mpe: { bend?: number[]; slide?: number[]; pressure?: number[] } | undefined,
    u: number
  ): { bendSemitones: number; slideNorm: number; pressureScalar: number } {
    if (!mpe) {
      return { bendSemitones: 0, slideNorm: 0.5, pressureScalar: 1.0 };
    }

    const interpArray = (arr: number[] | undefined, fallback: number): number => {
      if (!arr || arr.length === 0) return fallback;
      if (arr.length === 1) return arr[0];
      const clampedU = Math.max(0, Math.min(1, u));
      const scaled = clampedU * (arr.length - 1);
      const idx0 = Math.floor(scaled);
      const idx1 = Math.min(arr.length - 1, idx0 + 1);
      const frac = scaled - idx0;
      return arr[idx0] + (arr[idx1] - arr[idx0]) * frac;
    };

    const bendSemitones = Math.max(-24, Math.min(24, interpArray(mpe.bend, 0)));
    const slideRaw = Math.max(0, Math.min(127, interpArray(mpe.slide, 64)));
    const pressureRaw = Math.max(0, Math.min(127, interpArray(mpe.pressure, 90)));

    return {
      bendSemitones,
      slideNorm: slideRaw / 127,
      pressureScalar: 0.5 + 0.65 * (pressureRaw / 127),
    };
  }

  private buildScheduledTimeline(score: CompiledScore): ScheduledNoteEvent[] {
    const tempo = Number(score.meta?.tempo) || 120;
    const tempoMap = score.meta?.tempoMap;
    const secPerWholeNote = (60 / tempo) * 4;
    const defsById = new Map<string, TrackDefinition>();
    const trackOrderById = new Map<string, number>();
    score.defs.forEach((d, idx) => {
      defsById.set(d.id, d);
      trackOrderById.set(d.id, idx);
    });

    this.routingMatrix.clear();
    for (const d of score.defs) {
      this.routingMatrix.createBus(SpatialAudioMatrix.toBusUri(d.id));
    }
    for (const d of score.defs) {
      if (d.sends) {
        for (const [retId, sendLvl] of Object.entries(d.sends)) {
          try {
            const override = this.trackSends.get(d.id)?.get(retId);
            this.routingMatrix.registerTrackSend(
              d.id,
              retId,
              override ? override.level : sendLvl,
              override ? override.mode : 'post'
            );
          } catch {
            // Ignore circular send route
          }
        }
      }
    }

    const numTracks = Math.max(1, score.defs.length);
    this.polyphonyScalar =
      numTracks >= 10
        ? 0.62
        : numTracks >= 6
          ? 0.7
          : numTracks >= 4
            ? 0.76
            : numTracks >= 2
              ? 0.85
              : 0.95;

    const automationLanes =
      score.automationLanes && score.automationLanes.length > 0
        ? score.automationLanes
        : compileAutomationLanes(score.events);
    const lanesByTrackAndParam = new Map<string, AutomationLane>();
    for (const lane of automationLanes) {
      lanesByTrackAndParam.set(`${lane.trackId}::${lane.param}`, lane);
    }

    const groovesById = new Map<string, any>();
    if (score.grooves) {
      for (const g of score.grooves) {
        groovesById.set(g.id, g);
      }
    }

    const groupsById = new Map<string, any>();
    for (const g of score.groups || []) {
      groupsById.set(g.id, g);
    }
    const activeTapMode =
      (score.meta?.sidechainTap as 'pre_fx' | 'post_fx' | 'post_mixer') || this.sidechainTapMode;

    const sidechainSourceId = score.meta?.sidechain?.toLowerCase();
    const sidechainTriggers: Array<{
      timeSec: number;
      velocity: number;
      sourceTrackVol: number;
      sourceMuted: boolean;
    }> = [];

    if (sidechainSourceId) {
      for (const ev of score.events) {
        if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer) continue;
        const tId = ev.trackId || 'pno';
        const def = defsById.get(tId);
        const matchesSource =
          tId.toLowerCase() === sidechainSourceId ||
          def?.groupId?.toLowerCase() === sidechainSourceId ||
          (sidechainSourceId.includes('drum') && (ev.style === 'grid' || def?.style === 'grid'));
        const isKickOrTrigger =
          ev.style !== 'grid' && def?.style !== 'grid'
            ? true
            : ev.pitch.midi === 36 || ev.pitch.gridKey === 'k' || ev.pitch.gridKey === 'bd';

        if (matchesSource && isKickOrTrigger) {
          const stW = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
          const trigSec = this.wholeNoteToSeconds(stW, tempo, tempoMap);
          const srcVol = this.trackVolumes.get(tId) ?? def?.volume ?? 100;
          const srcMuted =
            this.mutedTracks.has(tId) ||
            (def?.groupId ? this.mutedGroups.has(def.groupId) : false);
          sidechainTriggers.push({
            timeSec: trigSec,
            velocity: ev.physics?.velocity ?? 100,
            sourceTrackVol: srcVol,
            sourceMuted: srcMuted,
          });
        }
      }
    }

    const list: ScheduledNoteEvent[] = [];
    const playableEvents = FollowActionEngine.evaluateNoteProbabilities(score.events);

    for (const ev of playableEvents) {
      if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer) continue;

      const trackId = ev.trackId || 'pno';
      if (this.soloedTracks.size > 0 && !this.soloedTracks.has(trackId)) continue;
      if (this.mutedTracks.has(trackId)) continue;

      const def = defsById.get(trackId);
      const groupId = def?.groupId;
      if (groupId && this.mutedGroups.has(groupId)) continue;
      if (this.soloedGroups.size > 0 && (!groupId || !this.soloedGroups.has(groupId))) continue;

      const style = (ev.style || def?.style || 'standard').toLowerCase();
      const patch = (ev.patch || def?.patch || 'salamander_grand').toLowerCase();

      const trackVolMidi = this.trackVolumes.get(trackId) ?? def?.volume ?? 100;

      const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (!Number.isFinite(startWhole) || !Number.isFinite(durWhole)) continue;

      const isGrace = Boolean(ev.duration?.isGrace);
      const trackIdx = trackOrderById.get(trackId) ?? 0;
      const isGridOrDrum = style === 'grid' || Boolean(ev.pitch.gridKey);
      const seatingOffsetSec = isGridOrDrum ? 0 : (trackIdx % 7) * 0.0014;
      const rawStartSec = this.wholeNoteToSeconds(startWhole, tempo, tempoMap);
      const rawEndSec = this.wholeNoteToSeconds(startWhole + durWhole, tempo, tempoMap);

      const groupDef = groupId ? groupsById.get(groupId) : undefined;
      const groupVolMidi = groupId
        ? (this.groupVolumes.get(groupId) ?? groupDef?.volume ?? 100)
        : 100;
      const groupVolScalar = groupVolMidi / 100;

      const isSidechainSource =
        Boolean(sidechainSourceId) &&
        (trackId.toLowerCase() === sidechainSourceId ||
          groupId?.toLowerCase() === sidechainSourceId ||
          ev.style === 'grid' ||
          def?.style === 'grid');
      const rawDuckScalar =
        !isSidechainSource && sidechainTriggers.length > 0
          ? this.computeSidechainDuckScalar(rawStartSec, sidechainTriggers, activeTapMode)
          : 1.0;
      const noteSpanSec = Math.max(0.05, rawEndSec - rawStartSec);
      // Short notes (<= 0.6s) take the full transient duckScalar; long sustained half/whole notes (> 0.6s)
      // amortize static attenuation so a Beat 1 kick never crushes a 2.5-second hold by 50%.
      const duckScalar =
        noteSpanSec > 0.6
          ? 1.0 - (1.0 - rawDuckScalar) * Math.min(0.28, 0.2 / noteSpanSec)
          : rawDuckScalar;

      const trackGainScalar =
        (trackVolMidi / 100) * groupVolScalar * duckScalar * 0.78 * this.polyphonyScalar;
      let startSec = rawStartSec + seatingOffsetSec;
      if (isGrace) {
        startSec = Math.max(0, startSec - 0.045);
      }
      if (ev.physics?.pullMs) startSec += ev.physics.pullMs / 1000;
      if (ev.physics?.pushMs) startSec = Math.max(0, startSec - ev.physics.pushMs / 1000);

      let durSec = isGrace ? 0.045 : Math.max(0.05, rawEndSec - rawStartSec);
      const isContSynthVoice = ContinuousSynthEngine.isContinuousSynthPatch(
        patch,
        style,
        ev.physics
      );
      if (ev.physics?.pizz) {
        durSec = Math.min(0.16, Math.max(0.045, durSec * 0.35));
      } else if (ev.physics?.articulation === 'stacc' || ev.physics?.articulation === 'staccato') {
        durSec = Math.max(0.045, durSec * 0.48);
      } else if (ev.physics?.legato && !isContSynthVoice) {
        durSec = durSec + Math.min(0.035, durSec * 0.06);
      }

      if (ev.physics?.pedal) {
        durSec = Math.max(durSec * 2.2, Math.min(3.2, secPerWholeNote * 0.75));
      }
      if (ev.physics?.fermata) {
        durSec = durSec * 1.65;
      }

      // Map MIDI velocity (1..127) onto a clean studio dynamic curve (0.18..1.0)
      const velToAudibleCurve = (v: number) => 0.18 + 0.82 * Math.pow(Math.max(1, Math.min(127, v)) / 127, 1.05);

      let vel = ev.physics?.velocity ?? 90;
      if (def?.groove && groovesById.has(def.groove)) {
        const grooved = GrooveEngine.applyGrooveToEvent(
          groovesById.get(def.groove)!,
          startWhole,
          startSec,
          vel,
          tempo,
          list.length
        );
        startSec = grooved.startSec;
        vel = grooved.velocity;
      }

      const normalizedVelocity = Math.max(0.1, Math.min(1.0, vel / 127));
      let swell = ev.physics?.swell;
      const startVel = ev.physics?.startVelocity ?? (swell === 'crescendo' ? 40 : swell === 'diminuendo' ? 116 : vel);
      const endVel = ev.physics?.endVelocity ?? (swell === 'crescendo' ? 120 : swell === 'diminuendo' ? 35 : vel);

      const endWhole = startWhole + durWhole;
      const midWhole = startWhole + durWhole * 0.5;
      const volLane =
        lanesByTrackAndParam.get(`${trackId}::volume`) ||
        lanesByTrackAndParam.get(`${trackId}::expression`);
      const panLane = lanesByTrackAndParam.get(`${trackId}::pan`);
      const cutoffLane = lanesByTrackAndParam.get(`${trackId}::cutoff`);

      let autoStartVolScalar = 1.0;
      let autoEndVolScalar = 1.0;
      if (volLane) {
        const isCcVol = volLane.controller !== undefined;
        const vStart = evaluateAutomationLaneAt(volLane, startWhole);
        const vEnd = evaluateAutomationLaneAt(volLane, endWhole);
        if (vStart !== undefined) autoStartVolScalar = ccOrValueToVolumeScalar(vStart, isCcVol);
        if (vEnd !== undefined) autoEndVolScalar = ccOrValueToVolumeScalar(vEnd, isCcVol);
        if (!swell && Math.abs(autoEndVolScalar - autoStartVolScalar) > 0.08) {
          swell = autoEndVolScalar > autoStartVolScalar ? 'crescendo' : 'diminuendo';
        }
      }

      const avgVolScalar = (autoStartVolScalar + autoEndVolScalar) * 0.5;
      const amp = Math.max(0.05, Math.min(1.4, velToAudibleCurve(vel) * trackGainScalar * avgVolScalar));
      const startAmp = Math.max(0.05, Math.min(1.4, velToAudibleCurve(startVel) * trackGainScalar * autoStartVolScalar));
      const endAmp = Math.max(0.05, Math.min(1.4, velToAudibleCurve(endVel) * trackGainScalar * autoEndVolScalar));

      let autoPanOverride: number | undefined;
      if (panLane) {
        const rawPan = evaluateAutomationLaneAt(panLane, startWhole);
        if (rawPan !== undefined) {
          autoPanOverride = ccOrValueToPan(rawPan, panLane.controller !== undefined);
        }
      }
      const pan = Math.max(
        -1,
        Math.min(1, ev.physics?.pan ?? autoPanOverride ?? this.trackPans.get(trackId) ?? def?.pan ?? 0)
      );

      let cutoffHzOverride: number | undefined;
      if (cutoffLane) {
        const rawCut = evaluateAutomationLaneAt(cutoffLane, midWhole);
        if (rawCut !== undefined) {
          cutoffHzOverride = ccOrValueToCutoffHz(rawCut);
        }
      } else if (ev.physics?.lyric) {
        const phoneme = PhonemeEngine.decomposeLyric(ev.physics.lyric);
        cutoffHzOverride = phoneme.secondaryVowel
          ? Math.round((phoneme.primaryVowel.f2 + phoneme.secondaryVowel.f2) * 0.5)
          : phoneme.primaryVowel.f2;
      }

      const baseFreq =
        Number.isFinite(ev.pitch.frequency) && ev.pitch.frequency >= 20 && ev.pitch.frequency <= 10000
          ? ev.pitch.frequency
          : 440;
      const pitchShiftSt = ev.physics?.pitchShiftSt ?? 0;
      const freq = pitchShiftSt !== 0 ? baseFreq * Math.pow(2, pitchShiftSt / 12) : baseFreq;

      const sfInstrument = resolveSoundfontInstrument(
        trackId,
        def?.name,
        ev.patch || def?.patch,
        style,
        ev.physics?.pizz
      );
      const isEnsembleSection = isEnsembleSectionTrack(trackId, def?.name, sfInstrument);

      let reverbSendGain = 0;
      const trackSendEntries = this.routingMatrix.getTrackSends(trackId);
      for (const sr of trackSendEntries) {
        reverbSendGain = Math.max(
          reverbSendGain,
          SpatialAudioMatrix.computeEffectiveSendGain(sr.level, sr.mode, trackVolMidi, false)
        );
      }

      const activeFxChain = AbletonAudioFxEngine.resolveActiveFxChain(def, ev);
      const fxModulated =
        activeFxChain.length > 0
          ? AbletonAudioFxEngine.computeRealtimeChainModulation(
              activeFxChain,
              {
                amp,
                pan,
                freq,
                cutoffHz: cutoffHzOverride,
                reverbSendGain,
              },
              ev.physics?.lyric
            )
          : {
              amp,
              pan,
              freq,
              cutoffHz: cutoffHzOverride,
              reverbSendGain,
            };

      list.push({
        event: ev,
        def,
        startSec,
        durSec,
        freq: fxModulated.freq,
        midi: ev.pitch.midi || 60,
        gridKey: ev.pitch.gridKey,
        style,
        patch,
        sfInstrument,
        amp: fxModulated.amp,
        startAmp,
        endAmp,
        swell,
        pan: fxModulated.pan,
        isEnsembleSection,
        normalizedVelocity,
        cutoffHzOverride: fxModulated.cutoffHz,
        reverbSendGain: fxModulated.reverbSendGain,
      });
    }

    // 1. Sort by trackId then startSec and coalesce simultaneous ContinuousSynthEngine chord notes FIRST
    // so humanizeTimelinePhrasing never mutates earlier chord members' durations before coalescing.
    list.sort((a, b) => {
      if (a.event.trackId !== b.event.trackId) {
        return (a.event.trackId || '').localeCompare(b.event.trackId || '');
      }
      return a.startSec - b.startSec;
    });

    const coalescedList: ScheduledNoteEvent[] = [];
    for (let i = 0; i < list.length; i++) {
      const curr = list[i];
      const isContSynth = ContinuousSynthEngine.isContinuousSynthPatch(
        curr.patch,
        curr.style,
        curr.event.physics
      );
      if (!isContSynth) {
        coalescedList.push(curr);
        continue;
      }

      const prev = coalescedList[coalescedList.length - 1];
      if (
        prev &&
        prev.event.trackId === curr.event.trackId &&
        Math.abs(prev.startSec - curr.startSec) < 0.006 &&
        Math.abs(prev.durSec - curr.durSec) < 0.025 &&
        ContinuousSynthEngine.isContinuousSynthPatch(prev.patch, prev.style, prev.event.physics)
      ) {
        if (!prev.chordVoices) {
          prev.chordVoices = [
            {
              freq: prev.freq,
              midi: prev.midi,
              amp: prev.amp,
              mpeBend: prev.event.physics?.mpe?.bend,
            },
          ];
        }
        prev.chordVoices.push({
          freq: curr.freq,
          midi: curr.midi,
          amp: curr.amp,
          mpeBend: curr.event.physics?.mpe?.bend,
        });
        continue;
      }

      coalescedList.push(curr);
    }

    // 2. Apply phrase legatos and dynamic arches on the coalesced timeline, then sort chronologically
    this.humanizeTimelinePhrasing(coalescedList);
    coalescedList.sort((a, b) => a.startSec - b.startSec);

    SamplerAndDrumRackEngine.applyDrumRackChokeGroups(coalescedList);
    for (let idx = 0; idx < coalescedList.length; idx++) {
      coalescedList[idx].voiceSeed = idx + 1;
    }
    return coalescedList;
  }

  private getVoiceCacheKey(item: ScheduledNoteEvent, sampleRate: number, tempoBpm: number): string {
    const prefix = `${sampleRate}:${Math.round(tempoBpm * 10)}:`;
    if (item.cacheKey && item.cacheKey.startsWith(prefix)) {
      return item.cacheKey;
    }
    const chordSig =
      item.chordVoices && item.chordVoices.length > 0
        ? item.chordVoices
            .map(
              (v) =>
                `${v.midi}:${Math.round(v.freq * 10)}:${Math.round(v.amp * 20)}:${v.mpeBend ? v.mpeBend.join(',') : ''}`
            )
            .join('|')
        : `${item.midi}:${Math.round(item.freq * 10)}`;
    const macrosSig = item.def?.macros ? JSON.stringify(item.def.macros) : '';
    const fxSig = item.def?.fxChain ? JSON.stringify(item.def.fxChain) : '';
    const physSig = item.event?.physics ? JSON.stringify(item.event.physics) : '';
    const computed = `${prefix}${item.patch}:${item.style}:${chordSig}:${Math.round(item.durSec * 100)}:${Math.round(item.amp * 20)}:${Math.round((item.startAmp ?? item.amp) * 20)}:${Math.round((item.endAmp ?? item.amp) * 20)}:${Math.round(item.pan * 20)}:${item.swell || ''}:${item.cutoffHzOverride ?? ''}:${macrosSig}:${fxSig}:${physSig}`;
    item.cacheKey = computed;
    return computed;
  }

  private storeVoicePcmInCache(
    key: string,
    left: Float32Array,
    right: Float32Array,
    stats?: { peak?: number; rms?: number; nanCount?: number }
  ): void {
    this.voiceRingBuffer.write(key, left, right, stats);
  }

  private createAudioBufferFromPcm(
    ctx: BaseAudioContext,
    left: Float32Array,
    right: Float32Array,
    sampleRate: number
  ): AudioBuffer {
    const buf = ctx.createBuffer(2, left.length, sampleRate);
    buf.getChannelData(0).set(left);
    buf.getChannelData(1).set(right);
    return buf;
  }

  /**
   * Rolling Lookahead JIT Prebaker backed by `VoicePcmRingBuffer`:
   * Pre-renders ContinuousSynthEngine voices within `[fromSec, toSec]` (capped at `maxVoicesToBake`
   * and `timeBudgetMs`) and evicts finished `prebakedBuffer` instances behind the playhead
   * so pressing Play starts immediately and RAM stays strictly bounded across 60+ measure scores.
   */
  public prebakeContinuousSynthTimeline(
    ctx: BaseAudioContext,
    timeline: ScheduledNoteEvent[],
    tempoBpm: number,
    fromSec: number = 0,
    toSec: number = 14.0,
    maxVoicesToBake: number = 24,
    timeBudgetMs: number = Infinity
  ): void {
    if (typeof ctx.createBuffer !== 'function') return;
    const sr = ctx.sampleRate || 44100;
    let bakedCount = 0;
    const budgetStart = typeof performance !== 'undefined' ? performance.now() : 0;

    this.voiceRingBuffer.evictTimelineWindow(
      timeline,
      fromSec,
      0.6,
      Math.max(30.0, toSec - fromSec + 10.0),
      this.isLooping
    );

    for (let idx = 0; idx < timeline.length; idx++) {
      const item = timeline[idx];
      if (item.startSec + item.durSec < fromSec) continue;
      if (item.startSec > toSec) break;
      if (item.prebakedBuffer) continue;
      if (!this.isContinuousSynthItem(item)) {
        continue;
      }

      const cacheKey = this.getVoiceCacheKey(item, sr, tempoBpm);
      const cachedPcm = this.voiceRingBuffer.get(cacheKey);
      if (cachedPcm) {
        item.prebakedBuffer = this.createAudioBufferFromPcm(ctx, cachedPcm.left, cachedPcm.right, sr);
        item.pcmStats = {
          peak: cachedPcm.peak,
          rms: cachedPcm.rms,
          nanCount: cachedPcm.nanCount,
        };
        continue;
      }

      if (
        timeBudgetMs !== Infinity &&
        bakedCount > 0 &&
        typeof performance !== 'undefined' &&
        performance.now() - budgetStart >= timeBudgetMs
      ) {
        break;
      }

      const { left, right, peak, rms, nanCount } = renderContinuousVoicePcm(
        item,
        sr,
        tempoBpm,
        idx + 1
      );
      this.storeVoicePcmInCache(cacheKey, left, right, { peak, rms, nanCount });
      item.prebakedBuffer = this.createAudioBufferFromPcm(ctx, left, right, sr);
      item.pcmStats = { peak, rms, nanCount };
      bakedCount++;
      if (bakedCount >= maxVoicesToBake) break;
      if (
        timeBudgetMs !== Infinity &&
        typeof performance !== 'undefined' &&
        performance.now() - budgetStart >= timeBudgetMs
      ) {
        break;
      }
    }
  }

  private getBakePool(): VoiceBakePool | null {
    if (this.bakePool && this.bakePool.broken) {
      this.bakePool = undefined;
    }
    if (this.bakePool === undefined) {
      this.bakePool = this.soundfontLoader.isTestEnvironment() ? null : VoiceBakePool.create();
    }
    return this.bakePool;
  }

  private isContinuousSynthItem(item: ScheduledNoteEvent): boolean {
    return ContinuousSynthEngine.isContinuousSynthPatch(item.patch, item.style, item.event.physics);
  }

  /**
   * Queues upcoming synth voices in `[fromSec, toSec]` for rendering on the worker pool into
   * `voiceRingBuffer`. First purges any stale queued jobs behind `fromSec` so workers NEVER
   * waste time baking notes that the playhead has already passed.
   */
  private requestWorkerBakes(
    ctx: AudioContext,
    timeline: ScheduledNoteEvent[],
    tempoBpm: number,
    fromSec: number,
    toSec: number
  ): Promise<void>[] {
    const sr = ctx.sampleRate || 44100;
    const pool = this.getBakePool();
    if (pool) {
      pool.cancelStaleJobs(fromSec);
    }
    const queued: Promise<void>[] = [];
    for (let idx = 0; idx < timeline.length; idx++) {
      const item = timeline[idx];
      if (item.startSec + item.durSec < fromSec) continue;
      if (item.startSec > toSec) break;
      if (item.prebakedBuffer || this.pendingBakes.has(item)) continue;
      if (!this.isContinuousSynthItem(item)) continue;

      const cacheKey = this.getVoiceCacheKey(item, sr, tempoBpm);
      const cachedPcm = this.voiceRingBuffer.get(cacheKey);
      if (cachedPcm) {
        item.prebakedBuffer = this.createAudioBufferFromPcm(ctx, cachedPcm.left, cachedPcm.right, sr);
        item.pcmStats = {
          peak: cachedPcm.peak,
          rms: cachedPcm.rms,
          nanCount: cachedPcm.nanCount,
        };
        continue;
      }

      if (!pool) continue;
      const existingKeyPromise = this.pendingBakeKeys.get(cacheKey);
      if (existingKeyPromise) {
        this.pendingBakes.add(item);
        queued.push(
          existingKeyPromise.then(() => {
            this.pendingBakes.delete(item);
            if (!item.prebakedBuffer && this.ctx === ctx && (ctx.state as string) !== 'closed') {
              const pcm = this.voiceRingBuffer.get(cacheKey);
              if (pcm) {
                item.prebakedBuffer = this.createAudioBufferFromPcm(ctx, pcm.left, pcm.right, sr);
                item.pcmStats = {
                  peak: pcm.peak,
                  rms: pcm.rms,
                  nanCount: pcm.nanCount,
                };
              }
            }
            if (this.voicesAwaitingBake.has(item)) {
              this.voicesAwaitingBake.delete(item);
              this.triggerDeferredVoice(item);
            }
          })
        );
        continue;
      }

      if (pool.pendingCount >= StudioAudioEngine.MAX_BAKES_IN_FLIGHT) break;
      const isUrgent = item.startSec <= fromSec + 0.5;
      const seed = item.voiceSeed ?? (idx + 1);
      queued.push(this.bakeItemInWorker(ctx, pool, item, tempoBpm, seed, cacheKey, isUrgent));
    }
    return queued;
  }

  private bakeItemInWorker(
    ctx: AudioContext,
    pool: VoiceBakePool,
    item: ScheduledNoteEvent,
    tempoBpm: number,
    voiceSeed: number,
    cacheKey?: string,
    urgent: boolean = false
  ): Promise<void> {
    const sr = ctx.sampleRate || 44100;
    const key = cacheKey ?? this.getVoiceCacheKey(item, sr, tempoBpm);
    this.pendingBakes.add(item);
    const {
      prebakedBuffer: _omit,
      pcmStats: _omitStats,
      cacheKey: _omitKey,
      isBaked: _omitBaked,
      ...payload
    } = item;
    const finish = () => {
      this.pendingBakes.delete(item);
      this.pendingBakeKeys.delete(key);
      if (this.voicesAwaitingBake.has(item)) {
        this.voicesAwaitingBake.delete(item);
        this.triggerDeferredVoice(item);
      }
    };
    const promise = pool.bake(payload, sr, tempoBpm, voiceSeed, urgent).then(
      ({ left, right, peak, rms, nanCount }) => {
        this.storeVoicePcmInCache(key, left, right, { peak, rms, nanCount });
        item.pcmStats = { peak, rms, nanCount };
        if (!item.prebakedBuffer && this.ctx === ctx && (ctx.state as string) !== 'closed') {
          item.prebakedBuffer = this.createAudioBufferFromPcm(ctx, left, right, sr);
        }
        finish();
      },
      // On worker failure or stale cancellation, clean up pending state cleanly.
      () => finish()
    );
    this.pendingBakeKeys.set(key, promise);
    return promise;
  }

  /**
   * Plays a voice whose worker bake finished after its scheduled start.
   * For short sequencer/arp notes (`durSec <= 0.35s`) that finished within 320ms of `absStart`,
   * plays the full note from `offset = 0` at `now + 0.004` rather than silently dropping it!
   */
  private triggerDeferredVoice(item: ScheduledNoteEvent): void {
    if (!this.isPlaying || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const playheadSec = Math.max(0, now - this.startContextTime);
    const absStart = this.startContextTime + item.startSec;
    const rawLateSec = Math.max(0, now + 0.005 - absStart);

    // Only drop if the note is genuinely ancient (> 400ms past the end of the note)
    if (rawLateSec >= item.durSec + 0.4) {
      playbackDiag.recordVoiceEvent({
        playheadSec,
        measure: (item.event as any).measure || 1,
        beat: (item.event as any).beat || 1,
        trackId: item.event.trackId || 'synth',
        style: item.style,
        patch: item.patch,
        startSec: item.startSec,
        durSec: item.durSec,
        offsetSec: rawLateSec,
        freqHz: item.freq,
        amp: item.amp,
        chordVoices: item.chordVoices ? item.chordVoices.length : 1,
        path: 'deferred_drop',
        pcmPeak: item.pcmStats?.peak,
        pcmRms: item.pcmStats?.rms,
        pcmNanCount: item.pcmStats?.nanCount,
        activeVoices: this.activeVoices.size,
        note: `late=${(rawLateSec * 1000).toFixed(0)}ms`,
      });
      return;
    }

    // For short notes (< 0.4s) that arrived slightly late, start from offset 0 so the transient is heard
    const joinOffset =
      item.durSec <= 0.4
        ? 0
        : Math.min(rawLateSec, Math.max(0, item.durSec - 0.08));

    playbackDiag.recordVoiceEvent({
      playheadSec,
      measure: (item.event as any).measure || 1,
      beat: (item.event as any).beat || 1,
      trackId: item.event.trackId || 'synth',
      style: item.style,
      patch: item.patch,
      startSec: item.startSec,
      durSec: item.durSec,
      offsetSec: joinOffset,
      freqHz: item.freq,
      amp: item.amp,
      chordVoices: item.chordVoices ? item.chordVoices.length : 1,
      path: 'deferred_join',
      pcmPeak: item.pcmStats?.peak,
      pcmRms: item.pcmStats?.rms,
      pcmNanCount: item.pcmStats?.nanCount,
      activeVoices: this.activeVoices.size,
      note: `late=${(rawLateSec * 1000).toFixed(0)}ms`,
    });
    this.triggerRealtimeVoice(ctx, item, Math.max(absStart, now + 0.005), joinOffset, true);
  }

  /** Drops voices whose scheduled end has passed but whose cleanup never removed them. */
  private pruneFinishedVoices(now: number): void {
    for (const [voice, meta] of Array.from(this.activeVoiceMeta.entries())) {
      if (meta.endTime < now - 0.1) {
        this.activeVoices.delete(voice);
        this.activeVoiceMeta.delete(voice);
        try {
          voice.stopAndDisconnect();
        } catch {
          // Ignore
        }
      }
    }
  }

  private prebakeTimelineWindow(
    ctx: BaseAudioContext,
    timeline: ScheduledNoteEvent[],
    tempoBpm: number,
    fromSec: number,
    upToSec: number,
    maxItems: number = 16
  ): void {
    this.prebakeContinuousSynthTimeline(ctx, timeline, tempoBpm, fromSec, upToSec, maxItems);
  }

  /**
   * Detects connected melodic phrases per track so consecutive notes overlap smoothly
   * by 65ms, enter inside the sustained body of the recording (`isPhraseContinuation`),
   * and apply natural human phrase-arch breathing when no explicit swell is written.
   */
  private humanizeTimelinePhrasing(list: ScheduledNoteEvent[]): void {
    const byTrack = new Map<string, ScheduledNoteEvent[]>();
    for (const item of list) {
      if (item.style === 'grid' || item.gridKey) continue;
      const trackId = item.event.trackId || 'pno';
      let arr = byTrack.get(trackId);
      if (!arr) {
        arr = [];
        byTrack.set(trackId, arr);
      }
      arr.push(item);
    }

    for (const notes of byTrack.values()) {
      notes.sort((a, b) => a.startSec - b.startSec);
      for (let i = 0; i < notes.length; i++) {
        notes[i].noteIndexInTrack = i;
      }

      for (let i = 1; i < notes.length; i++) {
        const prev = notes[i - 1];
        const curr = notes[i];
        const prevArt = prev.event.physics?.articulation;
        const prevStacc = prevArt === 'stacc' || prevArt === 'staccato' || Boolean(prev.event.physics?.pizz);
        const prevEnd = prev.startSec + prev.durSec;
        const gap = curr.startSec - prevEnd;

        const prevIsContSynth = ContinuousSynthEngine.isContinuousSynthPatch(
          prev.patch,
          prev.style,
          prev.event.physics
        );

        if ((Math.abs(gap) <= 0.08 || (gap >= -0.15 && gap <= 0.08)) && !prevStacc && curr.startSec > prev.startSec + 0.02) {
          curr.isPhraseContinuation = true;
          prev.hasNextConnectedNote = true;
          if (!prevIsContSynth) {
            prev.durSec = Math.max(prev.durSec, curr.startSec - prev.startSec + 0.085);
          }
        } else if (gap > 0.08 && gap <= 1.2 && !prevStacc && !prevIsContSynth) {
          // Bridge up to 50% of short rests/breaths so notes taper smoothly rather than slamming shut
          prev.durSec += Math.min(gap * 0.5, 0.38);
        }
      }

      // Phrase Arch Shaping: gently arch dynamics (+8% mid-phrase, -6% cadence) on connected phrases of 3+ notes
      let phraseStart = 0;
      while (phraseStart < notes.length) {
        let phraseEnd = phraseStart;
        while (phraseEnd + 1 < notes.length && notes[phraseEnd + 1].isPhraseContinuation) {
          phraseEnd++;
        }
        const phraseLen = phraseEnd - phraseStart + 1;
        if (phraseLen >= 3) {
          for (let k = phraseStart; k <= phraseEnd; k++) {
            const n = notes[k];
            if (n.swell) continue;
            const pos = (k - phraseStart) / (phraseLen - 1);
            const archScalar = k === phraseEnd ? 0.94 : 1.0 + 0.08 * Math.sin(Math.PI * pos);
            n.amp = Math.max(0.12, Math.min(1.38, n.amp * archScalar));
          }
        }
        phraseStart = phraseEnd + 1;
      }
    }
  }

  private getInstrumentArticulationProfile(
    sfInstrument?: string | null,
    patch?: string,
    physics?: AtomicEvent['physics'],
    isPhraseContinuation?: boolean,
    noteIndexInTrack?: number,
    normalizedVelocity?: number,
    cutoffHzOverride?: number
  ): {
    attackSec: number;
    releaseSec: number;
    sampleOffsetSec: number;
    sustainRatio: number;
    filterCutoffHz: number;
  } {
    const inst = (sfInstrument || patch || '').toLowerCase();
    const isStacc = physics?.articulation === 'stacc' || physics?.articulation === 'staccato';
    const isMarc = physics?.articulation === 'marc' || physics?.articulation === 'accent';
    const isSlurred = Boolean(isPhraseContinuation || physics?.legato);
    const isPizz = Boolean(physics?.pizz) || inst.includes('pizz');
    const velScale = 0.48 + 0.68 * (normalizedVelocity ?? 0.72);
    const rrOffset = ((noteIndexInTrack ?? 0) % 3) * 0.008;
    const applyCutOverride = (defaultCut: number) =>
      cutoffHzOverride !== undefined && Number.isFinite(cutoffHzOverride)
        ? Math.round(Math.max(80, Math.min(16000, cutoffHzOverride)))
        : defaultCut;

    if (isPizz) {
      return {
        attackSec: 0.008,
        releaseSec: 0.09,
        sampleOffsetSec: 0,
        sustainRatio: 0.35,
        filterCutoffHz: applyCutOverride(Math.round(4200 * velScale)),
      };
    }

    // 1. Bowed Strings (Violin, Viola, Cello, Contrabass, String Ensembles)
    if (
      inst.includes('violin') ||
      inst.includes('viola') ||
      inst.includes('cello') ||
      inst.includes('contrabass') ||
      inst.includes('string')
    ) {
      return {
        attackSec: isSlurred ? 0.085 : isStacc ? 0.022 : isMarc ? 0.028 : 0.055,
        releaseSec: isStacc ? 0.26 : 0.78,
        // Skip 95ms-125ms past the recorded bow-scrape transient on connected/legato string notes
        sampleOffsetSec: isSlurred ? 0.105 + rrOffset : isStacc || isMarc ? 0.006 : 0.024 + rrOffset * 0.5,
        sustainRatio: 0.98,
        filterCutoffHz: applyCutOverride(Math.round(4400 * velScale)),
      };
    }

    // 2. Choir & Warm Pads
    if (inst.includes('choir') || inst.includes('voice') || inst.includes('pad')) {
      return {
        attackSec: isSlurred ? 0.095 : 0.068,
        releaseSec: 0.95,
        sampleOffsetSec: isSlurred ? 0.11 + rrOffset : 0.035 + rrOffset * 0.5,
        sustainRatio: 0.98,
        filterCutoffHz: applyCutOverride(Math.round(3800 * velScale)),
      };
    }

    // 3. Woodwinds (Flute, Piccolo, Oboe, English Horn, Clarinet, Bassoon, Sax)
    if (
      inst.includes('flute') ||
      inst.includes('piccolo') ||
      inst.includes('oboe') ||
      inst.includes('english_horn') ||
      inst.includes('clarinet') ||
      inst.includes('bassoon') ||
      inst.includes('sax')
    ) {
      return {
        attackSec: isSlurred ? 0.065 : isStacc ? 0.018 : 0.04,
        releaseSec: isStacc ? 0.24 : 0.65,
        sampleOffsetSec: isSlurred ? 0.098 + rrOffset : isStacc ? 0.005 : 0.018 + rrOffset * 0.5,
        sustainRatio: 0.96,
        filterCutoffHz: applyCutOverride(Math.round(5200 * velScale)),
      };
    }

    // 4. Orchestral Brass (French Horn, Trumpet, Trombone, Tuba, Brass Section)
    if (
      inst.includes('horn') ||
      inst.includes('trumpet') ||
      inst.includes('trombone') ||
      inst.includes('tuba') ||
      inst.includes('brass')
    ) {
      const isWarmBrass = inst.includes('horn') || inst.includes('trombone') || inst.includes('tuba');
      return {
        attackSec: isSlurred ? 0.062 : isStacc || isMarc ? 0.016 : 0.036,
        releaseSec: isStacc ? 0.28 : 0.72,
        sampleOffsetSec: isSlurred ? 0.096 + rrOffset : isStacc || isMarc ? 0.004 : 0.016 + rrOffset * 0.5,
        sustainRatio: 0.98,
        filterCutoffHz: applyCutOverride(Math.round((isWarmBrass ? 3600 : 4600) * velScale)),
      };
    }

    // 5. Pianos, Harps, Timpani, Chromatic Percussion & Plucked Instruments
    return {
      attackSec: isSlurred ? 0.022 : 0.012,
      releaseSec: 0.85,
      sampleOffsetSec: 0,
      sustainRatio: 0.82,
      filterCutoffHz: applyCutOverride(Math.round(6500 * velScale)),
    };
  }

  private triggerRealtimeVoice(
    ctx: AudioContext,
    item: ScheduledNoteEvent,
    absStartSec: number,
    inNoteOffsetSec: number = 0,
    isDeferredJoin: boolean = false
  ): void {
    if (!this.dryBus || !this.drumBus) return;
    const playheadSec = Math.max(0, ctx.currentTime - this.startContextTime);
    const evMeasure = (item.event as any).measureNumber || (item.event as any).measure || 1;
    const evBeat =
      (item.event as any).beat ||
      (item.event.startTime
        ? Number((((item.event.startTime.numerator / item.event.startTime.denominator) % 1) * 4 + 1).toFixed(2))
        : 1);
    const evTrackId = item.event.trackId || 'pno';
    const chordVoicesCount = item.chordVoices ? item.chordVoices.length : 1;

    // Soft-steal the voice with the shortest remaining duration when active voices exceed 128
    // so short 16th-note percussion/ratchet bursts never kill long sustained sub-bass or pad holds.
    if (this.activeVoices.size >= 128) {
      this.pruneFinishedVoices(ctx.currentTime);
    }
    while (this.activeVoices.size >= 128) {
      const nowSec = ctx.currentTime;
      let victim: ActiveVoiceCleanup | undefined;
      let earliestEndTime = Infinity;
      let fallbackVictim: ActiveVoiceCleanup | undefined;
      let fallbackEndTime = Infinity;
      for (const candidate of this.activeVoices) {
        const meta = this.activeVoiceMeta.get(candidate);
        const startTime = meta ? meta.startTime : nowSec;
        const endTime = meta ? meta.endTime : nowSec + 0.3;
        if (startTime <= nowSec) {
          if (endTime < earliestEndTime) {
            earliestEndTime = endTime;
            victim = candidate;
          }
        } else if (endTime < fallbackEndTime) {
          fallbackEndTime = endTime;
          fallbackVictim = candidate;
        }
      }
      victim = victim || fallbackVictim;
      if (!victim) {
        victim = this.activeVoices.values().next().value;
      }
      if (!victim) break;
      this.activeVoices.delete(victim);
      this.activeVoiceMeta.delete(victim);
      victim.fadeOutAndStop(ctx.currentTime);
      playbackDiag.recordVoiceStolen(evTrackId, playheadSec);
    }

    const safeStart = Math.max(ctx.currentTime + 0.006, absStartSec);
    const durSec = Math.max(0.05, item.durSec - inNoteOffsetSec);
    const isDrumTrack = item.style === 'grid' || Boolean(item.gridKey);
    const targetBus: AudioNode = isDrumTrack ? this.drumBus : this.dryBus;

    let voiceOut: AudioNode = targetBus;
    let pannerNode: StereoPannerNode | null = null;

    if (typeof ctx.createStereoPanner === 'function' && item.pan !== 0) {
      pannerNode = ctx.createStereoPanner();
      pannerNode.pan.setValueAtTime(item.pan, safeStart);
      pannerNode.connect(targetBus);
      voiceOut = pannerNode;
    }

    if (isDrumTrack) {
      const key = (item.gridKey || '').toLowerCase();
      const isHammerBlow =
        item.sfInstrument === 'taiko_drum' ||
        item.event.trackId === 'ham' ||
        Boolean(item.def?.name?.toLowerCase().includes('hammer'));

      if (isHammerBlow) {
        this.scheduleDrumHit(ctx, voiceOut, pannerNode, 'hammer', item.midi, safeStart, item.amp);
        playbackDiag.recordVoiceEvent({
          playheadSec,
          measure: evMeasure,
          beat: evBeat,
          trackId: evTrackId,
          style: item.style,
          patch: 'hammer',
          startSec: item.startSec,
          durSec,
          offsetSec: inNoteOffsetSec,
          freqHz: item.freq,
          amp: item.amp,
          chordVoices: 1,
          path: 'drum_synth',
          activeVoices: this.activeVoices.size,
        });
        return;
      }

      const isTimpaniStrike =
        item.sfInstrument === 'timpani' &&
        (key === 'k' || key === 'bd' || key === 'kick' || key === 'lt' || key === 'mt' || key === 'ht' || !key);

      if (isTimpaniStrike) {
        const timpMidi = key === 'ht' ? 52 : key === 'mt' ? 48 : 45;
        const timpSample = this.soundfontLoader.getCachedSampleForNote('timpani', timpMidi);
        if (timpSample) {
          this.scheduleSoundfontBufferVoice(
            ctx,
            voiceOut,
            pannerNode,
            timpSample,
            'timpani',
            safeStart,
            Math.max(0.38, durSec),
            item.amp * 0.95,
            item.swell,
            item.startAmp,
            item.endAmp,
            item.event.physics,
            item.isPhraseContinuation,
            item.noteIndexInTrack,
            item.normalizedVelocity
          );
          playbackDiag.recordVoiceEvent({
            playheadSec,
            measure: evMeasure,
            beat: evBeat,
            trackId: evTrackId,
            style: item.style,
            patch: 'timpani',
            startSec: item.startSec,
            durSec,
            offsetSec: inNoteOffsetSec,
            freqHz: item.freq,
            amp: item.amp,
            chordVoices: 1,
            path: 'soundfont',
            activeVoices: this.activeVoices.size,
          });
          return;
        }
      }

      const chokeGroup = SamplerAndDrumRackEngine.getChokeGroupForDrumKey(key, item.midi);
      const chokeMapKey = chokeGroup > 0 ? `${item.event.trackId || 'drums'}::cg${chokeGroup}` : undefined;
      if (chokeMapKey) {
        const prevChokeVoice = this.activeChokeGroups.get(chokeMapKey);
        if (prevChokeVoice) {
          prevChokeVoice.fadeOutAndStop(safeStart);
          this.activeChokeGroups.delete(chokeMapKey);
        }
      }

      const drumCleanup = this.scheduleDrumHit(ctx, voiceOut, pannerNode, item.gridKey || 'k', item.midi, safeStart, item.amp);
      if (chokeMapKey && drumCleanup) {
        this.activeChokeGroups.set(chokeMapKey, drumCleanup);
      }
      playbackDiag.recordVoiceEvent({
        playheadSec,
        measure: evMeasure,
        beat: evBeat,
        trackId: evTrackId,
        style: item.style,
        patch: `drum:${item.gridKey || 'k'}`,
        startSec: item.startSec,
        durSec,
        offsetSec: inNoteOffsetSec,
        freqHz: item.freq,
        amp: item.amp,
        chordVoices: 1,
        path: 'drum_synth',
        activeVoices: this.activeVoices.size,
      });
      return;
    }

    if (
      SamplerAndDrumRackEngine.isGranulatorPatch(item.patch) ||
      SamplerAndDrumRackEngine.isSimplerTrack(item.style, item.patch, item.def)
    ) {
      const cleanup = SamplerAndDrumRackEngine.scheduleRealtimeGranulatorOrSimplerVoice(
        ctx,
        voiceOut,
        pannerNode,
        item.freq,
        safeStart,
        durSec,
        item.amp,
        item.def,
        item.event,
        item.swell,
        item.startAmp,
        item.endAmp
      );
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, {
        startTime: safeStart,
        endTime: safeStart + durSec + 0.25,
      });
      playbackDiag.recordVoiceEvent({
        playheadSec,
        measure: evMeasure,
        beat: evBeat,
        trackId: evTrackId,
        style: item.style,
        patch: item.patch,
        startSec: item.startSec,
        durSec,
        offsetSec: inNoteOffsetSec,
        freqHz: item.freq,
        amp: item.amp,
        chordVoices: chordVoicesCount,
        path: 'ableton_synth',
        activeVoices: this.activeVoices.size,
      });
      return;
    }

    if (ContinuousSynthEngine.isContinuousSynthPatch(item.patch, item.style, item.event.physics)) {
      if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
        let buf = item.prebakedBuffer;
        let triggerPath: 'prebaked' | 'ring_hit' | 'sync_urgent' | 'sync_fallback' | 'deferred_join' =
          isDeferredJoin ? 'deferred_join' : 'prebaked';

        if (!buf) {
          const sr = ctx.sampleRate || 44100;
          const tempo = this.tempoBpm || 120;
          const cacheKey = this.getVoiceCacheKey(item, sr, tempo);
          const cachedPcm = this.voiceRingBuffer.get(cacheKey);
          if (cachedPcm) {
            buf = this.createAudioBufferFromPcm(ctx, cachedPcm.left, cachedPcm.right, sr);
            item.prebakedBuffer = buf;
            item.pcmStats = {
              peak: cachedPcm.peak,
              rms: cachedPcm.rms,
              nanCount: cachedPcm.nanCount,
            };
            triggerPath = isDeferredJoin ? 'deferred_join' : 'ring_hit';
          } else {
            const voiceSeed = item.voiceSeed ?? (item.noteIndexInTrack ?? 0) + 1;
            const pool = this.getBakePool();

            if (pool !== null) {
              // Worker pool is available! Promote to urgent (or dispatch urgently)
              if (this.pendingBakes.has(item)) {
                pool.promoteUrgentBySeed(voiceSeed);
              } else {
                this.bakeItemInWorker(ctx, pool, item, tempo, voiceSeed, cacheKey, true);
              }

              // Sound immediate realtime synth voice so playback never has gaps or silences!
              this.scheduleSynthVoice(
                ctx,
                voiceOut,
                pannerNode,
                item.freq,
                item.patch,
                safeStart,
                durSec,
                item.amp,
                item.swell,
                item.startAmp,
                item.endAmp,
                item.event.physics,
                item.cutoffHzOverride
              );

              playbackDiag.recordVoiceEvent({
                playheadSec,
                measure: evMeasure,
                beat: evBeat,
                trackId: evTrackId,
                style: item.style,
                patch: item.patch,
                startSec: item.startSec,
                durSec,
                offsetSec: inNoteOffsetSec,
                freqHz: item.freq,
                amp: item.amp,
                chordVoices: chordVoicesCount,
                path: 'osc_fallback',
                activeVoices: this.activeVoices.size,
                note: 'worker rendering in background; immediate realtime synth fallback sounding',
              });
              return;
            }

            // Fallback ONLY when Web Workers are completely unavailable (e.g. headless unit tests)
            triggerPath = 'sync_fallback';
            const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
            const { left: chL, right: chR, peak, rms, nanCount } = renderContinuousVoicePcm(
              item,
              sr,
              tempo,
              voiceSeed
            );
            const bakeMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
            this.storeVoicePcmInCache(cacheKey, chL, chR, { peak, rms, nanCount });
            buf = this.createAudioBufferFromPcm(ctx, chL, chR, sr);
            item.prebakedBuffer = buf;
            item.pcmStats = { peak, rms, nanCount };

            playbackDiag.recordSyncBake(
              bakeMs,
              playheadSec,
              evMeasure,
              evBeat,
              evTrackId,
              item.patch,
              item.durSec,
              peak
            );
          }
        }

        if (!isDeferredJoin) {
          playbackDiag.recordVoiceEvent({
            playheadSec,
            measure: evMeasure,
            beat: evBeat,
            trackId: evTrackId,
            style: item.style,
            patch: item.patch,
            startSec: item.startSec,
            durSec,
            offsetSec: inNoteOffsetSec,
            freqHz: item.freq,
            amp: item.amp,
            chordVoices: chordVoicesCount,
            path: triggerPath,
            pcmPeak: item.pcmStats?.peak,
            pcmRms: item.pcmStats?.rms,
            pcmNanCount: item.pcmStats?.nanCount,
            activeVoices: this.activeVoices.size + 1,
          });
        }

        const src = ctx.createBufferSource();
        src.buffer = buf;
        const envGain = ctx.createGain();
        const voiceHeadroomGain = 0.58;
        const safeOffset = Math.max(0, Math.min(inNoteOffsetSec, Math.max(0, buf.duration - 0.04)));
        if (safeOffset > 0.005) {
          envGain.gain.setValueAtTime(0.001, safeStart);
          envGain.gain.linearRampToValueAtTime(voiceHeadroomGain, safeStart + 0.015);
        } else {
          envGain.gain.setValueAtTime(voiceHeadroomGain, safeStart);
        }
        src.connect(envGain);
        envGain.connect(voiceOut);

        let sendTapGain: GainNode | null = null;
        if (
          this.reverbSendBus &&
          item.reverbSendGain !== undefined &&
          item.reverbSendGain > 0.02
        ) {
          sendTapGain = ctx.createGain();
          sendTapGain.gain.setValueAtTime(
            Math.min(0.45, item.reverbSendGain * 0.38),
            safeStart
          );
          envGain.connect(sendTapGain);
          sendTapGain.connect(this.reverbSendBus);
        }

        src.start(safeStart, safeOffset);
        let cleaned = false;
        const cleanup: ActiveVoiceCleanup = {
          fadeOutAndStop: (now: number) => {
            if (cleaned) return;
            cleaned = true;
            this.activeVoices.delete(cleanup);
            this.activeVoiceMeta.delete(cleanup);
            try {
              envGain.gain.cancelScheduledValues?.(now);
              envGain.gain.setTargetAtTime?.(0.0001, now, 0.008);
              src.stop(now + 0.03);
            } catch {
              cleanup.stopAndDisconnect();
            }
          },
          stopAndDisconnect: () => {
            if (cleaned) return;
            cleaned = true;
            this.activeVoices.delete(cleanup);
            this.activeVoiceMeta.delete(cleanup);
            try {
              src.stop();
              src.disconnect();
              envGain.disconnect();
              sendTapGain?.disconnect();
              pannerNode?.disconnect();
            } catch {
              // Ignore
            }
          },
        };
        this.activeVoices.add(cleanup);
        const remainingBufDur = Math.max(durSec + 0.28, buf.duration - safeOffset);
        this.activeVoiceMeta.set(cleanup, {
          startTime: safeStart,
          endTime: safeStart + remainingBufDur,
        });
        src.onended = () => cleanup.stopAndDisconnect();
        return;
      }
    }

    if (
      item.patch.includes('wavetable') ||
      item.patch.includes('supersaw') ||
      item.patch.includes('flutter')
    ) {
      const wtParams = WavetableEngine.resolveParams(
        item.def,
        item.event.physics,
        item.cutoffHzOverride
      );
      const cleanup = WavetableEngine.scheduleRealtimeVoice(
        ctx,
        voiceOut,
        pannerNode,
        item.freq,
        safeStart,
        durSec,
        item.amp,
        wtParams,
        item.swell,
        item.startAmp,
        item.endAmp,
        item.event.physics
      );
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, {
        startTime: safeStart,
        endTime: safeStart + durSec + 0.35,
      });
      playbackDiag.recordVoiceEvent({
        playheadSec,
        measure: evMeasure,
        beat: evBeat,
        trackId: evTrackId,
        style: item.style,
        patch: item.patch,
        startSec: item.startSec,
        durSec,
        offsetSec: inNoteOffsetSec,
        freqHz: item.freq,
        amp: item.amp,
        chordVoices: chordVoicesCount,
        path: 'wavetable',
        activeVoices: this.activeVoices.size,
      });
      return;
    }

    if (AbletonSynthSuite.isSupportedPatch(item.patch)) {
      const synthParams = AbletonSynthSuite.resolveParams(
        item.patch,
        item.def,
        item.event.physics,
        item.cutoffHzOverride
      );
      const cleanup = AbletonSynthSuite.scheduleRealtimeVoice(
        ctx,
        voiceOut,
        pannerNode,
        item.freq,
        safeStart,
        durSec,
        item.amp,
        synthParams,
        item.swell,
        item.startAmp,
        item.endAmp,
        item.event.physics
      );
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, {
        startTime: safeStart,
        endTime: safeStart + durSec + 0.35,
      });
      playbackDiag.recordVoiceEvent({
        playheadSec,
        measure: evMeasure,
        beat: evBeat,
        trackId: evTrackId,
        style: item.style,
        patch: item.patch,
        startSec: item.startSec,
        durSec,
        offsetSec: inNoteOffsetSec,
        freqHz: item.freq,
        amp: item.amp,
        chordVoices: chordVoicesCount,
        path: 'ableton_synth',
        activeVoices: this.activeVoices.size,
      });
      return;
    }

    if (item.sfInstrument) {
      const cachedSample = this.soundfontLoader.getCachedSampleForNote(item.sfInstrument, item.midi);
      if (cachedSample) {
        const independentDesk2 =
          item.isEnsembleSection && this.activeVoices.size < 44
            ? this.soundfontLoader.getIndependentDeskSampleForNote(item.sfInstrument, item.midi)
            : null;

        if (independentDesk2) {
          const desk1Sample = {
            buffer: cachedSample.buffer,
            playbackRate: cachedSample.playbackRate * Math.pow(2, -2.5 / 1200),
          };
          const desk2Sample = {
            buffer: independentDesk2.buffer,
            playbackRate: independentDesk2.playbackRate * Math.pow(2, 3.0 / 1200),
          };

          let desk1Out: AudioNode = targetBus;
          let desk1Panner: StereoPannerNode | null = null;
          let desk2Out: AudioNode = targetBus;
          let desk2Panner: StereoPannerNode | null = null;

          if (typeof ctx.createStereoPanner === 'function') {
            desk1Panner = ctx.createStereoPanner();
            desk1Panner.pan.setValueAtTime(Math.max(-1, Math.min(1, item.pan - 0.08)), safeStart);
            desk1Panner.connect(targetBus);
            desk1Out = desk1Panner;

            desk2Panner = ctx.createStereoPanner();
            desk2Panner.pan.setValueAtTime(Math.max(-1, Math.min(1, item.pan + 0.08)), safeStart + 0.018);
            desk2Panner.connect(targetBus);
            desk2Out = desk2Panner;
          }

          this.scheduleSoundfontBufferVoice(
            ctx,
            desk1Out,
            desk1Panner,
            desk1Sample,
            item.sfInstrument,
            safeStart,
            durSec,
            item.amp * 0.7,
            item.swell,
            item.startAmp * 0.7,
            item.endAmp * 0.7,
            item.event.physics,
            item.isPhraseContinuation,
            item.noteIndexInTrack,
            item.normalizedVelocity,
            item.hasNextConnectedNote,
            item.cutoffHzOverride
          );

          this.scheduleSoundfontBufferVoice(
            ctx,
            desk2Out,
            desk2Panner,
            desk2Sample,
            item.sfInstrument,
            safeStart + 0.018,
            durSec,
            item.amp * 0.48,
            item.swell,
            item.startAmp * 0.48,
            item.endAmp * 0.48,
            item.event.physics,
            true,
            (item.noteIndexInTrack ?? 0) + 1,
            item.normalizedVelocity,
            item.hasNextConnectedNote,
            item.cutoffHzOverride
          );
          playbackDiag.recordVoiceEvent({
            playheadSec,
            measure: evMeasure,
            beat: evBeat,
            trackId: evTrackId,
            style: item.style,
            patch: item.sfInstrument,
            startSec: item.startSec,
            durSec,
            offsetSec: inNoteOffsetSec,
            freqHz: item.freq,
            amp: item.amp,
            chordVoices: 2,
            path: 'soundfont',
            activeVoices: this.activeVoices.size,
          });
          return;
        }

        this.scheduleSoundfontBufferVoice(
          ctx,
          voiceOut,
          pannerNode,
          cachedSample,
          item.sfInstrument,
          safeStart,
          durSec,
          item.amp,
          item.swell,
          item.startAmp,
          item.endAmp,
          item.event.physics,
          item.isPhraseContinuation,
          item.noteIndexInTrack,
          item.normalizedVelocity,
          item.hasNextConnectedNote,
          item.cutoffHzOverride
        );
        playbackDiag.recordVoiceEvent({
          playheadSec,
          measure: evMeasure,
          beat: evBeat,
          trackId: evTrackId,
          style: item.style,
          patch: item.sfInstrument,
          startSec: item.startSec,
          durSec,
          offsetSec: inNoteOffsetSec,
          freqHz: item.freq,
          amp: item.amp,
          chordVoices: 1,
          path: 'soundfont',
          activeVoices: this.activeVoices.size,
        });
        return;
      }
    }

    if (item.style === 'synth') {
      this.scheduleSynthVoice(
        ctx,
        voiceOut,
        pannerNode,
        item.freq,
        item.patch,
        safeStart,
        durSec,
        item.amp,
        item.swell,
        item.startAmp,
        item.endAmp,
        item.event.physics,
        item.cutoffHzOverride
      );
    } else {
      this.scheduleAcousticPianoVoice(
        ctx,
        voiceOut,
        pannerNode,
        item.freq,
        safeStart,
        durSec,
        item.amp,
        item.swell,
        item.startAmp,
        item.endAmp,
        item.event.physics
      );
    }
    playbackDiag.recordVoiceEvent({
      playheadSec,
      measure: evMeasure,
      beat: evBeat,
      trackId: evTrackId,
      style: item.style,
      patch: item.patch,
      startSec: item.startSec,
      durSec,
      offsetSec: inNoteOffsetSec,
      freqHz: item.freq,
      amp: item.amp,
      chordVoices: chordVoicesCount,
      path: 'osc_fallback',
      activeVoices: this.activeVoices.size,
    });
  }

  private scheduleSoundfontBufferVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    pannerNode: StereoPannerNode | null,
    sampleData: { buffer: AudioBuffer; playbackRate: number },
    sfInstrument: string,
    startSec: number,
    durSec: number,
    amp: number,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number,
    physics?: AtomicEvent['physics'],
    isPhraseContinuation?: boolean,
    noteIndexInTrack?: number,
    normalizedVelocity?: number,
    hasNextConnectedNote?: boolean,
    cutoffHzOverride?: number
  ): void {
    const profile = this.getInstrumentArticulationProfile(
      sfInstrument,
      sfInstrument,
      physics,
      isPhraseContinuation,
      noteIndexInTrack,
      normalizedVelocity,
      cutoffHzOverride
    );
    const env = ctx.createGain();
    const src = ctx.createBufferSource();
    src.buffer = sampleData.buffer;
    src.playbackRate.setValueAtTime(sampleData.playbackRate, startSec);

    if (isSustainingOrchestralInstrument(sfInstrument, sfInstrument) && sampleData.buffer.duration >= 2.5) {
      src.loop = true;
      src.loopStart = 0.6;
      src.loopEnd = Math.max(2.0, sampleData.buffer.duration - 0.3);
    }

    if (physics?.mordent && durSec >= 0.08) {
      src.playbackRate.setValueAtTime(sampleData.playbackRate, startSec);
      src.playbackRate.setValueAtTime(sampleData.playbackRate * Math.pow(2, 2 / 12), startSec + 0.025);
      src.playbackRate.setValueAtTime(sampleData.playbackRate, startSec + 0.065);
    } else if (physics?.trill && durSec >= 0.1) {
      const upperRate = sampleData.playbackRate * Math.pow(2, 2 / 12);
      const stepSec = 0.065;
      const steps = Math.min(48, Math.floor(durSec / stepSec));
      for (let s = 0; s < steps; s++) {
        src.playbackRate.setValueAtTime(s % 2 === 0 ? sampleData.playbackRate : upperRate, startSec + s * stepSec);
      }
    }

    let toneFilter: BiquadFilterNode | null = null;
    if (typeof ctx.createBiquadFilter === 'function') {
      toneFilter = ctx.createBiquadFilter();
      toneFilter.type = 'lowpass';
      toneFilter.Q.setValueAtTime(0.5, startSec);
      const baseCut = profile.filterCutoffHz;
      if (swell === 'crescendo') {
        toneFilter.frequency.setValueAtTime(Math.max(900, baseCut * 0.65), startSec);
        toneFilter.frequency.exponentialRampToValueAtTime(Math.min(8500, baseCut * 1.25), startSec + durSec);
      } else if (swell === 'diminuendo') {
        toneFilter.frequency.setValueAtTime(Math.min(8500, baseCut * 1.15), startSec);
        toneFilter.frequency.exponentialRampToValueAtTime(Math.max(800, baseCut * 0.6), startSec + durSec);
      } else {
        toneFilter.frequency.setValueAtTime(baseCut, startSec);
      }
      src.connect(toneFilter);
      toneFilter.connect(env);
    } else {
      src.connect(env);
    }

    env.connect(output);

    const t0 = startSec;
    const attack = Math.min(profile.attackSec, Math.max(0.01, durSec * 0.45));
    const tAttack = t0 + attack;
    const tSustain = Math.max(tAttack + 0.015, t0 + durSec);
    const release = hasNextConnectedNote ? 0.16 : Math.max(0.65, profile.releaseSec);
    const tEnd = tSustain + release;
    const sampleScale = 0.85;

    env.gain.setValueAtTime(0.0001, t0);
    if (physics?.fp) {
      const fpPeak = Math.max(0.004, amp * sampleScale * 1.1);
      const fpDrop = Math.max(0.001, fpPeak * 0.3);
      env.gain.linearRampToValueAtTime(fpPeak, t0 + Math.min(0.02, attack));
      env.gain.exponentialRampToValueAtTime(fpDrop, Math.min(tSustain, t0 + 0.09));
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else if (swell === 'crescendo' || swell === 'diminuendo') {
      const sPeak = Math.max(0.002, (startAmp ?? amp) * sampleScale);
      const ePeak = Math.max(0.002, (endAmp ?? amp) * sampleScale);
      env.gain.linearRampToValueAtTime(sPeak, tAttack);
      env.gain.linearRampToValueAtTime(ePeak, tSustain);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else {
      const peak = Math.max(0.002, amp * sampleScale);
      env.gain.linearRampToValueAtTime(peak, tAttack);
      env.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * profile.sustainRatio), tSustain);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    }

    const stopAt = tEnd + 0.025;
    const safeOffset =
      sampleData.buffer.duration > 0.25 ? Math.min(profile.sampleOffsetSec, sampleData.buffer.duration * 0.35) : 0;
    src.start(t0, safeOffset);
    src.stop(stopAt);

    let cleaned = false;
    const cleanup: ActiveVoiceCleanup = {
      fadeOutAndStop: (now: number) => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
        this.activeVoiceMeta.delete(cleanup);
        try {
          env.gain.cancelScheduledValues?.(now);
          env.gain.setTargetAtTime?.(0.0001, now, 0.006);
          src.stop(now + 0.025);
        } catch {
          cleanup.stopAndDisconnect();
        }
      },
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
        this.activeVoiceMeta.delete(cleanup);
        try {
          src.stop();
        } catch {
          // Ignore
        }
        try {
          src.disconnect();
          toneFilter?.disconnect();
          env.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };

    this.activeVoices.add(cleanup);
    this.activeVoiceMeta.set(cleanup, { startTime: t0, endTime: stopAt });
    src.onended = () => cleanup.stopAndDisconnect();
  }

  private applyPitchOrnamentsToOscillator(
    ctx: BaseAudioContext,
    osc: OscillatorNode,
    baseFreq: number,
    startSec: number,
    durSec: number,
    physics?: AtomicEvent['physics']
  ): { stopExtra: () => void } {
    const extraOscs: OscillatorNode[] = [];
    const extraGains: GainNode[] = [];

    if (physics?.mordent && durSec >= 0.08) {
      const upperFreq = baseFreq * Math.pow(2, 2 / 12);
      osc.frequency.setValueAtTime(baseFreq, startSec);
      osc.frequency.setValueAtTime(upperFreq, startSec + 0.025);
      osc.frequency.setValueAtTime(baseFreq, startSec + 0.065);
    } else if (physics?.trill && durSec >= 0.1) {
      const upperFreq = baseFreq * Math.pow(2, 2 / 12);
      const stepSec = 0.065;
      const steps = Math.min(48, Math.floor(durSec / stepSec));
      for (let s = 0; s < steps; s++) {
        osc.frequency.setValueAtTime(s % 2 === 0 ? baseFreq : upperFreq, startSec + s * stepSec);
      }
    }

    if (physics?.mpe?.bend && physics.mpe.bend.length > 0 && durSec >= 0.05) {
      const bendArr = physics.mpe.bend;
      if (bendArr.length === 1) {
        const bentFreq = baseFreq * Math.pow(2, bendArr[0] / 12);
        osc.frequency.setValueAtTime(bentFreq, startSec);
      } else {
        const segDur = durSec / (bendArr.length - 1);
        for (let bIdx = 0; bIdx < bendArr.length; bIdx++) {
          const bentFreq = Math.max(20, Math.min(14000, baseFreq * Math.pow(2, bendArr[bIdx] / 12)));
          const tPoint = startSec + bIdx * segDur;
          if (bIdx === 0) {
            osc.frequency.setValueAtTime(bentFreq, tPoint);
          } else {
            osc.frequency.linearRampToValueAtTime(bentFreq, tPoint);
          }
        }
      }
    }

    if (physics?.vibrato && durSec >= 0.15) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(5.5, startSec);
      const onset = Math.min(startSec + 0.1, startSec + durSec * 0.3);
      lfoGain.gain.setValueAtTime(0.001, startSec);
      lfoGain.gain.linearRampToValueAtTime(baseFreq * 0.0085, onset);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(startSec);
      lfo.stop(startSec + durSec + 0.25);
      extraOscs.push(lfo);
      extraGains.push(lfoGain);
    }

    return {
      stopExtra: () => {
        for (const o of extraOscs) {
          try {
            o.stop();
            o.disconnect();
          } catch {
            // Ignore
          }
        }
        for (const g of extraGains) {
          try {
            g.disconnect();
          } catch {
            // Ignore
          }
        }
      },
    };
  }

  private scheduleAcousticPianoVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    pannerNode: StereoPannerNode | null,
    freq: number,
    startSec: number,
    durSec: number,
    amp: number,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number,
    physics?: AtomicEvent['physics']
  ): void {
    const env = ctx.createGain();
    const oscFund = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();

    oscFund.type = 'triangle';
    oscHarm.type = 'sine';
    oscFund.frequency.setValueAtTime(freq, startSec);
    oscHarm.frequency.setValueAtTime(Math.min(12000, freq * 2), startSec);

    const ornFund = this.applyPitchOrnamentsToOscillator(ctx, oscFund, freq, startSec, durSec, physics);

    const gFund = ctx.createGain();
    const gHarm = ctx.createGain();
    gFund.gain.value = 0.75;
    gHarm.gain.value = 0.25;

    let lpFilter: BiquadFilterNode | null = null;
    if (typeof ctx.createBiquadFilter === 'function') {
      lpFilter = ctx.createBiquadFilter();
      lpFilter.type = 'lowpass';
      lpFilter.Q.setValueAtTime(0.5, startSec);
      lpFilter.frequency.setValueAtTime(3800, startSec);
      oscFund.connect(gFund);
      oscHarm.connect(gHarm);
      gFund.connect(lpFilter);
      gHarm.connect(lpFilter);
      lpFilter.connect(env);
    } else {
      oscFund.connect(gFund);
      oscHarm.connect(gHarm);
      gFund.connect(env);
      gHarm.connect(env);
    }
    env.connect(output);

    const t0 = startSec;
    const tAttack = t0 + (physics?.legato ? 0.028 : 0.015);
    const tDecay = Math.max(tAttack + 0.02, t0 + durSec);
    const release = Math.min(0.22, durSec * 0.45);
    const tEnd = tDecay + Math.max(0.04, release);

    env.gain.setValueAtTime(0.0001, t0);
    if (physics?.fp) {
      const fpPeak = Math.max(0.004, amp * 1.15);
      const fpDrop = Math.max(0.001, fpPeak * 0.25);
      env.gain.linearRampToValueAtTime(fpPeak, t0 + 0.014);
      env.gain.exponentialRampToValueAtTime(fpDrop, Math.min(tDecay, t0 + 0.075));
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else if (swell === 'crescendo' || swell === 'diminuendo') {
      const sPeak = Math.max(0.002, (startAmp ?? amp) * 0.95);
      const ePeak = Math.max(0.002, (endAmp ?? amp) * 0.95);
      env.gain.linearRampToValueAtTime(sPeak, tAttack);
      env.gain.linearRampToValueAtTime(ePeak, tDecay);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else {
      const peak = Math.max(0.002, amp * 0.95);
      env.gain.linearRampToValueAtTime(peak, tAttack);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0005, peak * 0.35), tDecay);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    }

    const stopAt = tEnd + 0.015;
    oscFund.start(t0);
    oscHarm.start(t0);
    oscFund.stop(stopAt);
    oscHarm.stop(stopAt);

    let cleaned = false;
    const cleanup: ActiveVoiceCleanup = {
      fadeOutAndStop: (_now: number) => {
        cleanup.stopAndDisconnect();
      },
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
        this.activeVoiceMeta.delete(cleanup);
        ornFund.stopExtra();
        try {
          oscFund.stop();
          oscHarm.stop();
        } catch {
          // Ignore if already stopped
        }
        try {
          oscFund.disconnect();
          oscHarm.disconnect();
          gFund.disconnect();
          gHarm.disconnect();
          lpFilter?.disconnect();
          env.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };

    this.activeVoices.add(cleanup);
    this.activeVoiceMeta.set(cleanup, { startTime: t0, endTime: stopAt });
    oscFund.onended = () => cleanup.stopAndDisconnect();
  }

  private scheduleSynthVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    pannerNode: StereoPannerNode | null,
    freq: number,
    patch: string,
    startSec: number,
    durSec: number,
    amp: number,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number,
    physics?: AtomicEvent['physics'],
    cutoffHzOverride?: number
  ): void {
    const profile = this.getInstrumentArticulationProfile(
      undefined,
      patch,
      physics,
      undefined,
      undefined,
      undefined,
      cutoffHzOverride
    );
    const isSub = patch.includes('sub') || patch.includes('808') || freq < 130;
    const isPad = patch.includes('pad') || patch.includes('string');

    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(0.707, startSec);
    const baseCutoff =
      cutoffHzOverride !== undefined
        ? profile.filterCutoffHz
        : isSub
          ? 360
          : physics?.pizz
            ? 1600
            : Math.min(3200, profile.filterCutoffHz);
    if (swell === 'crescendo') {
      filter.frequency.setValueAtTime(Math.max(220, baseCutoff * 0.55), startSec);
      filter.frequency.exponentialRampToValueAtTime(Math.min(7500, baseCutoff * 1.45), startSec + durSec);
    } else if (swell === 'diminuendo') {
      filter.frequency.setValueAtTime(Math.min(7500, baseCutoff * 1.35), startSec);
      filter.frequency.exponentialRampToValueAtTime(Math.max(200, baseCutoff * 0.5), startSec + durSec);
    } else {
      filter.frequency.setValueAtTime(baseCutoff, startSec);
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = isSub ? 'sine' : 'sawtooth';
    osc2.type = isSub ? 'triangle' : isPad ? 'triangle' : 'square';

    osc1.frequency.setValueAtTime(freq, startSec);
    osc2.frequency.setValueAtTime(freq, startSec);
    osc2.detune.setValueAtTime(isPad ? 6 : 4, startSec);

    const orn1 = this.applyPitchOrnamentsToOscillator(ctx, osc1, freq, startSec, durSec, physics);
    const orn2 = this.applyPitchOrnamentsToOscillator(ctx, osc2, freq, startSec, durSec, physics);

    const mix1 = ctx.createGain();
    const mix2 = ctx.createGain();
    mix1.gain.value = 0.6;
    mix2.gain.value = 0.35;

    osc1.connect(mix1);
    osc2.connect(mix2);
    mix1.connect(filter);
    mix2.connect(filter);
    filter.connect(env);
    env.connect(output);

    const t0 = startSec;
    const attack = Math.min(profile.attackSec, Math.max(0.008, durSec * 0.45));
    const tAttack = t0 + attack;
    const tSustain = Math.max(tAttack + 0.02, t0 + durSec);
    const release = profile.releaseSec;
    const tEnd = tSustain + release;
    const voiceScale = isSub ? 0.95 : isPad ? 0.65 : 0.75;

    env.gain.setValueAtTime(0.0001, t0);
    if (physics?.fp) {
      const fpPeak = Math.max(0.004, amp * voiceScale * 1.25);
      const fpDrop = Math.max(0.001, fpPeak * 0.25);
      env.gain.linearRampToValueAtTime(fpPeak, t0 + Math.min(0.018, attack));
      env.gain.exponentialRampToValueAtTime(fpDrop, Math.min(tSustain, t0 + 0.075));
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else if (swell === 'crescendo' || swell === 'diminuendo') {
      const sPeak = Math.max(0.002, (startAmp ?? amp) * voiceScale);
      const ePeak = Math.max(0.002, (endAmp ?? amp) * voiceScale);
      env.gain.linearRampToValueAtTime(sPeak, tAttack);
      env.gain.linearRampToValueAtTime(ePeak, tSustain);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else {
      const peak = Math.max(0.002, amp * voiceScale);
      env.gain.linearRampToValueAtTime(peak, tAttack);
      env.gain.exponentialRampToValueAtTime(
        Math.max(0.0005, peak * profile.sustainRatio),
        tSustain
      );
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    }

    const stopAt = tEnd + 0.015;
    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(stopAt);
    osc2.stop(stopAt);

    let cleaned = false;
    const cleanup: ActiveVoiceCleanup = {
      fadeOutAndStop: (_now: number) => {
        cleanup.stopAndDisconnect();
      },
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
        this.activeVoiceMeta.delete(cleanup);
        orn1.stopExtra();
        orn2.stopExtra();
        try {
          osc1.stop();
          osc2.stop();
        } catch {
          // Ignore
        }
        try {
          osc1.disconnect();
          osc2.disconnect();
          mix1.disconnect();
          mix2.disconnect();
          filter.disconnect();
          env.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };

    this.activeVoices.add(cleanup);
    this.activeVoiceMeta.set(cleanup, { startTime: t0, endTime: stopAt });
    osc1.onended = () => cleanup.stopAndDisconnect();
  }

  private scheduleDrumHit(
    ctx: BaseAudioContext,
    output: AudioNode,
    pannerNode: StereoPannerNode | null,
    gridKey: string,
    midi: number,
    startSec: number,
    amp: number
  ): ActiveVoiceCleanup | void {
    const key = gridKey.toLowerCase();
    const sr = ctx.sampleRate || 44100;

    // 0. MAHLER WOODEN BOX HAMMER (hammer / ham): Non-metallic deep wooden resonator box thud
    if (key === 'hammer' || key === 'ham') {
      const subOsc = ctx.createOscillator();
      const woodOsc1 = ctx.createOscillator();
      const woodOsc2 = ctx.createOscillator();
      const subGain = ctx.createGain();
      const woodGain = ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(58, startSec);
      subOsc.frequency.exponentialRampToValueAtTime(31, startSec + 0.55);

      woodOsc1.type = 'triangle';
      woodOsc1.frequency.setValueAtTime(118, startSec);
      woodOsc1.frequency.exponentialRampToValueAtTime(84, startSec + 0.18);

      woodOsc2.type = 'sine';
      woodOsc2.frequency.setValueAtTime(176, startSec);
      woodOsc2.frequency.exponentialRampToValueAtTime(124, startSec + 0.14);

      const peak = Math.max(0.02, amp * 1.35);
      subGain.gain.setValueAtTime(0.001, startSec);
      subGain.gain.linearRampToValueAtTime(peak, startSec + 0.005);
      subGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.65);

      woodGain.gain.setValueAtTime(peak * 0.65, startSec);
      woodGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.22);

      subOsc.connect(subGain);
      woodOsc1.connect(woodGain);
      woodOsc2.connect(woodGain);
      subGain.connect(output);
      woodGain.connect(output);

      subOsc.start(startSec);
      woodOsc1.start(startSec);
      woodOsc2.start(startSec);
      subOsc.stop(startSec + 0.68);
      woodOsc1.stop(startSec + 0.24);
      woodOsc2.stop(startSec + 0.24);

      let cleaned = false;
      const cleanup: ActiveVoiceCleanup = {
        fadeOutAndStop: (_now: number) => {
          cleanup.stopAndDisconnect();
        },
        stopAndDisconnect: () => {
          if (cleaned) return;
          cleaned = true;
          this.activeVoices.delete(cleanup);
          this.activeVoiceMeta.delete(cleanup);
          try {
            subOsc.stop();
            woodOsc1.stop();
            woodOsc2.stop();
          } catch {
            // Ignore
          }
          try {
            subOsc.disconnect();
            woodOsc1.disconnect();
            woodOsc2.disconnect();
            subGain.disconnect();
            woodGain.disconnect();
            pannerNode?.disconnect();
          } catch {
            // Ignore
          }
        },
      };
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, { startTime: startSec, endTime: startSec + 0.68 });
      subOsc.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    // 1. STUDIO KICK DRUM (k / bd / kick / 36): Sub Membrane + Punch Body + Beater Click
    if (key === 'k' || key === 'bd' || key === 'kick' || midi === 36) {
      const subOsc = ctx.createOscillator();
      const bodyOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      const bodyGain = ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(155, startSec);
      subOsc.frequency.exponentialRampToValueAtTime(52, startSec + 0.022);
      subOsc.frequency.exponentialRampToValueAtTime(34, startSec + 0.28);

      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(220, startSec);
      bodyOsc.frequency.exponentialRampToValueAtTime(62, startSec + 0.035);

      const peak = Math.max(0.01, amp * 1.15);
      subGain.gain.setValueAtTime(0.001, startSec);
      subGain.gain.linearRampToValueAtTime(peak, startSec + 0.004);
      subGain.gain.exponentialRampToValueAtTime(peak * 0.55, startSec + 0.08);
      subGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.32);

      bodyGain.gain.setValueAtTime(peak * 0.5, startSec);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.045);

      subOsc.connect(subGain);
      bodyOsc.connect(bodyGain);
      subGain.connect(output);
      bodyGain.connect(output);

      subOsc.start(startSec);
      bodyOsc.start(startSec);
      subOsc.stop(startSec + 0.34);
      bodyOsc.stop(startSec + 0.055);

      let cleaned = false;
      const cleanup: ActiveVoiceCleanup = {
        fadeOutAndStop: (_now: number) => {
          cleanup.stopAndDisconnect();
        },
        stopAndDisconnect: () => {
          if (cleaned) return;
          cleaned = true;
          this.activeVoices.delete(cleanup);
          this.activeVoiceMeta.delete(cleanup);
          try {
            subOsc.stop();
            bodyOsc.stop();
          } catch {
            // Ignore
          }
          try {
            subOsc.disconnect();
            bodyOsc.disconnect();
            subGain.disconnect();
            bodyGain.disconnect();
            pannerNode?.disconnect();
          } catch {
            // Ignore
          }
        },
      };
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, { startTime: startSec, endTime: startSec + 0.34 });
      subOsc.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    // 2. STUDIO HAND CLAP (cp / clap / 39): 4-Burst Human Flam Envelope + Warm 1.35kHz Bandpass
    if (key === 'cp' || key === 'clap' || midi === 39) {
      const dur = 0.24;
      const cacheKey = `clap:${sr}`;
      let buf = this.drumBufferCache.get(cacheKey);
      if (!buf) {
        const len = Math.floor(sr * dur);
        buf = ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);

        // 4 staggered micro-clap transients at 0ms, 11ms, 21ms, and 32ms + diffused tail
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          let env = 0;
          if (t < 0.011) env = Math.exp(-(t / 0.0035));
          else if (t < 0.021) env = Math.exp(-((t - 0.011) / 0.0035));
          else if (t < 0.032) env = Math.exp(-((t - 0.021) / 0.004));
          else env = Math.exp(-((t - 0.032) / 0.055)) * 0.75;
          data[i] = (Math.random() * 2 - 1) * env;
        }
        this.drumBufferCache.set(cacheKey, buf);
      }

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1350, startSec);
      bp.Q.setValueAtTime(1.4, startSec);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(Math.max(0.01, amp * 0.9), startSec);
      gain.gain.exponentialRampToValueAtTime(0.0001, startSec + dur);

      src.connect(bp);
      bp.connect(gain);
      gain.connect(output);
      src.start(startSec);

      let cleaned = false;
      const cleanup: ActiveVoiceCleanup = {
        fadeOutAndStop: (_now: number) => {
          cleanup.stopAndDisconnect();
        },
        stopAndDisconnect: () => {
          if (cleaned) return;
          cleaned = true;
          this.activeVoices.delete(cleanup);
          this.activeVoiceMeta.delete(cleanup);
          try {
            src.stop();
          } catch {
            // Ignore
          }
          try {
            src.disconnect();
            bp.disconnect();
            gain.disconnect();
            pannerNode?.disconnect();
          } catch {
            // Ignore
          }
        },
      };
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, { startTime: startSec, endTime: startSec + dur + 0.02 });
      src.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    // 3. ACOUSTIC STUDIO SNARE (s / sd / snare / rim / 37 / 38): Dual Drumhead Modes + Bandpass Snare Wires
    if (key === 's' || key === 'sd' || key === 'snare' || key === 'rim' || midi === 38 || midi === 37) {
      const mode1 = ctx.createOscillator();
      const mode2 = ctx.createOscillator();
      const modeGain = ctx.createGain();

      mode1.type = 'triangle';
      mode2.type = 'sine';
      mode1.frequency.setValueAtTime(210, startSec);
      mode1.frequency.exponentialRampToValueAtTime(118, startSec + 0.075);
      mode2.frequency.setValueAtTime(345, startSec);
      mode2.frequency.exponentialRampToValueAtTime(185, startSec + 0.055);

      const peak = Math.max(0.01, amp * 0.85);
      modeGain.gain.setValueAtTime(peak * 0.7, startSec);
      modeGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.11);

      mode1.connect(modeGain);
      mode2.connect(modeGain);
      modeGain.connect(output);
      mode1.start(startSec);
      mode2.start(startSec);
      mode1.stop(startSec + 0.12);
      mode2.stop(startSec + 0.12);

      // Snare wires: bandpass-filtered shell rattle + crisp stick snap
      const dur = 0.21;
      const cacheKey = `snare_wires:${sr}`;
      let buf = this.drumBufferCache.get(cacheKey);
      if (!buf) {
        const len = Math.floor(sr * dur);
        buf = ctx.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const snap = t < 0.006 ? 1.0 : 0.65 * Math.exp(-(t - 0.006) * 16);
          data[i] = (Math.random() * 2 - 1) * snap;
        }
        this.drumBufferCache.set(cacheKey, buf);
      }

      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = buf;

      const wireFilter = ctx.createBiquadFilter();
      wireFilter.type = 'bandpass';
      wireFilter.frequency.setValueAtTime(2450, startSec);
      wireFilter.Q.setValueAtTime(0.9, startSec);

      const wireGain = ctx.createGain();
      wireGain.gain.setValueAtTime(peak * 0.8, startSec);
      wireGain.gain.exponentialRampToValueAtTime(0.0001, startSec + dur);

      noiseSrc.connect(wireFilter);
      wireFilter.connect(wireGain);
      wireGain.connect(output);
      noiseSrc.start(startSec);

      let cleaned = false;
      const cleanup: ActiveVoiceCleanup = {
        fadeOutAndStop: (_now: number) => {
          cleanup.stopAndDisconnect();
        },
        stopAndDisconnect: () => {
          if (cleaned) return;
          cleaned = true;
          this.activeVoices.delete(cleanup);
          this.activeVoiceMeta.delete(cleanup);
          try {
            mode1.stop();
            mode2.stop();
            noiseSrc.stop();
          } catch {
            // Ignore
          }
          try {
            mode1.disconnect();
            mode2.disconnect();
            modeGain.disconnect();
            noiseSrc.disconnect();
            wireFilter.disconnect();
            wireGain.disconnect();
            pannerNode?.disconnect();
          } catch {
            // Ignore
          }
        },
      };
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, { startTime: startSec, endTime: startSec + dur + 0.02 });
      noiseSrc.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    // 4. TUNED ACOUSTIC TOMS (lt / mt / ht / 45 / 47 / 50)
    if (key === 'lt' || key === 'mt' || key === 'ht' || midi === 45 || midi === 47 || midi === 50) {
      const baseTomFreq = key === 'ht' || midi === 50 ? 165 : key === 'mt' || midi === 47 ? 125 : 92;
      const tomOsc = ctx.createOscillator();
      const tomGain = ctx.createGain();
      tomOsc.type = 'sine';
      tomOsc.frequency.setValueAtTime(baseTomFreq * 1.45, startSec);
      tomOsc.frequency.exponentialRampToValueAtTime(baseTomFreq, startSec + 0.06);
      tomOsc.frequency.exponentialRampToValueAtTime(baseTomFreq * 0.78, startSec + 0.28);

      const peak = Math.max(0.01, amp * 0.9);
      tomGain.gain.setValueAtTime(peak, startSec);
      tomGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.29);

      tomOsc.connect(tomGain);
      tomGain.connect(output);
      tomOsc.start(startSec);
      tomOsc.stop(startSec + 0.31);

      let cleaned = false;
      const cleanup: ActiveVoiceCleanup = {
        fadeOutAndStop: (_now: number) => {
          cleanup.stopAndDisconnect();
        },
        stopAndDisconnect: () => {
          if (cleaned) return;
          cleaned = true;
          this.activeVoices.delete(cleanup);
          this.activeVoiceMeta.delete(cleanup);
          try {
            tomOsc.stop();
          } catch {
            // Ignore
          }
          try {
            tomOsc.disconnect();
            tomGain.disconnect();
            pannerNode?.disconnect();
          } catch {
            // Ignore
          }
        },
      };
      this.activeVoices.add(cleanup);
      this.activeVoiceMeta.set(cleanup, { startTime: startSec, endTime: startSec + 0.31 });
      tomOsc.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    // 5. METALLIC BRONZE HI-HATS & CYMBALS (h / hh / oh / cr / rd / 42 / 46 / 49 / 51)
    const isCrashOrRide = key === 'cr' || key === 'rd' || midi === 49 || midi === 51;
    const isOpenHat = key === 'oh' || midi === 46 || isCrashOrRide;
    const dur = isCrashOrRide ? 0.65 : isOpenHat ? 0.28 : 0.058;
    const cymCacheKey = `cymbal:${sr}:${isCrashOrRide ? 'cr' : isOpenHat ? 'oh' : 'ch'}`;
    let buf = this.drumBufferCache.get(cymCacheKey);
    if (!buf) {
      const len = Math.floor(sr * dur);
      buf = ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);

      // Synthesize 6 inharmonic metallic cymbal modes + crisp air shimmer (eliminating flat white-noise hiss)
      const w1 = (2 * Math.PI * 3171) / sr;
      const w2 = (2 * Math.PI * 4483) / sr;
      const w3 = (2 * Math.PI * 5869) / sr;
      const w4 = (2 * Math.PI * 7331) / sr;
      const w5 = (2 * Math.PI * 8923) / sr;
      const w6 = (2 * Math.PI * 10459) / sr;

      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.exp(-t / (isCrashOrRide ? 0.22 : isOpenHat ? 0.095 : 0.015));
        const metallic =
          (Math.sin(i * w1) +
            Math.sin(i * w2) +
            Math.sin(i * w3) +
            Math.sin(i * w4) +
            Math.sin(i * w5) +
            Math.sin(i * w6)) *
          0.11;
        const air = (Math.random() * 2 - 1) * 0.34;
        data[i] = (metallic + air) * env;
      }
      this.drumBufferCache.set(cymCacheKey, buf);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.Q.setValueAtTime(0.707, startSec);
    hp.frequency.setValueAtTime(isCrashOrRide ? 4800 : 7800, startSec);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.005, amp * (isOpenHat ? 0.52 : 0.42)), startSec);
    gain.gain.exponentialRampToValueAtTime(0.0001, startSec + dur);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(output);
    src.start(startSec);

    let cleaned = false;
    const cleanup: ActiveVoiceCleanup = {
      fadeOutAndStop: (stopAtSec: number) => {
        if (cleaned) return;
        try {
          const nowTime = (ctx as AudioContext).currentTime || 0;
          if (stopAtSec > nowTime + 0.01) {
            gain.gain.setTargetAtTime?.(0.0001, stopAtSec, 0.006);
            src.stop(stopAtSec + 0.025);
            return;
          }
        } catch {
          // Fall through to immediate cleanup
        }
        cleanup.stopAndDisconnect();
      },
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
        this.activeVoiceMeta.delete(cleanup);
        try {
          src.stop();
        } catch {
          // Ignore
        }
        try {
          src.disconnect();
          hp.disconnect();
          gain.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };
    this.activeVoices.add(cleanup);
    this.activeVoiceMeta.set(cleanup, { startTime: startSec, endTime: startSec + dur });
    src.onended = () => cleanup.stopAndDisconnect();
    return cleanup;
  }

  public getActiveClipsByTrack(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.activeClipIdsByTrack.entries()) {
      out[k] = v;
    }
    return out;
  }

  public getQueuedClipsByTrack(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of this.queuedClipIdsByTrack.entries()) {
      out[k] = v;
    }
    return out;
  }

  /**
   * Computes the quantization delay in seconds until the next launch boundary
   * (`"none"`, `"1/8"`, `"1/4"`, `"1/2"`, `"1/1"`, `"2/1"`, `"4/1"`).
   */
  public computeQuantizeDelaySec(quantizeSpec?: string, tempoBpm: number = 120): number {
    const clean = (quantizeSpec || 'none').trim().toLowerCase();
    if (!this.isPlaying || !this.ctx || clean === 'none' || clean === 'off' || clean === '0') {
      return 0;
    }

    const secPerBeat = 60 / (tempoBpm || 120);
    let boundaryBeats = 4; // Default 1/1 bar (4 quarter beats)
    if (clean === '1/16') boundaryBeats = 0.25;
    else if (clean === '1/8') boundaryBeats = 0.5;
    else if (clean === '1/4') boundaryBeats = 1;
    else if (clean === '1/2') boundaryBeats = 2;
    else if (clean === '1/1' || clean === '1 bar') boundaryBeats = 4;
    else if (clean === '2/1' || clean === '2 bars') boundaryBeats = 8;
    else if (clean === '4/1' || clean === '4 bars') boundaryBeats = 16;

    const boundarySec = boundaryBeats * secPerBeat;
    const elapsed = Math.max(0, this.ctx.currentTime - this.startContextTime);
    const remainder = elapsed % boundarySec;
    if (remainder < 0.015 || boundarySec - remainder < 0.015) return 0;
    return boundarySec - remainder;
  }

  /**
   * Launches a single Session View clip (or virtual measure clip) on its track,
   * looping the active set of running Session clips.
   */
  public async launchClip(
    score: CompiledScore,
    clipId: string,
    trackId: string,
    clipEvents: AtomicEvent[],
    clipDef?: ClipDefinition
  ): Promise<void> {
    this.activeClipIdsByTrack.set(trackId, clipId);
    this.queuedClipIdsByTrack.delete(trackId);
    this.isLooping = true;

    const subScore: CompiledScore = {
      ...score,
      events: clipEvents.map((ev) => ({
        ...ev,
        startTime: ev.startTime || { numerator: 0, denominator: 1 },
      })),
    };
    await this.playScore(subScore);

    // If the launched clip defines an Ableton Follow Action, resolve the next clip on the track
    if (clipDef?.followAction && score.clips && score.clips.length > 0) {
      const trackClips = score.clips.filter((c) => c.trackId === trackId);
      const resolution = FollowActionEngine.resolveNextClip(clipDef, trackClips);
      if (resolution.targetClip) {
        this.queuedClipIdsByTrack.set(trackId, resolution.targetClip.id);
      }
    }
  }

  /**
   * Launches an entire horizontal Scene row across all tracks in the scene.
   */
  public async launchScene(
    score: CompiledScore,
    _sceneIndex: number,
    sceneEvents: AtomicEvent[],
    trackClipMap: Record<string, string>,
    sceneTempo?: number
  ): Promise<void> {
    this.activeClipIdsByTrack.clear();
    this.queuedClipIdsByTrack.clear();
    for (const [tId, cId] of Object.entries(trackClipMap)) {
      this.activeClipIdsByTrack.set(tId, cId);
    }
    this.isLooping = true;

    const subScore: CompiledScore = {
      ...score,
      meta: {
        ...score.meta,
        tempo: sceneTempo && sceneTempo > 0 ? sceneTempo : score.meta.tempo,
      },
      events: sceneEvents.map((ev) => ({
        ...ev,
        startTime: ev.startTime || { numerator: 0, denominator: 1 },
      })),
    };
    await this.playScore(subScore);
  }

  public stopTrackClip(trackId: string): void {
    this.activeClipIdsByTrack.delete(trackId);
    this.queuedClipIdsByTrack.delete(trackId);
    if (this.activeClipIdsByTrack.size === 0) {
      this.stop(true);
    }
  }

  private playbackSessionId = 0;

  private computeScoreSignature(score: CompiledScore): string {
    let hash = 2166136261;
    const mixHash = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
      }
    };
    for (const d of score.defs) {
      mixHash(
        `${d.id}:${d.patch}:${d.style}:${d.volume ?? ''}:${d.pan ?? ''}:${d.groupId ?? (d as any).group ?? ''}:${JSON.stringify(d.fxChain ?? d.fx ?? '')}:${JSON.stringify(d.sends ?? '')}|`
      );
    }
    for (const ev of score.events) {
      const st = ev.startTime ? `${ev.startTime.numerator}/${ev.startTime.denominator}` : '0';
      const dur = ev.duration ? `${ev.duration.numerator}/${ev.duration.denominator}` : '0';
      mixHash(`${ev.trackId}:${ev.voiceId}:${st}:${dur}:${ev.pitch?.midi ?? -1}:${ev.rawToken ?? ''}|`);
    }
    return JSON.stringify({
      title: score.meta?.title || '',
      tempo: score.meta?.tempo || 120,
      time: score.meta?.time || '4/4',
      defsLen: score.defs.length,
      eventsLen: score.events.length,
      contentHash: hash >>> 0,
      muted: Array.from(this.mutedTracks).sort().join(','),
      soloed: Array.from(this.soloedTracks).sort().join(','),
      vols: Array.from(this.trackVolumes.entries()),
      pans: Array.from(this.trackPans.entries()),
      masterVol: Math.round(this.masterVolumeScalar * 1000),
      sfBanks: this.soundfontLoader.getCachedBankCount(),
    });
  }

  /**
   * 1-Click Score Pre-Downloader & Offline Synth Prebaker (`⬇ Pre-Download`):
   * 1. Pre-downloads and decodes all required SoundFont banks for `score` (2 banks at a time, 25s timeout).
   * 2. Pre-renders 100% of the score's `ContinuousSynthEngine` voices and `.fx(...)` chains into memory
   *    in non-blocking 10-voice batches so subsequent `playScore(score)` runs with zero runtime synthesis!
   */
  public async predownloadAndCacheScore(
    score: CompiledScore,
    onProgress?: (progress: { percent: number; label: string; done: boolean }) => void
  ): Promise<{ banksCached: number; notesDecoded: number; synthVoicesBaked: number }> {
    this.unlockAudioContext();
    let ctx: AudioContext | null = null;
    try {
      ctx = this.ensureContext();
    } catch {
      ctx = null;
    }

    onProgress?.({ percent: 5, label: 'Downloading SoundFont banks...', done: false });

    const sfStats = await this.soundfontLoader.predownloadScoreAssets(ctx, score, (sfProg) => {
      const bankRatio =
        sfProg.totalBanks > 0 ? sfProg.loadedBanks / sfProg.totalBanks : 1;
      const noteRatio =
        sfProg.totalNotes > 0 ? sfProg.decodedNotes / sfProg.totalNotes : 1;
      const pct = Math.min(45, Math.round((bankRatio * 0.5 + noteRatio * 0.5) * 45));
      onProgress?.({
        percent: pct,
        label: `Caching Samples (${sfProg.loadedBanks}/${sfProg.totalBanks} banks)...`,
        done: false,
      });
    });

    const timeline = this.buildScheduledTimeline(score);
    const tempoBpm = Number(score.meta?.tempo) || 120;
    let synthVoicesBaked = 0;

    if (ctx && typeof ctx.createBuffer === 'function') {
      const synthIndices: number[] = [];
      for (let i = 0; i < timeline.length; i++) {
        const it = timeline[i];
        if (
          ContinuousSynthEngine.isContinuousSynthPatch(
            it.patch,
            it.style,
            it.event.physics
          )
        ) {
          synthIndices.push(i);
        }
      }

      const totalSynth = synthIndices.length;
      const BATCH_SIZE = 10;
      for (let b = 0; b < totalSynth; b += BATCH_SIZE) {
        const slice = synthIndices.slice(b, b + BATCH_SIZE);
        for (const idx of slice) {
          const item = timeline[idx];
          if (!item.prebakedBuffer) {
            const sr = ctx.sampleRate || 44100;
            const isStacc =
              item.event.physics?.articulation === 'stacc' ||
              item.event.physics?.articulation === 'staccato';
            const relSec = isStacc ? 0.14 : 0.28;
            const totalSec = Math.max(0.06, item.durSec + relSec);
            const frames = Math.max(128, Math.floor(totalSec * sr));
            const buf = ctx.createBuffer(2, frames, sr);
            const left = buf.getChannelData(0);
            const right = buf.getChannelData(1);

            ContinuousSynthEngine.renderVoiceIntoTrackStem(
              left,
              right,
              0,
              frames,
              sr,
              tempoBpm,
              idx + 1,
              item
            );
            const activeFxChain = AbletonAudioFxEngine.resolveActiveFxChain(
              item.def,
              item.event
            );
            if (activeFxChain.length > 0) {
              AbletonAudioFxEngine.applyFxChainToSlice(
                left,
                right,
                0,
                frames,
                sr,
                activeFxChain,
                {
                  lyric: item.event.physics?.lyric,
                  carrierFreqHz: item.freq,
                }
              );
            }
            item.prebakedBuffer = buf;
          }
          synthVoicesBaked++;
        }

        const pct =
          45 +
          Math.round(
            (Math.min(totalSynth, b + BATCH_SIZE) / Math.max(1, totalSynth)) * 55
          );
        onProgress?.({
          percent: Math.min(99, pct),
          label: `Pre-baking Synth Voices (${synthVoicesBaked}/${totalSynth})...`,
          done: false,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    this.scheduledTimeline = timeline;
    const scoreSig = this.computeScoreSignature(score);
    this.prebakedScoreSignature = scoreSig;

    // In browser / Electron runtime, pre-render the unified stereo master mix buffer
    // so subsequent Play clicks stream a single AudioBufferSourceNode with zero runtime CPU!
    if (
      ctx &&
      typeof ctx.createBuffer === 'function' &&
      !this.soundfontLoader.isTestEnvironment()
    ) {
      onProgress?.({
        percent: 96,
        label: 'Mastering Full Score Buffer...',
        done: false,
      });
      await new Promise((r) => setTimeout(r, 0));
      const rendered = await this.renderScoreToStereoPcm(score);
      const mixBuf = ctx.createBuffer(
        2,
        rendered.left.length,
        rendered.sampleRate
      );
      mixBuf.getChannelData(0).set(rendered.left);
      mixBuf.getChannelData(1).set(rendered.right);
      this.cachedMasterMixBuffer = mixBuf;
      this.cachedMasterMixSignature = scoreSig;
    }

    onProgress?.({ percent: 100, label: 'Cached Offline', done: true });

    return {
      banksCached: sfStats.banksCached,
      notesDecoded: sfStats.notesDecoded,
      synthVoicesBaked,
    };
  }

  public async playScore(score: CompiledScore): Promise<void> {
    this.stop(false);
    const sessionId = ++this.playbackSessionId;

    const ctx = this.ensureContext();
    this.rebuildMasterChain(ctx);
    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      await ctx.resume();
    }

    const { totalQuarterBeats, totalSeconds } = this.calculateScoreDuration(score);
    this.totalQuarterBeats = totalQuarterBeats;
    this.scoreDurationSec = totalSeconds;
    this.tempoBpm = Number(score.meta?.tempo) || 120;

    const currentSig = this.computeScoreSignature(score);
    const hasPrebakedTimeline =
      this.prebakedScoreSignature === currentSig &&
      this.scheduledTimeline.length > 0 &&
      this.countInBars === 0;

    if (!hasPrebakedTimeline) {
      this.scheduledTimeline = this.buildScheduledTimeline(score);
      this.prebakedScoreSignature = this.countInBars === 0 ? currentSig : null;
    }

    const [beatsStr] = (score.meta?.time || '4/4').split('/');
    const beatsPerBar = Math.max(1, parseInt(beatsStr, 10) || 4);
    const countInSec = this.countInBars > 0 ? this.countInBars * beatsPerBar * (60 / this.tempoBpm) : 0;
    if (countInSec > 0) {
      for (const item of this.scheduledTimeline) {
        item.startSec += countInSec;
      }
      this.scoreDurationSec += countInSec;
    }
    const metronomeTicks =
      this.isMetronomeEnabled || this.countInBars > 0
        ? MetronomeAndCaptureEngine.buildMetronomeSchedule(
            this.totalQuarterBeats,
            this.tempoBpm,
            score.meta?.time || '4/4',
            this.countInBars
          )
        : [];
    let nextMetronomeIdx = 0;
    this.nextScheduleIndex = 0;
    this.isPlaying = true;

    await this.soundfontLoader.prewarmScoreSamples(ctx, score);
    if (!this.isPlaying || this.playbackSessionId !== sessionId) return;

    const baseTempo = this.tempoBpm;
    const tempoMap = score.meta?.tempoMap;
    let lastRafTimeMs = 0;
    let lastTrackedStartCtxTime = -1;
    let lastMonotonicElapsedSec = 0;
    let lastObservedCtxTime = -1;
    let lastAudioClockAdvanceWallMs = 0;
    const rafDeltaWindowMs: number[] = [];
    let detectedRefreshRateHz = 60;
    // Capture a clamped baseline hardware latency once per session so mid-stream Bluetooth A2DP
    // outputLatency renegotiations never cause the visual playhead to snap backward and flicker.
    const sessionHwLatencySec = Math.min(
      0.18,
      Math.max(
        0,
        Number((ctx as unknown as { outputLatency?: number }).outputLatency) ||
          Number((ctx as unknown as { baseLatency?: number }).baseLatency) ||
          0
      )
    );

    const tickVisualProgress = (frameTimeMs: DOMHighResTimeStamp) => {
      if (!this.isPlaying || this.playbackSessionId !== sessionId || !this.ctx) return;
      this.rafId = requestAnimationFrame(tickVisualProgress);

      if (lastRafTimeMs > 0) {
        const elapsedRafMs = frameTimeMs - lastRafTimeMs;
        // Guard only against duplicate synthetic sub-millisecond calls (< 1.5ms);
        // allow up to 500Hz native hardware VSync!
        if (elapsedRafMs < 1.5) {
          return;
        }
        if (elapsedRafMs >= 1.8 && elapsedRafMs <= 50) {
          rafDeltaWindowMs.push(elapsedRafMs);
          if (rafDeltaWindowMs.length > 30) {
            rafDeltaWindowMs.shift();
          }
          if (rafDeltaWindowMs.length >= 6 && rafDeltaWindowMs.length % 6 === 0) {
            detectedRefreshRateHz = estimateRefreshRateFromDeltas(rafDeltaWindowMs).snappedHz;
          }
        }
      }
      lastRafTimeMs = frameTimeMs;

      playbackDiag.recordVisualFrame();

      if (this.startContextTime !== lastTrackedStartCtxTime) {
        lastTrackedStartCtxTime = this.startContextTime;
        lastMonotonicElapsedSec = 0;
        lastObservedCtxTime = -1;
        lastAudioClockAdvanceWallMs = frameTimeMs;
      }

      const now = this.ctx.currentTime;
      // Phase-locked sub-quantum clock interpolation:
      // Web Audio's `ctx.currentTime` advances in 128-sample render quanta (~2.9ms at 44.1kHz).
      // On 120Hz/144Hz/240Hz monitors (4.16ms–8.33ms per frame), interpolating with high-res
      // `frameTimeMs` between audio quantum ticks eliminates quantum aliasing and delivers
      // silky sub-pixel motion on every VSync frame while remaining strictly locked to `ctx.currentTime`.
      if (now !== lastObservedCtxTime) {
        lastObservedCtxTime = now;
        lastAudioClockAdvanceWallMs = frameTimeMs;
      }
      const subQuantumSec =
        lastAudioClockAdvanceWallMs > 0
          ? Math.min(0.012, Math.max(0, (frameTimeMs - lastAudioClockAdvanceWallMs) / 1000))
          : 0;

      const candidateElapsed = Math.max(
        0,
        now + subQuantumSec - this.startContextTime - sessionHwLatencySec
      );
      const rawElapsed = Math.max(lastMonotonicElapsedSec, candidateElapsed);
      lastMonotonicElapsedSec = rawElapsed;

      const audibleScoreSec = Math.max(0, rawElapsed - countInSec);
      const currentWhole = this.secondsToWholeNote(audibleScoreSec, baseTempo, tempoMap);
      const currentBeat = Math.min(this.totalQuarterBeats, currentWhole * 4);
      const activeTempo = this.getTempoAtWholeNote(currentWhole, baseTempo, tempoMap);

      this.onProgress?.({
        isPlaying: true,
        currentQuarterBeat: currentBeat,
        totalQuarterBeats: this.totalQuarterBeats,
        currentTimeSec: rawElapsed,
        totalDurationSec: this.scoreDurationSec,
        currentTempoBpm: activeTempo,
        currentRefreshRateHz: detectedRefreshRateHz,
      });
    };

    // Recompute signature after prewarmScoreSamples in case new SoundFont banks were decoded
    const postWarmSig = this.computeScoreSignature(score);

    // If the user explicitly pre-mastered this exact score via `predownloadAndCacheScore`,
    // stream the cached master buffer directly. Otherwise use the non-blocking real-time
    // lookahead scheduler + Web Worker voice bake pool so pressing Play starts immediately!
    if (
      !this.soundfontLoader.isTestEnvironment() &&
      this.cachedMasterMixBuffer &&
      this.cachedMasterMixSignature === postWarmSig &&
      typeof ctx.createBufferSource === 'function'
    ) {
      const baseStart = ctx.currentTime + 0.04;
      this.startContextTime = baseStart;

      const src = ctx.createBufferSource();
      src.buffer = this.cachedMasterMixBuffer;
      const outNode = this.masterGain ?? ctx.destination;
      src.connect(outNode);
      src.start(baseStart + countInSec);

      const handle: ActiveVoiceCleanup = {
        stopAndDisconnect: () => {
          try {
            src.stop();
          } catch {}
          try {
            src.disconnect();
          } catch {}
        },
        fadeOutAndStop: (whenSec: number) => {
          try {
            src.stop(whenSec + 0.02);
          } catch {}
        },
      };
      this.activeVoices.add(handle);
      this.activeVoiceMeta.set(handle, {
        startTime: baseStart + countInSec,
        endTime: baseStart + countInSec + this.scoreDurationSec,
      });

      const monitorMasterStream = () => {
        if (!this.isPlaying || !this.ctx) return;
        const now = this.ctx.currentTime;
        const elapsed = Math.max(0, now - this.startContextTime);

        while (
          nextMetronomeIdx < metronomeTicks.length &&
          metronomeTicks[nextMetronomeIdx].timeSec <= elapsed + 0.5
        ) {
          const tick = metronomeTicks[nextMetronomeIdx];
          if (
            (this.isMetronomeEnabled || tick.isCountIn) &&
            tick.timeSec >= elapsed - 0.035
          ) {
            this.scheduleMetronomeClick(
              this.ctx,
              this.startContextTime + tick.timeSec,
              tick.frequencyHz,
              tick.isDownbeat
            );
          }
          nextMetronomeIdx++;
        }

        if (elapsed >= this.scoreDurationSec) {
          if (this.isLooping) {
            this.playScore(score);
            return;
          }
          this.stop(true);
        }
      };

      monitorMasterStream();
      this.schedulerIntervalId = window.setInterval(monitorMasterStream, 50);
      this.rafId = requestAnimationFrame(tickVisualProgress);
      return;
    }

    const pool = this.getBakePool();
    playbackDiag.startSession(
      this.scheduledTimeline.length,
      this.tempoBpm,
      score.meta?.title || 'Untitled',
      ctx.currentTime + 0.05
    );
    playbackDiag.recordTimelineCompilation(
      this.scheduledTimeline.map((it) => ({
        startSec: it.startSec,
        durSec: it.durSec,
        track: {
          id: it.event.trackId || 'pno',
          style: it.style,
          patch: it.patch,
        },
        event: {
          measure: (it.event as any).measureNumber || (it.event as any).measure || 1,
          beat:
            (it.event as any).beat ||
            (it.event.startTime
              ? Number((((it.event.startTime.numerator / it.event.startTime.denominator) % 1) * 4 + 1).toFixed(2))
              : 1),
          type: (it.event as any).type || 'note',
        },
      })),
      this.tempoBpm,
      beatsPerBar
    );

    // Dispatch opening notes to workers and await up to 350ms so the first several measures
    // are 100% prebaked in the ring buffer before the audio clock starts ticking!
    if (pool) {
      const startupBakes = this.requestWorkerBakes(
        ctx,
        this.scheduledTimeline,
        this.tempoBpm,
        0,
        8.0
      );
      if (startupBakes.length > 0) {
        await Promise.race([
          Promise.all(startupBakes),
          new Promise((resolve) => setTimeout(resolve, 350)),
        ]);
      }
    } else {
      this.prebakeContinuousSynthTimeline(ctx, this.scheduledTimeline, this.tempoBpm, 0, 2.5, 12, 55);
    }

    const baseStart = ctx.currentTime + 0.05;
    this.startContextTime = baseStart;

    // 0.35s schedule lookahead provides ample buffer against minor frame drops or GC pauses
    const DEFAULT_LOOKAHEAD_SEC = 0.35;
    let schedulerSubTick = 0;

    const scheduleLookaheadSlice = () => {
      if (!this.isPlaying || this.playbackSessionId !== sessionId || !this.ctx) return;
      const tickWallStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const now = this.ctx.currentTime;
      const elapsed = Math.max(0, now - this.startContextTime);
      // Widen lookahead when the browser tab is hidden so 1s background timer throttling never drops notes
      const lookaheadSec =
        typeof document !== 'undefined' && document.hidden ? 1.5 : DEFAULT_LOOKAHEAD_SEC;

      const activePool = this.getBakePool();
      if (activePool) {
        activePool.cancelStaleJobs(elapsed);
      }

      const shouldRefillRing =
        schedulerSubTick % 2 === 0 ||
        (activePool !== null && activePool.queuedCount < 8);
      schedulerSubTick++;

      if (shouldRefillRing) {
        // Evict finished AudioBuffers strictly behind the playhead (retainBehindSec = 1.5s)
        this.voiceRingBuffer.evictTimelineWindow(
          this.scheduledTimeline,
          elapsed,
          1.5,
          60.0,
          this.isLooping
        );

        if (activePool) {
          this.requestWorkerBakes(
            this.ctx,
            this.scheduledTimeline,
            this.tempoBpm,
            elapsed,
            elapsed + 8.0
          );
        } else {
          // Fallback when Web Workers are unavailable (e.g. unit test environments)
          this.prebakeContinuousSynthTimeline(
            this.ctx,
            this.scheduledTimeline,
            this.tempoBpm,
            elapsed,
            elapsed + 2.5,
            2,
            6
          );
        }
      }
      if (this.activeVoices.size > 32 && schedulerSubTick % 2 === 0) {
        this.pruneFinishedVoices(now);
      }

      while (
        nextMetronomeIdx < metronomeTicks.length &&
        metronomeTicks[nextMetronomeIdx].timeSec <= elapsed + lookaheadSec
      ) {
        const tick = metronomeTicks[nextMetronomeIdx];
        if (
          (this.isMetronomeEnabled || tick.isCountIn) &&
          tick.timeSec >= elapsed - 0.035
        ) {
          this.scheduleMetronomeClick(
            this.ctx,
            this.startContextTime + tick.timeSec,
            tick.frequencyHz,
            tick.isDownbeat
          );
        }
        nextMetronomeIdx++;
      }

      while (
        this.nextScheduleIndex < this.scheduledTimeline.length &&
        this.scheduledTimeline[this.nextScheduleIndex].startSec <= elapsed + lookaheadSec
      ) {
        const item = this.scheduledTimeline[this.nextScheduleIndex];
        const latenessSec = elapsed - item.startSec;
        if (latenessSec <= 0.04) {
          this.triggerRealtimeVoice(this.ctx, item, this.startContextTime + item.startSec, 0);
        } else {
          // If a main-thread GC or UI frame spike delayed the timer past item.startSec,
          // recover both short drum/ratchet hits and sustained notes immediately instead of dropping them!
          const recoverOffset =
            item.style === 'grid' || item.gridKey || item.durSec <= 0.35 ? 0 : latenessSec;
          if (item.durSec - recoverOffset >= 0.02) {
            this.triggerRealtimeVoice(this.ctx, item, now + 0.006, recoverOffset);
          }
        }
        this.nextScheduleIndex++;
      }

      const tickDurationMs =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - tickWallStart;
      const currentWhole = this.secondsToWholeNote(
        Math.max(0, elapsed - countInSec),
        baseTempo,
        tempoMap
      );
      const currentMeasure = Math.floor(currentWhole) + 1;
      const currentBeatInBar = (currentWhole - Math.floor(currentWhole)) * beatsPerBar + 1;

      this.sampleHardwareSignalTelemetry(now, elapsed, currentMeasure, currentBeatInBar);

      playbackDiag.recordSchedulerTick({
        playheadSec: elapsed,
        measure: currentMeasure,
        beat: currentBeatInBar,
        audioCtxState: String(this.ctx.state || 'running'),
        audioCtxCurrentTime: now,
        schedulerCpuMs: tickDurationMs,
        activeVoices: this.activeVoices.size,
        totalTimelineEvents: this.scheduledTimeline.length,
        timelineCursor: this.nextScheduleIndex,
        deferredVoicesAwaiting: this.voicesAwaitingBake.size,
        pendingWorkerBakes: this.pendingBakes.size,
        ringBufferStats: this.voiceRingBuffer.stats,
      });

      if (elapsed >= this.scoreDurationSec) {
        if (this.isLooping) {
          // Seamless gapless loop restart: preserve active reverb tails and shift startContextTime
          // forward by the musical loop length without stopping the AudioContext or re-awaiting prewarm!
          const musicalLoopSec = Math.max(0.1, this.scoreDurationSec - countInSec);
          this.startContextTime += musicalLoopSec;
          this.nextScheduleIndex = 0;
          this.voicesAwaitingBake.clear();
          nextMetronomeIdx = metronomeTicks.findIndex((t) => !t.isCountIn);
          if (nextMetronomeIdx < 0) nextMetronomeIdx = metronomeTicks.length;
          return;
        }
        this.stop(true);
      }
    };

    // Run audio lookahead immediately and on a steady 25ms timer independent of UI rendering
    scheduleLookaheadSlice();
    this.schedulerIntervalId = window.setInterval(scheduleLookaheadSlice, 25);

    this.rafId = requestAnimationFrame(tickVisualProgress);
  }

  public stop(notify: boolean = true): void {
    const wasPlaying = this.isPlaying;
    this.isPlaying = false;
    this.playbackSessionId++;
    this.pendingBakes.clear();
    this.pendingBakeKeys.clear();
    this.voicesAwaitingBake.clear();
    this.bakePool?.cancelPending();
    if (wasPlaying) {
      playbackDiag.stopSession(notify ? 'completed_or_user_stop' : 'restarting');
    }
    if (this.schedulerIntervalId !== null) {
      window.clearInterval(this.schedulerIntervalId);
      this.schedulerIntervalId = null;
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    for (const voice of Array.from(this.activeVoices)) {
      voice.stopAndDisconnect();
    }
    this.activeVoices.clear();
    this.activeVoiceMeta.clear();
    this.activeChokeGroups.clear();

    if (notify) {
      this.onProgress?.({
        isPlaying: false,
        currentQuarterBeat: 0,
        totalQuarterBeats: this.totalQuarterBeats,
        currentTimeSec: 0,
        totalDurationSec: this.scoreDurationSec,
        currentTempoBpm: this.tempoBpm,
      });
    }
  }

  /**
   * Synthesizes the entire multi-track score directly into stereo Float32 PCM buffers
   * with zero WebAudio node limits and strict feed-forward reflections so 60+ measure scores
   * render completely from measure 1 to the final reverb tail.
   */
  public async renderScoreToStereoPcm(score: CompiledScore): Promise<{
    left: Float32Array;
    right: Float32Array;
    sampleRate: number;
    totalSeconds: number;
    totalQuarterBeats: number;
  }> {
    try {
      if (!this.soundfontLoader.isTestEnvironment()) {
        const requiredAssets = this.soundfontLoader.extractRequiredScoreAssets(score);
        if (requiredAssets.size > 0) {
          const OfflineCtx =
            typeof OfflineAudioContext !== 'undefined'
              ? OfflineAudioContext
              : (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext })
                  ?.webkitOfflineAudioContext;
          const decodeCtx: BaseAudioContext =
            this.ctx && (this.ctx.state as string) !== 'closed'
              ? this.ctx
              : OfflineCtx
                ? new OfflineCtx(2, 1, 44100)
                : this.ensureContext();
          await this.soundfontLoader.prewarmScoreSamples(decodeCtx, score);
        }
      }
    } catch {
      // Fallback to synthesis if AudioContext / network is unavailable
    }

    const { totalSeconds, totalQuarterBeats } = this.calculateScoreDuration(score);
    const renderDuration = Math.max(2, totalSeconds + 3.4);
    const sampleRate = 44100;
    const totalFrames = Math.ceil(renderDuration * sampleRate);

    const left = new Float32Array(totalFrames);
    const right = new Float32Array(totalFrames);
    const timeline = this.buildScheduledTimeline(score);
    const tempoBpm = Number(score.meta?.tempo) || 120;
    const trackStems = new Map<
      string,
      {
        left: Float32Array;
        right: Float32Array;
        def?: TrackDefinition;
        vocodedPerNote?: boolean;
      }
    >();
    let continuousVoiceSeed = 0;

    for (const item of timeline) {
      const startFrame = Math.max(0, Math.floor(item.startSec * sampleRate));
      if (startFrame >= totalFrames) continue;

      const isDrum = item.style === 'grid' || Boolean(item.gridKey);
      const profile = this.getInstrumentArticulationProfile(
        item.sfInstrument,
        item.patch,
        item.event.physics,
        item.isPhraseContinuation,
        item.noteIndexInTrack,
        item.normalizedVelocity,
        item.cutoffHzOverride
      );
      const isSustainer = isSustainingOrchestralInstrument(item.sfInstrument, item.patch);
      const isStacc =
        item.event.physics?.articulation === 'stacc' ||
        item.event.physics?.articulation === 'staccato' ||
        Boolean(item.event.physics?.pizz);
      const releaseSec = isDrum
        ? item.sfInstrument === 'timpani'
          ? 1.15
          : 0.18
        : isStacc
        ? 0.32
        : Math.max(0.85, profile.releaseSec);
      const totalNoteSec = item.durSec + releaseSec;
      const noteFrames = Math.min(totalFrames - startFrame, Math.floor(totalNoteSec * sampleRate));

      if (
        !isDrum &&
        ContinuousSynthEngine.isContinuousSynthPatch(item.patch, item.style, item.event.physics)
      ) {
        const trackId = item.event.trackId || 'pno';
        let stem = trackStems.get(trackId);
        if (!stem) {
          stem = {
            left: new Float32Array(totalFrames),
            right: new Float32Array(totalFrames),
            def: item.def,
            vocodedPerNote: false,
          };
          trackStems.set(trackId, stem);
        }

        const activeFxChain = AbletonAudioFxEngine.resolveActiveFxChain(
          item.def,
          item.event
        );
        const vocoderFx = activeFxChain.find(
          (f) => f.type.toLowerCase() === 'vocoder'
        );
        if (vocoderFx && item.event.physics?.lyric) {
          const tempL = new Float32Array(noteFrames);
          const tempR = new Float32Array(noteFrames);
          ContinuousSynthEngine.renderVoiceIntoTrackStem(
            tempL,
            tempR,
            0,
            noteFrames,
            sampleRate,
            tempoBpm,
            continuousVoiceSeed++,
            item
          );
          AbletonAudioFxEngine.applyTalkingVocoderToSlice(
            tempL,
            tempR,
            0,
            noteFrames,
            sampleRate,
            item.event.physics.lyric,
            vocoderFx.params
          );
          for (let k = 0; k < noteFrames; k++) {
            stem.left[startFrame + k] += tempL[k];
            stem.right[startFrame + k] += tempR[k];
          }
          stem.vocodedPerNote = true;
        } else {
          ContinuousSynthEngine.renderVoiceIntoTrackStem(
            stem.left,
            stem.right,
            startFrame,
            noteFrames,
            sampleRate,
            tempoBpm,
            continuousVoiceSeed++,
            item
          );
        }
        continue;
      }

      const panAngle = ((item.pan + 1) * 0.5) * (Math.PI * 0.5);
      const gainL = Math.cos(panAngle);
      const gainR = Math.sin(panAngle);

      const trackId = item.event.trackId || 'pno';
      const hasTrackFxOrRouting =
        Boolean(item.def?.fxChain && item.def.fxChain.length > 0) ||
        Boolean(item.def?.fx && Object.keys(item.def.fx).length > 0) ||
        Boolean(item.def?.sends && Object.keys(item.def.sends).length > 0) ||
        Boolean(item.def?.groupId || (item.def as any)?.group);

      let targetL = left;
      let targetR = right;
      if (hasTrackFxOrRouting) {
        let stem = trackStems.get(trackId);
        if (!stem) {
          stem = {
            left: new Float32Array(totalFrames),
            right: new Float32Array(totalFrames),
            def: item.def,
            vocodedPerNote: false,
          };
          trackStems.set(trackId, stem);
        }
        targetL = stem.left;
        targetR = stem.right;
      }

      // Only run per-note FX if the note itself carries note-level `.fx(...)` modifiers;
      // track-level `def.fxChain` is applied once to the unified track stem!
      const noteOnlyFxChain = hasTrackFxOrRouting
        ? item.event.physics?.fx && item.event.physics.fx.length > 0
          ? item.event.physics.fx
          : []
        : AbletonAudioFxEngine.resolveActiveFxChain(item.def, item.event);

      const fxSliceFrames =
        noteOnlyFxChain.length > 0
          ? Math.min(totalFrames - startFrame, Math.max(noteFrames, Math.floor(0.85 * sampleRate)))
          : 0;
      const preFxL =
        noteOnlyFxChain.length > 0 ? targetL.slice(startFrame, startFrame + fxSliceFrames) : null;
      const preFxR =
        noteOnlyFxChain.length > 0 ? targetR.slice(startFrame, startFrame + fxSliceFrames) : null;

      const applyItemFx = (framesToProcess: number) => {
        if (!preFxL || !preFxR || noteOnlyFxChain.length === 0) return;
        const count = Math.min(framesToProcess, preFxL.length);
        if (count <= 0) return;
        const deltaL = new Float32Array(count);
        const deltaR = new Float32Array(count);
        for (let k = 0; k < count; k++) {
          deltaL[k] = targetL[startFrame + k] - preFxL[k];
          deltaR[k] = targetR[startFrame + k] - preFxR[k];
        }
        AbletonAudioFxEngine.applyFxChainToSlice(
          deltaL,
          deltaR,
          0,
          count,
          sampleRate,
          noteOnlyFxChain,
          {
            lyric: item.event.physics?.lyric,
            carrierFreqHz: item.freq,
          }
        );
        for (let k = 0; k < count; k++) {
          targetL[startFrame + k] = preFxL[k] + deltaL[k];
          targetR[startFrame + k] = preFxR[k] + deltaR[k];
        }
      };

      if (isDrum) {
        const key = (item.gridKey || 'k').toLowerCase();
        const isHammerBlow =
          item.sfInstrument === 'taiko_drum' ||
          item.event.trackId === 'ham' ||
          Boolean(item.def?.name?.toLowerCase().includes('hammer'));

        if (isHammerBlow) {
          const hammerFrames = Math.min(totalFrames - startFrame, Math.floor(0.72 * sampleRate));
          let phSub = 0;
          let phBox1 = 0;
          let phBox2 = 0;
          let lpWood = 0;
          for (let i = 0; i < hammerFrames; i++) {
            const t = i / sampleRate;
            const subFreq = 31 + 27 * Math.exp(-t * 9.5);
            const box1Freq = 86 + 34 * Math.exp(-t * 18);
            const box2Freq = 132 + 48 * Math.exp(-t * 22);
            phSub += (2 * Math.PI * subFreq) / sampleRate;
            phBox1 += (2 * Math.PI * box1Freq) / sampleRate;
            phBox2 += (2 * Math.PI * box2Freq) / sampleRate;

            const sub = Math.sin(phSub) * Math.exp(-t * 5.2);
            const box = (Math.sin(phBox1) * 0.65 + Math.sin(phBox2) * 0.35) * Math.exp(-t * 14.5) * 0.65;
            const rawNoise = (Math.random() * 2 - 1) * Math.exp(-t * 65);
            lpWood += 0.095 * (rawNoise - lpWood);
            const sample = Math.tanh((sub + box + lpWood * 0.75) * 1.55) * item.amp * 1.15;
            targetL[startFrame + i] += sample * gainL;
            targetR[startFrame + i] += sample * gainR;
          }
          applyItemFx(hammerFrames);
          continue;
        }

        // If this is an orchestral Timpani track with a cached timpani SoundFont sample, render the real sample!
        if (
          item.sfInstrument === 'timpani' &&
          (key === 'k' || key === 'bd' || key === 'kick' || key === 'lt' || key === 'mt' || key === 'ht')
        ) {
          const timpMidi = key === 'ht' ? 52 : key === 'mt' ? 48 : 45;
          const timpSample = this.soundfontLoader.getCachedSampleForNote('timpani', timpMidi);
          if (timpSample) {
            const buf = timpSample.buffer;
            const ch0 = buf.getChannelData(0);
            const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
            const rateRatio = (buf.sampleRate / sampleRate) * timpSample.playbackRate;
            const maxFrames = Math.min(totalFrames - startFrame, Math.floor(0.85 * sampleRate));
            let rPos = 0;
            for (let i = 0; i < maxFrames; i++) {
              const idx0 = Math.floor(rPos);
              if (idx0 >= ch0.length - 1) break;
              const frac = rPos - idx0;
              const s0 = ch0[idx0] + (ch0[idx0 + 1] - ch0[idx0]) * frac;
              const s1 = ch1[idx0] + (ch1[idx0 + 1] - ch1[idx0]) * frac;
              const env = Math.exp(-(i / sampleRate) * 3.5);
              targetL[startFrame + i] += s0 * env * item.amp * 2.2 * gainL;
              targetR[startFrame + i] += s1 * env * item.amp * 2.2 * gainR;
              rPos += rateRatio;
            }
            applyItemFx(maxFrames);
            continue;
          }
        }

        const isKick = key === 'k' || key === 'bd' || key === 'kick' || item.midi === 36;
        const isClap = key === 'cp' || key === 'clap' || item.midi === 39;
        const isSnare = key === 's' || key === 'sd' || key === 'snare' || key === 'rim' || item.midi === 38;
        const isTom = key === 'lt' || key === 'mt' || key === 'ht' || item.midi === 45 || item.midi === 47 || item.midi === 50;
        const isOpenHat = key === 'oh' || key === 'cr' || key === 'rd' || item.midi === 46 || item.midi === 49;

        const durSec = isKick ? 0.32 : isClap ? 0.24 : isSnare ? 0.21 : isTom ? 0.28 : isOpenHat ? Math.min(0.28, item.durSec) : 0.058;
        const drumFrames = Math.min(totalFrames - startFrame, Math.floor(durSec * sampleRate));

        let phase1 = 0;
        let phase2 = 0;
        let lpState = 0;
        let prevIn = 0;
        let hpState = 0;

        const w1 = (2 * Math.PI * 3171) / sampleRate;
        const w2 = (2 * Math.PI * 4483) / sampleRate;
        const w3 = (2 * Math.PI * 5869) / sampleRate;
        const w4 = (2 * Math.PI * 7331) / sampleRate;
        const w5 = (2 * Math.PI * 8923) / sampleRate;
        const w6 = (2 * Math.PI * 10459) / sampleRate;

        for (let i = 0; i < drumFrames; i++) {
          const t = i / sampleRate;
          let sample = 0;

          if (isKick) {
            const subFreq = 34 + 120 * Math.exp(-t * 42);
            const bodyFreq = 60 + 160 * Math.exp(-t * 55);
            phase1 += (2 * Math.PI * subFreq) / sampleRate;
            phase2 += (2 * Math.PI * bodyFreq) / sampleRate;
            const sub = Math.sin(phase1) * Math.exp(-t * 9.5);
            const body = Math.sin(phase2) * Math.exp(-t * 32) * 0.45;
            const click = (Math.random() * 2 - 1) * Math.exp(-t * 240) * 0.25;
            sample = Math.tanh((sub + body + click) * 1.4) * item.amp * 0.95;
          } else if (isClap) {
            let env = 0;
            if (t < 0.011) env = Math.exp(-(t / 0.0035));
            else if (t < 0.021) env = Math.exp(-((t - 0.011) / 0.0035));
            else if (t < 0.032) env = Math.exp(-((t - 0.021) / 0.004));
            else env = Math.exp(-((t - 0.032) / 0.055)) * 0.75;
            const rawNoise = Math.random() * 2 - 1;
            // Bandpass filter around 1.35kHz
            lpState += 0.18 * (rawNoise - lpState);
            hpState = 0.92 * (hpState + lpState - prevIn);
            prevIn = lpState;
            sample = hpState * env * item.amp * 0.85;
          } else if (isSnare) {
            const f1 = 118 + 92 * Math.exp(-t * 38);
            const f2 = 185 + 160 * Math.exp(-t * 45);
            phase1 += (2 * Math.PI * f1) / sampleRate;
            phase2 += (2 * Math.PI * f2) / sampleRate;
            const shell = (Math.sin(phase1) * 0.65 + Math.sin(phase2) * 0.35) * Math.exp(-t * 24);

            const rawNoise = Math.random() * 2 - 1;
            lpState += 0.32 * (rawNoise - lpState);
            hpState = 0.88 * (hpState + lpState - prevIn);
            prevIn = lpState;
            const wires = hpState * Math.exp(-t * 15) * 0.75;
            sample = (shell * 0.65 + wires) * item.amp * 0.85;
          } else if (isTom) {
            const baseTom = key === 'ht' ? 165 : key === 'mt' ? 125 : 92;
            const instFreq = baseTom + baseTom * 0.45 * Math.exp(-t * 28);
            phase1 += (2 * Math.PI * instFreq) / sampleRate;
            sample = Math.sin(phase1) * Math.exp(-t * 11) * item.amp * 0.85;
          } else {
            // Metallic Bronze Hi-Hat / Cymbal with steep highpass filter
            const env = Math.exp(-t / (isOpenHat ? 0.095 : 0.015));
            const metallic =
              (Math.sin(i * w1) +
                Math.sin(i * w2) +
                Math.sin(i * w3) +
                Math.sin(i * w4) +
                Math.sin(i * w5) +
                Math.sin(i * w6)) *
              0.11;
            const raw = metallic + (Math.random() * 2 - 1) * 0.32;
            hpState = 0.72 * (hpState + raw - prevIn);
            prevIn = raw;
            sample = hpState * env * item.amp * (isOpenHat ? 0.48 : 0.38);
          }

          targetL[startFrame + i] += sample * gainL;
          targetR[startFrame + i] += sample * gainR;
        }
        applyItemFx(drumFrames);
        continue;
      }

      const isSynthItem =
        ContinuousSynthEngine.isContinuousSynthPatch(item.patch, item.style, item.event.physics) ||
        item.patch.includes('wavetable') ||
        item.patch.includes('supersaw') ||
        item.patch.includes('flutter') ||
        AbletonSynthSuite.isSupportedPatch(item.patch) ||
        (item.style === 'synth' && !item.sfInstrument);

      const cachedSample =
        !isSynthItem && item.sfInstrument
          ? this.soundfontLoader.getCachedSampleForNote(item.sfInstrument, item.midi)
          : null;

      if (cachedSample) {
        const buf = cachedSample.buffer;
        const ch0 = buf.getChannelData(0);
        const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
        const bufLen = ch0.length;
        const rateRatio = (buf.sampleRate / sampleRate) * cachedSample.playbackRate;

        // Fetch an independent neighbor-key recording for Desk 2 so Desk 1 + Desk 2 never comb-filter
        const desk2Sample =
          item.isEnsembleSection && item.sfInstrument
            ? this.soundfontLoader.getIndependentDeskSampleForNote(item.sfInstrument, item.midi)
            : null;
        const desk2Buf = desk2Sample ? desk2Sample.buffer : null;
        const desk2Ch0 = desk2Buf ? desk2Buf.getChannelData(0) : null;
        const desk2Ch1 = desk2Buf ? (desk2Buf.numberOfChannels > 1 ? desk2Buf.getChannelData(1) : desk2Ch0) : null;
        const desk2Len = desk2Ch0 ? desk2Ch0.length : 0;
        const rateRatio2 =
          desk2Buf && desk2Sample
            ? (desk2Buf.sampleRate / sampleRate) * desk2Sample.playbackRate * Math.pow(2, 3.0 / 1200)
            : 0;

        const hasSwell = item.swell === 'crescendo' || item.swell === 'diminuendo';
        const baseAmpScalar = hasSwell ? 1.0 : item.amp;
        const attackSec = Math.min(profile.attackSec, Math.max(0.01, item.durSec * 0.45));
        const phys = item.event.physics;
        const isSustainingSample = isSustainingOrchestralInstrument(item.sfInstrument, item.patch);

        // Energy-gated loop bounds prevent reading into trailing MP3 silence
        const loopInfo1 = this.soundfontLoader.getSustainedLoopInfo(buf, isSustainingSample);
        const loopStart1 = loopInfo1.loopStart;
        const loopEnd1 = loopInfo1.loopEnd;
        const loopSpan1 = Math.max(256, loopEnd1 - loopStart1);
        const halfSpan1 = Math.floor(loopSpan1 * 0.5);

        const loopInfo2 = desk2Buf
          ? this.soundfontLoader.getSustainedLoopInfo(desk2Buf, isSustainingSample)
          : null;
        const loopStart2 = loopInfo2 ? loopInfo2.loopStart : 0;
        const loopEnd2 = loopInfo2 ? loopInfo2.loopEnd : 1;
        const loopSpan2 = Math.max(256, loopEnd2 - loopStart2);
        const halfSpan2 = Math.floor(loopSpan2 * 0.5);

        const offsetSamples = Math.min(
          Math.max(0, loopEnd1 - 2),
          Math.floor(profile.sampleOffsetSec * (buf.sampleRate || sampleRate))
        );
        let readPos1 = offsetSamples;
        let readPos2 = desk2Buf
          ? Math.min(
              Math.max(0, loopEnd2 - 2),
              Math.floor(Math.max(0.09, profile.sampleOffsetSec) * (desk2Buf.sampleRate || sampleRate))
            )
          : 0;
        let lpState0 = 0;
        let lpState1 = 0;

        const readCrossfadeSample = (
          channel: Float32Array,
          pos: number,
          lStart: number,
          lEnd: number,
          lSpan: number,
          hSpan: number
        ): number => {
          const maxIdx = channel.length - 2;
          if (pos < lEnd || !isSustainingSample) {
            const idx = Math.min(maxIdx, Math.max(0, Math.floor(pos)));
            const frac = pos - Math.floor(pos);
            return channel[idx] + (channel[idx + 1] - channel[idx]) * frac;
          }
          const rel = pos - lStart;
          const posA = lStart + (((rel % lSpan) + lSpan) % lSpan);
          const posB = lStart + ((((rel + hSpan) % lSpan) + lSpan) % lSpan);
          const phaseA = (Math.PI * (posA - lStart)) / lSpan;
          const wA = Math.sin(phaseA) * Math.sin(phaseA);
          const wB = 1.0 - wA;

          const idxA = Math.min(maxIdx, Math.max(0, Math.floor(posA)));
          const fracA = posA - Math.floor(posA);
          const valA = channel[idxA] + (channel[idxA + 1] - channel[idxA]) * fracA;

          const idxB = Math.min(maxIdx, Math.max(0, Math.floor(posB)));
          const fracB = posB - Math.floor(posB);
          const valB = channel[idxB] + (channel[idxB + 1] - channel[idxB]) * fracB;

          return valA * wA + valB * wB;
        };

        for (let i = 0; i < noteFrames; i++) {
          const t = i / sampleRate;
          let s0 = 0;
          let s1 = 0;

          if (!isSustainingSample && readPos1 >= loopInfo1.activeEnd) {
            // Warm acoustic soundboard resonance tail when a percussive/plucked sample reaches its end before noteFrames
            const tailSec = Math.max(0, (readPos1 - loopInfo1.activeEnd) / (buf.sampleRate || sampleRate));
            const resDecay = Math.exp(-tailSec * 2.5) * 0.14;
            const resWave =
              0.7 * Math.sin(2 * Math.PI * item.freq * t) +
              0.3 * Math.sin(4 * Math.PI * item.freq * t);
            s0 = resWave * resDecay;
            s1 = resWave * resDecay;
          } else {
            s0 =
              readCrossfadeSample(ch0, readPos1, loopStart1, loopEnd1, loopSpan1, halfSpan1) *
              loopInfo1.normGain;
            s1 =
              readCrossfadeSample(ch1, readPos1, loopStart1, loopEnd1, loopSpan1, halfSpan1) *
              loopInfo1.normGain;
          }

          if (desk2Ch0 && desk2Ch1 && loopInfo2 && t >= 0.018 && (isSustainingSample || readPos2 < loopInfo2.activeEnd)) {
            const d0 =
              readCrossfadeSample(desk2Ch0, readPos2, loopStart2, loopEnd2, loopSpan2, halfSpan2) *
              loopInfo2.normGain;
            const d1 =
              readCrossfadeSample(desk2Ch1, readPos2, loopStart2, loopEnd2, loopSpan2, halfSpan2) *
              loopInfo2.normGain;
            const desk2Fade = Math.min(1, (t - 0.018) / 0.045);
            s0 = s0 * 0.72 + d0 * 0.45 * desk2Fade;
            s1 = s1 * 0.68 + d1 * 0.48 * desk2Fade;
          }

          let env = 1.0;
          let swellFactor = 1.0;
          if (phys?.fp) {
            env = t < 0.015 ? t / 0.015 : t < 0.075 ? 1.0 - ((t - 0.015) / 0.06) * 0.7 : 0.35;
            if (t > item.durSec) {
              const relProgress = Math.min(1, (t - item.durSec) / Math.max(0.001, releaseSec));
              env *= Math.pow(1 - relProgress, 1.75);
            }
          } else if (hasSwell) {
            if (t < attackSec) {
              env = (t / attackSec) * item.startAmp;
              swellFactor = item.startAmp;
            } else if (t <= item.durSec) {
              const swellProgress = (t - attackSec) / Math.max(0.001, item.durSec - attackSec);
              env = item.startAmp + (item.endAmp - item.startAmp) * swellProgress;
              swellFactor = env;
            } else {
              const relProgress = Math.min(1, (t - item.durSec) / Math.max(0.001, releaseSec));
              env = item.endAmp * Math.pow(1 - relProgress, 1.75);
              swellFactor = item.endAmp;
            }
          } else {
            if (t < attackSec) {
              env = t / attackSec;
            } else if (t <= item.durSec) {
              env = 1.0;
            } else {
              const relProgress = Math.min(1, (t - item.durSec) / Math.max(0.001, releaseSec));
              env = Math.pow(1 - relProgress, 1.75);
            }
          }

          const dynamicCutoffHz = Math.max(
            900,
            Math.min(7500, profile.filterCutoffHz * (hasSwell ? 0.65 + 0.55 * swellFactor : 1.0))
          );
          const alpha = Math.min(0.85, (2 * Math.PI * dynamicCutoffHz) / sampleRate);
          lpState0 += alpha * (s0 - lpState0);
          lpState1 += alpha * (s1 - lpState1);

          let modScalar = 1.0;
          if (phys?.mordent && t >= 0.025 && t < 0.065) {
            modScalar = Math.pow(2, 2 / 12);
          } else if (phys?.trill && Math.floor(t / 0.065) % 2 === 1) {
            modScalar = Math.pow(2, 2 / 12);
          } else if ((phys?.vibrato || (isSustainingSample && item.durSec >= 0.45)) && t > 0.18) {
            const vibRamp = Math.min(1.0, (t - 0.18) / 0.22);
            const vibDepth = phys?.vibrato ? 0.0032 : 0.0016;
            modScalar = 1.0 + Math.sin(2 * Math.PI * 5.4 * (t - 0.18)) * vibDepth * vibRamp;
          }

          readPos1 += rateRatio * modScalar;
          if (desk2Buf && t >= 0.018) {
            readPos2 += rateRatio2 * modScalar;
          }

          const gain = env * baseAmpScalar * 0.85;
          targetL[startFrame + i] += lpState0 * gain * gainL;
          targetR[startFrame + i] += lpState1 * gain * gainR;
        }
        applyItemFx(noteFrames);
        continue;
      }

      if (
        item.patch.includes('wavetable') ||
        item.patch.includes('supersaw') ||
        item.patch.includes('flutter')
      ) {
        const wtParams = WavetableEngine.resolveParams(
          item.def,
          item.event.physics,
          item.cutoffHzOverride
        );
        WavetableEngine.renderNoteToStereoBuffer(
          targetL,
          targetR,
          startFrame,
          noteFrames,
          sampleRate,
          item.freq,
          item.durSec,
          item.amp,
          item.pan,
          wtParams,
          item.swell,
          item.startAmp,
          item.endAmp,
          item.event.physics
        );
        applyItemFx(noteFrames);
        continue;
      }

      if (AbletonSynthSuite.isSupportedPatch(item.patch)) {
        const synthParams = AbletonSynthSuite.resolveParams(
          item.patch,
          item.def,
          item.event.physics,
          item.cutoffHzOverride
        );
        AbletonSynthSuite.renderNoteToStereoBuffer(
          targetL,
          targetR,
          startFrame,
          noteFrames,
          sampleRate,
          item.freq,
          item.durSec,
          item.amp,
          item.pan,
          synthParams,
          item.swell,
          item.startAmp,
          item.endAmp,
          item.event.physics
        );
        applyItemFx(noteFrames);
        continue;
      }

      if (
        SamplerAndDrumRackEngine.isGranulatorPatch(item.patch) ||
        SamplerAndDrumRackEngine.isSimplerTrack(item.style, item.patch, item.def)
      ) {
        SamplerAndDrumRackEngine.renderGranularOrSimplerNoteToStereo(
          targetL,
          targetR,
          startFrame,
          noteFrames,
          sampleRate,
          item.freq,
          item.durSec,
          item.amp,
          item.pan,
          item.def,
          item.event,
          item.swell,
          item.startAmp,
          item.endAmp
        );
        applyItemFx(noteFrames);
        continue;
      }

      const instName = (item.sfInstrument || item.patch || '').toLowerCase();
      const isSub = item.patch.includes('sub') || item.patch.includes('808') || item.freq < 110;
      const isSustaining = isSustainingOrchestralInstrument(item.sfInstrument, item.patch);
      const isStringFamily =
        instName.includes('violin') ||
        instName.includes('viola') ||
        instName.includes('cello') ||
        instName.includes('contrabass') ||
        instName.includes('string');
      const isBrassFamily =
        instName.includes('horn') ||
        instName.includes('trumpet') ||
        instName.includes('trombone') ||
        instName.includes('tuba') ||
        instName.includes('brass');
      const isWindFamily =
        instName.includes('flute') ||
        instName.includes('piccolo') ||
        instName.includes('oboe') ||
        instName.includes('clarinet') ||
        instName.includes('bassoon');

      const attackSec = Math.min(profile.attackSec, Math.max(0.01, item.durSec * 0.45));
      const twoPiOverSr = (2 * Math.PI) / sampleRate;

      const hasSwell = item.swell === 'crescendo' || item.swell === 'diminuendo';
      const baseAmpScalar = hasSwell ? 1.0 : item.amp;
      const phys = item.event.physics;
      let ph1 = 0;
      let ph2 = 0;
      let ph3 = 0;
      let lpState = 0;
      const detuneRatio2 = item.isEnsembleSection ? 0.9979 : 1.0018;
      const detuneRatio3 = item.isEnsembleSection ? 1.0023 : 0.9985;

      // Acoustic body formant center frequency for realistic harmonic shaping
      const formantCenterHz = isStringFamily
        ? 950
        : isBrassFamily
        ? 1150
        : isWindFamily
        ? 1450
        : 1800;

      const hAmps = new Float32Array(9);
      let maxHarmonic = 0;
      const harmTable = !isSub && isSustaining ? new Float32Array(2048) : null;
      if (!isSub && isSustaining && harmTable) {
        for (let h = 1; h <= 8; h++) {
          const hFreq = item.freq * h;
          if (hFreq > 12000) break;
          const formantDist = (hFreq - formantCenterHz) / formantCenterHz;
          const formantGain = 1.0 + 0.65 * Math.exp(-formantDist * formantDist * 1.4);
          const oddBoost = isWindFamily && h % 2 === 1 ? 1.2 : 1.0;
          hAmps[h] = (1 / Math.pow(h, 1.15)) * formantGain * oddBoost;
          maxHarmonic = h;
        }
        const twoPiOver2048 = (2 * Math.PI) / 2048;
        for (let ti = 0; ti < 2048; ti++) {
          const theta = ti * twoPiOver2048;
          let sumH = 0;
          for (let h = 1; h <= maxHarmonic; h++) {
            sumH += hAmps[h] * Math.sin(theta * h);
          }
          harmTable[ti] = sumH * 0.48;
        }
      }
      const radToTableIdx = 2048 / (2 * Math.PI);

      for (let i = 0; i < noteFrames; i++) {
        const t = i / sampleRate;
        let env = 1.0;
        let swellBrightness = 1.0;
        if (phys?.fp) {
          if (t < attackSec) {
            env = t / attackSec;
          } else if (t > 0.055) {
            const relProgress = Math.min(1, Math.max(0, t - item.durSec) / Math.max(0.001, releaseSec));
            env = 0.32 * Math.pow(1 - relProgress, 1.75);
          }
        } else if (hasSwell) {
          if (t < attackSec) {
            env = (t / attackSec) * item.startAmp;
            swellBrightness = item.startAmp;
          } else if (t <= item.durSec) {
            const swellProgress = (t - attackSec) / Math.max(0.001, item.durSec - attackSec);
            env = item.startAmp + (item.endAmp - item.startAmp) * swellProgress;
            swellBrightness = env;
          } else {
            const relProgress = Math.min(1, (t - item.durSec) / Math.max(0.001, releaseSec));
            env = item.endAmp * Math.pow(1 - relProgress, 1.75);
            swellBrightness = item.endAmp;
          }
        } else {
          if (t < attackSec) {
            env = t / attackSec;
          } else if (t <= item.durSec) {
            const decayProgress = (t - attackSec) / Math.max(0.001, item.durSec - attackSec);
            env = isSustaining
              ? 1.0
              : 0.55 + 0.45 * Math.exp(-decayProgress * 1.8);
          } else {
            const relProgress = Math.min(1, (t - item.durSec) / Math.max(0.001, releaseSec));
            const sustainEnd = isSustaining ? 1.0 : 0.55;
            env = sustainEnd * Math.pow(1 - relProgress, 1.75);
          }
        }

        let instFreq = item.freq;
        if (phys?.mordent && t >= 0.025 && t < 0.065) {
          instFreq = item.freq * Math.pow(2, 2 / 12);
        } else if (phys?.trill) {
          const stepIndex = Math.floor(t / 0.065);
          if (stepIndex % 2 === 1) {
            instFreq = item.freq * Math.pow(2, 2 / 12);
          }
        }
        if ((phys?.vibrato || isStringFamily || isWindFamily) && t > 0.12) {
          const vibDepth = phys?.vibrato ? 0.0065 : 0.0028;
          instFreq *= 1 + Math.sin(2 * Math.PI * 5.4 * t) * vibDepth;
        }
        if (phys?.mpe) {
          const mpeEval = StudioAudioEngine.evaluateMpeAtNormalizedTime(
            phys.mpe,
            Math.min(1, t / Math.max(0.01, item.durSec))
          );
          if (mpeEval.bendSemitones !== 0) {
            instFreq *= Math.pow(2, mpeEval.bendSemitones / 12);
          }
          env *= mpeEval.pressureScalar;
          swellBrightness *= 0.6 + 0.8 * mpeEval.slideNorm;
        }

        ph1 += instFreq * twoPiOverSr;
        ph2 += instFreq * detuneRatio2 * twoPiOverSr;
        ph3 += instFreq * detuneRatio3 * twoPiOverSr;

        let wave = 0;
        if (isSub) {
          wave = Math.sin(ph1) * 0.8 + Math.sin(ph1 * 2) * 0.2;
        } else if (isSustaining && harmTable) {
          const idx1 = ((ph1 * radToTableIdx) | 0) & 2047;
          const idx2 = ((ph2 * radToTableIdx) | 0) & 2047;
          if (item.isEnsembleSection) {
            const idx3 = ((ph3 * radToTableIdx) | 0) & 2047;
            wave = 0.45 * harmTable[idx1] + 0.3 * harmTable[idx2] + 0.25 * harmTable[idx3];
          } else {
            wave = 0.65 * harmTable[idx1] + 0.35 * harmTable[idx2];
          }
        } else {
          wave =
            0.58 * Math.sin(ph1) +
            0.24 * Math.sin(ph2 * 2) * Math.exp(-t * 2.2) +
            0.12 * Math.sin(ph1 * 3) * Math.exp(-t * 3.8) +
            0.06 * Math.sin(ph2 * 4) * Math.exp(-t * 5.5);
        }

        const minCut = item.cutoffHzOverride !== undefined ? 80 : 950;
        const maxCut = item.cutoffHzOverride !== undefined ? 14000 : 6800;
        const dynCutoff = Math.max(minCut, Math.min(maxCut, profile.filterCutoffHz * swellBrightness));
        const lpAlpha = Math.min(0.85, (2 * Math.PI * dynCutoff) / sampleRate);
        lpState += lpAlpha * (wave - lpState);

        const sample = lpState * env * baseAmpScalar * 0.88;
        targetL[startFrame + i] += sample * gainL;
        targetR[startFrame + i] += sample * gainR;
      }
      applyItemFx(noteFrames);
    }

    const returnDefsById = new Map<string, TrackDefinition>();
    for (const d of score.defs) {
      if (d.style === 'return') {
        returnDefsById.set(d.id, d);
      }
    }
    const returnStems = new Map<string, { left: Float32Array; right: Float32Array; def: TrackDefinition }>();

    for (const [, stem] of trackStems.entries()) {
      ContinuousSynthEngine.applyTrackBassMonoCrossover(stem.left, stem.right, sampleRate, 120);
      const rawTrackFx = AbletonAudioFxEngine.resolveActiveFxChain(stem.def, undefined);
      const trackFxChain = stem.vocodedPerNote
        ? rawTrackFx.filter((f) => f.type.toLowerCase() !== 'vocoder')
        : rawTrackFx;
      if (trackFxChain.length > 0) {
        AbletonAudioFxEngine.applyFxChainToSlice(
          stem.left,
          stem.right,
          0,
          totalFrames,
          sampleRate,
          trackFxChain
        );
      }

      if (stem.def?.sends) {
        for (const [retId, sendLvl] of Object.entries(stem.def.sends)) {
          const retDef = returnDefsById.get(retId);
          const lvl = Math.max(0, Math.min(1.5, Number(sendLvl) || 0));
          if (retDef && lvl > 0.001 && !this.mutedTracks.has(retId)) {
            let retStem = returnStems.get(retId);
            if (!retStem) {
              retStem = {
                left: new Float32Array(totalFrames),
                right: new Float32Array(totalFrames),
                def: retDef,
              };
              returnStems.set(retId, retStem);
            }
            for (let i = 0; i < totalFrames; i++) {
              retStem.left[i] += stem.left[i] * lvl;
              retStem.right[i] += stem.right[i] * lvl;
            }
          }
        }
      }

      for (let i = 0; i < totalFrames; i++) {
        left[i] += stem.left[i];
        right[i] += stem.right[i];
      }
    }

    for (const [, retStem] of returnStems.entries()) {
      const retFxChain = AbletonAudioFxEngine.resolveActiveFxChain(retStem.def, undefined);
      if (retFxChain.length > 0) {
        AbletonAudioFxEngine.applyFxChainToSlice(
          retStem.left,
          retStem.right,
          0,
          totalFrames,
          sampleRate,
          retFxChain
        );
      }
      const retVol = this.trackVolumes.get(retStem.def.id) ?? retStem.def.volume ?? 0.85;
      for (let i = 0; i < totalFrames; i++) {
        left[i] += retStem.left[i] * retVol;
        right[i] += retStem.right[i] * retVol;
      }
    }

    // Apply rich 2.4-second Concertgebouw Hall Diffuser (6 parallel lowpass-damped combs + 2 series all-pass filters)
    const dryL = new Float32Array(left);
    const dryR = new Float32Array(right);

    const combTimesSec = [0.0437, 0.0531, 0.0613, 0.0709, 0.0809, 0.0919];
    const combGains = [0.88, 0.87, 0.86, 0.85, 0.84, 0.83];
    const combLensL = combTimesSec.map((t) => Math.floor(t * sampleRate));
    const combLensR = combTimesSec.map((t) => Math.floor((t + 0.0013) * sampleRate));
    const combBufsL = combLensL.map((len) => new Float32Array(len));
    const combBufsR = combLensR.map((len) => new Float32Array(len));
    const combIdxL = new Int32Array(6);
    const combIdxR = new Int32Array(6);
    const combLpL = new Float32Array(6);
    const combLpR = new Float32Array(6);

    const ap1LenL = Math.floor(0.0113 * sampleRate);
    const ap1LenR = Math.floor(0.0121 * sampleRate);
    const ap2LenL = Math.floor(0.0037 * sampleRate);
    const ap2LenR = Math.floor(0.0043 * sampleRate);
    const ap1BufL = new Float32Array(ap1LenL);
    const ap1BufR = new Float32Array(ap1LenR);
    const ap2BufL = new Float32Array(ap2LenL);
    const ap2BufR = new Float32Array(ap2LenR);
    let ap1IdxL = 0;
    let ap1IdxR = 0;
    let ap2IdxL = 0;
    let ap2IdxR = 0;

    const er1 = Math.floor(0.019 * sampleRate);
    const er2 = Math.floor(0.034 * sampleRate);

    for (let i = 0; i < totalFrames; i++) {
      const inL = dryL[i];
      const inR = dryR[i];
      const hallInL = inL * 0.75 + inR * 0.25;
      const hallInR = inR * 0.75 + inL * 0.25;

      let wetL = 0;
      let wetR = 0;

      for (let c = 0; c < 6; c++) {
        const bufL = combBufsL[c];
        const idxL = combIdxL[c];
        const delayedL = bufL[idxL];
        combLpL[c] = delayedL * 0.68 + combLpL[c] * 0.32;
        bufL[idxL] = hallInL + combLpL[c] * combGains[c];
        combIdxL[c] = idxL + 1 >= combLensL[c] ? 0 : idxL + 1;
        wetL += delayedL;

        const bufR = combBufsR[c];
        const idxR = combIdxR[c];
        const delayedR = bufR[idxR];
        combLpR[c] = delayedR * 0.68 + combLpR[c] * 0.32;
        bufR[idxR] = hallInR + combLpR[c] * combGains[c];
        combIdxR[c] = idxR + 1 >= combLensR[c] ? 0 : idxR + 1;
        wetR += delayedR;
      }

      wetL *= 0.16;
      wetR *= 0.16;

      // All-pass stage 1
      const dAp1L = ap1BufL[ap1IdxL];
      const outAp1L = -0.5 * wetL + dAp1L;
      ap1BufL[ap1IdxL] = wetL + 0.5 * dAp1L;
      if (++ap1IdxL >= ap1LenL) ap1IdxL = 0;

      const dAp1R = ap1BufR[ap1IdxR];
      const outAp1R = -0.5 * wetR + dAp1R;
      ap1BufR[ap1IdxR] = wetR + 0.5 * dAp1R;
      if (++ap1IdxR >= ap1LenR) ap1IdxR = 0;

      // All-pass stage 2
      const dAp2L = ap2BufL[ap2IdxL];
      const outAp2L = -0.5 * outAp1L + dAp2L;
      ap2BufL[ap2IdxL] = outAp1L + 0.5 * dAp2L;
      if (++ap2IdxL >= ap2LenL) ap2IdxL = 0;

      const dAp2R = ap2BufR[ap2IdxR];
      const outAp2R = -0.5 * outAp1R + dAp2R;
      ap2BufR[ap2IdxR] = outAp1R + 0.5 * dAp2R;
      if (++ap2IdxR >= ap2LenR) ap2IdxR = 0;

      const earlyL = (i >= er1 ? dryR[i - er1] * 0.09 : 0) + (i >= er2 ? dryL[i - er2] * 0.07 : 0);
      const earlyR = (i >= er1 ? dryL[i - er1] * 0.09 : 0) + (i >= er2 ? dryR[i - er2] * 0.07 : 0);

      left[i] = inL + earlyL + outAp2L * 0.34;
      right[i] = inR + earlyR + outAp2R * 0.34;
    }

    // 1st-order DC blocker (R=0.998 => ~14 Hz cutoff at 44.1kHz):
    // Eliminates lingering DC offset across all summed stems before peak-normalizing
    const R_dc = 0.998;
    let prevDcXL = 0, prevDcYL = 0, prevDcXR = 0, prevDcYR = 0;
    for (let i = 0; i < totalFrames; i++) {
      const l = left[i];
      const yL = l - prevDcXL + R_dc * prevDcYL;
      prevDcXL = l;
      prevDcYL = yL;
      left[i] = yL;

      const r = right[i];
      const yR = r - prevDcXR + R_dc * prevDcYR;
      prevDcXR = r;
      prevDcYR = yR;
      right[i] = yR;
    }

    // Peak-normalize the rendered stereo mix to 0.90 (-0.9 dBFS) with transient spike protection
    let maxPeak = 0;
    const winStep = Math.max(1024, Math.floor(0.05 * sampleRate));
    const winPeaks: number[] = [];
    for (let i = 0; i < totalFrames; i += winStep) {
      const end = Math.min(totalFrames, i + winStep);
      let wPeak = 0;
      for (let j = i; j < end; j++) {
        const l = Number.isFinite(left[j]) ? left[j] : 0;
        const r = Number.isFinite(right[j]) ? right[j] : 0;
        left[j] = l;
        right[j] = r;
        const m = Math.max(Math.abs(l), Math.abs(r));
        if (m > wPeak) wPeak = m;
        if (m > maxPeak) maxPeak = m;
      }
      if (wPeak > 0.001) winPeaks.push(wPeak);
    }

    let refPeak = maxPeak;
    if (winPeaks.length >= 8) {
      winPeaks.sort((a, b) => a - b);
      const p98 = winPeaks[Math.min(winPeaks.length - 1, Math.floor(winPeaks.length * 0.98))];
      if (p98 > 0.001 && maxPeak > p98 * 2.5) {
        refPeak = p98 * 1.35;
      }
    }

    const normGain =
      refPeak > 0.0001
        ? (0.90 / refPeak) * Math.min(1.5, Math.max(0.5, this.masterVolumeScalar))
        : 1.0;

    for (let i = 0; i < totalFrames; i++) {
      left[i] = Math.tanh(left[i] * normGain);
      right[i] = Math.tanh(right[i] * normGain);
    }

    return {
      left,
      right,
      sampleRate,
      totalSeconds,
      totalQuarterBeats,
    };
  }

  public async exportWavBlob(score: CompiledScore): Promise<Blob> {
    const { left, right, sampleRate } = await this.renderScoreToStereoPcm(score);
    return this.channelsToWavBlob(left, right, sampleRate);
  }

  private channelsToWavBlob(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
    const numCh = 2;
    const numFrames = left.length;
    const bytesPerSample = 2;
    const blockAlign = numCh * bytesPerSample;
    const dataBytes = numFrames * blockAlign;
    const arrayBuffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(arrayBuffer);

    const writeStr = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numCh, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, dataBytes, true);

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      const sL = Math.max(-1, Math.min(1, left[i]));
      const sR = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
      view.setInt16(offset + 2, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
      offset += 4;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}
