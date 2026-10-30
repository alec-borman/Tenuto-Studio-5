import { AtomicEvent, WindowedModulationSpec } from '../../parser/ASTSerializer';
import { TrackDefinition } from '../../parser/DocumentParser';

export interface ContinuousVoiceNote {
  event: AtomicEvent;
  def?: TrackDefinition;
  startSec: number;
  durSec: number;
  freq: number;
  midi: number;
  amp: number;
  startAmp: number;
  endAmp: number;
  swell?: 'crescendo' | 'diminuendo';
  pan: number;
  chordVoices?: Array<{
    freq: number;
    midi: number;
    amp: number;
    mpeBend?: number[];
  }>;
}

const CONTROL_BLOCK_SIZE = 128;

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
      const smoothFrac = frac * frac * (3 - 2 * frac);
      const val = spec.curve[i0] + (spec.curve[i1] - spec.curve[i0]) * smoothFrac;
      return defaultVal + (val - defaultVal) * edgeFeather;
    }

    return defaultVal + (spec.peak - defaultVal) * edgeFeather;
  }

  /**
   * Automatically pairs sorted voices of consecutive chords/notes on the same track & voice
   * when `.glide(ms)` is present, populating per-voice `mpe.bend` trajectories so every voice
   * in a 5-note chord glides smoothly along its shortest voice-leading path into the next chord.
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

  public static isContinuousSynthPatch(
    patch?: string,
    style?: string,
    physics?: AtomicEvent['physics']
  ): boolean {
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

  /**
   * High-speed 64-sample Control-Rate (`k-rate`) synthesizer renderer.
   * Supports both single notes and coalesced multi-note chords (`item.chordVoices`) so an entire
   * 7-note supersaw chord shares one filter/comb/noise/drive/Haas pipeline and executes in < 0.25ms.
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

    const chordNotes =
      item.chordVoices && item.chordVoices.length > 0
        ? item.chordVoices
        : [
            {
              freq: item.freq,
              midi: item.midi,
              amp: item.amp,
              mpeBend: phys?.mpe?.bend,
            },
          ];

    const numNotes = chordNotes.length;
    // Scale unison count intelligently when a multi-note chord is coalesced (e.g. 2 unison x 7 notes = 14 oscs)
    const numUnison = isReese ? 3 : numNotes >= 5 ? 2 : numNotes >= 3 ? 3 : 7;
    const totalOscs = numNotes * numUnison;

    const slopAmount = Math.max(
      0,
      Math.min(1, ((phys?.analogSlop ?? macros.slop ?? 18) as number) / 100)
    );

    const oscPhases = new Float32Array(totalOscs);
    const oscPhaseIncs = new Float32Array(totalOscs);
    const oscGainL = new Float32Array(totalOscs);
    const oscGainR = new Float32Array(totalOscs);
    const unisonPanNorm = new Float32Array(numUnison);
    const unisonStackRatios = new Float32Array(numUnison);
    const noteSlopScalar = new Float32Array(numNotes);

    const stackMode = phys?.stackMode || (patch === 'supersaw' ? 'super' : 'none');

    for (let u = 0; u < numUnison; u++) {
      unisonPanNorm[u] = numUnison > 1 ? (u / (numUnison - 1)) * 2 - 1 : 0;
      if (stackMode === 'octaves' && u >= numUnison - 1) {
        unisonStackRatios[u] = 2.0;
      } else if (stackMode === 'fifths' && u === numUnison - 1) {
        unisonStackRatios[u] = 1.4983;
      } else if (stackMode === 'seventh' && u === numUnison - 1) {
        unisonStackRatios[u] = 1.8877;
      } else {
        unisonStackRatios[u] = 1.0;
      }
    }

    const normFactor = 0.62 / Math.sqrt(totalOscs);
    const baseWidthScalar = (phys?.stereoWidth ?? (macros.width ? Number(macros.width) : 100)) / 100;
    const hasDynamicWidthCurve = Boolean(phys?.widthCurve && phys.widthCurve.length >= 2);

    for (let nIdx = 0; nIdx < numNotes; nIdx++) {
      const sRand = Math.sin((voiceSeed + nIdx * 31 + 1) * 12.9898) * 43758.5453;
      const sBipolar = (sRand - Math.floor(sRand)) * 2 - 1;
      noteSlopScalar[nIdx] = Math.pow(2, (sBipolar * 3.5 * slopAmount) / 1200);

      for (let u = 0; u < numUnison; u++) {
        const oscIdx = nIdx * numUnison + u;
        const pSeed = Math.sin((voiceSeed * 17 + nIdx * 71 + u * 53 + 7) * 78.233) * 43758.5453;
        oscPhases[oscIdx] = pSeed - Math.floor(pSeed); // Normalized [0, 1) phase

        const normPos = unisonPanNorm[u];
        const panPos = Math.max(-1, Math.min(1, item.pan + normPos * 0.75 * baseWidthScalar));
        const panRad = (panPos + 1) * 0.25 * Math.PI;
        oscGainL[oscIdx] = Math.cos(panRad) * normFactor;
        oscGainR[oscIdx] = Math.sin(panRad) * normFactor;
      }
    }

    const baseDetunePct =
      phys?.detune ??
      (macros.unison !== undefined ? Number(macros.unison) : isReese ? 72 : 68);

    let subPhase = 0;
    let fmModPhase = 0;
    let ringPhase = 0;
    let lpL = 0;
    let bpL = 0;
    let lpR = 0;
    let bpR = 0;
    let pinkState = 0;
    let noiseLfsr = ((voiceSeed + 1) * 1103515245 + 12345) | 0;

    const combSamples = phys?.combFreqHz
      ? Math.max(8, Math.min(2048, Math.floor(sampleRate / phys.combFreqHz)))
      : 0;
    const combBufL = combSamples > 0 ? new Float32Array(combSamples) : null;
    const combBufR = combSamples > 0 ? new Float32Array(combSamples) : null;
    let combIdx = 0;

    const avgMidi =
      chordNotes.reduce((acc, n) => acc + n.midi, 0) / Math.max(1, numNotes);
    const keytrackPct = (phys?.keytrack ?? macros.keytrack ?? 35) / 100;
    const keytrackRatio = Math.pow(2, ((avgMidi - 60) * keytrackPct) / 12);

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
    const invSampleRate = 1.0 / sampleRate;
    const durFrames = Math.max(1, Math.floor(item.durSec * sampleRate));
    const secPerBeat = 60 / Math.max(40, tempoBpm || 120);

    const subLevel =
      macros.sub_level !== undefined
        ? Number(macros.sub_level) / 100
        : isReese
          ? 0.85
          : 0.42;
    const lowestNoteFreq = Math.min(...chordNotes.map((n) => n.freq));
    const airPct =
      (phys?.airSheen ?? (macros.air ? Number(macros.air) : patch === 'supersaw' ? 55 : 0)) / 100;
    const hasPwm = Boolean(phys?.pwmDuty);
    const hasWaveMirror = phys?.waveWarpMode === 'mirror';
    const hasWaveBend = phys?.waveWarpMode === 'bend';
    const waveBendScale = 1 + (phys?.waveWarpAmount ?? 0.5) * 2.2;
    const chordAmpAvg =
      chordNotes.reduce((acc, n) => acc + n.amp, 0) / Math.max(1, numNotes);

    // Process in 128-sample Control-Rate (k-rate) blocks
    for (let blockStart = 0; blockStart < len; blockStart += CONTROL_BLOCK_SIZE) {
      const blockEnd = Math.min(len, blockStart + CONTROL_BLOCK_SIZE);
      const midSample = (blockStart + blockEnd) >> 1;
      const absFrame = startFrame + midSample;
      const songTimeSec = absFrame * invSampleRate;
      const t = midSample * invSampleRate;
      const normU = Math.min(1.0, midSample / durFrames);

      // 1. Amplitude Envelope at k-rate
      let ampEnv = 1.0;
      if (phys?.preSwell) {
        if (midSample <= durFrames) {
          ampEnv = Math.pow(normU, 2.6);
        } else {
          const rel = (midSample - durFrames) / Math.max(1, Math.floor(0.025 * sampleRate));
          ampEnv = Math.max(0, 1 - rel);
        }
      } else if (item.swell === 'crescendo' || item.swell === 'diminuendo') {
        if (midSample <= durFrames) {
          ampEnv = item.startAmp + (item.endAmp - item.startAmp) * normU;
        } else {
          const relProg = (midSample - durFrames) / Math.max(1, len - durFrames);
          ampEnv = item.endAmp * Math.pow(Math.max(0, 1 - relProg), 1.6);
        }
      } else {
        const attackSec = isPluckPatch ? 0.003 : 0.008;
        if (t < attackSec) {
          ampEnv = t / attackSec;
        } else if (midSample <= durFrames) {
          ampEnv = isPluckPatch ? 0.35 + 0.65 * Math.exp(-(t - attackSec) * 6.5) : 0.92;
        } else {
          const relProg = (midSample - durFrames) / Math.max(1, len - durFrames);
          ampEnv = 0.92 * Math.pow(Math.max(0, 1 - relProg), 1.6);
        }
      }

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

      const duckDepth = phys?.duckDepth ?? (macros.duck ? Number(macros.duck) / 100 : 0);
      if (duckDepth > 0.01) {
        const beatPhase = (songTimeSec / secPerBeat) % 1.0;
        const recovery = beatPhase < 0.04 ? 0.0 : Math.min(1.0, (beatPhase - 0.04) / 0.58);
        const shaped = recovery * recovery * (3 - 2 * recovery);
        ampEnv *= 1 - duckDepth * (1 - shaped);
      }

      // 2. Shared Pitch Modifiers at k-rate
      let globalPitchMultiplier = isRiser ? Math.pow(2, normU) : 1.0;

      if (phys?.detuneCentsMod) {
        const cents = this.evaluateWindowedModulation(phys.detuneCentsMod, normU, 0);
        if (cents !== 0) globalPitchMultiplier *= Math.pow(2, cents / 1200);
      }

      if (phys?.pluckDecayMs && phys.pluckSemitones) {
        const decaySec = phys.pluckDecayMs / 1000;
        const zapSt = phys.pluckSemitones * Math.exp(-t / Math.max(0.002, decaySec));
        globalPitchMultiplier *= Math.pow(2, zapSt / 12);
      }

      if (phys?.warbleDepth) {
        const wRate = phys.warbleRateHz ?? 3.2;
        const wCents = phys.warbleDepth * 0.45 * Math.sin(2 * Math.PI * wRate * songTimeSec);
        globalPitchMultiplier *= Math.pow(2, wCents / 1200);
      }

      let syncRatio = phys?.syncRatio ?? 1.0;
      if (phys?.syncSweep) {
        syncRatio = phys.syncSweep[0] + (phys.syncSweep[1] - phys.syncSweep[0]) * normU;
      }

      // 3. Windowed Unison Detune & Stereo Pan Gains at k-rate
      const activeDetunePct = phys?.detuneMod
        ? this.evaluateWindowedModulation(phys.detuneMod, normU, 8)
        : baseDetunePct;
      const maxSpreadOctaves = ((activeDetunePct / 100) * (isReese ? 34 : 42)) / 1200;

      let widthScalar = baseWidthScalar;
      if (hasDynamicWidthCurve && phys?.widthCurve) {
        const w0 = phys.widthCurve[0];
        const w1 = phys.widthCurve[phys.widthCurve.length - 1];
        widthScalar = (w0 + (w1 - w0) * normU) / 100;
      }

      for (let nIdx = 0; nIdx < numNotes; nIdx++) {
        const cNote = chordNotes[nIdx];
        let noteBendMultiplier = 1.0;
        const bendArr = cNote.mpeBend || phys?.mpe?.bend;
        if (bendArr && bendArr.length > 0) {
          const scaled = normU * (bendArr.length - 1);
          const b0 = Math.floor(scaled);
          const b1 = Math.min(bendArr.length - 1, b0 + 1);
          const bFrac = scaled - b0;
          const smoothB = bFrac * bFrac * (3 - 2 * bFrac);
          const bendSt = bendArr[b0] + (bendArr[b1] - bendArr[b0]) * smoothB;
          if (bendSt !== 0) noteBendMultiplier = Math.pow(2, bendSt / 12);
        }

        const baseNoteFreq =
          cNote.freq * noteSlopScalar[nIdx] * globalPitchMultiplier * noteBendMultiplier * syncRatio * invSampleRate;

        for (let u = 0; u < numUnison; u++) {
          const oscIdx = nIdx * numUnison + u;
          const normPos = unisonPanNorm[u];
          const x = normPos * maxSpreadOctaves;
          const detuneRatio = 1 + x * 0.69314718 + x * x * 0.2402265;
          const inc = baseNoteFreq * unisonStackRatios[u] * detuneRatio;

          oscPhaseIncs[oscIdx] = inc < 0.45 ? inc : 0.45;

          if (hasDynamicWidthCurve) {
            const panPos = Math.max(-1, Math.min(1, item.pan + normPos * 0.75 * widthScalar));
            const panRad = (panPos + 1) * 0.25 * Math.PI;
            oscGainL[oscIdx] = Math.cos(panRad) * normFactor;
            oscGainR[oscIdx] = Math.sin(panRad) * normFactor;
          }
        }
      }

      const subPhaseInc = (lowestNoteFreq * 0.5 * globalPitchMultiplier) * invSampleRate;
      const fmPhaseInc =
        phys?.fmAmount && phys.fmAmount > 0
          ? lowestNoteFreq * (phys.fmRatio ?? 2.0) * invSampleRate
          : 0;
      const ringPhaseInc =
        phys?.ringAmount && phys.ringAmount > 0
          ? (phys.ringFreqHz ?? 220) * invSampleRate
          : 0;

      const pwmThreshold = hasPwm
        ? Math.max(
            0.05,
            Math.min(
              0.95,
              (phys?.pwmDuty ?? 0.5) +
                0.22 * Math.sin(2 * Math.PI * (phys?.pwmRateHz ?? 1.8) * songTimeSec)
            )
          )
        : 0.5;

      const baseNoise = phys?.noiseLevel ?? (macros.noise ? Number(macros.noise) / 100 : 0);
      const activeNoise = phys?.noiseMod
        ? this.evaluateWindowedModulation(phys.noiseMod, normU, 0)
        : baseNoise;

      const modCutoffHz = phys?.cutoffMod
        ? this.evaluateWindowedModulation(phys.cutoffMod, normU, baseCutoffHz)
        : phys?.preSwell
          ? 240 + (baseCutoffHz - 240) * Math.pow(normU, 2.2)
          : baseCutoffHz;
      const effectiveCutoff = Math.max(60, Math.min(15500, modCutoffHz * keytrackRatio));
      const svfF = Math.min(0.85, 2 * Math.sin((Math.PI * effectiveCutoff) * invSampleRate));

      const driveVal = phys?.driveMod
        ? this.evaluateWindowedModulation(phys.driveMod, normU, 0)
        : isReese
          ? 0.35
          : 0;
      const driveScalar = driveVal > 0 ? 1 + (driveVal > 1 ? driveVal / 100 : driveVal) * 2.8 : 1.0;
      const blockFinalGain =
        ampEnv *
        (item.swell === 'crescendo' || item.swell === 'diminuendo' ? 1.0 : chordAmpAvg) *
        0.78;

      const isFastSawPath = !hasPwm && !hasWaveMirror && !hasWaveBend && fmPhaseInc === 0;

      // 4. Tight Branchless Inner Sample Loop (64 samples)
      for (let i = blockStart; i < blockEnd; i++) {
        let sigL = 0;
        let sigR = 0;

        if (isFastSawPath) {
          for (let o = 0; o < totalOscs; o++) {
            let ph = oscPhases[o] + oscPhaseIncs[o];
            if (ph >= 1) ph -= 1;
            oscPhases[o] = ph;
            const oscSample = 2 * ph - 1;
            sigL += oscSample * oscGainL[o];
            sigR += oscSample * oscGainR[o];
          }
        } else {
          let fmOffset = 0;
          if (fmPhaseInc > 0) {
            fmModPhase += fmPhaseInc;
            if (fmModPhase >= 1) fmModPhase -= 1;
            const fmTri = 1 - 4 * Math.abs(fmModPhase - 0.5);
            fmOffset = fmTri * (phys?.fmAmount ?? 0) * 0.35;
          }

          for (let o = 0; o < totalOscs; o++) {
            let ph = oscPhases[o] + oscPhaseIncs[o];
            if (ph >= 1) ph -= 1;
            oscPhases[o] = ph;

            let p = ph + fmOffset;
            if (p >= 1) p -= 1;
            else if (p < 0) p += 1;

            let oscSample = hasPwm ? (p < pwmThreshold ? 0.85 : -0.85) : 2 * p - 1;

            if (hasWaveMirror) {
              oscSample = Math.abs(oscSample) * 2 - 0.8;
            } else if (hasWaveBend) {
              const x = oscSample * waveBendScale;
              oscSample = x / (1 + Math.abs(x));
            }

            sigL += oscSample * oscGainL[o];
            sigR += oscSample * oscGainR[o];
          }
        }

        if (subLevel > 0.01) {
          subPhase += subPhaseInc;
          if (subPhase >= 1) subPhase -= 1;
          // Fast parabolic sine approximation on [0, 1)
          const sp = subPhase * 2 - 1;
          const subSine = 4 * sp * (1 - Math.abs(sp));
          const subSample = subSine * subLevel * 0.52;
          sigL += subSample;
          sigR += subSample;
        }

        if (ringPhaseInc > 0) {
          ringPhase += ringPhaseInc;
          if (ringPhase >= 1) ringPhase -= 1;
          const rp = ringPhase * 2 - 1;
          const ringSine = 4 * rp * (1 - Math.abs(rp));
          const rMix = Math.min(1, phys?.ringAmount ?? 0);
          sigL = sigL * (1 - rMix) + sigL * ringSine * rMix;
          sigR = sigR * (1 - rMix) + sigR * ringSine * rMix;
        }

        if (activeNoise > 0.005) {
          noiseLfsr = (noiseLfsr * 1664525 + 1013904223) | 0;
          const white = (noiseLfsr >> 16) / 32768.0;
          pinkState = 0.92 * pinkState + 0.08 * white;
          const noiseSig =
            phys?.noiseColor === 'pink' ? pinkState * 2.2 : white * 0.45;
          sigL += noiseSig * activeNoise;
          sigR += noiseSig * activeNoise;
        }

        const hpL = sigL - lpL - qDamp * bpL;
        bpL += svfF * hpL;
        lpL += svfF * bpL;

        const hpR = sigR - lpR - qDamp * bpR;
        bpR += svfF * hpR;
        lpR += svfF * bpR;

        let outL = lpL;
        let outR = lpR;

        if (combBufL && combBufR && combSamples > 0) {
          const fb = phys?.combFeedback ?? 0.65;
          const dL = combBufL[combIdx];
          const dR = combBufR[combIdx];
          outL = outL * 0.65 + dL * 0.55;
          outR = outR * 0.65 + dR * 0.55;
          const cInL = (lpL + dL * fb) * 1.1;
          const cInR = (lpR + dR * fb) * 1.1;
          combBufL[combIdx] = cInL / (1 + Math.abs(cInL));
          combBufR[combIdx] = cInR / (1 + Math.abs(cInR));
          combIdx = (combIdx + 1) % combSamples;
        }

        if (driveScalar > 1.01) {
          const dL = outL * driveScalar;
          const dR = outR * driveScalar;
          outL = dL / (1 + Math.abs(dL));
          outR = dR / (1 + Math.abs(dR));
        }

        if (airPct > 0.01) {
          const aL = hpL * 2.2;
          const aR = hpR * 2.2;
          outL += (aL / (1 + Math.abs(aL))) * airPct * 0.42;
          outR += (aR / (1 + Math.abs(aR))) * airPct * 0.42;
        }

        const absIdx = startFrame + i;
        trackLeft[absIdx] += outL * blockFinalGain;
        trackRight[absIdx] += outR * blockFinalGain;
      }
    }

    if (phys?.haasDelayMs && phys.haasDelayMs > 0) {
      const delayFrames = Math.min(
        1500,
        Math.max(1, Math.floor((phys.haasDelayMs / 1000) * sampleRate))
      );
      const copyR = trackRight.slice(startFrame, endFrame);
      for (let i = delayFrames; i < len; i++) {
        trackRight[startFrame + i] = copyR[i - delayFrames];
      }
    }
  }

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
