import { CompiledScore, TrackDefinition } from '../parser/DocumentParser';
import { AtomicEvent } from '../parser/ASTSerializer';
import { SoundfontBankLoader, resolveSoundfontInstrument } from './SoundfontLibrary';

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
  sfInstrument?: string | null;
  amp: number;
  startAmp: number;
  endAmp: number;
  swell?: 'crescendo' | 'diminuendo';
  pan: number;
}

interface ActiveVoiceCleanup {
  fadeOutAndStop: (now: number) => void;
  stopAndDisconnect: () => void;
}

export class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private drumBus: GainNode | null = null;
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
  private masterVolumeScalar: number = 1.25;

  private scheduledTimeline: ScheduledNoteEvent[] = [];
  private nextScheduleIndex: number = 0;

  public soundfontLoader = new SoundfontBankLoader();
  public onProgress?: (progress: PlaybackProgress) => void;

  public setMasterVolume(scalar: number): void {
    this.masterVolumeScalar = Math.max(0, Math.min(2.5, scalar));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(1.35 * this.masterVolumeScalar, this.ctx.currentTime || 0);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolumeScalar;
  }

  private ensureContext(): AudioContext {
    if (!this.ctx || (this.ctx.state as string) === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    this.rebuildMasterChain(this.ctx);
    return this.ctx;
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
      this.compressorNode?.disconnect();
    } catch {
      // Ignore disconnect errors on old nodes
    }

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = 1.35 * this.masterVolumeScalar;

    if (typeof (ctx as any).createDynamicsCompressor === 'function') {
      const comp = ctx.createDynamicsCompressor();
      const now = ctx.currentTime || 0;
      comp.threshold?.setValueAtTime?.(-3, now);
      comp.knee?.setValueAtTime?.(8, now);
      comp.ratio?.setValueAtTime?.(10, now);
      comp.attack?.setValueAtTime?.(0.005, now);
      comp.release?.setValueAtTime?.(0.16, now);
      comp.connect(ctx.destination);
      this.masterGain.connect(comp);
      this.compressorNode = comp;
    } else {
      this.masterGain.connect(ctx.destination);
      this.compressorNode = null;
    }

    this.dryBus = ctx.createGain();
    this.dryBus.gain.value = 1.0;
    this.dryBus.connect(this.masterGain);

    this.drumBus = ctx.createGain();
    this.drumBus.gain.value = 1.0;
    this.drumBus.connect(this.masterGain);

    this.reverbSendBus = ctx.createGain();
    this.reverbSendBus.gain.value = 0.16;

    if (typeof (ctx as any).createConvolver === 'function') {
      this.reverbNode = this.createImpulseReverb(ctx, 1.4, 3.8);
      this.reverbWetGain = ctx.createGain();
      this.reverbWetGain.gain.value = 0.2;

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
    this.polyphonyScalar = numTracks >= 10 ? 0.78 : numTracks >= 6 ? 0.85 : numTracks >= 3 ? 0.92 : 1.0;

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
      const trackGainScalar = (trackVolMidi / 100) * 0.95 * this.polyphonyScalar;

      const startWhole = ev.startTime ? ev.startTime.numerator / ev.startTime.denominator : 0;
      const durWhole = ev.duration ? ev.duration.numerator / ev.duration.denominator : 0.25;
      if (!Number.isFinite(startWhole) || !Number.isFinite(durWhole)) continue;

      const isGrace = Boolean(ev.duration?.isGrace);
      let startSec = startWhole * secPerWholeNote;
      if (isGrace) {
        startSec = Math.max(0, startSec - 0.045);
      }
      if (ev.physics?.pullMs) startSec += ev.physics.pullMs / 1000;
      if (ev.physics?.pushMs) startSec = Math.max(0, startSec - ev.physics.pushMs / 1000);

      let durSec = isGrace ? 0.045 : Math.max(0.05, durWhole * secPerWholeNote);
      if (ev.physics?.pizz) {
        durSec = Math.min(0.16, Math.max(0.045, durSec * 0.35));
      } else if (ev.physics?.articulation === 'stacc' || ev.physics?.articulation === 'staccato') {
        durSec = Math.max(0.045, durSec * 0.48);
      } else if (ev.physics?.legato) {
        durSec = durSec * 1.08;
      }

      if (ev.physics?.pedal) {
        durSec = Math.max(durSec * 2.2, Math.min(3.2, secPerWholeNote * 0.75));
      }
      if (ev.physics?.fermata) {
        durSec = durSec * 1.65;
      }

      // Map MIDI velocity (1..127) onto an audible studio dynamic curve (0.28..1.0)
      const velToAudibleCurve = (v: number) => 0.25 + 0.75 * Math.pow(Math.max(1, Math.min(127, v)) / 127, 0.85);

      const vel = ev.physics?.velocity ?? 90;
      const swell = ev.physics?.swell;
      const startVel = ev.physics?.startVelocity ?? (swell === 'crescendo' ? 40 : swell === 'diminuendo' ? 116 : vel);
      const endVel = ev.physics?.endVelocity ?? (swell === 'crescendo' ? 120 : swell === 'diminuendo' ? 35 : vel);

      const amp = Math.max(0.15, Math.min(1.35, velToAudibleCurve(vel) * trackGainScalar));
      const startAmp = Math.max(0.1, Math.min(1.4, velToAudibleCurve(startVel) * trackGainScalar));
      const endAmp = Math.max(0.1, Math.min(1.4, velToAudibleCurve(endVel) * trackGainScalar));
      const pan = Math.max(-1, Math.min(1, ev.physics?.pan ?? def?.pan ?? 0));
      const freq =
        Number.isFinite(ev.pitch.frequency) && ev.pitch.frequency >= 20 && ev.pitch.frequency <= 10000
          ? ev.pitch.frequency
          : 440;

      const sfInstrument = resolveSoundfontInstrument(
        trackId,
        def?.name,
        ev.patch || def?.patch,
        style,
        ev.physics?.pizz
      );

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
        sfInstrument,
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

  private getInstrumentArticulationProfile(
    sfInstrument?: string | null,
    patch?: string,
    physics?: AtomicEvent['physics']
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
    const isLegato = Boolean(physics?.legato);
    const isPizz = Boolean(physics?.pizz) || inst.includes('pizz');

    if (isPizz) {
      return {
        attackSec: 0.008,
        releaseSec: 0.09,
        sampleOffsetSec: 0,
        sustainRatio: 0.35,
        filterCutoffHz: 4200,
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
        attackSec: isLegato ? 0.075 : isStacc ? 0.022 : isMarc ? 0.028 : 0.052,
        releaseSec: isStacc ? 0.09 : 0.24,
        // Skip the initial bow-scrape click on sustained and legato string notes
        sampleOffsetSec: isLegato ? 0.032 : isStacc || isMarc ? 0.004 : 0.016,
        sustainRatio: 0.92,
        filterCutoffHz: 4400,
      };
    }

    // 2. Choir & Warm Pads
    if (inst.includes('choir') || inst.includes('voice') || inst.includes('pad')) {
      return {
        attackSec: isLegato ? 0.09 : 0.068,
        releaseSec: 0.28,
        sampleOffsetSec: 0.025,
        sustainRatio: 0.95,
        filterCutoffHz: 3800,
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
        attackSec: isLegato ? 0.058 : isStacc ? 0.018 : 0.038,
        releaseSec: isStacc ? 0.08 : 0.18,
        sampleOffsetSec: isLegato ? 0.022 : 0.008,
        sustainRatio: 0.9,
        filterCutoffHz: 5200,
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
        attackSec: isLegato ? 0.055 : isStacc || isMarc ? 0.016 : 0.034,
        releaseSec: isStacc ? 0.09 : 0.2,
        sampleOffsetSec: isLegato ? 0.02 : isStacc || isMarc ? 0.002 : 0.01,
        sustainRatio: 0.88,
        filterCutoffHz: isWarmBrass ? 3600 : 4600,
      };
    }

    // 5. Pianos, Harps, Timpani, Chromatic Percussion & Plucked Instruments
    return {
      attackSec: isLegato ? 0.022 : 0.012,
      releaseSec: 0.22,
      sampleOffsetSec: 0,
      sustainRatio: 0.65,
      filterCutoffHz: 6500,
    };
  }

  private triggerRealtimeVoice(ctx: AudioContext, item: ScheduledNoteEvent, absStartSec: number): void {
    if (!this.dryBus || !this.drumBus) return;

    // Soft-steal oldest voice with a 22ms de-clicking fade-out if active voices exceed 72
    while (this.activeVoices.size >= 72) {
      const oldest = this.activeVoices.values().next().value;
      if (!oldest) break;
      this.activeVoices.delete(oldest);
      oldest.fadeOutAndStop(ctx.currentTime);
    }

    const safeStart = Math.max(ctx.currentTime + 0.008, absStartSec);
    const durSec = Math.max(0.05, item.durSec);
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
            item.event.physics
          );
          return;
        }
      }

      this.scheduleDrumHit(ctx, voiceOut, pannerNode, item.gridKey || 'k', item.midi, safeStart, item.amp);
      return;
    }

    if (item.sfInstrument) {
      const cachedSample = this.soundfontLoader.getCachedSampleForNote(item.sfInstrument, item.midi);
      if (cachedSample) {
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
          item.event.physics
        );
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
        item.event.physics
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
    physics?: AtomicEvent['physics']
  ): void {
    const profile = this.getInstrumentArticulationProfile(sfInstrument, sfInstrument, physics);
    const env = ctx.createGain();
    const src = ctx.createBufferSource();
    src.buffer = sampleData.buffer;
    src.playbackRate.setValueAtTime(sampleData.playbackRate, startSec);

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
    const release = profile.releaseSec;
    const tEnd = tSustain + release;
    const sampleScale = 2.1;

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
      sampleData.buffer.duration > 0.25 ? Math.min(profile.sampleOffsetSec, sampleData.buffer.duration * 0.15) : 0;
    src.start(t0, safeOffset);
    src.stop(stopAt);

    let cleaned = false;
    const cleanup: ActiveVoiceCleanup = {
      fadeOutAndStop: (now: number) => {
        if (cleaned) return;
        cleaned = true;
        this.activeVoices.delete(cleanup);
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
    physics?: AtomicEvent['physics']
  ): void {
    const profile = this.getInstrumentArticulationProfile(undefined, patch, physics);
    const isSub = patch.includes('sub') || patch.includes('808') || freq < 130;
    const isPad = patch.includes('pad') || patch.includes('string');

    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(0.707, startSec);
    const baseCutoff = isSub ? 360 : physics?.pizz ? 1600 : Math.min(3200, profile.filterCutoffHz);
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
    const sr = ctx.sampleRate || 44100;

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
      subOsc.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    // 2. STUDIO HAND CLAP (cp / clap / 39): 4-Burst Human Flam Envelope + Warm 1.35kHz Bandpass
    if (key === 'cp' || key === 'clap' || midi === 39) {
      const dur = 0.24;
      const len = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, len, sr);
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
      const len = Math.floor(sr * dur);
      const buf = ctx.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const snap = t < 0.006 ? 1.0 : 0.65 * Math.exp(-(t - 0.006) * 16);
        data[i] = (Math.random() * 2 - 1) * snap;
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
      tomOsc.onended = () => cleanup.stopAndDisconnect();
      return;
    }

    // 5. METALLIC BRONZE HI-HATS & CYMBALS (h / hh / oh / cr / rd / 42 / 46 / 49 / 51)
    const isCrashOrRide = key === 'cr' || key === 'rd' || midi === 49 || midi === 51;
    const isOpenHat = key === 'oh' || midi === 46 || isCrashOrRide;
    const dur = isCrashOrRide ? 0.65 : isOpenHat ? 0.28 : 0.058;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
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
      fadeOutAndStop: (_now: number) => {
        cleanup.stopAndDisconnect();
      },
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
          hp.disconnect();
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

    await this.soundfontLoader.prewarmScoreSamples(ctx, score);
    if (!this.isPlaying) return;

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
    try {
      if (!this.soundfontLoader.isTestEnvironment()) {
        await this.soundfontLoader.prewarmScoreSamples(this.ensureContext(), score);
      }
    } catch {
      // Fallback to synthesis if AudioContext / network is unavailable
    }

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
      const profile = this.getInstrumentArticulationProfile(item.sfInstrument, item.patch, item.event.physics);
      const releaseSec = isDrum ? 0.05 : profile.releaseSec;
      const totalNoteSec = item.durSec + releaseSec;
      const noteFrames = Math.min(totalFrames - startFrame, Math.floor(totalNoteSec * sampleRate));

      const panAngle = ((item.pan + 1) * 0.5) * (Math.PI * 0.5);
      const gainL = Math.cos(panAngle);
      const gainR = Math.sin(panAngle);

      if (isDrum) {
        const key = (item.gridKey || 'k').toLowerCase();

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
              left[startFrame + i] += s0 * env * item.amp * 2.2 * gainL;
              right[startFrame + i] += s1 * env * item.amp * 2.2 * gainR;
              rPos += rateRatio;
            }
            continue;
          }
        }

        const isKick = key === 'k' || key === 'bd' || key === 'kick' || item.midi === 36;
        const isClap = key === 'cp' || key === 'clap' || item.midi === 39;
        const isSnare = key === 's' || key === 'sd' || key === 'snare' || key === 'rim' || item.midi === 38;
        const isTom = key === 'lt' || key === 'mt' || key === 'ht' || item.midi === 45 || item.midi === 47 || item.midi === 50;
        const isOpenHat = key === 'oh' || key === 'cr' || key === 'rd' || item.midi === 46 || item.midi === 49;

        const durSec = isKick ? 0.32 : isClap ? 0.24 : isSnare ? 0.21 : isTom ? 0.28 : isOpenHat ? 0.28 : 0.058;
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

          left[startFrame + i] += sample * gainL;
          right[startFrame + i] += sample * gainR;
        }
        continue;
      }

      const cachedSample = item.sfInstrument
        ? this.soundfontLoader.getCachedSampleForNote(item.sfInstrument, item.midi)
        : null;

      if (cachedSample) {
        const buf = cachedSample.buffer;
        const ch0 = buf.getChannelData(0);
        const ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0;
        const bufLen = ch0.length;
        const rateRatio = (buf.sampleRate / sampleRate) * cachedSample.playbackRate;
        const hasSwell = item.swell === 'crescendo' || item.swell === 'diminuendo';
        const baseAmpScalar = hasSwell ? 1.0 : item.amp;
        const attackSec = Math.min(profile.attackSec, Math.max(0.01, item.durSec * 0.45));
        const phys = item.event.physics;

        let readPos = Math.min(
          Math.max(0, bufLen - 2),
          Math.floor(profile.sampleOffsetSec * (buf.sampleRate || sampleRate))
        );
        for (let i = 0; i < noteFrames; i++) {
          const idx0 = Math.floor(readPos);
          if (idx0 >= bufLen - 1) break;
          const frac = readPos - idx0;

          const s0 = ch0[idx0] + (ch0[idx0 + 1] - ch0[idx0]) * frac;
          const s1 = ch1[idx0] + (ch1[idx0 + 1] - ch1[idx0]) * frac;

          const t = i / sampleRate;
          let env = 1.0;
          if (phys?.fp) {
            env = t < 0.015 ? t / 0.015 : t < 0.075 ? 1.0 - ((t - 0.015) / 0.06) * 0.7 : 0.3;
            if (t > item.durSec) {
              env *= Math.max(0, 1 - (t - item.durSec) / Math.max(0.001, releaseSec));
            }
          } else if (hasSwell) {
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
            } else if (t > item.durSec) {
              env = Math.max(0, 1 - (t - item.durSec) / Math.max(0.001, releaseSec));
            }
          }

          let stepRatio = rateRatio;
          if (phys?.mordent && t >= 0.025 && t < 0.065) {
            stepRatio *= Math.pow(2, 2 / 12);
          } else if (phys?.trill && Math.floor(t / 0.065) % 2 === 1) {
            stepRatio *= Math.pow(2, 2 / 12);
          }
          readPos += stepRatio;

          const gain = env * baseAmpScalar * 2.1;
          left[startFrame + i] += s0 * gain * gainL;
          right[startFrame + i] += s1 * gain * gainR;
        }
        continue;
      }

      const isSub = item.patch.includes('sub') || item.patch.includes('808') || item.freq < 130;
      const isPad = item.patch.includes('pad') || item.patch.includes('string');
      const isSynth = item.style === 'synth';

      const attackSec = Math.min(profile.attackSec, Math.max(0.01, item.durSec * 0.45));
      const twoPiOverSr = (2 * Math.PI) / sampleRate;

      const hasSwell = item.swell === 'crescendo' || item.swell === 'diminuendo';
      const baseAmpScalar = hasSwell ? 1.0 : item.amp;
      const phys = item.event.physics;
      let ph1 = 0;
      let ph2 = 0;
      const detuneRatio = isPad ? 1.004 : 1.002;

      for (let i = 0; i < noteFrames; i++) {
        const t = i / sampleRate;
        let env = 1.0;
        if (phys?.fp) {
          if (t < attackSec) {
            env = t / attackSec;
          } else if (t > 0.055) {
            env = 0.28 * Math.max(0, 1 - Math.max(0, t - item.durSec) / Math.max(0.001, releaseSec));
          }
        } else if (hasSwell) {
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

        let instFreq = item.freq;
        if (phys?.mordent && t >= 0.025 && t < 0.065) {
          instFreq = item.freq * Math.pow(2, 2 / 12);
        } else if (phys?.trill) {
          const stepIndex = Math.floor(t / 0.065);
          if (stepIndex % 2 === 1) {
            instFreq = item.freq * Math.pow(2, 2 / 12);
          }
        }
        if (phys?.vibrato && t > 0.08) {
          instFreq *= 1 + Math.sin(2 * Math.PI * 5.5 * t) * 0.0075;
        }

        ph1 += instFreq * twoPiOverSr;
        ph2 += instFreq * detuneRatio * twoPiOverSr;

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

        const sample = wave * env * baseAmpScalar * 0.85;
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

    // Peak-normalize the rendered stereo mix to 0.90 (-0.9 dBFS) so WAV exports are always full studio volume
    let maxPeak = 0;
    for (let i = 0; i < totalFrames; i++) {
      const absL = Number.isFinite(left[i]) ? Math.abs(left[i]) : 0;
      const absR = Number.isFinite(right[i]) ? Math.abs(right[i]) : 0;
      if (absL > maxPeak) maxPeak = absL;
      if (absR > maxPeak) maxPeak = absR;
    }

    const normGain = maxPeak > 0.0001 ? (0.90 / maxPeak) * Math.min(1.5, Math.max(0.5, this.masterVolumeScalar)) : 1.0;

    for (let i = 0; i < totalFrames; i++) {
      const l = Number.isFinite(left[i]) ? Math.tanh(left[i] * normGain) : 0;
      const r = Number.isFinite(right[i]) ? Math.tanh(right[i] * normGain) : 0;
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
