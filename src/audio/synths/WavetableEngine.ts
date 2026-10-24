import { TrackDefinition } from '../../parser/DocumentParser';
import { AtomicEvent } from '../../parser/ASTSerializer';

export type WavetableBankName =
  | 'basic_shapes'
  | 'harmonics'
  | 'digital_pwm'
  | 'vintage_analog'
  | 'formant_vocal';

export type WavetableUnisonMode =
  | 'none'
  | 'classic'
  | 'shimmer'
  | 'noise'
  | 'phase_sync'
  | 'position_spread';

export interface WavetablePatchParams {
  bank1: WavetableBankName;
  bank2: WavetableBankName;
  osc1Pos: number; // 0.0 .. 1.0
  osc2Pos: number; // 0.0 .. 1.0
  osc2Enabled: boolean;
  osc2DetuneCents: number;
  osc2Semitones: number;
  osc2Gain: number;
  subEnabled: boolean;
  subGain: number;
  subTone: number; // 0.0 (sine) .. 1.0 (saturated harmonics)
  subOctave: -1 | -2;
  unisonMode: WavetableUnisonMode;
  unisonVoices: number; // 1 .. 8
  unisonAmount: number; // 0.0 .. 1.0
  filterCutoffHz: number;
  filterResonance: number;
  filterMorph: number; // 0.0 (LP) .. 0.5 (BP) .. 1.0 (HP)
  envAttackSec: number;
  envDecaySec: number;
  envSustain: number;
  envReleaseSec: number;
  env2ToPos: number; // -1.0 .. +1.0 modulation depth
  env2ToCutoff: number; // -1.0 .. +1.0 modulation depth
  lfo1RateHz: number;
  lfo1ToPos: number; // -1.0 .. +1.0 modulation depth
  lfo1ToCutoff: number; // -1.0 .. +1.0 modulation depth
}

const NUM_HARMONICS = 24;

export class WavetableEngine {
  /**
   * Extracts WavetablePatchParams from a TrackDefinition's `macros`, `env`, `fxChain`, and `patch` name.
   */
  public static resolveParams(
    def?: TrackDefinition,
    eventPhysics?: AtomicEvent['physics'],
    cutoffOverrideHz?: number
  ): WavetablePatchParams {
    const macros = def?.macros || {};
    const env = def?.env || {};
    const wtFx = def?.fxChain?.find((f) => f.type === 'wavetable')?.params || {};

    const normalize0to1 = (val: any, fallback: number): number => {
      const n = Number(val);
      if (isNaN(n)) return fallback;
      if (n > 1.0) return Math.max(0, Math.min(1, n / 100));
      return Math.max(0, Math.min(1, n));
    };

    const patchStr = (def?.patch || 'wavetable').toLowerCase();
    let defaultBank: WavetableBankName = 'basic_shapes';
    if (patchStr.includes('harm')) defaultBank = 'harmonics';
    else if (patchStr.includes('pwm') || patchStr.includes('digital')) defaultBank = 'digital_pwm';
    else if (patchStr.includes('vintage') || patchStr.includes('analog')) defaultBank = 'vintage_analog';
    else if (patchStr.includes('formant') || patchStr.includes('vocal') || Boolean(eventPhysics?.lyric)) {
      defaultBank = 'formant_vocal';
    }

    const bank1 = (wtFx.bank1 || env.bank1 || defaultBank) as WavetableBankName;
    const bank2 = (wtFx.bank2 || env.bank2 || 'vintage_analog') as WavetableBankName;

    const osc1Pos = normalize0to1(
      wtFx.osc1_pos ?? macros.osc1_pos ?? macros.wt_pos ?? macros.wave_pos ?? env.osc1_pos,
      0.45
    );
    const osc2Pos = normalize0to1(
      wtFx.osc2_pos ?? macros.osc2_pos ?? env.osc2_pos,
      0.6
    );

    const unisonRaw = String(
      wtFx.unison_mode || env.unison_mode || (macros.unison ? 'shimmer' : 'classic')
    ).toLowerCase() as WavetableUnisonMode;

    const unisonAmount = normalize0to1(
      wtFx.unison_amount ?? macros.unison ?? macros.carrier_unison ?? env.unison_amount,
      0.35
    );
    const unisonVoices = Math.max(
      1,
      Math.min(
        8,
        Math.round(Number(wtFx.unison_voices ?? macros.unison_voices ?? (unisonAmount > 0.1 ? 3 : 1)))
      )
    );

    const baseCutoff =
      cutoffOverrideHz ??
      Number(wtFx.cutoff ?? macros.cutoff ?? macros.filter_cutoff ?? 3400);

    return {
      bank1,
      bank2,
      osc1Pos,
      osc2Pos,
      osc2Enabled: wtFx.osc2 !== false,
      osc2DetuneCents: Number(wtFx.osc2_detune ?? macros.detune ?? 7),
      osc2Semitones: Number(wtFx.osc2_semi ?? 0),
      osc2Gain: normalize0to1(wtFx.osc2_gain ?? 0.45, 0.45),
      subEnabled: wtFx.sub !== false,
      subGain: normalize0to1(wtFx.sub_gain ?? macros.sub_level ?? 0.35, 0.35),
      subTone: normalize0to1(wtFx.sub_tone ?? 0.3, 0.3),
      subOctave: Number(wtFx.sub_octave) === -2 ? -2 : -1,
      unisonMode: unisonRaw,
      unisonVoices,
      unisonAmount,
      filterCutoffHz: Math.max(80, Math.min(14000, isNaN(baseCutoff) ? 3400 : baseCutoff)),
      filterResonance: Math.max(0.5, Math.min(12, Number(wtFx.resonance ?? macros.resonance ?? 1.2))),
      filterMorph: normalize0to1(wtFx.filter_morph ?? macros.filter_morph ?? 0, 0),
      envAttackSec: Math.max(0.003, Number(wtFx.attack ?? env.attack ?? 0.012)),
      envDecaySec: Math.max(0.02, Number(wtFx.decay ?? env.decay ?? 0.25)),
      envSustain: normalize0to1(wtFx.sustain ?? env.sustain ?? 0.75, 0.75),
      envReleaseSec: Math.max(0.04, Number(wtFx.release ?? env.release ?? 0.18)),
      env2ToPos: Math.max(-1, Math.min(1, Number(wtFx.env2_to_pos ?? macros.env_to_pos ?? 0.25))),
      env2ToCutoff: Math.max(-1, Math.min(1, Number(wtFx.env2_to_cutoff ?? 0.35))),
      lfo1RateHz: Math.max(0.1, Math.min(20, Number(wtFx.lfo1_rate ?? macros.lfo_rate ?? 3.2))),
      lfo1ToPos: Math.max(-1, Math.min(1, Number(wtFx.lfo1_to_pos ?? macros.lfo_to_pos ?? 0.15))),
      lfo1ToCutoff: Math.max(-1, Math.min(1, Number(wtFx.lfo1_to_cutoff ?? 0.1))),
    };
  }

  /**
   * Computes the Fourier sine (`imag`) and cosine (`real`) harmonic amplitudes (indices 1..NUM_HARMONICS)
   * for a given wavetable bank at normalized wave position `pos` in `[0.0, 1.0]`.
   *
   * For `'basic_shapes'`:
   * - pos = 0.00 -> Pure Sine (only fundamental harmonic 1)
   * - pos = 0.33 -> Triangle (odd harmonics 1/n^2 alternating sign)
   * - pos = 0.66 -> Sawtooth (all harmonics 1/n)
   * - pos = 1.00 -> Square (odd harmonics 1/n)
   */
  public static computeHarmonicSpectrum(
    bank: WavetableBankName,
    pos: number
  ): { real: Float32Array; imag: Float32Array } {
    const p = Math.max(0, Math.min(1, pos));
    const real = new Float32Array(NUM_HARMONICS + 1);
    const imag = new Float32Array(NUM_HARMONICS + 1);

    for (let n = 1; n <= NUM_HARMONICS; n++) {
      const isOdd = n % 2 === 1;
      const sineAmp = n === 1 ? 1.0 : 0.0;
      const triAmp = isOdd ? (n % 4 === 1 ? 1 : -1) * (1 / (n * n)) : 0.0;
      const sawAmp = 1 / n;
      const sqAmp = isOdd ? 1 / n : 0.0;

      if (bank === 'basic_shapes') {
        if (p <= 1 / 3) {
          const u = p * 3;
          imag[n] = sineAmp * (1 - u) + triAmp * u;
        } else if (p <= 2 / 3) {
          const u = (p - 1 / 3) * 3;
          imag[n] = triAmp * (1 - u) + sawAmp * u;
        } else {
          const u = (p - 2 / 3) * 3;
          imag[n] = sawAmp * (1 - u) + sqAmp * u;
        }
      } else if (bank === 'harmonics') {
        // Emphasizes drawbar / formant harmonic clusters that sweep upward with `pos`
        const centerHarmonic = 1 + p * 10;
        const dist = (n - centerHarmonic) / 2.2;
        const bell = Math.exp(-dist * dist);
        imag[n] = (0.45 / n) + 0.65 * bell * (1 / Math.sqrt(n));
      } else if (bank === 'digital_pwm') {
        // Pulse-width modulation spectrum: sin(n * pi * duty) / (n * pi)
        const duty = 0.08 + 0.42 * (1 - p);
        imag[n] = Math.sin(n * Math.PI * duty) / (n * Math.PI * 0.35);
      } else if (bank === 'formant_vocal') {
        // Morphs vowel formant peaks between Aah (pos=0) -> Eeh (pos=0.5) -> Ooh (pos=1)
        const f1Harm = 2 + (1 - p) * 2;
        const f2Harm = 5 + p * 6;
        const d1 = (n - f1Harm) / 1.5;
        const d2 = (n - f2Harm) / 2.0;
        imag[n] = (0.5 / n) + 0.5 * Math.exp(-d1 * d1) + 0.35 * Math.exp(-d2 * d2);
      } else {
        // 'vintage_analog': Warm saw/square blend with gentle high-harmonic roll-off
        const rollOff = Math.exp(-n * 0.06);
        imag[n] = (sawAmp * (1 - p * 0.5) + sqAmp * (p * 0.5)) * rollOff;
      }
    }

    return { real, imag };
  }

  /**
   * Computes per-voice unison detune (in cents) and stereo pan offset for `voiceIdx` of `totalVoices`.
   */
  public static getUnisonVoiceOffsets(
    voiceIdx: number,
    totalVoices: number,
    mode: WavetableUnisonMode,
    amount: number
  ): { detuneCents: number; panOffset: number; posOffset: number } {
    if (totalVoices <= 1 || mode === 'none' || amount <= 0.001) {
      return { detuneCents: 0, panOffset: 0, posOffset: 0 };
    }

    // Normalized spread in [-1, +1]
    const norm = (voiceIdx / (totalVoices - 1)) * 2 - 1;
    const maxCents =
      mode === 'shimmer'
        ? 28
        : mode === 'noise'
          ? 36
          : mode === 'phase_sync'
            ? 14
            : 22;

    const detuneCents = norm * maxCents * amount;
    const panOffset = norm * 0.65 * amount;
    const posOffset = mode === 'position_spread' ? norm * 0.25 * amount : 0;

    return { detuneCents, panOffset, posOffset };
  }

  /**
   * Schedules a real-time WebAudio Wavetable synthesizer voice using PeriodicWave tables,
   * multi-voice Unison, Sub-Oscillator, and Modulation Matrix envelopes.
   */
  public static scheduleRealtimeVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    pannerNode: StereoPannerNode | null,
    freq: number,
    startSec: number,
    durSec: number,
    amp: number,
    params: WavetablePatchParams,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number
  ): { stopAndDisconnect: () => void; fadeOutAndStop: (now: number) => void } {
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    if (params.filterMorph > 0.75) filter.type = 'highpass';
    else if (params.filterMorph > 0.35) filter.type = 'bandpass';
    else filter.type = 'lowpass';

    filter.Q.setValueAtTime(Math.min(8, params.filterResonance), startSec);

    const startCutoff = Math.max(
      120,
      Math.min(14000, params.filterCutoffHz * (1 + params.env2ToCutoff * 0.6))
    );
    const endCutoff = Math.max(120, Math.min(14000, params.filterCutoffHz));
    filter.frequency.setValueAtTime(startCutoff, startSec);
    filter.frequency.exponentialRampToValueAtTime(
      endCutoff,
      startSec + Math.min(durSec, params.envDecaySec)
    );

    const activeOscs: OscillatorNode[] = [];
    const activeGains: GainNode[] = [env];

    // Modulated effective wave position for Osc 1
    const modPos1 = Math.max(
      0,
      Math.min(1, params.osc1Pos + params.env2ToPos * 0.35 + params.lfo1ToPos * 0.15)
    );

    const numVoices = Math.max(1, Math.min(4, params.unisonVoices));
    const voiceGainScalar = 0.55 / Math.sqrt(numVoices);

    for (let v = 0; v < numVoices; v++) {
      const { detuneCents, posOffset } = WavetableEngine.getUnisonVoiceOffsets(
        v,
        numVoices,
        params.unisonMode,
        params.unisonAmount
      );

      const osc1 = ctx.createOscillator();
      const spec1 = WavetableEngine.computeHarmonicSpectrum(
        params.bank1,
        Math.max(0, Math.min(1, modPos1 + posOffset))
      );
      if (typeof (ctx as any).createPeriodicWave === 'function') {
        try {
          const wave1 = ctx.createPeriodicWave(spec1.real, spec1.imag);
          osc1.setPeriodicWave(wave1);
        } catch {
          osc1.type = 'sawtooth';
        }
      } else {
        osc1.type = 'sawtooth';
      }

      osc1.frequency.setValueAtTime(freq, startSec);
      osc1.detune.setValueAtTime(detuneCents, startSec);

      const g1 = ctx.createGain();
      g1.gain.value = voiceGainScalar;
      osc1.connect(g1);
      g1.connect(filter);
      activeOscs.push(osc1);
      activeGains.push(g1);
    }

    // Osc 2
    if (params.osc2Enabled && params.osc2Gain > 0.01) {
      const osc2 = ctx.createOscillator();
      const spec2 = WavetableEngine.computeHarmonicSpectrum(params.bank2, params.osc2Pos);
      if (typeof (ctx as any).createPeriodicWave === 'function') {
        try {
          const wave2 = ctx.createPeriodicWave(spec2.real, spec2.imag);
          osc2.setPeriodicWave(wave2);
        } catch {
          osc2.type = 'square';
        }
      } else {
        osc2.type = 'square';
      }

      const osc2Freq = freq * Math.pow(2, params.osc2Semitones / 12);
      osc2.frequency.setValueAtTime(osc2Freq, startSec);
      osc2.detune.setValueAtTime(params.osc2DetuneCents, startSec);

      const g2 = ctx.createGain();
      g2.gain.value = params.osc2Gain * 0.45;
      osc2.connect(g2);
      g2.connect(filter);
      activeOscs.push(osc2);
      activeGains.push(g2);
    }

    // Sub-Oscillator
    if (params.subEnabled && params.subGain > 0.01) {
      const subOsc = ctx.createOscillator();
      subOsc.type = params.subTone > 0.45 ? 'triangle' : 'sine';
      const subFreq = freq * Math.pow(2, params.subOctave);
      subOsc.frequency.setValueAtTime(Math.max(20, subFreq), startSec);

      const gSub = ctx.createGain();
      gSub.gain.value = params.subGain * 0.55;
      subOsc.connect(gSub);
      gSub.connect(filter);
      activeOscs.push(subOsc);
      activeGains.push(gSub);
    }

    filter.connect(env);
    env.connect(output);

    const t0 = startSec;
    const tAttack = t0 + Math.min(params.envAttackSec, durSec * 0.4);
    const tSustain = Math.max(tAttack + 0.015, t0 + durSec);
    const tEnd = tSustain + params.envReleaseSec;
    const peak = Math.max(0.002, amp * 0.82);

    env.gain.setValueAtTime(0.0001, t0);
    if (swell === 'crescendo' || swell === 'diminuendo') {
      const sPeak = Math.max(0.002, (startAmp ?? amp) * 0.82);
      const ePeak = Math.max(0.002, (endAmp ?? amp) * 0.82);
      env.gain.linearRampToValueAtTime(sPeak, tAttack);
      env.gain.linearRampToValueAtTime(ePeak, tSustain);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else {
      env.gain.linearRampToValueAtTime(peak, tAttack);
      env.gain.exponentialRampToValueAtTime(
        Math.max(0.0005, peak * params.envSustain),
        tSustain
      );
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    }

    const stopAt = tEnd + 0.02;
    for (const o of activeOscs) {
      o.start(t0);
      o.stop(stopAt);
    }

    let cleaned = false;
    const cleanup = {
      fadeOutAndStop: (now: number) => {
        if (cleaned) return;
        try {
          env.gain.cancelScheduledValues?.(now);
          env.gain.setTargetAtTime?.(0.0001, now, 0.006);
          for (const o of activeOscs) {
            o.stop(now + 0.025);
          }
        } catch {
          cleanup.stopAndDisconnect();
        }
      },
      stopAndDisconnect: () => {
        if (cleaned) return;
        cleaned = true;
        for (const o of activeOscs) {
          try {
            o.stop();
            o.disconnect();
          } catch {
            // Ignore
          }
        }
        for (const g of activeGains) {
          try {
            g.disconnect();
          } catch {
            // Ignore
          }
        }
        try {
          filter.disconnect();
          pannerNode?.disconnect();
        } catch {
          // Ignore
        }
      },
    };

    if (activeOscs[0]) {
      activeOscs[0].onended = () => cleanup.stopAndDisconnect();
    }

    return cleanup;
  }

  /**
   * Renders a Wavetable synthesizer note directly into stereo Float32 PCM buffers (`left`, `right`)
   * with real-time wavetable position morphing (Env2 + LFO1), Unison stereo spread, and Sub-Oscillator.
   */
  public static renderNoteToStereoBuffer(
    left: Float32Array,
    right: Float32Array,
    startFrame: number,
    noteFrames: number,
    sampleRate: number,
    freq: number,
    durSec: number,
    amp: number,
    pan: number,
    params: WavetablePatchParams,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number
  ): void {
    const startSpectrum1 = WavetableEngine.computeHarmonicSpectrum(params.bank1, params.osc1Pos);
    const modTargetPos = Math.max(
      0,
      Math.min(1, params.osc1Pos + params.env2ToPos * 0.45 + params.lfo1ToPos * 0.25)
    );
    const endSpectrum1 = WavetableEngine.computeHarmonicSpectrum(params.bank1, modTargetPos);
    const spectrum2 = WavetableEngine.computeHarmonicSpectrum(params.bank2, params.osc2Pos);

    const panAngle = ((pan + 1) * 0.5) * (Math.PI * 0.5);
    const baseGainL = Math.cos(panAngle);
    const baseGainR = Math.sin(panAngle);

    const twoPiOverSr = (2 * Math.PI) / sampleRate;
    const osc2Freq = freq * Math.pow(2, (params.osc2Semitones + params.osc2DetuneCents / 100) / 12);
    const subFreq = Math.max(20, freq * Math.pow(2, params.subOctave));

    const unisonOffsets = Array.from({ length: Math.min(3, params.unisonVoices) }, (_, idx) =>
      WavetableEngine.getUnisonVoiceOffsets(
        idx,
        Math.min(3, params.unisonVoices),
        params.unisonMode,
        params.unisonAmount
      )
    );

    let lpL = 0;
    let lpR = 0;
    const hasSwell = swell === 'crescendo' || swell === 'diminuendo';
    const baseAmpScalar = hasSwell ? 1.0 : amp;
    const attackSec = Math.min(params.envAttackSec, durSec * 0.35);
    const releaseSec = params.envReleaseSec;

    for (let i = 0; i < noteFrames; i++) {
      const t = i / sampleRate;
      let env = 1.0;
      if (hasSwell) {
        if (t < attackSec) env = (t / attackSec) * (startAmp ?? amp);
        else if (t <= durSec) {
          const u = (t - attackSec) / Math.max(0.001, durSec - attackSec);
          env = (startAmp ?? amp) + ((endAmp ?? amp) - (startAmp ?? amp)) * u;
        } else {
          env = (endAmp ?? amp) * Math.max(0, 1 - (t - durSec) / Math.max(0.001, releaseSec));
        }
      } else {
        if (t < attackSec) env = t / attackSec;
        else if (t <= durSec) {
          const decayProg = (t - attackSec) / Math.max(0.001, durSec - attackSec);
          env = params.envSustain + (1 - params.envSustain) * Math.exp(-decayProg * 2.5);
        } else {
          env = params.envSustain * Math.max(0, 1 - (t - durSec) / Math.max(0.001, releaseSec));
        }
      }

      // Morph ratio between startSpectrum1 and endSpectrum1 driven by Env2 + LFO1
      const env2Val = Math.exp(-t / Math.max(0.05, params.envDecaySec));
      const lfo1Val = 0.5 + 0.5 * Math.sin(2 * Math.PI * params.lfo1RateHz * t);
      const morphMix = Math.max(0, Math.min(1, 0.6 * env2Val + 0.4 * lfo1Val));

      let sigL = 0;
      let sigR = 0;

      // Sum band-limited harmonics (up to 10 harmonics for fast offline PCM rendering)
      for (let h = 1; h <= 10; h++) {
        if (freq * h > 14000) break;
        const hAmp1 =
          startSpectrum1.imag[h] * (1 - morphMix) + endSpectrum1.imag[h] * morphMix;
        const hAmp2 = params.osc2Enabled ? spectrum2.imag[h] * params.osc2Gain * 0.4 : 0;

        for (let uIdx = 0; uIdx < unisonOffsets.length; uIdx++) {
          const u = unisonOffsets[uIdx];
          const uFreq = freq * Math.pow(2, u.detuneCents / 1200);
          const sVal = Math.sin(i * uFreq * h * twoPiOverSr) * hAmp1;
          sigL += sVal * (1 - u.panOffset * 0.4);
          sigR += sVal * (1 + u.panOffset * 0.4);
        }

        if (hAmp2 !== 0) {
          const s2 = Math.sin(i * osc2Freq * h * twoPiOverSr) * hAmp2;
          sigL += s2;
          sigR += s2;
        }
      }

      sigL /= Math.sqrt(unisonOffsets.length);
      sigR /= Math.sqrt(unisonOffsets.length);

      // Add Sub-Oscillator
      if (params.subEnabled && params.subGain > 0.01) {
        const subPhase = i * subFreq * twoPiOverSr;
        const subWave =
          Math.sin(subPhase) * (1 - params.subTone * 0.3) +
          Math.sin(subPhase * 2) * (params.subTone * 0.3);
        const subSample = subWave * params.subGain * 0.55;
        sigL += subSample;
        sigR += subSample;
      }

      const modCutoff = Math.max(
        120,
        Math.min(
          12000,
          params.filterCutoffHz *
            (1 + params.env2ToCutoff * env2Val * 0.5 + params.lfo1ToCutoff * (lfo1Val - 0.5) * 0.4)
        )
      );
      const alpha = Math.min(0.88, (2 * Math.PI * modCutoff) / sampleRate);
      lpL += alpha * (sigL - lpL);
      lpR += alpha * (sigR - lpR);

      const outGain = env * baseAmpScalar * 0.62;
      left[startFrame + i] += lpL * outGain * baseGainL;
      right[startFrame + i] += lpR * outGain * baseGainR;
    }
  }
}
