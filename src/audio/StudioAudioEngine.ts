import { CompiledScore, TrackDefinition } from '../parser/DocumentParser';
import { AtomicEvent } from '../parser/ASTSerializer';

export interface PlaybackProgress {
  isPlaying: boolean;
  currentQuarterBeat: number;
  totalQuarterBeats: number;
  currentTimeSec: number;
  totalDurationSec: number;
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
  amp: number;
  startAmp: number;
  endAmp: number;
  swell?: 'crescendo' | 'diminuendo';
  pan: number;
}

interface ActiveVoiceCleanup {
  stopAndDisconnect: () => void;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbSendBus: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private activeVoices: Set<ActiveVoiceCleanup> = new Set();
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
  private polyphonyScalar: number = 1.0;

  private scheduledTimeline: ScheduledNoteEvent[] = [];
  private nextScheduleIndex: number = 0;

  public onProgress?: (progress: PlaybackProgress) => void;

  private ensureContext(): AudioContext {
    if (!this.ctx || (this.ctx.state as string) === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    this.rebuildMasterChain(this.ctx);
    return this.ctx;
  }

  /**
   * Rebuilds a clean master bus before playback so no residual ConvolverNode
   * or DynamicsCompressorNode state can ever poison subsequent plays.
   */
  private rebuildMasterChain(ctx: AudioContext): void {
    try {
      this.reverbSendBus?.disconnect();
      this.reverbNode?.disconnect();
      this.reverbWetGain?.disconnect();
      this.masterGain?.disconnect();
      this.compressorNode?.disconnect();
    } catch {
      // Ignore disconnect errors on old nodes
    }

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 0.7;

    if (typeof (ctx as any).createDynamicsCompressor === 'function') {
      const comp = ctx.createDynamicsCompressor();
      const now = ctx.currentTime || 0;
      comp.threshold?.setValueAtTime?.(-10, now);
      comp.knee?.setValueAtTime?.(12, now);
      comp.ratio?.setValueAtTime?.(6, now);
      comp.attack?.setValueAtTime?.(0.003, now);
      comp.release?.setValueAtTime?.(0.15, now);
      comp.connect(ctx.destination);
      this.masterGain.connect(comp);
      this.compressorNode = comp;
    } else {
      this.masterGain.connect(ctx.destination);
      this.compressorNode = null;
    }

    this.reverbSendBus = ctx.createGain();
    this.reverbSendBus.gain.value = 0.12;

    if (typeof (ctx as any).createConvolver === 'function') {
      this.reverbNode = this.createImpulseReverb(ctx, 1.35, 3.6);
      this.reverbWetGain = ctx.createGain();
      this.reverbWetGain.gain.value = 0.16;
      this.reverbSendBus.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbWetGain);
      this.reverbWetGain.connect(this.masterGain);
    } else {
      this.reverbNode = null;
      this.reverbWetGain = null;
    }
  }

  private createImpulseReverb(ctx: BaseAudioContext, seconds: number, decay: number): ConvolverNode {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate || 44100;
    const length = Math.floor(rate * seconds);
    const impulse = ctx.createBuffer(2, length, rate);
    const norm = 0.16;
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay) * norm;
      }
    }
    convolver.buffer = impulse;
    return convolver;
  }

  public setTrackVolume(trackId: string, volumeMidi: number): void {
    this.trackVolumes.set(trackId, Math.max(0, Math.min(127, volumeMidi)));
  }

  public setLoop(loop: boolean): void {
    this.isLooping = loop;
  }

  public calculateScoreDuration(score: CompiledScore): { totalQuarterBeats: number; totalSeconds: number } {
    const tempo = Number(score.meta?.tempo) || 120;
    const secPerWholeNote = (60 / tempo) * 4;
    let maxWholeFraction = 0;

    for (const ev of score.events) {
      const start = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const dur = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (Number.isFinite(start) && Number.isFinite(dur) && start + dur > maxWholeFraction) {
        maxWholeFraction = start + dur;
      }
    }

    if (maxWholeFraction <= 0) maxWholeFraction = 0.25;
    return {
      totalQuarterBeats: maxWholeFraction * 4,
      totalSeconds: maxWholeFraction * secPerWholeNote,
    };
  }

  private buildScheduledTimeline(score: CompiledScore): ScheduledNoteEvent[] {
    const tempo = Number(score.meta?.tempo) || 120;
    const secPerWholeNote = (60 / tempo) * 4;
    const defsById = new Map<string, TrackDefinition>();
    for (const d of score.defs) {
      defsById.set(d.id, d);
    }

    const numTracks = Math.max(1, score.defs.length);
    this.polyphonyScalar = numTracks >= 8 ? 0.42 : numTracks >= 5 ? 0.52 : numTracks >= 3 ? 0.68 : 0.85;

    const list: ScheduledNoteEvent[] = [];

    for (const ev of score.events) {
      if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer) continue;

      const trackId = ev.trackId || 'pno';
      if (this.soloedTracks.size > 0 && !this.soloedTracks.has(trackId)) continue;
      if (this.mutedTracks.has(trackId)) continue;

      const def = defsById.get(trackId);
      const style = (ev.style || def?.style || 'standard').toLowerCase();
      const patch = (ev.patch || def?.patch || 'salamander_grand').toLowerCase();

      const trackVolMidi = this.trackVolumes.get(trackId) ?? def?.volume ?? 100;
      const trackGainScalar = (trackVolMidi / 100) * 0.26 * this.polyphonyScalar;

      const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (!Number.isFinite(startWhole) || !Number.isFinite(durWhole)) continue;

      let startSec = startWhole * secPerWholeNote;
      if (ev.physics?.pullMs) startSec += ev.physics.pullMs / 1000;
      if (ev.physics?.pushMs) startSec = Math.max(0, startSec - ev.physics.pushMs / 1000);

      let durSec = Math.max(0.05, durWhole * secPerWholeNote);
      if (ev.physics?.articulation === 'stacc' || ev.physics?.articulation === 'staccato') {
        durSec = Math.max(0.045, durSec * 0.48);
      }

      const vel = ev.physics?.velocity ?? 85;
      const swell = ev.physics?.swell;
      const startVel = ev.physics?.startVelocity ?? (swell === 'crescendo' ? 40 : swell === 'diminuendo' ? 112 : vel);
      const endVel = ev.physics?.endVelocity ?? (swell === 'crescendo' ? 116 : swell === 'diminuendo' ? 32 : vel);

      const amp = Math.max(0.012, Math.min(0.55, (vel / 127) * trackGainScalar));
      const startAmp = Math.max(0.008, Math.min(0.6, (startVel / 127) * trackGainScalar));
      const endAmp = Math.max(0.008, Math.min(0.6, (endVel / 127) * trackGainScalar));
      const pan = Math.max(-1, Math.min(1, ev.physics?.pan ?? def?.pan ?? 0));
      const freq =
        Number.isFinite(ev.pitch.frequency) && ev.pitch.frequency >= 20 && ev.pitch.frequency <= 10000
          ? ev.pitch.frequency
          : 440;

      list.push({
        event: ev,
        def,
        startSec,
        durSec,
        freq,
        midi: ev.pitch.midi || 60,
        gridKey: ev.pitch.gridKey,
        style,
        patch,
        amp,
        startAmp,
        endAmp,
        swell,
        pan,
      });
    }

    list.sort((a, b) => a.startSec - b.startSec);
    return list;
  }

  private triggerRealtimeVoice(ctx: AudioContext, item: ScheduledNoteEvent, absStartSec: number): void {
    if (!this.masterGain) return;

    // Cap simultaneous live voices at 48 to prevent WebAudio thread saturation on dense scores
    while (this.activeVoices.size >= 48) {
      const oldest = this.activeVoices.values().next().value;
      if (!oldest) break;
      oldest.stopAndDisconnect();
      this.activeVoices.delete(oldest);
    }

    const safeStart = Math.max(ctx.currentTime + 0.008, absStartSec);
    const durSec = Math.max(0.05, item.durSec);

    let voiceOut: AudioNode = this.masterGain;
    let pannerNode: StereoPannerNode | null = null;

    if (typeof ctx.createStereoPanner === 'function' && item.pan !== 0) {
      pannerNode = ctx.createStereoPanner();
      pannerNode.pan.setValueAtTime(item.pan, safeStart);
      pannerNode.connect(this.masterGain);
      voiceOut = pannerNode;
    }

    if (this.reverbSendBus && item.style !== 'grid' && !item.gridKey) {
      voiceOut.connect(this.reverbSendBus);
    }

    if (item.style === 'grid' || item.gridKey) {
      this.scheduleDrumHit(ctx, voiceOut, pannerNode, item.gridKey || 'k', item.midi, safeStart, item.amp);
    } else if (item.style === 'synth') {
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
        item.endAmp
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
        item.endAmp
      );
    }
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
    endAmp?: number
  ): void {
    const env = ctx.createGain();
    const oscFund = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();

    oscFund.type = 'triangle';
    oscHarm.type = 'sine';
    oscFund.frequency.setValueAtTime(freq, startSec);
    oscHarm.frequency.setValueAtTime(Math.min(12000, freq * 2), startSec);

    const gFund = ctx.createGain();
    const gHarm = ctx.createGain();
    gFund.gain.value = 0.75;
    gHarm.gain.value = 0.25;

    oscFund.connect(gFund);
    oscHarm.connect(gHarm);
    gFund.connect(env);
    gHarm.connect(env);
    env.connect(output);

    const t0 = startSec;
    const tAttack = t0 + 0.01;
    const tDecay = Math.max(tAttack + 0.02, t0 + durSec);
    const release = Math.min(0.2, durSec * 0.4);
    const tEnd = tDecay + Math.max(0.03, release);

    env.gain.setValueAtTime(0.0001, t0);
    if (swell === 'crescendo' || swell === 'diminuendo') {
      const sPeak = Math.max(0.002, (startAmp ?? amp) * 0.52);
      const ePeak = Math.max(0.002, (endAmp ?? amp) * 0.52);
      env.gain.linearRampToValueAtTime(sPeak, tAttack);
      env.gain.linearRampToValueAtTime(ePeak, tDecay);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else {
      const peak = Math.max(0.002, amp * 0.5);
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
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
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
          env.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };

    this.activeVoices.add(cleanup);
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
    endAmp?: number
  ): void {
    const isSub = patch.includes('sub') || patch.includes('808') || freq < 130;
    const isPad = patch.includes('pad') || patch.includes('string');

    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(0.707, startSec);
    const baseCutoff = isSub ? 360 : isPad ? 1900 : 3000;
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
    const attack = isPad ? Math.min(0.06, durSec * 0.25) : 0.01;
    const tAttack = t0 + Math.max(0.008, attack);
    const tSustain = Math.max(tAttack + 0.02, t0 + durSec);
    const release = isPad ? 0.2 : 0.08;
    const tEnd = tSustain + release;
    const voiceScale = isSub ? 0.55 : isPad ? 0.28 : 0.34;

    env.gain.setValueAtTime(0.0001, t0);
    if (swell === 'crescendo' || swell === 'diminuendo') {
      const sPeak = Math.max(0.002, (startAmp ?? amp) * voiceScale);
      const ePeak = Math.max(0.002, (endAmp ?? amp) * voiceScale);
      env.gain.linearRampToValueAtTime(sPeak, tAttack);
      env.gain.linearRampToValueAtTime(ePeak, tSustain);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else {
      const peak = Math.max(0.002, amp * voiceScale);
      env.gain.linearRampToValueAtTime(peak, tAttack);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0005, peak * 0.7), tSustain);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    }

    const stopAt = tEnd + 0.015;
    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(stopAt);
    osc2.stop(stopAt);

    let cleaned = false;
    const cleanup: ActiveVoiceCleanup = {
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
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
  ): void {
    const key = gridKey.toLowerCase();

    if (key === 'k' || key === 'bd' || key === 'kick' || midi === 36) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(135, startSec);
      osc.frequency.exponentialRampToValueAtTime(38, startSec + 0.12);
      gain.gain.setValueAtTime(Math.max(0.002, amp * 0.78), startSec);
      gain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.24);
      osc.connect(gain);
      gain.connect(output);
      osc.start(startSec);
      osc.stop(startSec + 0.26);

      let cleaned = false;
      const cleanup: ActiveVoiceCleanup = {
        stopAndDisconnect: () => {
          if (cleaned) return;
          cleaned = true;
          this.activeVoices.delete(cleanup);
          try {
            osc.stop();
          } catch {
            // Ignore
          }
          try {
            osc.disconnect();
            gain.disconnect();
            pannerNode?.disconnect();
          } catch {
            // Ignore
          }
        },
      };

      this.activeVoices.add(cleanup);
      osc.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    const isSnare =
      key === 's' || key === 'sd' || key === 'snare' || key === 'cp' || key === 'clap' || midi === 38 || midi === 39;
    const isOpenHat = key === 'oh' || key === 'cr' || key === 'rd' || midi === 46 || midi === 49 || midi === 51;
    const dur = isSnare ? 0.16 : isOpenHat ? 0.22 : 0.055;
    const sr = ctx.sampleRate || 44100;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, isSnare ? 1.8 : 2.8);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.Q.setValueAtTime(0.707, startSec);
    filter.frequency.setValueAtTime(isSnare ? 550 : 5500, startSec);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.002, amp * (isSnare ? 0.48 : 0.3)), startSec);
    gain.gain.exponentialRampToValueAtTime(0.0001, startSec + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    src.start(startSec);

    let cleaned = false;
    const cleanup: ActiveVoiceCleanup = {
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
        try {
          src.stop();
        } catch {
          // Ignore
        }
        try {
          src.disconnect();
          filter.disconnect();
          gain.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };

    this.activeVoices.add(cleanup);
    src.onended = () => cleanup.stopAndDisconnect();
  }

  public async playScore(score: CompiledScore): Promise<void> {
    this.stop(false);

    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const { totalQuarterBeats, totalSeconds } = this.calculateScoreDuration(score);
    this.totalQuarterBeats = totalQuarterBeats;
    this.scoreDurationSec = totalSeconds;
    this.tempoBpm = Number(score.meta?.tempo) || 120;
    this.scheduledTimeline = this.buildScheduledTimeline(score);
    this.nextScheduleIndex = 0;
    this.isPlaying = true;

    const baseStart = ctx.currentTime + 0.06;
    this.startContextTime = baseStart;

    const LOOKAHEAD_SEC = 0.22;

    const scheduleLookaheadSlice = () => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const elapsed = Math.max(0, now - this.startContextTime);

      while (
        this.nextScheduleIndex < this.scheduledTimeline.length &&
        this.scheduledTimeline[this.nextScheduleIndex].startSec <= elapsed + LOOKAHEAD_SEC
      ) {
        const item = this.scheduledTimeline[this.nextScheduleIndex];
        // Only schedule notes that are in the future or within 25ms of now
        // so lagged UI frames never pile up overdue notes on the same sample
        if (item.startSec >= elapsed - 0.025) {
          this.triggerRealtimeVoice(this.ctx, item, this.startContextTime + item.startSec);
        }
        this.nextScheduleIndex++;
      }

      if (elapsed >= this.scoreDurationSec) {
        if (this.isLooping) {
          this.playScore(score);
          return;
        }
        this.stop(true);
      }
    };

    // Run audio lookahead immediately and on a steady 25ms timer independent of UI rendering
    scheduleLookaheadSlice();
    this.schedulerIntervalId = window.setInterval(scheduleLookaheadSlice, 25);

    const tickVisualProgress = () => {
      if (!this.isPlaying || !this.ctx) return;
      const elapsed = Math.max(0, this.ctx.currentTime - this.startContextTime);
      const currentBeat = (elapsed / 60) * this.tempoBpm;

      this.onProgress?.({
        isPlaying: true,
        currentQuarterBeat: currentBeat,
        totalQuarterBeats: this.totalQuarterBeats,
        currentTimeSec: elapsed,
        totalDurationSec: this.scoreDurationSec,
      });

      this.rafId = requestAnimationFrame(tickVisualProgress);
    };

    this.rafId = requestAnimationFrame(tickVisualProgress);
  }

  public stop(notify: boolean = true): void {
    this.isPlaying = false;
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

    if (notify) {
      this.onProgress?.({
        isPlaying: false,
        currentQuarterBeat: 0,
        totalQuarterBeats: this.totalQuarterBeats,
        currentTimeSec: 0,
        totalDurationSec: this.scoreDurationSec,
      });
    }
  }

  /**
   * Synthesizes the entire multi-track score directly into stereo Float32 PCM buffers
   * with zero WebAudio node limits and strict feed-forward reflections so 60+ measure scores
   * render completely from measure 1 to the final reverb tail.
   */
  public async exportWavBlob(score: CompiledScore): Promise<Blob> {
    const { totalSeconds } = this.calculateScoreDuration(score);
    const renderDuration = Math.max(2, totalSeconds + 1.5);
    const sampleRate = 44100;
    const totalFrames = Math.ceil(renderDuration * sampleRate);

    const left = new Float32Array(totalFrames);
    const right = new Float32Array(totalFrames);
    const timeline = this.buildScheduledTimeline(score);

    for (const item of timeline) {
      const startFrame = Math.max(0, Math.floor(item.startSec * sampleRate));
      if (startFrame >= totalFrames) continue;

      const isDrum = item.style === 'grid' || Boolean(item.gridKey);
      const releaseSec = isDrum ? 0.05 : item.patch.includes('pad') ? 0.28 : 0.16;
      const totalNoteSec = item.durSec + releaseSec;
      const noteFrames = Math.min(totalFrames - startFrame, Math.floor(totalNoteSec * sampleRate));

      const panAngle = ((item.pan + 1) * 0.5) * (Math.PI * 0.5);
      const gainL = Math.cos(panAngle);
      const gainR = Math.sin(panAngle);

      if (isDrum) {
        const key = (item.gridKey || 'k').toLowerCase();
        const isKick = key === 'k' || key === 'bd' || key === 'kick' || item.midi === 36;
        const isSnare =
          key === 's' || key === 'sd' || key === 'snare' || key === 'cp' || key === 'clap' || item.midi === 38;
        const drumFrames = Math.min(
          totalFrames - startFrame,
          Math.floor((isKick ? 0.26 : isSnare ? 0.18 : 0.08) * sampleRate)
        );
        let phase = 0;

        for (let i = 0; i < drumFrames; i++) {
          const t = i / sampleRate;
          let sample = 0;
          if (isKick) {
            const instFreq = 38 + 110 * Math.exp(-t * 28);
            phase += (2 * Math.PI * instFreq) / sampleRate;
            sample = Math.sin(phase) * Math.exp(-t * 11) * item.amp * 0.9;
          } else if (isSnare) {
            phase += (2 * Math.PI * 160) / sampleRate;
            const tone = Math.sin(phase) * Math.exp(-t * 22) * 0.4;
            const noise = ((Math.sin(i * 12.9898) * 43758.5453) % 1) * Math.exp(-t * 16) * 0.6;
            sample = (tone + noise) * item.amp * 0.7;
          } else {
            const noise = ((Math.sin(i * 78.233) * 43758.5453) % 1) * Math.exp(-t * 35);
            sample = noise * item.amp * 0.45;
          }
          left[startFrame + i] += sample * gainL;
          right[startFrame + i] += sample * gainR;
        }
        continue;
      }

      const isSub = item.patch.includes('sub') || item.patch.includes('808') || item.freq < 130;
      const isPad = item.patch.includes('pad') || item.patch.includes('string');
      const isSynth = item.style === 'synth';

      const attackSec = isPad ? Math.min(0.08, item.durSec * 0.25) : 0.008;
      const twoPiOverSr = (2 * Math.PI) / sampleRate;
      const f1 = item.freq;
      const f2 = item.freq * (isPad ? 1.004 : 1.002);

      const hasSwell = item.swell === 'crescendo' || item.swell === 'diminuendo';
      const baseAmpScalar = hasSwell ? 1.0 : item.amp;

      for (let i = 0; i < noteFrames; i++) {
        const t = i / sampleRate;
        let env = 1.0;
        if (hasSwell) {
          if (t < attackSec) {
            env = (t / attackSec) * item.startAmp;
          } else if (t <= item.durSec) {
            const swellProgress = (t - attackSec) / Math.max(0.001, item.durSec - attackSec);
            env = item.startAmp + (item.endAmp - item.startAmp) * swellProgress;
          } else {
            const relProgress = (t - item.durSec) / Math.max(0.001, releaseSec);
            env = item.endAmp * Math.max(0, 1 - relProgress);
          }
        } else {
          if (t < attackSec) {
            env = t / attackSec;
          } else if (t <= item.durSec) {
            const decayProgress = (t - attackSec) / Math.max(0.001, item.durSec - attackSec);
            env = isPad ? 1.0 - 0.15 * decayProgress : 0.45 + 0.55 * Math.exp(-decayProgress * 2.2);
          } else {
            const relProgress = (t - item.durSec) / Math.max(0.001, releaseSec);
            const sustainEnd = isPad ? 0.85 : 0.45;
            env = sustainEnd * Math.max(0, 1 - relProgress);
          }
        }

        const ph1 = i * f1 * twoPiOverSr;
        const ph2 = i * f2 * twoPiOverSr;

        let wave = 0;
        if (isSub) {
          wave = Math.sin(ph1) * 0.8 + Math.sin(ph1 * 2) * 0.2;
        } else if (isSynth) {
          wave =
            0.55 * Math.sin(ph1) +
            0.28 * Math.sin(ph2 * 2) +
            0.12 * Math.sin(ph1 * 3) +
            0.05 * Math.sin(ph2 * 4);
        } else {
          wave =
            0.62 * Math.sin(ph1) +
            0.22 * Math.sin(ph1 * 2) * Math.exp(-t * 2.5) +
            0.11 * Math.sin(ph1 * 3) * Math.exp(-t * 4.0) +
            0.05 * Math.sin(ph1 * 4) * Math.exp(-t * 6.0);
        }

        const sample = wave * env * baseAmpScalar * 0.55;
        left[startFrame + i] += sample * gainL;
        right[startFrame + i] += sample * gainR;
      }
    }

    // Apply strictly feed-forward stereo early reflections (feedback is mathematically impossible)
    const dryL = new Float32Array(left);
    const dryR = new Float32Array(right);
    const delay1 = Math.floor(0.037 * sampleRate);
    const delay2 = Math.floor(0.073 * sampleRate);
    for (let i = delay2; i < totalFrames; i++) {
      left[i] = dryL[i] + dryR[i - delay1] * 0.14 + dryL[i - delay2] * 0.08;
      right[i] = dryR[i] + dryL[i - delay1] * 0.14 + dryR[i - delay2] * 0.08;
    }

    for (let i = 0; i < totalFrames; i++) {
      const l = Number.isFinite(left[i]) ? Math.tanh(left[i]) : 0;
      const r = Number.isFinite(right[i]) ? Math.tanh(right[i]) : 0;
      left[i] = l;
      right[i] = r;
    }

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
