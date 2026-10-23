import { CompiledScore, TrackDefinition } from '../parser/DocumentParser';

export interface PlaybackProgress {
  isPlaying: boolean;
  currentQuarterBeat: number;
  totalQuarterBeats: number;
  currentTimeSec: number;
  totalDurationSec: number;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private delayWetGain: GainNode | null = null;
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

  public onProgress?: (progress: PlaybackProgress) => void;

  private setupMasterChain(ctx: BaseAudioContext): {
    masterInput: GainNode;
    reverbInput: ConvolverNode | null;
    delayInput: DelayNode | null;
  } {
    const masterInput = ctx.createGain();
    masterInput.gain.value = 0.85;

    let outputTarget: AudioNode = ctx.destination;
    if (typeof (ctx as any).createDynamicsCompressor === 'function') {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold?.setValueAtTime?.(-14, ctx.currentTime || 0);
      comp.knee?.setValueAtTime?.(18, ctx.currentTime || 0);
      comp.ratio?.setValueAtTime?.(4, ctx.currentTime || 0);
      comp.attack?.setValueAtTime?.(0.005, ctx.currentTime || 0);
      comp.release?.setValueAtTime?.(0.18, ctx.currentTime || 0);
      comp.connect(ctx.destination);
      outputTarget = comp;
      if (ctx === this.ctx) {
        this.compressorNode = comp;
      }
    }

    masterInput.connect(outputTarget);

    let reverbInput: ConvolverNode | null = null;
    if (typeof (ctx as any).createConvolver === 'function') {
      reverbInput = this.createImpulseReverb(ctx, 2.2, 2.6);
      const revWet = ctx.createGain();
      revWet.gain.value = 0.28;
      reverbInput.connect(revWet);
      revWet.connect(masterInput);
      if (ctx === this.ctx) {
        this.reverbNode = reverbInput;
        this.reverbWetGain = revWet;
      }
    }

    let delayInput: DelayNode | null = null;
    if (typeof (ctx as any).createDelay === 'function') {
      delayInput = ctx.createDelay(2.0);
      delayInput.delayTime.value = 0.375; // Dotted 8th feel at 120 BPM
      const fb = ctx.createGain();
      fb.gain.value = 0.32;
      const dlyWet = ctx.createGain();
      dlyWet.gain.value = 0.24;

      delayInput.connect(fb);
      fb.connect(delayInput);
      delayInput.connect(dlyWet);
      dlyWet.connect(masterInput);

      if (ctx === this.ctx) {
        this.delayNode = delayInput;
        this.delayFeedbackGain = fb;
        this.delayWetGain = dlyWet;
      }
    }

    return { masterInput, reverbInput, delayInput };
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
      const { masterInput } = this.setupMasterChain(this.ctx);
      this.masterGain = masterInput;
    }
    return this.ctx;
  }

  private createImpulseReverb(ctx: BaseAudioContext, seconds: number, decay: number): ConvolverNode {
    const convolver = ctx.createConvolver();
    const rate = ctx.sampleRate;
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
    const tempo = score.meta?.tempo || 120;
    const secPerWholeNote = (60 / tempo) * 4;
    let maxWholeFraction = 0;

    for (const ev of score.events) {
      const start = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const dur = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (start + dur > maxWholeFraction) {
        maxWholeFraction = start + dur;
      }
    }

    if (maxWholeFraction === 0) maxWholeFraction = 0.25;
    return {
      totalQuarterBeats: maxWholeFraction * 4,
      totalSeconds: maxWholeFraction * secPerWholeNote,
    };
  }

  private renderScoreToContext(
    targetCtx: BaseAudioContext,
    destination: AudioNode,
    reverbInput: AudioNode | null,
    delayInput: DelayNode | null,
    score: CompiledScore,
    baseStartTime: number
  ): void {
    const tempo = score.meta?.tempo || 120;
    const secPerWholeNote = (60 / tempo) * 4;

    if (delayInput?.delayTime) {
      // Sync stereo delay to 3/16 (dotted eighth) of active tempo
      const dottedEighthSec = Math.min(1.8, (60 / tempo) * 0.75);
      delayInput.delayTime.setValueAtTime(dottedEighthSec, baseStartTime);
    }

    const defsById = new Map<string, TrackDefinition>();
    for (const d of score.defs) {
      defsById.set(d.id, d);
    }

    // Collect kick timestamps if sidechain ducking is active in meta
    const sidechainSourceId = score.meta?.sidechain?.toLowerCase();
    const sidechainHitTimes: number[] = [];
    if (sidechainSourceId) {
      for (const ev of score.events) {
        const tId = (ev.trackId || '').toLowerCase();
        if (tId === sidechainSourceId || ev.style === 'grid') {
          const isKick = ev.pitch?.midi === 36 || ev.pitch?.gridKey === 'k' || ev.pitch?.gridKey === 'bd';
          if (isKick) {
            const stWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
            sidechainHitTimes.push(baseStartTime + stWhole * secPerWholeNote);
          }
        }
      }
    }

    // Create a shared ducking bus for non-drum tracks when sidechain is enabled
    const duckBus = targetCtx.createGain();
    duckBus.gain.setValueAtTime(1.0, baseStartTime);
    for (const hitTime of sidechainHitTimes) {
      duckBus.gain.setValueAtTime(1.0, Math.max(baseStartTime, hitTime - 0.005));
      duckBus.gain.linearRampToValueAtTime(0.32, hitTime + 0.015);
      duckBus.gain.exponentialRampToValueAtTime(1.0, hitTime + 0.22);
    }
    duckBus.connect(destination);

    for (let idx = 0; idx < score.events.length; idx++) {
      const ev = score.events[idx];
      if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer) continue;

      const trackId = ev.trackId || 'pno';
      if (this.soloedTracks.size > 0 && !this.soloedTracks.has(trackId)) continue;
      if (this.mutedTracks.has(trackId)) continue;

      const def = defsById.get(trackId);
      const style = (ev.style || def?.style || 'standard').toLowerCase();
      const patch = (ev.patch || def?.patch || 'salamander_grand').toLowerCase();

      const trackVolMidi = this.trackVolumes.get(trackId) ?? def?.volume ?? 100;
      const trackGainScalar = (trackVolMidi / 100) * 0.5;

      const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;

      let startSec = baseStartTime + startWhole * secPerWholeNote;
      if (ev.physics?.pullMs) startSec += ev.physics.pullMs / 1000;
      if (ev.physics?.pushMs) startSec = Math.max(baseStartTime, startSec - ev.physics.pushMs / 1000);

      let durSec = Math.max(0.04, durWhole * secPerWholeNote);
      if (ev.physics?.articulation === 'stacc' || ev.physics?.articulation === 'staccato') {
        durSec = Math.max(0.04, durSec * 0.42);
      } else if (ev.physics?.articulation === 'ten' || ev.physics?.articulation === 'tenuto') {
        durSec = durSec * 1.08;
      }

      const velScalar = ((ev.physics?.velocity ?? 85) / 127) * trackGainScalar;
      const panVal = ev.physics?.pan ?? def?.pan ?? 0;

      const isDrumTrack = style === 'grid' || Boolean(ev.pitch.gridKey);
      const targetBus = !isDrumTrack && sidechainHitTimes.length > 0 ? duckBus : destination;

      let voiceOutput: AudioNode = targetBus;
      if (typeof (targetCtx as any).createStereoPanner === 'function') {
        const panner = targetCtx.createStereoPanner();
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panVal)), startSec);
        panner.connect(targetBus);
        voiceOutput = panner;
      }

      const hasReverb =
        style === 'standard' ||
        patch.includes('pad') ||
        patch.includes('lead') ||
        def?.fx?.includes('reverb') ||
        ev.physics?.fx?.some((f) => f.type === 'reverb');

      if (hasReverb && reverbInput) {
        const send = targetCtx.createGain();
        const customMix = ev.physics?.fx?.find((f) => f.type === 'reverb')?.params?.mix;
        send.gain.value = typeof customMix === 'number' ? customMix : 0.35;
        voiceOutput.connect(send);
        send.connect(reverbInput);
      }

      const hasDelay =
        patch.includes('lead') ||
        def?.fx?.includes('delay') ||
        ev.physics?.fx?.some((f) => f.type === 'delay');

      if (hasDelay && delayInput) {
        const dlySend = targetCtx.createGain();
        const customMix = ev.physics?.fx?.find((f) => f.type === 'delay')?.params?.mix;
        dlySend.gain.value = typeof customMix === 'number' ? customMix : 0.25;
        voiceOutput.connect(dlySend);
        dlySend.connect(delayInput);
      }

      // Check next note on same track for portamento .glide()
      let glideTargetFreq: number | undefined;
      if (ev.physics?.glideMs) {
        for (let nextIdx = idx + 1; nextIdx < score.events.length; nextIdx++) {
          const candidate = score.events[nextIdx];
          if (candidate.trackId === trackId && candidate.pitch?.frequency > 0) {
            glideTargetFreq = candidate.pitch.frequency;
            break;
          }
        }
      }

      if (isDrumTrack) {
        this.scheduleDrumHit(targetCtx, voiceOutput, ev.pitch.gridKey || 'k', ev.pitch.midi, startSec, velScalar);
      } else if (style === 'synth') {
        this.scheduleSynthVoice(
          targetCtx,
          voiceOutput,
          ev.pitch.frequency,
          patch,
          startSec,
          durSec,
          velScalar,
          ev.physics?.glideMs,
          glideTargetFreq
        );
      } else {
        this.scheduleAcousticPianoVoice(targetCtx, voiceOutput, ev.pitch.frequency, startSec, durSec, velScalar);
      }
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
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(12000, freq * 7.5), startSec);
    filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 2.2), startSec + durSec);

    const oscFund = ctx.createOscillator();
    const oscHarm = ctx.createOscillator();
    const oscWarm = ctx.createOscillator();

    oscFund.type = 'triangle';
    oscHarm.type = 'sine';
    oscWarm.type = 'sawtooth';

    oscFund.frequency.setValueAtTime(freq, startSec);
    oscHarm.frequency.setValueAtTime(freq * 2, startSec);
    oscWarm.frequency.setValueAtTime(freq, startSec);
    oscWarm.detune.setValueAtTime(4, startSec);

    const gFund = ctx.createGain();
    const gHarm = ctx.createGain();
    const gWarm = ctx.createGain();
    gFund.gain.value = 0.65;
    gHarm.gain.value = 0.2;
    gWarm.gain.value = 0.15;

    oscFund.connect(gFund);
    oscHarm.connect(gHarm);
    oscWarm.connect(gWarm);
    gFund.connect(filter);
    gHarm.connect(filter);
    gWarm.connect(filter);
    filter.connect(env);
    env.connect(output);

    const peak = Math.max(0.001, amp * 0.55);
    const release = Math.min(0.28, durSec * 0.45);
    env.gain.setValueAtTime(0.0001, startSec);
    env.gain.linearRampToValueAtTime(peak, startSec + 0.008);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0005, peak * 0.45), startSec + durSec);
    env.gain.exponentialRampToValueAtTime(0.0001, startSec + durSec + release);

    const stopAt = startSec + durSec + release + 0.02;
    oscFund.start(startSec);
    oscHarm.start(startSec);
    oscWarm.start(startSec);
    oscFund.stop(stopAt);
    oscHarm.stop(stopAt);
    oscWarm.stop(stopAt);

    this.activeNodes.add(oscFund);
    this.activeNodes.add(oscHarm);
    this.activeNodes.add(oscWarm);
  }

  private scheduleSynthVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    freq: number,
    patch: string,
    startSec: number,
    durSec: number,
    amp: number,
    glideMs?: number,
    glideTargetFreq?: number
  ): void {
    const isSub = patch.includes('sub') || patch.includes('808') || freq < 130;
    const isPad = patch.includes('pad') || patch.includes('string');

    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';

    if (isSub) {
      filter.frequency.setValueAtTime(Math.min(600, freq * 3.5), startSec);
      filter.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 1.4), startSec + durSec);
    } else if (isPad) {
      filter.frequency.setValueAtTime(2400, startSec);
    } else {
      filter.frequency.setValueAtTime(4800, startSec);
      filter.frequency.exponentialRampToValueAtTime(1400, startSec + durSec);
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();

    osc1.type = isSub ? 'sine' : 'sawtooth';
    osc2.type = isSub ? 'triangle' : isPad ? 'sawtooth' : 'square';

    osc1.frequency.setValueAtTime(freq, startSec);
    osc2.frequency.setValueAtTime(freq, startSec);
    osc2.detune.setValueAtTime(isPad ? 10 : isSub ? 2 : 7, startSec);

    if (glideMs && glideTargetFreq && glideTargetFreq > 0) {
      const glideSec = Math.min(durSec, glideMs / 1000);
      osc1.frequency.exponentialRampToValueAtTime(glideTargetFreq, startSec + durSec);
      osc2.frequency.exponentialRampToValueAtTime(glideTargetFreq, startSec + durSec);
      void glideSec;
    }

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

    const attack = isPad ? Math.min(0.12, durSec * 0.3) : 0.01;
    const release = isPad ? 0.35 : 0.12;
    const peak = Math.max(0.001, amp * (isSub ? 0.65 : isPad ? 0.32 : 0.42));

    env.gain.setValueAtTime(0.0001, startSec);
    env.gain.linearRampToValueAtTime(peak, startSec + attack);
    env.gain.setValueAtTime(peak * 0.8, startSec + Math.max(attack, durSec - 0.02));
    env.gain.exponentialRampToValueAtTime(0.0001, startSec + durSec + release);

    const stopAt = startSec + durSec + release + 0.02;
    osc1.start(startSec);
    osc2.start(startSec);
    osc1.stop(stopAt);
    osc2.stop(stopAt);

    this.activeNodes.add(osc1);
    this.activeNodes.add(osc2);
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
      osc.frequency.setValueAtTime(145, startSec);
      osc.frequency.exponentialRampToValueAtTime(38, startSec + 0.12);
      gain.gain.setValueAtTime(Math.max(0.001, amp * 0.9), startSec);
      gain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.28);
      osc.connect(gain);
      gain.connect(output);
      osc.start(startSec);
      osc.stop(startSec + 0.3);
      this.activeNodes.add(osc);
      return;
    }

    if (key === 's' || key === 'sd' || key === 'snare' || key === 'cp' || key === 'clap' || midi === 38 || midi === 39) {
      const noiseLen = Math.floor(ctx.sampleRate * 0.2);
      const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / noiseLen, 1.8);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuf;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(650, startSec);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(Math.max(0.001, amp * 0.65), startSec);
      nGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.19);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(output);
      noise.start(startSec);

      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(185, startSec);
      bodyOsc.frequency.exponentialRampToValueAtTime(95, startSec + 0.08);
      bodyGain.gain.setValueAtTime(Math.max(0.001, amp * 0.45), startSec);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, startSec + 0.1);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(output);
      bodyOsc.start(startSec);
      bodyOsc.stop(startSec + 0.12);

      this.activeNodes.add(noise);
      this.activeNodes.add(bodyOsc);
      return;
    }

    const isOpen = key === 'oh' || midi === 46;
    const hatDur = isOpen ? 0.28 : 0.065;
    const bufLen = Math.floor(ctx.sampleRate * hatDur);
    const hatBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const chData = hatBuf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      chData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, isOpen ? 1.6 : 3.2);
    }
    const hatSrc = ctx.createBufferSource();
    hatSrc.buffer = hatBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(6500, startSec);

    const hatGain = ctx.createGain();
    hatGain.gain.setValueAtTime(Math.max(0.001, amp * 0.45), startSec);
    hatGain.gain.exponentialRampToValueAtTime(0.0001, startSec + hatDur);

    hatSrc.connect(hp);
    hp.connect(hatGain);
    hatGain.connect(output);
    hatSrc.start(startSec);
    this.activeNodes.add(hatSrc);
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
    this.tempoBpm = score.meta?.tempo || 120;
    this.isPlaying = true;

    const baseStart = ctx.currentTime + 0.04;
    this.startContextTime = baseStart;

    this.renderScoreToContext(ctx, this.masterGain!, this.reverbNode, this.delayNode, score, baseStart);

    const tickProgress = () => {
      if (!this.isPlaying || !this.ctx) return;
      const elapsed = Math.max(0, this.ctx.currentTime - this.startContextTime);
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

  public async exportWavBlob(score: CompiledScore): Promise<Blob> {
    const { totalSeconds } = this.calculateScoreDuration(score);
    const renderDuration = Math.min(180, Math.max(2, totalSeconds + 1.2));
    const sampleRate = 44100;
    const totalFrames = Math.ceil(renderDuration * sampleRate);

    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx: OfflineAudioContext = new OfflineCtx(2, totalFrames, sampleRate);

    const { masterInput, reverbInput, delayInput } = this.setupMasterChain(offlineCtx);
    this.renderScoreToContext(offlineCtx, masterInput, reverbInput, delayInput, score, 0.05);
    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWavBlob(renderedBuffer);
  }

  private audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numCh = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
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

    const channels: Float32Array[] = [];
    for (let ch = 0; ch < numCh; ch++) {
      channels.push(buffer.getChannelData(ch));
    }

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        const s = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
}
