import { TrackDefinition } from '../../parser/DocumentParser';
import { AtomicEvent } from '../../parser/ASTSerializer';

export type AbletonSynthEngineType =
  | 'operator'
  | 'meld'
  | 'drift'
  | 'analog'
  | 'collision'
  | 'tension'
  | 'electric'
  | 'reese'
  | 'reese_bass'
  | 'riser';

export interface AbletonSynthParams {
  engine: AbletonSynthEngineType;
  algorithm: number; // 1..11 for Operator FM routing
  ratios: [number, number, number, number]; // Op A, B, C, D frequency ratios
  modIndices: [number, number, number]; // Modulator depths for B, C, D
  feedback: number; // 0.0 .. 1.0
  swarmSpread: number; // 0.0 .. 1.0 (Meld / Drift detune & swarm dispersion)
  harmonicTilt: number; // 0.0 .. 1.0 (Brightness / upper-partial emphasis)
  driftAmount: number; // 0.0 .. 1.0 (Analog / Drift organic pitch & cutoff walk)
  malletStiffness: number; // 0.0 .. 1.0 (Collision / Tension / Electric transient hardness)
  decaySec: number;
  sustainLevel: number;
  releaseSec: number;
  cutoffHz: number;
  resonance: number;
}

export interface SynthEngineDisplaySpec {
  engineLabel: string;
  topologySummary: string;
  primaryMacroLabel: string;
}

const EULER_BERNOULLI_BAR_RATIOS = [1.0, 2.756, 5.404, 8.933];

export class AbletonSynthSuite {
  public static isSupportedPatch(patch?: string): boolean {
    if (!patch) return false;
    const clean = patch.trim().toLowerCase();
    return (
      clean === 'operator' ||
      clean === 'meld' ||
      clean === 'drift' ||
      clean === 'analog' ||
      clean === 'collision' ||
      clean === 'tension' ||
      clean === 'electric' ||
      clean === 'reese' ||
      clean === 'reese_bass' ||
      clean === 'riser'
    );
  }

  public static getEngineDisplaySpec(patch?: string): SynthEngineDisplaySpec {
    const clean = (patch || '').trim().toLowerCase();
    switch (clean) {
      case 'operator':
        return {
          engineLabel: 'Ableton Operator (4-Op FM)',
          topologySummary: '4-Op FM Cascade & Additive Matrix (11 Algs)',
          primaryMacroLabel: 'FM Index & Ratio Morph',
        };
      case 'meld':
        return {
          engineLabel: 'Ableton Meld (Bi-Timbral)',
          topologySummary: 'Dual Macro-Oscillator Scale Swarm & Harmonics',
          primaryMacroLabel: 'Swarm Spread & Tilt',
        };
      case 'drift':
        return {
          engineLabel: 'Ableton Drift (Analog Modeling)',
          topologySummary: 'Shape-Mod Osc + Organic Voice Drift + LP',
          primaryMacroLabel: 'Voice Drift & Sub Blend',
        };
      case 'analog':
        return {
          engineLabel: 'Ableton Analog (Dual VCO)',
          topologySummary: 'Dual Sync/PWM VCO + Dual Multimode Filters',
          primaryMacroLabel: 'VCO Detune & Filter Drive',
        };
      case 'reese':
      case 'reese_bass':
        return {
          engineLabel: 'Producer Reese Sub-Bass (3-Saw + Sub)',
          topologySummary: '3 Wide-Detuned Saws (±28ct) + Phase-Locked Sub + Ladder Drive',
          primaryMacroLabel: 'Reese Detune & Cutoff',
        };
      case 'riser':
        return {
          engineLabel: 'Festival Pitch & Filter Riser',
          topologySummary: '+12st Exponential Pitch Sweep + Opening Ladder Filter',
          primaryMacroLabel: 'Sweep Depth & Brightness',
        };
      case 'collision':
        return {
          engineLabel: 'Ableton Collision (Modal Mallet)',
          topologySummary: 'Mallet Exciters -> Dual Beam/Membrane Resonators',
          primaryMacroLabel: 'Mallet Stiffness & Decay',
        };
      case 'tension':
        return {
          engineLabel: 'Ableton Tension (String Model)',
          topologySummary: 'Karplus-Strong Waveguide + Body Coupling',
          primaryMacroLabel: 'String Damping & Bow/Pluck',
        };
      case 'electric':
        return {
          engineLabel: 'Ableton Electric (Tine/Reed)',
          topologySummary: 'Mallet Fork -> Tine Bell + Magnetic Pickup Bark',
          primaryMacroLabel: 'Tine Bell & Pickup Drive',
        };
      case 'wavetable':
      case 'supersaw':
      case 'flutter_pad':
        return {
          engineLabel: 'Ableton Wavetable (2-Osc Morph)',
          topologySummary: 'Dual 24-Harmonic Wavetables + 8-Voice Unison',
          primaryMacroLabel: 'Wave Position & Unison',
        };
      default:
        return {
          engineLabel: 'MusyngKite HD / Hybrid Engine',
          topologySummary: 'Multi-Sampled Acoustic + Concertgebouw DSP',
          primaryMacroLabel: 'Filter Cutoff & Expression',
        };
    }
  }

  public static resolveParams(
    patchName: string,
    def?: TrackDefinition,
    eventPhysics?: AtomicEvent['physics'],
    cutoffOverrideHz?: number
  ): AbletonSynthParams {
    const cleanPatch = patchName.trim().toLowerCase() as AbletonSynthEngineType;
    const isReese = cleanPatch === 'reese' || cleanPatch === 'reese_bass';
    const macros = def?.macros || {};
    const env = def?.env || {};
    const fxParams = def?.fxChain?.find((f) => f.type === cleanPatch)?.params || {};

    const norm0to1 = (val: any, fallback: number): number => {
      const n = Number(val);
      if (isNaN(n)) return fallback;
      return n > 1.0 ? Math.max(0, Math.min(1, n / 127)) : Math.max(0, Math.min(1, n));
    };

    const algorithm = Math.max(
      1,
      Math.min(11, parseInt(String(fxParams.algorithm ?? env.algorithm ?? 1), 10) || 1)
    );
    const rA = parseFloat(String(fxParams.ratioA ?? env.ratioA ?? 1.0)) || 1.0;
    const rB = parseFloat(String(fxParams.ratioB ?? env.ratioB ?? 2.0)) || 2.0;
    const rC = parseFloat(String(fxParams.ratioC ?? env.ratioC ?? 3.5)) || 3.5;
    const rD = parseFloat(String(fxParams.ratioD ?? env.ratioD ?? 7.0)) || 7.0;

    const feedback = norm0to1(fxParams.feedback ?? env.feedback ?? macros.resonance, 0.22);
    let swarmSpread = norm0to1(
      fxParams.swarm_spread ?? macros.swarm_spread ?? macros.unison ?? (isReese ? 0.78 : 0.42),
      isReese ? 0.78 : 0.42
    );
    if (eventPhysics?.detune !== undefined) {
      swarmSpread = Math.max(0, Math.min(1, eventPhysics.detune / 100));
    }
    const harmonicTilt = norm0to1(
      fxParams.harmonic_tilt ?? macros.harmonic_tilt ?? macros.osc1_pos ?? 0.55,
      0.55
    );
    const driftAmount = norm0to1(
      fxParams.drift_amount ?? macros.drift_amount ?? (isReese ? 0.65 : 0.35),
      isReese ? 0.65 : 0.35
    );
    const malletStiffness = norm0to1(
      fxParams.stiffness ?? macros.attack ?? 0.6,
      0.6
    );

    const defaultCutoff = isReese ? 650 : 3200;
    const rawCutoff =
      eventPhysics?.cutoff ??
      cutoffOverrideHz ??
      Number(
        fxParams.cutoff ??
          (macros.cutoff !== undefined
            ? macros.cutoff > 127
              ? macros.cutoff
              : 180 * Math.pow(10000 / 180, macros.cutoff / 127)
            : defaultCutoff)
      );

    const isPluckedOrStruck =
      cleanPatch === 'collision' ||
      cleanPatch === 'tension' ||
      cleanPatch === 'electric' ||
      Boolean(eventPhysics?.pizz);

    return {
      engine: cleanPatch,
      algorithm,
      ratios: [rA, rB, rC, rD],
      modIndices: [
        1.8 * (0.4 + harmonicTilt),
        1.1 * (0.3 + harmonicTilt),
        0.65 * harmonicTilt,
      ],
      feedback,
      swarmSpread,
      harmonicTilt,
      driftAmount,
      malletStiffness,
      decaySec: isPluckedOrStruck ? 0.38 : 0.45,
      sustainLevel: isPluckedOrStruck ? 0.32 : isReese ? 0.92 : 0.78,
      releaseSec: isPluckedOrStruck ? 0.24 : 0.22,
      cutoffHz: Math.max(80, Math.min(14000, isNaN(rawCutoff) ? defaultCutoff : rawCutoff)),
      resonance: Math.max(0.5, Math.min(10, Number(fxParams.resonance ?? (isReese ? 1.8 : 1.1)))),
    };
  }

  /**
   * Schedules a real-time WebAudio voice for Operator, Meld, Drift, Analog, Collision, Tension, Electric, Reese, or Riser.
   */
  public static scheduleRealtimeVoice(
    ctx: BaseAudioContext,
    output: AudioNode,
    pannerNode: StereoPannerNode | null,
    freq: number,
    startSec: number,
    durSec: number,
    amp: number,
    params: AbletonSynthParams,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number,
    physics?: AtomicEvent['physics']
  ): { stopAndDisconnect: () => void; fadeOutAndStop: (now: number) => void } {
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(Math.min(8, params.resonance), startSec);

    if (physics?.filterSweep && physics.filterSweep.length >= 2) {
      filter.frequency.setValueAtTime(Math.max(80, Math.min(14000, physics.filterSweep[0])), startSec);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(80, Math.min(14000, physics.filterSweep[1])),
        startSec + Math.max(0.05, durSec)
      );
    } else if (params.engine === 'riser') {
      filter.frequency.setValueAtTime(320, startSec);
      filter.frequency.exponentialRampToValueAtTime(9800, startSec + Math.max(0.1, durSec));
    } else {
      filter.frequency.setValueAtTime(params.cutoffHz, startSec);
    }

    const activeOscs: OscillatorNode[] = [];
    const activeGains: GainNode[] = [env];

    const t0 = startSec;
    const attackSec =
      params.engine === 'collision' || params.engine === 'electric'
        ? 0.004
        : params.engine === 'meld'
          ? 0.035
          : 0.01;
    const tAttack = t0 + Math.min(attackSec, durSec * 0.35);
    const tSustain = Math.max(tAttack + 0.015, t0 + durSec);
    const tEnd = tSustain + params.releaseSec;

    if (params.engine === 'operator') {
      // 4-Operator FM synthesis graph: Modulator C -> Modulator B -> Carrier A
      const carrierA = ctx.createOscillator();
      const modB = ctx.createOscillator();
      const modC = ctx.createOscillator();

      carrierA.type = 'sine';
      modB.type = 'sine';
      modC.type = 'sine';

      carrierA.frequency.setValueAtTime(freq * params.ratios[0], t0);
      modB.frequency.setValueAtTime(freq * params.ratios[1], t0);
      modC.frequency.setValueAtTime(freq * params.ratios[2], t0);

      const modGainB = ctx.createGain();
      const modGainC = ctx.createGain();

      // FM index scales with carrier frequency for consistent harmonic spectrum across octaves
      const indexBHz = freq * params.modIndices[0];
      const indexCHz = freq * params.modIndices[1];

      modGainB.gain.setValueAtTime(indexBHz, t0);
      modGainB.gain.exponentialRampToValueAtTime(Math.max(1, indexBHz * 0.25), tSustain);
      modGainC.gain.setValueAtTime(indexCHz, t0);
      modGainC.gain.exponentialRampToValueAtTime(Math.max(1, indexCHz * 0.18), tSustain);

      if (params.algorithm >= 10) {
        // Additive parallel organ mode
        const addGainB = ctx.createGain();
        const addGainC = ctx.createGain();
        addGainB.gain.value = 0.35;
        addGainC.gain.value = 0.2;
        modB.connect(addGainB);
        modC.connect(addGainC);
        addGainB.connect(filter);
        addGainC.connect(filter);
        activeGains.push(addGainB, addGainC);
      } else {
        modC.connect(modGainC);
        modGainC.connect(modB.frequency);
        modB.connect(modGainB);
        modGainB.connect(carrierA.frequency);
        activeGains.push(modGainB, modGainC);
      }

      const carrierGain = ctx.createGain();
      carrierGain.gain.value = 0.65;
      carrierA.connect(carrierGain);
      carrierGain.connect(filter);

      activeOscs.push(carrierA, modB, modC);
      activeGains.push(carrierGain);
    } else if (params.engine === 'collision' || params.engine === 'electric') {
      // Modal Resonator / Tine Electric Piano partials
      const ratios =
        params.engine === 'collision'
          ? EULER_BERNOULLI_BAR_RATIOS
          : [1.0, 2.0, 3.0, 7.1];
      const weights =
        params.engine === 'collision'
          ? [0.65, 0.22, 0.1, 0.05]
          : [0.68, 0.18, 0.08, 0.14];

      for (let m = 0; m < ratios.length; m++) {
        const pFreq = freq * ratios[m];
        if (pFreq > 14000) continue;
        const osc = ctx.createOscillator();
        osc.type = m === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(pFreq, t0);

        const pGain = ctx.createGain();
        const baseW = weights[m] * (m > 0 ? 0.6 + 0.6 * params.malletStiffness : 1.0);
        pGain.gain.setValueAtTime(baseW, t0);
        if (m >= 2) {
          // Upper metallic tine / bar modes decay rapidly after initial strike
          pGain.gain.exponentialRampToValueAtTime(0.001, t0 + Math.min(durSec, 0.16));
        }
        osc.connect(pGain);
        pGain.connect(filter);
        activeOscs.push(osc);
        activeGains.push(pGain);
      }
    } else if (params.engine === 'reese' || params.engine === 'reese_bass') {
      // 3 wide-detuned sawtooth oscillators (±28 cents) + phase-locked sub-octave sine
      const detunes = [-28 * params.swarmSpread, 0, 28 * params.swarmSpread];
      for (const dt of detunes) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t0);
        osc.detune.setValueAtTime(dt, t0);
        if (physics?.mpe?.bend && physics.mpe.bend.length > 1) {
          const bArr = physics.mpe.bend;
          const seg = durSec / (bArr.length - 1);
          for (let b = 0; b < bArr.length; b++) {
            const bf = Math.max(20, freq * Math.pow(2, bArr[b] / 12));
            if (b === 0) osc.frequency.setValueAtTime(bf, t0);
            else osc.frequency.linearRampToValueAtTime(bf, t0 + b * seg);
          }
        }
        const g = ctx.createGain();
        g.gain.value = 0.34;
        osc.connect(g);
        g.connect(filter);
        activeOscs.push(osc);
        activeGains.push(g);
      }
      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(Math.max(20, freq * 0.5), t0);
      const gSub = ctx.createGain();
      gSub.gain.value = 0.65;
      subOsc.connect(gSub);
      gSub.connect(filter);
      activeOscs.push(subOsc);
      activeGains.push(gSub);
    } else if (params.engine === 'riser') {
      // Sweeps pitch upward by +12st while opening filter cutoff
      for (let v = 0; v < 3; v++) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t0);
        osc.frequency.exponentialRampToValueAtTime(
          Math.min(12000, freq * 2),
          t0 + Math.max(0.1, durSec)
        );
        osc.detune.setValueAtTime((v - 1) * 18, t0);
        const g = ctx.createGain();
        g.gain.value = 0.35;
        osc.connect(g);
        g.connect(filter);
        activeOscs.push(osc);
        activeGains.push(g);
      }
    } else {
      // Meld (Swarm), Drift, Analog, and Tension (Waveguide String)
      const numSwarm = params.engine === 'meld' ? 4 : 3;
      const maxSpreadCents =
        params.engine === 'meld'
          ? 26 * params.swarmSpread
          : params.engine === 'drift'
            ? 14 * params.driftAmount
            : 10;

      for (let v = 0; v < numSwarm; v++) {
        const osc = ctx.createOscillator();
        if (params.engine === 'tension') {
          osc.type = v === 0 ? 'sawtooth' : 'triangle';
        } else if (params.engine === 'meld') {
          osc.type = v % 2 === 0 ? 'sawtooth' : 'triangle';
        } else {
          osc.type = v === 0 ? 'sawtooth' : v === 1 ? 'square' : 'sine';
        }

        const vFreq = v === 2 && (params.engine === 'drift' || params.engine === 'analog') ? freq * 0.5 : freq;
        osc.frequency.setValueAtTime(Math.max(20, vFreq), t0);
        const norm = (v / Math.max(1, numSwarm - 1)) * 2 - 1;
        osc.detune.setValueAtTime(norm * maxSpreadCents, t0);

        const vGain = ctx.createGain();
        vGain.gain.value = 0.55 / Math.sqrt(numSwarm);
        osc.connect(vGain);
        vGain.connect(filter);
        activeOscs.push(osc);
        activeGains.push(vGain);
      }
    }

    filter.connect(env);
    env.connect(output);

    const peak = Math.max(0.002, amp * 0.8);
    env.gain.setValueAtTime(0.0001, t0);
    if (swell === 'crescendo' || swell === 'diminuendo') {
      const sPeak = Math.max(0.002, (startAmp ?? amp) * 0.8);
      const ePeak = Math.max(0.002, (endAmp ?? amp) * 0.8);
      env.gain.linearRampToValueAtTime(sPeak, tAttack);
      env.gain.linearRampToValueAtTime(ePeak, tSustain);
      env.gain.exponentialRampToValueAtTime(0.0001, tEnd);
    } else {
      env.gain.linearRampToValueAtTime(peak, tAttack);
      env.gain.exponentialRampToValueAtTime(
        Math.max(0.0005, peak * params.sustainLevel),
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
   * Synthesizes a single sample frame at time `t` (in seconds) for deterministic offline WAV export
   * and unit test waveform verification.
   */
  public static computeSampleAtTime(
    t: number,
    freq: number,
    params: AbletonSynthParams,
    durSec: number = 1.0
  ): number {
    const twoPiF = 2 * Math.PI * freq;

    if (params.engine === 'reese' || params.engine === 'reese_bass') {
      // 3 wide-detuned sawtooth oscillators (±28 cents) + phase-locked sub-octave sine + saturating ladder drive
      const spreadRatio = Math.pow(2, (28 * Math.max(0.25, params.swarmSpread)) / 1200);
      const f1 = twoPiF / spreadRatio;
      const f2 = twoPiF;
      const f3 = twoPiF * spreadRatio;
      let sawSum = 0;
      for (let h = 1; h <= 6; h++) {
        if (freq * h > 8000) break;
        sawSum +=
          (Math.sin(f1 * h * t) + Math.sin(f2 * h * t) + Math.sin(f3 * h * t)) / (3 * h);
      }
      const subSine = Math.sin(twoPiF * 0.5 * t) * 0.72;
      return Math.tanh((sawSum * 0.68 + subSine) * 1.85);
    }

    if (params.engine === 'riser') {
      const sweptFreq = freq * Math.pow(2, Math.min(2, t / Math.max(0.5, durSec)));
      const w = 2 * Math.PI * sweptFreq;
      const saw =
        Math.sin(w * t) +
        0.5 * Math.sin(w * 2 * t) +
        0.33 * Math.sin(w * 3 * t) +
        0.25 * Math.sin(w * 4 * t);
      return Math.tanh(saw * 0.65);
    }

    if (params.engine === 'operator') {
      const [rA, rB, rC, rD] = params.ratios;
      const [iB, iC, iD] = params.modIndices;
      const modDecay = Math.exp(-t * 3.2);
      const sigD = Math.sin(twoPiF * rD * t) * iD * modDecay;

      if (params.algorithm === 11) {
        // 4-Carrier Additive Organ
        return (
          0.45 * Math.sin(twoPiF * rA * t) +
          0.25 * Math.sin(twoPiF * rB * t) +
          0.18 * Math.sin(twoPiF * rC * t) +
          0.12 * Math.sin(twoPiF * rD * t)
        );
      }

      if (params.algorithm === 8) {
        // Dual 2-Op pairs: (B -> A) + (D -> C)
        const pair1 = Math.sin(twoPiF * rA * t + iB * modDecay * Math.sin(twoPiF * rB * t));
        const pair2 = Math.sin(twoPiF * rC * t + sigD);
        return 0.55 * pair1 + 0.45 * pair2;
      }

      // Cascade FM (Algorithms 1..7)
      const sigC = Math.sin(twoPiF * rC * t + sigD) * iC * modDecay;
      const sigB = Math.sin(twoPiF * rB * t + sigC) * iB * modDecay;
      return Math.sin(twoPiF * rA * t + sigB);
    }

    if (params.engine === 'collision') {
      // Euler-Bernoulli modal mallet bar (1.0, 2.756, 5.404, 8.933)
      const m1 = Math.sin(twoPiF * EULER_BERNOULLI_BAR_RATIOS[0] * t) * Math.exp(-t * 3.5);
      const m2 =
        Math.sin(twoPiF * EULER_BERNOULLI_BAR_RATIOS[1] * t) *
        Math.exp(-t * 11.0) *
        0.35 *
        params.malletStiffness;
      const m3 =
        Math.sin(twoPiF * EULER_BERNOULLI_BAR_RATIOS[2] * t) *
        Math.exp(-t * 24.0) *
        0.18 *
        params.malletStiffness;
      const strikeClick = Math.sin(twoPiF * 12 * t) * Math.exp(-t * 140) * 0.15;
      return m1 * 0.7 + m2 + m3 + strikeClick;
    }

    if (params.engine === 'electric') {
      // Rhodes / Wurlitzer Tine Bell (7.1x overtone) + warm pickup bark saturation
      const fund = Math.sin(twoPiF * t);
      const second = Math.sin(twoPiF * 2 * t) * 0.28 * Math.exp(-t * 4.5);
      const tineBell =
        Math.sin(twoPiF * 7.1 * t) * Math.exp(-t * 18.0) * 0.25 * params.malletStiffness;
      return Math.tanh((fund + second) * 1.45) * 0.75 + tineBell;
    }

    if (params.engine === 'tension') {
      // Karplus-Strong / Bowed string harmonic series with stiffness dispersion
      let sum = 0;
      for (let h = 1; h <= 7; h++) {
        const stiffRatio = h * Math.sqrt(1 + 0.0004 * h * h);
        if (freq * stiffRatio > 13000) break;
        const hDecay = Math.exp(-t * (1.2 + h * 0.85));
        sum += (Math.sin(twoPiF * stiffRatio * t) / h) * hDecay;
      }
      return sum * 0.62;
    }

    if (params.engine === 'meld') {
      // Bi-Timbral Swarm + Fifth/Octave Harmonic Cluster
      const detune = 1 + 0.0045 * params.swarmSpread;
      const oscA =
        0.5 * Math.sin(twoPiF * t) +
        0.3 * Math.sin(twoPiF * detune * t) +
        0.2 * Math.sin((twoPiF / detune) * t);
      const oscB =
        0.45 * Math.sin(twoPiF * 1.5 * t) * params.harmonicTilt +
        0.35 * Math.sin(twoPiF * 2.0 * t);
      return 0.6 * oscA + 0.4 * oscB;
    }

    // 'drift' or 'analog': Analog oscillator with organic pitch drift + sub-oscillator + ladder warmth
    const slowDrift = 1 + Math.sin(2 * Math.PI * 1.7 * t) * 0.0022 * params.driftAmount;
    const fDrifted = twoPiF * slowDrift;
    const sawApprox =
      Math.sin(fDrifted * t) +
      0.5 * Math.sin(fDrifted * 2 * t) +
      0.33 * Math.sin(fDrifted * 3 * t) +
      0.25 * Math.sin(fDrifted * 4 * t);
    const subSine = Math.sin(twoPiF * 0.5 * t) * 0.55;
    return Math.tanh((sawApprox * 0.45 + subSine) * 1.3);
  }

  /**
   * Renders a full note event into stereo Float32 PCM buffers (`left`, `right`) for WAV export.
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
    params: AbletonSynthParams,
    swell?: 'crescendo' | 'diminuendo',
    startAmp?: number,
    endAmp?: number,
    physics?: AtomicEvent['physics']
  ): void {
    const panAngle = ((pan + 1) * 0.5) * (Math.PI * 0.5);
    const gainL = Math.cos(panAngle);
    const gainR = Math.sin(panAngle);

    const hasSwell = swell === 'crescendo' || swell === 'diminuendo';
    const baseAmpScalar = hasSwell ? 1.0 : amp;
    const attackSec =
      params.engine === 'collision' || params.engine === 'electric'
        ? 0.004
        : Math.min(0.025, durSec * 0.3);
    const releaseSec = params.releaseSec;

    const bendArr = physics?.mpe?.bend;
    const evalBendSemitones = (u: number): number => {
      if (!bendArr || bendArr.length === 0) return 0;
      if (bendArr.length === 1) return bendArr[0];
      const clampedU = Math.max(0, Math.min(1, u));
      const scaled = clampedU * (bendArr.length - 1);
      const idx0 = Math.floor(scaled);
      const idx1 = Math.min(bendArr.length - 1, idx0 + 1);
      const frac = scaled - idx0;
      return bendArr[idx0] + (bendArr[idx1] - bendArr[idx0]) * frac;
    };

    let lpL = 0;
    let lpR = 0;

    for (let i = 0; i < noteFrames; i++) {
      const t = i / sampleRate;
      const uNorm = Math.min(1, t / Math.max(0.01, durSec));
      const bendSemi = evalBendSemitones(uNorm);
      const instFreq = bendSemi !== 0 ? freq * Math.pow(2, bendSemi / 12) : freq;

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
          const dProg = (t - attackSec) / Math.max(0.001, durSec - attackSec);
          env =
            params.sustainLevel +
            (1 - params.sustainLevel) * Math.exp(-dProg * 2.6);
        } else {
          env =
            params.sustainLevel *
            Math.max(0, 1 - (t - durSec) / Math.max(0.001, releaseSec));
        }
      }

      const rawMono = AbletonSynthSuite.computeSampleAtTime(t, instFreq, params, durSec);
      // Slight stereo chorus dispersion for Meld, Drift & Reese
      const stereoSpread =
        params.engine === 'meld' ||
        params.engine === 'drift' ||
        params.engine === 'reese' ||
        params.engine === 'reese_bass'
          ? Math.sin(2 * Math.PI * (instFreq * 1.003) * t) * 0.15 * params.swarmSpread
          : 0;

      let dynCut = params.cutoffHz;
      if (physics?.filterSweep && physics.filterSweep.length >= 2) {
        dynCut = physics.filterSweep[0] + (physics.filterSweep[1] - physics.filterSweep[0]) * uNorm;
      } else if (params.engine === 'riser') {
        dynCut = 320 * Math.pow(9800 / 320, uNorm);
      }
      const alpha = Math.min(0.88, (2 * Math.PI * dynCut) / sampleRate);

      lpL += alpha * (rawMono + stereoSpread - lpL);
      lpR += alpha * (rawMono - stereoSpread - lpR);

      const outGain = env * baseAmpScalar * 0.72;
      left[startFrame + i] += lpL * outGain * gainL;
      right[startFrame + i] += lpR * outGain * gainR;
    }
  }
}
