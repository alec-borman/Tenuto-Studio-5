import { AtomicEvent, WindowedModulationSpec } from '../../parser/ASTSerializer';
import { TrackDefinition } from '../../parser/DocumentParser';

export interface ContinuousVoiceNote {
  event: AtomicEvent;
  def?: TrackDefinition;
  startSec: number;
  durSec: number;
  freq: number;
  targetGlideFreq?: number;
  glideDurationSec?: number;
  midi: number;
  amp: number;
  startAmp: number;
  endAmp: number;
  swell?: 'crescendo' | 'diminuendo';
  pan: number;
}

export class ContinuousSynthEngine {
  /**
   * Evaluates a WindowedModulationSpec (`peak`, `startNorm..endNorm`, or multi-point `curve`)
   * at normalized note progress `u` in `[0.0, 1.0]`, applying smooth cosine feathering at window
   * edges so mid-note detune/filter/noise/drive activations never click.
   */
  public static evaluateWindowedModulation(
    spec: WindowedModulationSpec | undefined,
    u: number,
    defaultVal: number = 0
  ): number {
    if (!spec) return defaultVal;
    const clampedU = Math.max(0, Math.min(1, u));

    if (clampedU < spec.startNorm || clampedU > spec.endNorm) {
      return defaultVal;
    }

    const windowSpan = Math.max(1e-5, spec.endNorm - spec.startNorm);
    const localU = (clampedU - spec.startNorm) / windowSpan;

    // Smooth raised-cosine edge feathering when a sub-window (startNorm > 0 or endNorm < 1) is used
    let edgeFeather = 1.0;
    const featherWidth = 0.12;
    if (spec.startNorm > 0.001 && localU < featherWidth) {
      edgeFeather = 0.5 * (1 - Math.cos((Math.PI * localU) / featherWidth));
    } else if (spec.endNorm < 0.999 && localU > 1 - featherWidth) {
      edgeFeather = 0.5 * (1 - Math.cos((Math.PI * (1 - localU)) / featherWidth));
    }

    if (spec.curve && spec.curve.length > 0) {
      if (spec.curve.length === 1) return spec.curve[0] * edgeFeather;
      const scaled = localU * (spec.curve.length - 1);
      const i0 = Math.floor(scaled);
      const i1 = Math.min(spec.curve.length - 1, i0 + 1);
      const frac = scaled - i0;
      // Smoothstep S-curve interpolation between curve points
      const smoothFrac = frac * frac * (3 - 2 * frac);
      const val = spec.curve[i0] + (spec.curve[i1] - spec.curve[i0]) * smoothFrac;
      return defaultVal + (val - defaultVal) * edgeFeather;
    }

    return defaultVal + (spec.peak - defaultVal) * edgeFeather;
  }

  /**
   * Automatically pairs sorted voices of consecutive chords/notes on the same track & voice
   * when `.glide(ms)` is present, populating both `mpe.bend` (for WebAudio/UI) and exact
   * target frequency slewing (`glideMs`) so every voice in a 5-note chord glides smoothly
   * along its shortest voice-leading path into the next chord.
   */
  public static linkPolyphonicChordGlides(events: AtomicEvent[]): void {
    const stepsByTrackVoice = new Map<
      string,
      Array<{ startWhole: number; durWhole: number; notes: AtomicEvent[] }>
    >();

    for (const ev of events) {
      if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer || !ev.startTime) continue;
      const key = `${ev.trackId || 'pno'}:${ev.voiceId || 'v1'}`;
      let steps = stepsByTrackVoice.get(key);
      if (!steps) {
        steps = [];
        stepsByTrackVoice.set(key, steps);
      }
      const st = ev.startTime.numerator / Math.max(1, ev.startTime.denominator);
      const dur = ev.duration.numerator / Math.max(1, ev.duration.denominator);
      const last = steps[steps.length - 1];
      if (last && Math.abs(last.startWhole - st) < 1e-6) {
        last.notes.push(ev);
      } else {
        steps.push({ startWhole: st, durWhole: dur, notes: [ev] });
      }
    }

    for (const steps of stepsByTrackVoice.values()) {
      steps.sort((a, b) => a.startWhole - b.startWhole);
      for (let i = 0; i < steps.length - 1; i++) {
        const currStep = steps[i];
        const nextStep = steps[i + 1];
        const hasGlide = currStep.notes.some((n) => (n.physics?.glideMs ?? 0) > 0);
        if (!hasGlide) continue;

        const currSorted = [...currStep.notes].sort((a, b) => a.pitch.midi - b.pitch.midi);
        const nextSorted = [...nextStep.notes].sort((a, b) => a.pitch.midi - b.pitch.midi);

        for (let vIdx = 0; vIdx < currSorted.length; vIdx++) {
          const srcNote = currSorted[vIdx];
          const targetIdx = Math.min(nextSorted.length - 1, vIdx);
          const dstNote = nextSorted[targetIdx];
          if (!dstNote) continue;

          const semitoneDelta = dstNote.pitch.midi - srcNote.pitch.midi;
          if (!srcNote.physics) srcNote.physics = {};
          if (!srcNote.physics.mpe?.bend) {
            srcNote.physics.mpe = {
              ...(srcNote.physics.mpe || {}),
              bend: [0, 0, 0, 0, semitoneDelta],
            };
          }
          srcNote.physics.legato = true;
        }
      }
    }
  }

  public static isContinuousSynthPatch(patch?: string, style?: string, physics?: AtomicEvent['physics']): boolean {
    const p = (patch || '').trim().toLowerCase();
    const s = (style || '').trim().toLowerCase();
    if (
      p === 'supersaw' ||
      p === 'reese' ||
      p === 'reese_bass' ||
      p === 'flutter_pad' ||
      p === 'riser' ||
      p === 'pluck_lead' ||
      p === 'acid_lead'
    ) {
      return true;
    }
    if (s === 'grid') return false;
    return Boolean(
      physics?.detuneMod ||
        physics?.detuneCentsMod ||
        physics?.cutoffMod ||
        physics?.flutterRateHz ||
        physics?.warbleDepth ||
        physics?.stackMode ||
        physics?.noiseLevel ||
        physics?.syncRatio ||
        physics?.fmAmount ||
        physics?.ringAmount ||
        physics?.pwmDuty ||
        physics?.waveWarpMode ||
        physics?.combFreqHz ||
        physics?.duckDepth ||
        physics?.tranceGate ||
        physics?.pluckDecayMs ||
        physics?.haasDelayMs ||
        physics?.analogSlop ||
        physics?.airSheen ||
        physics?.preSwell
    );
  }

  private static readonly SAW_LUT_SIZE = 2048;
  private static readonly SAW_LUT_MASK = 2047;
  private static readonly SAW_LUT: Float32Array = (() => {
    const lut = new Float32Array(2048);
    for (let k = 0; k < 2048; k++) {
      const wrappedPhase = k / 2048;
      const ph = wrappedPhase * 2 * Math.PI;
      lut[k] = (2 * wrappedPhase - 1) * 0.65 + Math.sin(ph) * 0.35 + Math.sin(ph * 2) * 0.18;
    }
    return lut;
  })();

  /**
   * Renders a note/chord voice into a track's stereo stem (`trackLeft`, `trackRight`) using
   * free-running oscillator phases, global song-clock LFOs, intra-note windowed detune/filter/noise/drive,
   * and all 20 continuous synth features.
   */
  public static renderVoiceIntoTrackStem(
    trackLeft: Float32Array,
    trackRight: Float32Array,
    startFrame: number,
    noteFrames: number,
    sampleRate: number,
    tempoBpm: number,
    voiceSeed: number,
    item: ContinuousVoiceNote
  ): void {
    const endFrame = Math.min(trackLeft.length, trackRight.length, startFrame + noteFrames);
    const len = endFrame - startFrame;
    if (len <= 0) return;

    const phys = item.event.physics;
    const macros = item.def?.macros || {};
    const patch = (item.event.patch || item.def?.patch || 'supersaw').toLowerCase();

    const isReese = patch.includes('reese');
    const isRiser = patch.includes('riser');
    const isFlutterPatch = patch.includes('flutter');
    const isPluckPatch = patch.includes('pluck') || patch.includes('acid');

    // 1. Analog Component Tolerance / Slop (organic per-voice variance)
    const slopAmount = Math.max(0, Math.min(1, ((phys?.analogSlop ?? macros.slop ?? 18) as number) / 100));
    const slopRand = Math.sin((voiceSeed + 1) * 12.9898) * 43758.5453;
    const slopBipolar = (slopRand - Math.floor(slopRand)) * 2 - 1;
    const slopFreqScalar = Math.pow(2, (slopBipolar * 3.5 * slopAmount) / 1200);
    const slopCutoffScalar = 1 + slopBipolar * 0.04 * slopAmount;

    // 2. Unison Voices & Free-Running Initial Phases (prevents laser-click phase cancellation!)
    const baseDetunePct =
      phys?.detune ??
      (macros.unison !== undefined ? Number(macros.unison) : isReese ? 72 : 68);
    const numUnison = isReese ? 3 : 7;
    const unisonPhases = new Float64Array(numUnison);
    const unisonPans = new Float32Array(numUnison);
    const unisonStackRatios = new Float32Array(numUnison);
    const unisonBasePanCos = new Float32Array(numUnison);
    const unisonBasePanSin = new Float32Array(numUnison);

    const stackMode = phys?.stackMode || (patch === 'supersaw' ? 'super' : 'none');
    const staticWidthScalar = (phys?.stereoWidth ?? (macros.width ? Number(macros.width) : 100)) / 100;
    const hasWidthCurve = Boolean(phys?.widthCurve && phys.widthCurve.length >= 2);

    for (let u = 0; u < numUnison; u++) {
      // Deterministic free-running initial phase in [0, 2*PI)
      const pSeed = Math.sin((voiceSeed * 17 + u * 53 + 7) * 78.233) * 43758.5453;
      unisonPhases[u] = (pSeed - Math.floor(pSeed)) * 2 * Math.PI;
      const normPos = numUnison > 1 ? (u / (numUnison - 1)) * 2 - 1 : 0;
      unisonPans[u] = normPos;

      const panPos = Math.max(-1, Math.min(1, item.pan + normPos * 0.75 * staticWidthScalar));
      const panRad = ((panPos + 1) * 0.5) * (Math.PI * 0.5);
      unisonBasePanCos[u] = Math.cos(panRad);
      unisonBasePanSin[u] = Math.sin(panRad);

      if (stackMode === 'octaves' && u >= numUnison - 2) {
        unisonStackRatios[u] = 2.0; // +12st octave layer
      } else if (stackMode === 'fifths' && u === numUnison - 1) {
        unisonStackRatios[u] = 1.4983; // +7st fifth layer
      } else if (stackMode === 'seventh' && u === numUnison - 1) {
        unisonStackRatios[u] = 1.8877; // +11st maj7 layer
      } else {
        unisonStackRatios[u] = 1.0;
      }
    }

    let subPhase = 0;
    let fmModPhase = 0;
    let lpL = 0;
    let bpL = 0;
    let lpR = 0;
    let bpR = 0;
    let pinkState = 0;

    // Comb filter delay line if `.comb()` is active
    const combSamples = phys?.combFreqHz
      ? Math.max(8, Math.min(2048, Math.floor(sampleRate / phys.combFreqHz)))
      : 0;
    const combBufL = combSamples > 0 ? new Float32Array(combSamples) : null;
    const combBufR = combSamples > 0 ? new Float32Array(combSamples) : null;
    let combIdx = 0;

    // Filter Keytracking (scales cutoff with pitch relative to C4 = MIDI 60)
    const keytrackPct = (phys?.keytrack ?? macros.keytrack ?? 35) / 100;
    const keytrackRatio = Math.pow(2, ((item.midi - 60) * keytrackPct) / 12);

    const baseCutoffHz =
      phys?.cutoff ??
      (macros.cutoff !== undefined
        ? macros.cutoff > 127
          ? Number(macros.cutoff)
          : 180 * Math.pow(12000 / 180, Number(macros.cutoff) / 127)
        : isReese
          ? 520
          : 7800);

    const baseRes = phys?.resonance ?? (isPluckPatch ? 3.2 : 1.2);
    const qDamp = Math.max(0.12, Math.min(1.0, 1.0 / Math.max(0.6, baseRes * 0.7)));
    const twoPiOverSr = (2 * Math.PI) / sampleRate;
    const invTwoPi = 1 / (2 * Math.PI);
    const durFrames = Math.max(1, Math.floor(item.durSec * sampleRate));
    const secPerBeat = 60 / Math.max(40, tempoBpm || 120);
    const normFactor = 0.62 / Math.sqrt(numUnison);
    const sawLut = ContinuousSynthEngine.SAW_LUT;
    const sawLutMask = ContinuousSynthEngine.SAW_LUT_MASK;
    const sawLutSize = ContinuousSynthEngine.SAW_LUT_SIZE;

    for (let i = 0; i < len; i++) {
      const absFrame = startFrame + i;
      const songTimeSec = absFrame / sampleRate;
      const t = i / sampleRate;
      const normU = Math.min(1.0, i / durFrames);

      // 3. Amplitude Envelope (supports standard ADSR, .cresc/.dim swells, and .pre_swell reverse suction)
      let ampEnv = 1.0;
      if (phys?.preSwell) {
        if (i <= durFrames) {
          ampEnv = Math.pow(normU, 2.6);
        } else {
          // Razor-clean cut at barline for pre-drop reverse suction
          const rel = (i - durFrames) / Math.max(1, Math.floor(0.025 * sampleRate));
          ampEnv = Math.max(0, 1 - rel);
        }
      } else if (item.swell === 'crescendo' || item.swell === 'diminuendo') {
        const sA = item.startAmp;
        const eA = item.endAmp;
        if (i <= durFrames) {
          ampEnv = sA + (eA - sA) * normU;
        } else {
          const relProg = (i - durFrames) / Math.max(1, len - durFrames);
          ampEnv = eA * Math.pow(Math.max(0, 1 - relProg), 1.6);
        }
      } else {
        const attackSec = isPluckPatch ? 0.003 : 0.008;
        if (t < attackSec) {
          ampEnv = t / attackSec;
        } else if (i <= durFrames) {
          ampEnv = isPluckPatch ? 0.35 + 0.65 * Math.exp(-(t - attackSec) * 6.5) : 0.92;
        } else {
          const relProg = (i - durFrames) / Math.max(1, len - durFrames);
          ampEnv = 0.92 * Math.pow(Math.max(0, 1 - relProg), 1.6);
        }
      }

      // 4. Rhythmic Trance Gate Chopper (`.gate([1, 0, 1, 1, ...])`)
      if (phys?.tranceGate && phys.tranceGate.length > 0) {
        const stepCount = phys.tranceGate.length;
        const exactPos = normU * stepCount;
        const stepIdx = Math.min(stepCount - 1, Math.floor(exactPos));
        const stepFrac = exactPos - stepIdx;
        const gateTarget = phys.tranceGate[stepIdx] > 0 ? 1.0 : 0.08;
        const nextTarget = phys.tranceGate[(stepIdx + 1) % stepCount] > 0 ? 1.0 : 0.08;
        const smoothEdge = stepFrac > 0.82 ? (stepFrac - 0.82) / 0.18 : 0;
        ampEnv *= gateTarget * (1 - smoothEdge) + nextTarget * smoothEdge;
      }

      // 5. Global Song-Clock Flutter LFO (`.flutter(rateHz | [startRate, endRate])`)
      if (phys?.flutterRateHz || isFlutterPatch) {
        let rateHz = phys?.flutterRateHz ?? 12.0;
        if (phys?.flutterCurve && phys.flutterCurve.length >= 2) {
          const c0 = phys.flutterCurve[0];
          const c1 = phys.flutterCurve[phys.flutterCurve.length - 1];
          rateHz = c0 + (c1 - c0) * normU;
        }
        const depth = phys?.flutterDepth ?? 0.65;
        const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * rateHz * songTimeSec);
        ampEnv *= 1 - depth * (1 - lfo);
      }

      // 6. Sample-Accurate Quarter-Note Sidechain Ducking Shaper (`.duck(depth)`)
      const duckDepth = phys?.duckDepth ?? (macros.duck ? Number(macros.duck) / 100 : 0);
      if (duckDepth > 0.01) {
        const beatPhase = (songTimeSec / secPerBeat) % 1.0;
        // S-curve sidechain recovery over each quarter-note beat
        const recovery = beatPhase < 0.04 ? 0.0 : Math.min(1.0, (beatPhase - 0.04) / 0.58);
        const shaped = recovery * recovery * (3 - 2 * recovery);
        ampEnv *= 1 - duckDepth * (1 - shaped);
      }

      // 7. Continuous Pitch Trajectory (MPE / Polyphonic Chord Glide + Pitch Dip + Pluck Zap + Warble + Fine Cents)
      let currentFreq = item.freq * slopFreqScalar;

      if (isRiser) {
        currentFreq *= 1 + normU; // +12st riser sweep
      }

      if (phys?.mpe?.bend && phys.mpe.bend.length > 0) {
        const scaled = normU * (phys.mpe.bend.length - 1);
        const b0 = Math.floor(scaled);
        const b1 = Math.min(phys.mpe.bend.length - 1, b0 + 1);
        const bFrac = scaled - b0;
        const smoothB = bFrac * bFrac * (3 - 2 * bFrac);
        const bendSt = phys.mpe.bend[b0] + (phys.mpe.bend[b1] - phys.mpe.bend[b0]) * smoothB;
        if (bendSt !== 0) currentFreq *= Math.pow(2, bendSt / 12);
      }

      if (phys?.detuneCentsMod) {
        const cents = this.evaluateWindowedModulation(phys.detuneCentsMod, normU, 0);
        if (cents !== 0) currentFreq *= Math.pow(2, cents / 1200);
      }

      if (phys?.pluckDecayMs && phys.pluckSemitones) {
        const decaySec = phys.pluckDecayMs / 1000;
        const zapSt = phys.pluckSemitones * Math.exp(-t / Math.max(0.002, decaySec));
        currentFreq *= Math.pow(2, zapSt / 12);
      }

      if (phys?.warbleDepth) {
        const wRate = phys.warbleRateHz ?? 3.2;
        const wCents = (phys.warbleDepth * 0.45) * Math.sin(2 * Math.PI * wRate * songTimeSec);
        currentFreq *= 1 + wCents * 0.00057762265;
      }

      // 8. Intra-Note Windowed Unison Detune Spread (`.detune(85%, 0.4..0.85)` or `.detune([0, 90, 20])`)
      const activeDetunePct = phys?.detuneMod
        ? this.evaluateWindowedModulation(phys.detuneMod, normU, 8)
        : baseDetunePct;
      const maxSpreadCents = (activeDetunePct / 100) * (isReese ? 34 : 42);

      // 9. Stereo Width Trajectory (`.width([10, 100])` or `width=120`)
      let widthScalar = staticWidthScalar;
      if (hasWidthCurve && phys?.widthCurve) {
        const w0 = phys.widthCurve[0];
        const w1 = phys.widthCurve[phys.widthCurve.length - 1];
        widthScalar = (w0 + (w1 - w0) * normU) / 100;
      }

      // 10. Linear FM & Hard-Sync Ratio
      let fmModOffset = 0;
      if (phys?.fmAmount && phys.fmAmount > 0) {
        const fmRatio = phys.fmRatio ?? 2.0;
        fmModPhase += currentFreq * fmRatio * twoPiOverSr;
        fmModOffset = Math.sin(fmModPhase) * phys.fmAmount * 2.5;
      }

      let syncRatio = phys?.syncRatio ?? 1.0;
      if (phys?.syncSweep) {
        syncRatio = phys.syncSweep[0] + (phys.syncSweep[1] - phys.syncSweep[0]) * normU;
      }

      // 11. Sum Multi-Voice Unison Stack
      let sigL = 0;
      let sigR = 0;

      for (let u = 0; u < numUnison; u++) {
        const normPos = unisonPans[u]; // -1 .. +1
        const voiceCents = normPos * maxSpreadCents;
        const centRatio = 1 + voiceCents * 0.00057762265 + voiceCents * voiceCents * 0.0000001668;
        const voiceFreq = currentFreq * unisonStackRatios[u] * centRatio;

        unisonPhases[u] += voiceFreq * twoPiOverSr;
        const syncedPhase = unisonPhases[u] * syncRatio;

        let oscSample = 0;
        if (phys?.pwmDuty) {
          const wrappedPhase = (syncedPhase * invTwoPi) % 1.0;
          const pwmRate = phys.pwmRateHz ?? 1.8;
          const duty = Math.max(
            0.05,
            Math.min(0.95, phys.pwmDuty + 0.22 * Math.sin(2 * Math.PI * pwmRate * songTimeSec))
          );
          oscSample = wrappedPhase < duty ? 0.85 : -0.85;
        } else {
          // Rich band-tempered sawtooth + FM phase offset via precomputed 2048-point LUT
          const lutIdx = (((syncedPhase + fmModOffset) * invTwoPi * sawLutSize) | 0) & sawLutMask;
          oscSample = sawLut[lutIdx];
        }

        if (phys?.waveWarpMode === 'mirror') {
          oscSample = Math.abs(oscSample) * 2 - 0.8;
        } else if (phys?.waveWarpMode === 'bend') {
          const amt = phys.waveWarpAmount ?? 0.5;
          oscSample = Math.tanh(oscSample * (1 + amt * 2.5));
        }

        if (!hasWidthCurve) {
          sigL += oscSample * unisonBasePanCos[u];
          sigR += oscSample * unisonBasePanSin[u];
        } else {
          const panPos = Math.max(-1, Math.min(1, item.pan + normPos * 0.75 * widthScalar));
          sigL += oscSample * 0.7071 * (1 - panPos * 0.5);
          sigR += oscSample * 0.7071 * (1 + panPos * 0.5);
        }
      }

      sigL *= normFactor;
      sigR *= normFactor;

      // 12. Phase-Locked Mono Sub-Oscillator (Essential for Reese Bass & Supersaw weight)
      const subLevel =
        macros.sub_level !== undefined
          ? Number(macros.sub_level) / 100
          : isReese
            ? 0.85
            : 0.42;
      if (subLevel > 0.01) {
        subPhase += currentFreq * 0.5 * twoPiOverSr;
        const subSample = Math.sin(subPhase) * subLevel * 0.55;
        sigL += subSample;
        sigR += subSample;
      }

      // 13. Ring Modulation (`.ring(amount, freqHz)`)
      if (phys?.ringAmount && phys.ringAmount > 0) {
        const rFreq = phys.ringFreqHz ?? 220;
        const ringCarrier = Math.sin(2 * Math.PI * rFreq * songTimeSec);
        const rMix = Math.min(1, phys.ringAmount);
        sigL = sigL * (1 - rMix) + sigL * ringCarrier * rMix;
        sigR = sigR * (1 - rMix) + sigR * ringCarrier * rMix;
      }

      // 14. Windowed White / Pink / Breath Noise Layer (`.noise(level, color, start..end)`)
      const baseNoise = phys?.noiseLevel ?? (macros.noise ? Number(macros.noise) / 100 : 0);
      const activeNoise = phys?.noiseMod
        ? this.evaluateWindowedModulation(phys.noiseMod, normU, 0)
        : baseNoise;
      if (activeNoise > 0.005) {
        const nRand = Math.sin((absFrame + voiceSeed * 97) * 12.9898) * 43758.5453;
        const white = (nRand - Math.floor(nRand)) * 2 - 1;
        pinkState = 0.92 * pinkState + 0.08 * white;
        const noiseSig =
          phys?.noiseColor === 'pink'
            ? pinkState * 2.2
            : phys?.noiseColor === 'breath'
              ? white * Math.exp(-t * 14)
              : white * 0.45;
        sigL += noiseSig * activeNoise;
        sigR += noiseSig * activeNoise;
      }

      // 15. Intra-Note Filter Cutoff Trajectory + Keytracking + SVF Resonance
      const modCutoffHz = phys?.cutoffMod
        ? this.evaluateWindowedModulation(phys.cutoffMod, normU, baseCutoffHz)
        : phys?.preSwell
          ? 240 + (baseCutoffHz - 240) * Math.pow(normU, 2.2)
          : baseCutoffHz;
      const effectiveCutoff = Math.max(
        60,
        Math.min(15500, modCutoffHz * keytrackRatio * slopCutoffScalar)
      );
      const svfF = Math.min(0.85, 2 * Math.sin((Math.PI * effectiveCutoff) / sampleRate));

      const hpL = sigL - lpL - qDamp * bpL;
      bpL += svfF * hpL;
      lpL += svfF * bpL;

      const hpR = sigR - lpR - qDamp * bpR;
      bpR += svfF * hpR;
      lpR += svfF * bpR;

      let outL = lpL;
      let outR = lpR;

      // 16. Comb Filter Flanging (`.comb(freqHz, feedback)`)
      if (combBufL && combBufR && combSamples > 0) {
        const fb = phys?.combFeedback ?? 0.65;
        const dL = combBufL[combIdx];
        const dR = combBufR[combIdx];
        outL = outL * 0.65 + dL * 0.55;
        outR = outR * 0.65 + dR * 0.55;
        combBufL[combIdx] = Math.tanh(lpL + dL * fb);
        combBufR[combIdx] = Math.tanh(lpR + dR * fb);
        combIdx = (combIdx + 1) % combSamples;
      }

      // 17. Intra-Note Windowed Saturation Drive (`.drive([0.1, 0.9])`)
      if (phys?.driveMod) {
        const driveVal = this.evaluateWindowedModulation(phys.driveMod, normU, 0);
        const driveScalar = 1 + (driveVal > 1 ? driveVal / 100 : driveVal) * 3.2;
        outL = Math.tanh(outL * driveScalar);
        outR = Math.tanh(outR * driveScalar);
      } else if (isReese) {
        outL = Math.tanh(outL * 1.65);
        outR = Math.tanh(outR * 1.65);
      }

      // 18. Harmonic Air / Top-End Presence Exciter (`.air(75%)`)
      const airPct = (phys?.airSheen ?? (macros.air ? Number(macros.air) : patch === 'supersaw' ? 55 : 0)) / 100;
      if (airPct > 0.01) {
        outL += Math.tanh(hpL * 2.4) * airPct * 0.45;
        outR += Math.tanh(hpR * 2.4) * airPct * 0.45;
      }

      const finalGain = ampEnv * item.amp * 0.78;
      trackLeft[absFrame] += outL * finalGain;
      trackRight[absFrame] += outR * finalGain;
    }

    // 19. Stereo Haas Micro-Delay Widening (`.haas(12ms)`)
    if (phys?.haasDelayMs && phys.haasDelayMs > 0) {
      const delayFrames = Math.min(1500, Math.max(1, Math.floor((phys.haasDelayMs / 1000) * sampleRate)));
      const copyR = trackRight.slice(startFrame, endFrame);
      for (let i = delayFrames; i < len; i++) {
        trackRight[startFrame + i] = copyR[i - delayFrames];
      }
    }
  }

  /**
   * Processes a summed Track Stem through Bass-Mono Crossover (`< 120 Hz` mono lock)
   * so wide supersaw and Reese tracks retain 100% phase-solid low-end punch.
   */
  public static applyTrackBassMonoCrossover(
    left: Float32Array,
    right: Float32Array,
    sampleRate: number,
    crossoverHz: number = 120
  ): void {
    const alpha = Math.min(0.25, (2 * Math.PI * crossoverHz) / sampleRate);
    let lowL = 0;
    let lowR = 0;

    for (let i = 0; i < left.length; i++) {
      lowL += alpha * (left[i] - lowL);
      lowR += alpha * (right[i] - lowR);
      const highL = left[i] - lowL;
      const highR = right[i] - lowR;
      const monoSub = 0.5 * (lowL + lowR);
      left[i] = monoSub + highL;
      right[i] = monoSub + highR;
    }
  }
}
