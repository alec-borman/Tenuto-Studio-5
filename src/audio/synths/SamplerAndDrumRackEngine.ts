import { TrackDefinition } from '../../parser/DocumentParser';
import { AtomicEvent } from '../../parser/ASTSerializer';

export interface SimplerSliceRegion {
  sliceKey: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  playbackRate: number;
  reverse: boolean;
  formantShiftSt: number;
}

export interface GranulatorCloudParams {
  grainSizeMs: number;
  grainDensityHz: number;
  sprayMs: number;
  pitchJitterCents: number;
  scanRate: number;
  formantHz: number;
  reverseProb: number;
}

export interface DrumRackPadCell {
  key: string;
  midiNote: number;
  chokeGroup: number; // 0 = None, 1 = Hi-Hat Choke Group
}

const DEFAULT_VOCAL_FORMANTS: Record<string, [number, number, number]> = {
  a: [800, 1150, 2900],
  e: [400, 1700, 2600],
  i: [300, 2250, 3000],
  o: [500, 880, 2500],
  u: [350, 650, 2400],
};

export class SamplerAndDrumRackEngine {
  public static isGranulatorPatch(patch?: string): boolean {
    if (!patch) return false;
    const clean = patch.trim().toLowerCase();
    return clean.includes('granulator') || clean.includes('granular');
  }

  public static isSimplerTrack(style?: string, patch?: string, def?: TrackDefinition): boolean {
    const st = (style || def?.style || '').trim().toLowerCase();
    const pt = (patch || def?.patch || '').trim().toLowerCase();
    return (
      st === 'simpler' ||
      st === 'concrete' ||
      pt.includes('simpler') ||
      pt.includes('sampler') ||
      Boolean(def?.map && Object.keys(def.map).length > 0)
    );
  }

  public static resolveSimplerSlice(
    def?: TrackDefinition,
    sliceKey?: string,
    sliceIndex?: number,
    pitchShiftSt: number = 0,
    reverse: boolean = false,
    formantShiftSt: number = 0
  ): SimplerSliceRegion {
    const map = def?.map as Record<string, [number, number]> | undefined;
    const keys = map ? Object.keys(map) : [];

    let resolvedKey = (sliceKey || '').trim().toLowerCase();
    let startSec = 0;
    let endSec = 0.4;

    if (map && resolvedKey && Array.isArray(map[resolvedKey])) {
      startSec = Math.max(0, Number(map[resolvedKey][0]) || 0);
      endSec = Math.max(startSec + 0.02, Number(map[resolvedKey][1]) || startSec + 0.4);
    } else if (map && sliceIndex !== undefined && keys.length > 0) {
      // Support both 1-based (.slice(1)) and 0-based indexing safely
      const normalizedIdx = sliceIndex >= 1 ? (sliceIndex - 1) % keys.length : Math.max(0, sliceIndex) % keys.length;
      resolvedKey = keys[normalizedIdx];
      const pair = map[resolvedKey];
      startSec = Math.max(0, Number(pair[0]) || 0);
      endSec = Math.max(startSec + 0.02, Number(pair[1]) || startSec + 0.4);
    } else if (sliceIndex !== undefined) {
      const idx = Math.max(0, sliceIndex >= 1 ? sliceIndex - 1 : sliceIndex);
      resolvedKey = `slice_${idx + 1}`;
      startSec = idx * 0.25;
      endSec = startSec + 0.25;
    } else {
      resolvedKey = resolvedKey || 'default';
      startSec = 0;
      endSec = 0.4;
    }

    const playbackRate = Math.pow(2, pitchShiftSt / 12);
    const durationSec = Math.max(0.02, (endSec - startSec) / Math.max(0.25, playbackRate));

    return {
      sliceKey: resolvedKey,
      startSec,
      endSec,
      durationSec,
      playbackRate,
      reverse,
      formantShiftSt,
    };
  }

  public static resolveGranulatorParams(
    def?: TrackDefinition,
    physics?: AtomicEvent['physics']
  ): GranulatorCloudParams {
    const macros = def?.macros || {};
    const grainSizeMs = Math.max(12, Math.min(240, Number(macros.grain_size ?? macros.size ?? 68)));
    const grainDensityHz = Math.max(4, Math.min(60, Number(macros.density ?? macros.flux ?? 22)));
    const sprayMs = Math.max(0, Math.min(150, Number(macros.spray ?? macros.jitter ?? 28)));
    const pitchJitterCents = Math.max(0, Math.min(120, Number(macros.pitch_jitter ?? 14)));
    const scanRate = Math.max(0.1, Math.min(2.0, Number(macros.scan ?? 0.65)));
    const shiftSt = physics?.formant ?? Number(macros.formant ?? 0);
    const formantHz = 1150 * Math.pow(2, shiftSt / 12);
    const reverseProb = physics?.reverse ? 1.0 : Math.max(0, Math.min(1, Number(macros.reverse ?? 0.15)));

    return {
      grainSizeMs,
      grainDensityHz,
      sprayMs,
      pitchJitterCents,
      scanRate,
      formantHz,
      reverseProb,
    };
  }

  /**
   * Ableton 128-Pad Drum Rack Choke Group mapping:
   * Closed Hi-Hats (`h`, `hh`, `ch`, MIDI 42, Pedal 44) and Open Hi-Hats (`oh`, MIDI 46)
   * share Choke Group 1 so closed hi-hats immediately mute ringing open hi-hats.
   */
  public static getChokeGroupForDrumKey(gridKey?: string, midi?: number): number {
    const k = (gridKey || '').trim().toLowerCase();
    if (k === 'h' || k === 'hh' || k === 'ch' || k === 'oh' || midi === 42 || midi === 44 || midi === 46) {
      return 1;
    }
    return 0;
  }

  /**
   * Enforces Drum Rack Choke Groups across a sorted timeline: when a pad in Choke Group N
   * (such as closed hi-hat `h`/`ch`) triggers on the same track while an earlier pad in
   * Choke Group N (such as open hi-hat `oh`) is still ringing, the earlier pad's duration
   * is truncated cleanly at the new hit's start time.
   */
  public static applyDrumRackChokeGroups<
    T extends {
      startSec: number;
      durSec: number;
      style: string;
      gridKey?: string;
      midi: number;
      event: AtomicEvent;
    }
  >(timeline: T[]): void {
    const lastActiveByTrackAndChoke = new Map<string, T>();

    for (const item of timeline) {
      const isDrum = item.style === 'grid' || Boolean(item.gridKey);
      if (!isDrum) continue;

      const cg = this.getChokeGroupForDrumKey(item.gridKey, item.midi);
      if (cg <= 0) continue;

      const trackId = item.event.trackId || 'drums';
      const mapKey = `${trackId}::cg${cg}`;
      const prev = lastActiveByTrackAndChoke.get(mapKey);

      if (prev && item.startSec > prev.startSec + 0.002) {
        // Extend open hi-hats naturally up to 0.28s if they were default grid durations, then choke at curr.startSec
        const keyPrev = (prev.gridKey || '').toLowerCase();
        const naturalRing = keyPrev === 'oh' || prev.midi === 46 ? Math.max(prev.durSec, 0.28) : prev.durSec;
        if (prev.startSec + naturalRing > item.startSec) {
          prev.durSec = Math.max(0.015, item.startSec - prev.startSec);
        }
      }

      lastActiveByTrackAndChoke.set(mapKey, item);
    }
  }

  /**
   * Renders Ableton Granulator III raised-cosine grain clouds or Simpler vocal slice chops
   * directly into stereo Float32 PCM buffers for offline WAV export and testing.
   */
  public static renderGranularOrSimplerNoteToStereo(
    left: Float32Array,
    right: Float32Array,
    startFrame: number,
    noteFrames: number,
    sampleRate: number,
    freq: number,
    durSec: number,
    amp: number,
    pan: number,
    def?: TrackDefinition,
    event?: AtomicEvent,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number
  ): void {
    if (noteFrames <= 0 || startFrame >= left.length) return;
    const maxFrames = Math.min(noteFrames, left.length - startFrame);

    const isGranular = this.isGranulatorPatch(event?.patch || def?.patch);
    const sliceRegion = this.resolveSimplerSlice(
      def,
      event?.pitch?.sliceKey,
      event?.physics?.slice,
      event?.physics?.pitchShiftSt ?? 0,
      Boolean(event?.physics?.reverse),
      event?.physics?.formant ?? 0
    );

    const panAngle = ((Math.max(-1, Math.min(1, pan)) + 1) * 0.5) * (Math.PI * 0.5);
    const baseGainL = Math.cos(panAngle);
    const baseGainR = Math.sin(panAngle);

    if (isGranular) {
      const params = this.resolveGranulatorParams(def, event?.physics);
      const grainDurSec = params.grainSizeMs / 1000;
      const grainFrames = Math.max(64, Math.floor(grainDurSec * sampleRate));
      const hopFrames = Math.max(16, Math.floor(sampleRate / params.grainDensityHz));

      let grainIdx = 0;
      for (let gStart = 0; gStart < maxFrames; gStart += hopFrames) {
        // Deterministic pseudo-random spray & pan per grain
        const seed = Math.sin((grainIdx + 1) * 12.9898) * 43758.5453;
        const rand01 = seed - Math.floor(seed);
        const sprayFrames = Math.floor((rand01 - 0.5) * (params.sprayMs / 1000) * sampleRate);
        const actualStart = Math.max(0, Math.min(maxFrames - 1, gStart + sprayFrames));
        const centsOffset = (rand01 * 2 - 1) * params.pitchJitterCents;
        const grainFreq = freq * Math.pow(2, centsOffset / 1200);
        const isRevGrain = rand01 < params.reverseProb;
        const grainPan = Math.max(-1, Math.min(1, pan + (rand01 - 0.5) * 0.45));
        const gAngle = ((grainPan + 1) * 0.5) * (Math.PI * 0.5);
        const gL = Math.cos(gAngle);
        const gR = Math.sin(gAngle);

        let phase1 = 0;
        let phase2 = 0;
        let phaseFormant = 0;

        const gLen = Math.min(grainFrames, maxFrames - actualStart);
        for (let i = 0; i < gLen; i++) {
          const normPos = isRevGrain ? 1.0 - i / gLen : i / gLen;
          // Raised-cosine Hann grain window: w(n) = 0.5 * (1 - cos(2*pi*n/N))
          const window = 0.5 * (1 - Math.cos(2 * Math.PI * normPos));

          phase1 += (2 * Math.PI * grainFreq) / sampleRate;
          phase2 += (2 * Math.PI * grainFreq * 1.501) / sampleRate;
          phaseFormant += (2 * Math.PI * params.formantHz) / sampleRate;

          const sig =
            Math.sin(phase1) * 0.55 +
            Math.sin(phase2) * 0.25 +
            Math.sin(phaseFormant) * Math.sin(phase1 * 0.5) * 0.2;

          const framePos = actualStart + i;
          const noteProg = framePos / Math.max(1, maxFrames);
          const dynAmp =
            swell === 'crescendo' || swell === 'diminuendo'
              ? (startAmp ?? amp) + ((endAmp ?? amp) - (startAmp ?? amp)) * noteProg
              : amp;
          const releaseEnv =
            framePos > durSec * sampleRate
              ? Math.exp(-((framePos - durSec * sampleRate) / sampleRate) * 6.0)
              : 1.0;

          const outSample = sig * window * dynAmp * releaseEnv * 0.52;
          left[startFrame + framePos] += outSample * gL;
          right[startFrame + framePos] += outSample * gR;
        }
        grainIdx++;
      }
      return;
    }

    // Simpler / Concrete Vocal Slice Formant & Chop Synthesis
    const keyChar = sliceRegion.sliceKey.charAt(0) || 'a';
    const vowelFormants =
      DEFAULT_VOCAL_FORMANTS[keyChar] ||
      DEFAULT_VOCAL_FORMANTS[['a', 'e', 'i', 'o', 'u'][ sliceRegion.sliceKey.length % 5 ]];
    const formantRatio = Math.pow(2, sliceRegion.formantShiftSt / 12);
    const f1 = vowelFormants[0] * formantRatio;
    const f2 = vowelFormants[1] * formantRatio;
    const f3 = vowelFormants[2] * formantRatio;

    let p0 = 0;
    let p1 = 0;
    let p2 = 0;
    let p3 = 0;

    for (let i = 0; i < maxFrames; i++) {
      const normIdx = i / Math.max(1, maxFrames - 1);
      const timeCursor = sliceRegion.reverse ? 1.0 - normIdx : normIdx;

      // Subtle vocal vibrato + slice transient contour
      const vibrato = 1.0 + 0.004 * Math.sin(2 * Math.PI * 5.5 * (i / sampleRate));
      const actualFreq = freq * vibrato;

      p0 += (2 * Math.PI * actualFreq) / sampleRate;
      p1 += (2 * Math.PI * f1) / sampleRate;
      p2 += (2 * Math.PI * f2) / sampleRate;
      p3 += (2 * Math.PI * f3) / sampleRate;

      const glottal = Math.sin(p0) + 0.45 * Math.sin(2 * p0) + 0.22 * Math.sin(3 * p0);
      const formantBody =
        Math.sin(p1) * 0.42 + Math.sin(p2) * 0.32 + Math.sin(p3) * 0.14;

      // Reverse envelope rises exponentially toward the chop cutoff; forward decays naturally
      const chopContour = Math.exp(-timeCursor * 2.2) * (1.0 - Math.exp(-timeCursor * 35));
      const deClickWindow =
        i < 64 ? i / 64 : i > maxFrames - 96 ? Math.max(0, (maxFrames - i) / 96) : 1.0;

      const dynAmp =
        swell === 'crescendo' || swell === 'diminuendo'
          ? (startAmp ?? amp) + ((endAmp ?? amp) - (startAmp ?? amp)) * normIdx
          : amp;

      const sample = Math.tanh((glottal * 0.58 + formantBody * 0.42) * 1.25) * chopContour * deClickWindow * dynAmp * 0.72;
      left[startFrame + i] += sample * baseGainL;
      right[startFrame + i] += sample * baseGainR;
    }
  }

  /**
   * Schedules a real-time WebAudio BufferSource voice for Granulator III or Simpler vocal chops.
   */
  public static scheduleRealtimeGranulatorOrSimplerVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    pannerNode: StereoPannerNode | null,
    freq: number,
    startSec: number,
    durSec: number,
    amp: number,
    def?: TrackDefinition,
    event?: AtomicEvent,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number
  ): {
    fadeOutAndStop: (now: number) => void;
    stopAndDisconnect: () => void;
  } {
    const sr = ctx.sampleRate || 44100;
    const totalDur = Math.max(0.06, durSec + 0.18);
    const frames = Math.max(128, Math.floor(totalDur * sr));
    const buf = ctx.createBuffer(2, frames, sr);
    const left = buf.getChannelData(0);
    const right = buf.getChannelData(1);

    this.renderGranularOrSimplerNoteToStereo(
      left,
      right,
      0,
      frames,
      sr,
      freq,
      durSec,
      amp,
      0,
      def,
      event,
      swell,
      startAmp,
      endAmp
    );

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const env = ctx.createGain();
    env.gain.setValueAtTime(1.0, startSec);

    src.connect(env);
    env.connect(output);
    src.start(startSec);
    src.stop(startSec + totalDur + 0.02);

    let cleaned = false;
    const cleanup = {
      fadeOutAndStop: (now: number) => {
        if (cleaned) return;
        cleaned = true;
        try {
          env.gain.cancelScheduledValues?.(now);
          env.gain.setTargetAtTime?.(0.0001, now, 0.008);
          src.stop(now + 0.03);
        } catch {
          cleanup.stopAndDisconnect();
        }
      },
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        try {
          src.stop();
        } catch {
          // Ignore
        }
        try {
          src.disconnect();
          env.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };
    src.onended = () => cleanup.stopAndDisconnect();
    return cleanup;
  }
}
