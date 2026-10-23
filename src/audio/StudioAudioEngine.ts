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
  pan: number;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private activeNodes: Set<AudioNode> = new Set();
  private rafId: number | null = null;
  private startContextTime: number = 0;
  private scoreDurationSec: number = 0;
  private totalQuarterBeats: number = 4;
  private tempoBpm: number = 120;
  private isPlaying: boolean = false;
  private isLooping: boolean = false;
  private trackVolumes: Map<string, number> = new Map();
  private mutedTracks: Set<string> = new Set();
  private soloedTracks: Set<string> = new Set();

  private scheduledTimeline: ScheduledNoteEvent[] = [];
  private nextScheduleIndex: number = 0;

  public onProgress?: (progress: PlaybackProgress) => void;

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;

      if (typeof (this.ctx as any).createDynamicsCompressor === 'function') {
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold?.setValueAtTime?.(-12, this.ctx.currentTime || 0);
        comp.ratio?.setValueAtTime?.(4, this.ctx.currentTime || 0);
        comp.connect(this.ctx.destination);
        this.masterGain.connect(comp);
      } else {
        this.masterGain.connect(this.ctx.destination);
      }

      if (typeof (this.ctx as any).createConvolver === 'function') {
        this.reverbNode = this.createImpulseReverb(this.ctx, 1.8, 2.8);
        const wet = this.ctx.createGain();
        wet.gain.value = 0.22;
        this.reverbNode.connect(wet);
        wet.connect(this.masterGain);
      }
    }
    return this.ctx;
  }

  private createImpulseReverb(ctx: BaseAudioContext, seconds: number, decay: number): ConvolverNode {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate || 44100;
    const length = Math.floor(rate * seconds);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
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
      const trackGainScalar = (trackVolMidi / 100) * 0.45;

      const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (!Number.isFinite(startWhole) || !Number.isFinite(durWhole)) continue;

      let startSec = startWhole * secPerWholeNote;
      if (ev.physics?.pullMs) startSec += ev.physics.pullMs / 1000;
      if (ev.physics?.pushMs) startSec = Math.max(0, startSec - ev.physics.pushMs / 1000);

      let durSec = Math.max(0.045, durWhole * secPerWholeNote);
      if (ev.physics?.articulation === 'stacc' || ev.physics?.articulation === 'staccato') {
        durSec = Math.max(0.04, durSec * 0.45);
      }

      const amp = Math.max(0.02, Math.min(1.0, ((ev.physics?.velocity ?? 85) / 127) * trackGainScalar));
      const pan = Math.max(-1, Math.min(1, ev.physics?.pan ?? def?.pan ?? 0));
      const freq = Number.isFinite(ev.pitch.frequency) && ev.pitch.frequency > 15 ? ev.pitch.frequency : 440;

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
        pan,
      });
    }

    list.sort((a, b) => a.startSec - b.startSec);
    return list;
  }

  private triggerRealtimeVoice(ctx: AudioContext, item: ScheduledNoteEvent, absStartSec: number): void {
    if (!this.masterGain) return;
    const safeStart = Math.max(ctx.currentTime + 0.005, absStartSec);
    const durSec = Math.max(0.04, item.durSec);

    let voiceOut: AudioNode = this.masterGain;
    if (typeof ctx.createStereoPanner === 'function' && item.pan !== 0) {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(item.pan, safeStart);
      panner.connect(this.masterGain);
      voiceOut = panner;
    }

    if (this.reverbNode && item.style !== 'grid' && !item.gridKey) {
      const send = ctx.createGain();
      send.gain.value = 0.22;
      voiceOut.connect(send);
      send.connect(this.reverbNode);
    }

    if (item.style === 'grid' || item.gridKey) {
      this.scheduleDrumHit(ctx, voiceOut, item.gridKey || 'k', item.midi, safeStart, item.amp);
    } else if (item.style === 'synth') {
      this.scheduleSynthVoice(ctx, voiceOut, item.freq, item.patch, safeStart, durSec, item.amp);
    } else {
      this.scheduleAcousticPianoVoice(ctx, voiceOut, item.freq, safeStart, durSec, item.amp);
    }
  }

  private scheduleAcousticPianoVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    freq: number,
    startSec: number,
    durSec: number,
    amp: number
  ): void {
    const env = ctx.createGain();
    const oscFund = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();

    oscFund.type = 'triangle';
    oscHarm.type = 'sine';
    oscFund.frequency.setValueAtTime(freq, startSec);
    oscHarm.frequency.setValueAtTime(freq * 2, startSec);

    const gFund = ctx.createGain();
    const gHarm = ctx.createGain();
    gFund.gain.value = 0.75;
    gHarm.gain.value = 0.25;

    oscFund.connect(gFund);
    oscHarm.connect(gHarm);
    gFund.connect(env);
    gHarm.connect(env);
    env.connect(output);

    const peak = Math.max(0.002, amp * 0.55);
    const release = Math.min(0.22, durSec * 0.4);
    env.gain.setValueAtTime(0.0001, startSec);
    env.gain.linearRampToValueAtTime(peak, startSec + 0.01);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.4), startSec + durSec);
    env.gain.exponentialRampToValueAtTime(0.0001, startSec + durSec + release);

    const stopAt = startSec + durSec + release + 0.02;
    oscFund.start(startSec);
    oscHarm.start(startSec);
    oscFund.stop(stopAt);
    oscHarm.stop(stopAt);

    this.activeNodes.add(oscFund);
    this.activeNodes.add(oscHarm);
    oscFund.onended = () => {
      this.activeNodes.delete(oscFund);
      this.activeNodes.delete(oscHarm);
      try {
        env.disconnect();
      } catch {
        // Ignore
      }
    };
  }

  private scheduleSynthVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    freq: number,
    patch: string,
    startSec: number,
    durSec: number,
    amp: number
  ): void {
    const isSub = patch.includes('sub') || patch.includes('808') || freq < 130;
    const isPad = patch.includes('pad') || patch.includes('string');

    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isSub ? 450 : isPad ? 2200 : 3800, startSec);

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = isSub ? 'sine' : 'sawtooth';
    osc2.type = isSub ? 'triangle' : isPad ? 'sawtooth' : 'square';

    osc1.frequency.setValueAtTime(freq, startSec);
    osc2.frequency.setValueAtTime(freq, startSec);
    osc2.detune.setValueAtTime(isPad ? 8 : 5, startSec);

    const mix1 = ctx.createGain();
    const mix2 = ctx.createGain();
    mix1.gain.value = 0.6;
    mix2.gain.value = 0.4;

    osc1.connect(mix1);
    osc2.connect(mix2);
    mix1.connect(filter);
    mix2.connect(filter);
    filter.connect(env);
    env.connect(output);

    const attack = isPad ? Math.min(0.08, durSec * 0.25) : 0.01;
    const release = isPad ? 0.25 : 0.1;
    const peak = Math.max(0.002, amp * (isSub ? 0.65 : isPad ? 0.35 : 0.42));

    env.gain.setValueAtTime(0.0001, startSec);
    env.gain.linearRampToValueAtTime(peak, startSec + attack);
    env.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * 0.7), startSec + durSec);
    env.gain.exponentialRampToValueAtTime(0.0001, startSec + durSec + release);

    const stopAt = startSec + durSec + release + 0.02;
    osc1.start(startSec);
    osc2.start(startSec);
    osc1.stop(stopAt);
    osc2.stop(stopAt);

    this.activeNodes.add(osc1);
    this.activeNodes.add(osc2);
    osc1.onended = () => {
      this.activeNodes.delete(osc1);
      this.activeNodes.delete(osc2);
      try {
        env.disconnect();
      } catch {
        // Ignore
      }
    };
  }

  private scheduleDrumHit(
    ctx: BaseAudioContext,
    output: AudioNode,
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
      osc.frequency.setValueAtTime(140, startSec);
      osc.frequency.exponentialRampToValueAtTime(38, startSec + 0.12);
      gain.gain.setValueAtTime(Math.max(0.002, amp * 0.85), startSec);
      gain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.25);
      osc.connect(gain);
      gain.connect(output);
      osc.start(startSec);
      osc.stop(startSec + 0.27);
      this.activeNodes.add(osc);
      osc.onended = () => {
        this.activeNodes.delete(osc);
        try {
          gain.disconnect();
        } catch {
          // Ignore
        }
      };
      return;
    }

    const isSnare =
      key === 's' || key === 'sd' || key === 'snare' || key === 'cp' || key === 'clap' || midi === 38 || midi === 39;
    const isOpenHat = key === 'oh' || midi === 46;
    const dur = isSnare ? 0.18 : isOpenHat ? 0.24 : 0.06;
    const len = Math.floor((ctx.sampleRate || 44100) * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate || 44100);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, isSnare ? 1.8 : 2.8);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(isSnare ? 550 : 6000, startSec);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.002, amp * (isSnare ? 0.6 : 0.4)), startSec);
    gain.gain.exponentialRampToValueAtTime(0.0001, startSec + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    src.start(startSec);
    this.activeNodes.add(src);
    src.onended = () => {
      this.activeNodes.delete(src);
      try {
        gain.disconnect();
      } catch {
        // Ignore
      }
    };
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

    const baseStart = ctx.currentTime + 0.05;
    this.startContextTime = baseStart;

    const LOOKAHEAD_SEC = 0.28;

    const tickProgress = () => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const elapsed = Math.max(0, now - this.startContextTime);

      // Schedule notes falling within the rolling 280ms lookahead window
      while (
        this.nextScheduleIndex < this.scheduledTimeline.length &&
        this.scheduledTimeline[this.nextScheduleIndex].startSec <= elapsed + LOOKAHEAD_SEC
      ) {
        const item = this.scheduledTimeline[this.nextScheduleIndex];
        this.triggerRealtimeVoice(this.ctx, item, this.startContextTime + item.startSec);
        this.nextScheduleIndex++;
      }

      const currentBeat = (elapsed / 60) * this.tempoBpm;

      if (elapsed >= this.scoreDurationSec) {
        if (this.isLooping) {
          this.playScore(score);
          return;
        }
        this.stop(true);
        return;
      }

      this.onProgress?.({
        isPlaying: true,
        currentQuarterBeat: currentBeat,
        totalQuarterBeats: this.totalQuarterBeats,
        currentTimeSec: elapsed,
        totalDurationSec: this.scoreDurationSec,
      });

      this.rafId = requestAnimationFrame(tickProgress);
    };

    this.rafId = requestAnimationFrame(tickProgress);
  }

  public stop(notify: boolean = true): void {
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    for (const node of this.activeNodes) {
      try {
        (node as any).stop?.();
        node.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.activeNodes.clear();

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
   * with zero WebAudio node limits and strict NaN protection so 60+ measure scores
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

      for (let i = 0; i < noteFrames; i++) {
        const t = i / sampleRate;
        let env = 1.0;
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
          // Acoustic Piano harmonic series
          wave =
            0.62 * Math.sin(ph1) +
            0.22 * Math.sin(ph1 * 2) * Math.exp(-t * 2.5) +
            0.11 * Math.sin(ph1 * 3) * Math.exp(-t * 4.0) +
            0.05 * Math.sin(ph1 * 4) * Math.exp(-t * 6.0);
        }

        const sample = wave * env * item.amp * 0.45;
        left[startFrame + i] += sample * gainL;
        right[startFrame + i] += sample * gainR;
      }
    }

    // Apply lightweight stereo room reflections & soft-knee mastering limiter
    const delay1 = Math.floor(0.037 * sampleRate);
    const delay2 = Math.floor(0.073 * sampleRate);
    for (let i = delay2; i < totalFrames; i++) {
      left[i] += right[i - delay1] * 0.14 + left[i - delay2] * 0.09;
      right[i] += left[i - delay1] * 0.14 + right[i - delay2] * 0.09;
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
