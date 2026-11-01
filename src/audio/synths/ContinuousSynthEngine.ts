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

export const FORMANT_VOWEL_TABLE: Record<string, [number, number]> = {
  a: [730, 1090],
  ah: [730, 1090],
  e: [530, 1840],
  eh: [530, 1840],
  i: [270, 2290],
  ee: [270, 2290],
  o: [570, 840],
  oh: [490, 880],
  ooh: [320, 800],
  oo: [320, 800],
  u: [300, 870],
};

/**
 * Returns the [F1, F2] formant peak frequencies in Hz for Hauntology / vowel filter modulation.
 */
export function computeFormantVowelFrequencies(vowel: string): [number, number] {
  const key = (vowel || 'a').trim().toLowerCase();
  return FORMANT_VOWEL_TABLE[key] ?? [490, 880];
}

/**
 * Clamps a normalized intra-note curve window (`curveStartNorm..curveEndNorm`) so its scheduled
 * `setValueCurveAtTime` / modulation window completes at least `6ms` (`0.006s`) before a trailing
 * `.glide()` ramp begins—preventing WebAudio `NotSupportedError` overlapping automation exceptions.
 */
export function clampCurveWindowBeforeGlide(
  noteStartSec: number,
  noteDurationSec: number,
  curveStartNorm: number = 0,
  curveEndNorm: number = 1,
  glideDurationSec: number = 0
): { startSec: number; durationSec: number } {
  const safeDur = Math.max(0.02, noteDurationSec);
  const glideReserve =
    glideDurationSec > 0 ? Math.min(safeDur * 0.65, glideDurationSec + 0.006) : 0;
  const maxEndSec = noteStartSec + Math.max(0.01, safeDur - glideReserve);
  const rawStartSec = noteStartSec + Math.max(0, Math.min(0.95, curveStartNorm)) * safeDur;
  const rawEndSec =
    noteStartSec + Math.max(curveStartNorm + 0.02, Math.min(1, curveEndNorm)) * safeDur;
  const clampedEndSec = Math.min(rawEndSec, maxEndSec);
  const clampedStartSec = Math.min(rawStartSec, clampedEndSec - 0.005);
  return {
    startSec: Math.max(noteStartSec, clampedStartSec),
    durationSec: Math.max(0.005, clampedEndSec - Math.max(noteStartSec, clampedStartSec)),
  };
}

const PERIODIC_WAVE_CACHE = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();
const WARPED_WAVE_LOOKUP_CACHE = new Map<string, Float32Array>();

/**
 * Returns a cached `PeriodicWave` for `.warp_wave(mode, amount)` per `BaseAudioContext`
 * keyed by `${mode}:${Math.round(amount)}` so wavetables are never regenerated per note.
 */
export function getOrCreateWarpedPeriodicWave(
  ctx: BaseAudioContext,
  mode: string = 'bend',
  amount: number = 50
): PeriodicWave | null {
  let ctxMap = PERIODIC_WAVE_CACHE.get(ctx);
  if (!ctxMap) {
    ctxMap = new Map<string, PeriodicWave>();
    PERIODIC_WAVE_CACHE.set(ctx, ctxMap);
  }
  const normAmount = Math.round(amount <= 1 ? amount * 100 : amount);
  const key = `${(mode || 'bend').toLowerCase()}:${normAmount}`;
  const cached = ctxMap.get(key);
  if (cached) return cached;

  if (typeof ctx.createPeriodicWave !== 'function') return null;
  const harmonics = 32;
  const real = new Float32Array(harmonics);
  const imag = new Float32Array(harmonics);
  const amt01 = Math.max(0, Math.min(1, normAmount / 100));
  for (let h = 1; h < harmonics; h++) {
    const baseSaw = 1 / h;
    imag[h] =
      mode === 'mirror'
        ? h % 2 === 1
          ? baseSaw * (1 + amt01 * 0.6)
          : baseSaw * (1 - amt01 * 0.5)
        : baseSaw * Math.pow(h, -amt01 * 0.35);
  }
  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false });
  ctxMap.set(key, wave);
  return wave;
}

export function getOrCreateWarpedWaveLookup(mode: string, amount: number): Float32Array {
  const normAmount = Math.round(amount <= 1 ? amount * 100 : amount);
  const key = `${(mode || 'bend').toLowerCase()}:${normAmount}`;
  const existing = WARPED_WAVE_LOOKUP_CACHE.get(key);
  if (existing) return existing;

  const size = 256;
  const table = new Float32Array(size);
  const scale = 1 + (normAmount / 100) * 2.2;
  for (let i = 0; i < size; i++) {
    const p = i / size;
    const raw = 2 * p - 1;
    if (mode === 'mirror') {
      table[i] = Math.abs(raw) * 2 - 0.8;
    } else {
      const x = raw * scale;
      table[i] = x / (1 + Math.abs(x));
    }
  }
  WARPED_WAVE_LOOKUP_CACHE.set(key, table);
  return table;
}

export class ContinuousSynthEngine {
  public static computeFormantVowelFrequencies = computeFormantVowelFrequencies;
  public static clampCurveWindowBeforeGlide = clampCurveWindowBeforeGlide;
  public static getOrCreateWarpedPeriodicWave = getOrCreateWarpedPeriodicWave;
  /**
   * Evaluates a WindowedModulationSpec (`peak`, `startNorm..endNorm`, or multi-point `curve`)
   * at normalized note progress `u` in `[0.0, 1.0]`, applying smooth cosine feathering at window
   * edges so mid-note detune/filter/noise/drive activations never click.
   */
  public static evaluateWindowedModulation(
    spec: WindowedModulationSpec | undefined,
    u: number,
    defaultVal: number = 0,
    noteDurationSec: number = 0,
    glideDurationSec: number = 0
  ): number {
    if (!spec) return defaultVal;
    const clampedU = Math.max(0, Math.min(1, u));

    let startNorm = spec.startNorm;
    let endNorm = spec.endNorm;
    if (glideDurationSec > 0 && noteDurationSec > 0) {
      const clampedWin = clampCurveWindowBeforeGlide(
        0,
        noteDurationSec,
        spec.startNorm,
        spec.endNorm,
        glideDurationSec
      );
      startNorm = clampedWin.startSec / Math.max(0.02, noteDurationSec);
      endNorm = (clampedWin.startSec + clampedWin.durationSec) / Math.max(0.02, noteDurationSec);
    }

    if (clampedU < startNorm || clampedU > endNorm) {
      return defaultVal;
    }

    const windowSpan = Math.max(1e-5, endNorm - startNorm);
    const localU = (clampedU - startNorm) / windowSpan;

    let edgeFeather = 1.0;
    const featherWidth = 0.12;
    if (startNorm > 0.001 && localU < featherWidth) {
      edgeFeather = 0.5 * (1 - Math.cos((Math.PI * localU) / featherWidth));
    } else if (endNorm < 0.999 && localU > 1 - featherWidth) {
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
      p === 'acid_lead' ||
      p === 'saw_lead' ||
      p === 'ribbon_cluster_8' ||
      p === 'tape_nostalgia_pad' ||
      p === 'cybernetic_eoc' ||
      p === 'west_coast_200' ||
      p === 'morph_analog_12' ||
      p === 'vintage_ladder_8' ||
      p === 'hybrid_motor_12' ||
      p === 'binaural_hybrid_20' ||
      p === 'state_variable_8' ||
      p === 'vintage_poly_10' ||
      p === 'stepped_wavetable_24' ||
      p === 'spectral_hybrid_16' ||
      p === 'granular_workstation_80' ||
      p === 'swarmatron' ||
      p === 'hauntology_pad' ||
      p === 'buchla_krell' ||
      p === 'buchla_200e' ||
      p === 'polybrute_12' ||
      p === 'moog_muse' ||
      p === 'nina_motor' ||
      p === 'super_gemini' ||
      p === 'ob_x8' ||
      p === 'prophet_10' ||
      p === 'ppg_3rd_wave' ||
      p === 'quantum_mk2' ||
      p === 'gr_mega'
    ) {
      return true;
    }
    if (s === 'grid') return false;
    if (
      s === 'synth' &&
      (physics?.lyric !== undefined ||
        physics?.fx?.some((f) => f.type.toLowerCase() === 'vocoder'))
    ) {
      return true;
    }
    return Boolean(
      physics?.detuneMod ||
        physics?.lpg ||
        physics?.metalizerAmount !== undefined ||
        physics?.bruteFactor !== undefined ||
        physics?.cp3Drive !== undefined ||
        physics?.binauralSpreadCents !== undefined ||
        physics?.spinRateHz !== undefined ||
        physics?.morphAmount !== undefined ||
        physics?.fullTouchMode !== undefined ||
        physics?.aliasingAmount !== undefined ||
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
        physics?.preSwell ||
        physics?.swarmSpreadSemitones !== undefined ||
        physics?.vowelFormant !== undefined ||
        physics?.wavefoldAmount !== undefined ||
        physics?.osmoseSqueeze !== undefined ||
        physics?.voiceBend !== undefined ||
        physics?.ratchet !== undefined ||
        physics?.wowFlutter !== undefined
    );
  }

  /**
   * High-speed 128-sample Control-Rate (`k-rate`) synthesizer renderer.
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
    const isSwarmatron =
      patch.includes('swarmatron') ||
      patch === 'ribbon_cluster_8' ||
      phys?.swarmSpreadSemitones !== undefined;
    const isHauntologyPad =
      patch.includes('hauntology') || patch === 'tape_nostalgia_pad';
    const isBuchla200e = patch === 'buchla_200e' || patch === 'west_coast_200';
    const isBuchlaKrell =
      patch.includes('buchla') ||
      patch.includes('krell') ||
      patch === 'cybernetic_eoc' ||
      patch === 'west_coast_200';
    const isPolyBrute = patch === 'polybrute_12' || patch === 'morph_analog_12';
    const isMoogMuse = patch === 'moog_muse' || patch === 'vintage_ladder_8';
    const isNinaMotor = patch === 'nina_motor' || patch === 'hybrid_motor_12';
    const isSuperGemini = patch === 'super_gemini' || patch === 'binaural_hybrid_20';
    const isObX8 = patch === 'ob_x8' || patch === 'state_variable_8';
    const isProphet10 = patch === 'prophet_10' || patch === 'vintage_poly_10';
    const isPpg3rdWave = patch === 'ppg_3rd_wave' || patch === 'stepped_wavetable_24';
    const isQuantumMk2 = patch === 'quantum_mk2' || patch === 'spectral_hybrid_16';
    const isGrMega = patch === 'gr_mega' || patch === 'granular_workstation_80';

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
    // Scale unison count: 8 oscillators for Swarmatron, 3 for Hauntology/Reese, or adaptive chord unison
    const numUnison = isSwarmatron
      ? numNotes >= 4
        ? 4
        : 8
      : isHauntologyPad || isReese
        ? 3
        : isSuperGemini || isObX8
          ? 4
          : numNotes >= 5
            ? 2
            : numNotes >= 3
              ? 3
              : 7;
    const totalOscs = numNotes * numUnison;

    const slopAmount = Math.max(
      0,
      Math.min(
        1,
        ((phys?.analogSlop ??
          macros.slop ??
          (isHauntologyPad || isProphet10 || isObX8 ? 32 : isMoogMuse ? 26 : 18)) as number) / 100
      )
    );

    const oscPhases = new Float32Array(totalOscs);
    const oscPhaseIncs = new Float32Array(totalOscs);
    const oscGainL = new Float32Array(totalOscs);
    const oscGainR = new Float32Array(totalOscs);
    const unisonPanNorm = new Float32Array(numUnison);
    const unisonDetuneNorm = new Float32Array(numUnison);
    const unisonWeight = new Float32Array(numUnison);
    const unisonStackRatios = new Float32Array(numUnison);
    const noteSlopScalar = new Float32Array(numNotes);

    const stackMode = phys?.stackMode || (patch === 'supersaw' || isGrMega ? 'super' : 'none');

    // Asymmetric JP-8000 / Golden-Ratio unison detune offsets prevent symmetric (-x, 0, +x)
    // phase cancellation where 1 + 2*cos(dw*t) hits exact -infinity dB nulls during long holds
    const ASYM_3 = [-0.91, 0.0, 1.09];
    const ASYM_7 = [-1.0, -0.618, -0.236, 0.0, 0.293, 0.676, 1.045];
    const centerUnisonIdx = Math.floor(numUnison / 2);
    const binauralCents =
      phys?.binauralSpreadCents !== undefined
        ? phys.binauralSpreadCents
        : isSuperGemini
          ? 14
          : 0;
    const hasBinauralSplit = binauralCents > 0;

    for (let u = 0; u < numUnison; u++) {
      if (hasBinauralSplit) {
        // UDO Super Gemini binaural split: even oscillators hard-biased Left, odd oscillators Right
        unisonPanNorm[u] = u % 2 === 0 ? -0.92 : 0.92;
      } else {
        unisonPanNorm[u] = numUnison > 1 ? (u / (numUnison - 1)) * 2 - 1 : 0;
      }
      if (numUnison === 3) {
        unisonDetuneNorm[u] = ASYM_3[u];
      } else if (numUnison === 7) {
        unisonDetuneNorm[u] = ASYM_7[u];
      } else {
        const sym = numUnison > 1 ? (u / (numUnison - 1)) * 2 - 1 : 0;
        unisonDetuneNorm[u] = sym >= 0 ? sym * 1.07 : sym * 0.92;
      }
      // Center fundamental oscillator carries 1.28x weight so side-voice beating never cancels the fundamental
      unisonWeight[u] = u === centerUnisonIdx ? 1.28 : 0.92;

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

    const normFactor = 0.64 / Math.sqrt(totalOscs);
    const baseWidthScalar = (phys?.stereoWidth ?? (macros.width ? Number(macros.width) : 100)) / 100;
    const hasDynamicWidthCurve = Boolean(phys?.widthCurve && phys.widthCurve.length >= 2);
    const activeSpinHz = phys?.spinRateHz ?? (isNinaMotor ? 0.85 : 0);

    for (let nIdx = 0; nIdx < numNotes; nIdx++) {
      const sRand = Math.sin((voiceSeed + nIdx * 31 + 1) * 12.9898) * 43758.5453;
      const sBipolar = (sRand - Math.floor(sRand)) * 2 - 1;
      noteSlopScalar[nIdx] = Math.pow(2, (sBipolar * 3.5 * slopAmount) / 1200);

      for (let u = 0; u < numUnison; u++) {
        const oscIdx = nIdx * numUnison + u;
        const pSeed = Math.sin((voiceSeed * 17 + nIdx * 71 + u * 53 + 7) * 78.233) * 43758.5453;
        oscPhases[oscIdx] = pSeed - Math.floor(pSeed); // Normalized [0, 1) phase

        const normPos = unisonPanNorm[u];
        const w = unisonWeight[u];
        const panPos = Math.max(-1, Math.min(1, item.pan + normPos * 0.75 * baseWidthScalar));
        const panRad = (panPos + 1) * 0.25 * Math.PI;
        oscGainL[oscIdx] = Math.cos(panRad) * normFactor * w;
        oscGainR[oscIdx] = Math.sin(panRad) * normFactor * w;
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
    let heldSampleL = 0;
    let heldSampleR = 0;

    const combSamples = phys?.combFreqHz
      ? Math.max(8, Math.min(2048, Math.floor(sampleRate / phys.combFreqHz)))
      : 0;
    const combBufL = combSamples > 0 ? new Float32Array(combSamples) : null;
    const combBufR = combSamples > 0 ? new Float32Array(combSamples) : null;
    let combIdx = 0;

    const avgMidi =
      chordNotes.reduce((acc, n) => acc + n.midi, 0) / Math.max(1, numNotes);
    // When a note specifies an explicit .filter(startHz, endHz) or .cutoff(hz) in Hz,
    // only apply keytracking if .keytrack(...) was explicitly requested on the note
    const hasExplicitNoteFilter = Boolean(
      phys?.cutoffMod || phys?.filterSweep || phys?.cutoff !== undefined
    );
    const keytrackPct =
      phys?.keytrack !== undefined
        ? phys.keytrack / 100
        : hasExplicitNoteFilter
          ? 0
          : (macros.keytrack ?? 35) / 100;
    const keytrackRatio = Math.pow(2, ((avgMidi - 60) * keytrackPct) / 12);

    const baseCutoffHz =
      phys?.cutoff ??
      (macros.cutoff !== undefined
        ? macros.cutoff > 127
          ? Number(macros.cutoff)
          : 180 * Math.pow(12000 / 180, Number(macros.cutoff) / 127)
        : isHauntologyPad
          ? 900
          : isReese
            ? 520
            : isMoogMuse || isProphet10
              ? 2400
              : isObX8 || isSuperGemini
                ? 3600
                : isSwarmatron || isPolyBrute || isNinaMotor
                  ? 3400
                  : 7800);

    const baseRes =
      phys?.resonance ??
      (isHauntologyPad
        ? 0.7
        : isPluckPatch
          ? 3.2
          : isPolyBrute || isMoogMuse
            ? 2.1
            : isSwarmatron
              ? 1.8
              : 1.2);
    const qDamp = Math.max(0.24, Math.min(1.0, 1.0 / Math.max(0.6, baseRes * 0.65)));
    const invSampleRate = 1.0 / sampleRate;
    const durFrames = Math.max(1, Math.floor(item.durSec * sampleRate));
    const secPerBeat = 60 / Math.max(40, tempoBpm || 120);

    const subLevel =
      macros.sub_level !== undefined
        ? Number(macros.sub_level) / 100
        : isHauntologyPad
          ? 0.2
          : isReese
            ? 0.85
            : 0.42;
    const lowestNoteFreq = Math.min(...chordNotes.map((n) => n.freq));
    const airPct =
      (phys?.airSheen ??
        (macros.air ? Number(macros.air) : patch === 'supersaw' || isObX8 || isSuperGemini ? 55 : 0)) /
      100;
    const hasPwm = Boolean(phys?.pwmDuty);
    const hasWaveMirror = phys?.waveWarpMode === 'mirror';
    const hasWaveBend = phys?.waveWarpMode === 'bend' || isHauntologyPad || isNinaMotor;
    const waveBendScale = 1 + (phys?.waveWarpAmount ?? (isHauntologyPad ? 0.3 : 0.5)) * 2.2;
    const hasBuchlaFold =
      isBuchlaKrell ||
      isBuchla200e ||
      isPolyBrute ||
      phys?.wavefoldAmount !== undefined ||
      phys?.metalizerAmount !== undefined;
    const aliasingPct = phys?.aliasingAmount ?? (isPpg3rdWave ? 28 : 0);
    const aliasStepHold = aliasingPct > 0 ? Math.max(2, Math.floor(1 + (aliasingPct / 100) * 14)) : 1;
    const chordAmpAvg =
      chordNotes.reduce((acc, n) => acc + n.amp, 0) / Math.max(1, numNotes);
    const dspState = new Float64Array(5);

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
      if (phys?.osmoseSqueeze !== undefined && phys.osmoseSqueeze > 0) {
        const sqNorm = Math.max(0.1, Math.min(1.0, phys.osmoseSqueeze / 100));
        if (midSample <= durFrames) {
          ampEnv = 0.25 + 0.75 * Math.sin(normU * Math.PI) * sqNorm;
        } else {
          const relProg = (midSample - durFrames) / Math.max(1, len - durFrames);
          ampEnv = 0.45 * Math.pow(Math.max(0, 1 - relProg), 1.6);
        }
      } else if (phys?.preSwell) {
        if (midSample <= durFrames) {
          ampEnv = Math.pow(normU, 2.6);
        } else {
          const rel = (midSample - durFrames) / Math.max(1, Math.floor(0.025 * sampleRate));
          ampEnv = Math.max(0, 1 - rel);
        }
      } else if (item.swell === 'crescendo' || item.swell === 'diminuendo') {
        const attRamp = t < 0.008 ? t / 0.008 : 1.0;
        if (midSample <= durFrames) {
          ampEnv = (item.startAmp + (item.endAmp - item.startAmp) * normU) * attRamp;
        } else {
          const relProg = (midSample - durFrames) / Math.max(1, len - durFrames);
          ampEnv = item.endAmp * Math.pow(Math.max(0, 1 - relProg), 1.6);
        }
      } else {
        const attackSec = isHauntologyPad ? Math.min(0.8, item.durSec * 0.35) : isPluckPatch ? 0.003 : 0.008;
        if (t < attackSec) {
          ampEnv = t / Math.max(0.001, attackSec);
        } else if (midSample <= durFrames) {
          ampEnv = isPluckPatch
            ? 0.35 + 0.65 * Math.exp(-(t - attackSec) * 6.5)
            : isBuchlaKrell
              ? 0.45 + 0.5 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 1.8 * t))
              : 0.92;
        } else {
          const relProg = (midSample - durFrames) / Math.max(1, len - durFrames);
          ampEnv = 0.92 * Math.pow(Math.max(0, 1 - relProg), 1.6);
        }
      }

      // Arturia PolyBrute 12 FullTouch MPE keybed envelope shaping
      if (phys?.fullTouchMode === 'pizz') {
        ampEnv *= Math.exp(-t * 7.5);
      } else if (phys?.fullTouchMode === 'at' || phys?.fullTouchMode === 'at_z') {
        ampEnv *= 0.35 + 0.65 * Math.sin(normU * Math.PI);
      }

      // Buchla 292e Vactrol Low-Pass Gate (asymmetrical photoresistor decay shaping VCA & LP)
      const lpgSpec =
        phys?.lpg ?? (isBuchla200e ? { mode: 'both' as const, decayMs: 420 } : undefined);
      let vactrolEnv = 1.0;
      if (lpgSpec) {
        const tau = Math.max(0.03, lpgSpec.decayMs / 1000);
        const vAtt = t < 0.004 ? t / 0.004 : 1.0;
        // Asymmetrical vactrol photoresistor decay tail
        vactrolEnv = vAtt * (0.7 * Math.exp(-t / tau) + 0.3 * Math.exp(-t / (tau * 2.4)));
        if (lpgSpec.mode === 'vca' || lpgSpec.mode === 'both') {
          ampEnv *= vactrolEnv;
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

      if (phys?.flutterRateHz !== undefined || isFlutterPatch) {
        const hasExplicitFlutter =
          phys?.flutterRateHz !== undefined || Boolean(phys?.flutterCurve);
        let rateHz = phys?.flutterRateHz ?? (hasExplicitFlutter ? 12.0 : 3.2);
        if (phys?.flutterCurve && phys.flutterCurve.length >= 2) {
          const c0 = phys.flutterCurve[0];
          const c1 = phys.flutterCurve[phys.flutterCurve.length - 1];
          rateHz = c0 + (c1 - c0) * normU;
        }
        const depth = phys?.flutterDepth ?? (hasExplicitFlutter ? 0.55 : 0.10);
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

      if (phys?.wowFlutter || isHauntologyPad) {
        const wf = phys?.wowFlutter ?? {
          wowCents: 4.5,
          wowHz: 0.42,
          flutterCents: 2.2,
          flutterHz: 9.5,
        };
        // Irregular dual-sine seasick tape wow + fast transient-blurring flutter
        const wowWave =
          0.72 * Math.sin(2 * Math.PI * wf.wowHz * songTimeSec) +
          0.28 * Math.sin(2 * Math.PI * (wf.wowHz * 1.618) * songTimeSec + 1.1);
        const flutterWave = Math.sin(2 * Math.PI * wf.flutterHz * songTimeSec);
        const totalTapeCents = wf.wowCents * wowWave + wf.flutterCents * flutterWave;
        globalPitchMultiplier *= Math.pow(2, totalTapeCents / 1200);
      }

      let syncRatio = phys?.syncRatio ?? 1.0;
      if (phys?.syncSweep) {
        syncRatio = phys.syncSweep[0] + (phys.syncSweep[1] - phys.syncSweep[0]) * normU;
      }

      // 3. Windowed Unison Detune, Swarmatron Ribbon Spread, Binaural Split & 360-deg NINA Spin at k-rate
      const activeDetunePct = phys?.detuneMod
        ? this.evaluateWindowedModulation(phys.detuneMod, normU, 8)
        : isHauntologyPad && phys?.detune === undefined
          ? 20
          : baseDetunePct;
      const activeSwarmSt = phys?.swarmMod
        ? this.evaluateWindowedModulation(phys.swarmMod, normU, 0.2)
        : typeof phys?.swarmSpreadSemitones === 'number'
          ? phys.swarmSpreadSemitones
          : isSwarmatron
            ? 1.8
            : 0;
      const maxSpreadOctaves =
        activeSwarmSt > 0
          ? (activeSwarmSt * 0.5) / 12
          : isHauntologyPad && phys?.detune === undefined
            ? 8 / 1200
            : ((activeDetunePct / 100) * (isReese ? 34 : 42)) / 1200;
      const binauralOctaves = hasBinauralSplit ? (binauralCents * 0.5) / 1200 : 0;

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

        if (phys?.voiceBend && nIdx === phys.voiceBend.voiceIndex) {
          const vb = phys.voiceBend;
          const sW = vb.startWindow ?? 0;
          const eW = vb.endWindow ?? 1;
          if (normU >= sW && normU <= eW) {
            const localU = (normU - sW) / Math.max(1e-4, eW - sW);
            const env = Math.sin(localU * Math.PI);
            noteBendMultiplier *= Math.pow(2, (vb.cents * env) / 1200);
          }
        }

        const baseNoteFreq =
          cNote.freq * noteSlopScalar[nIdx] * globalPitchMultiplier * noteBendMultiplier * syncRatio * invSampleRate;

        for (let u = 0; u < numUnison; u++) {
          const oscIdx = nIdx * numUnison + u;
          const normPos = unisonPanNorm[u];
          const detPos = unisonDetuneNorm[u];
          const binOffset = hasBinauralSplit ? (u % 2 === 0 ? -binauralOctaves : binauralOctaves) : 0;
          const x = detPos * maxSpreadOctaves + binOffset;
          const detuneRatio = 1 + x * 0.69314718 + x * x * 0.2402265;
          const inc = baseNoteFreq * unisonStackRatios[u] * detuneRatio;

          oscPhaseIncs[oscIdx] = inc < 0.45 ? inc : 0.45;

          if (activeSpinHz > 0) {
            // Melbourne Instruments NINA 360-degree four-quadrant VCA rotation
            const w = unisonWeight[u];
            const theta = 2 * Math.PI * activeSpinHz * songTimeSec + u * 0.9;
            const panPos = Math.max(-1, Math.min(1, item.pan + Math.sin(theta) * 0.88 * widthScalar));
            const panRad = (panPos + 1) * 0.25 * Math.PI;
            oscGainL[oscIdx] = Math.cos(panRad) * normFactor * w;
            oscGainR[oscIdx] = Math.sin(panRad) * normFactor * w;
          } else if (hasDynamicWidthCurve) {
            const w = unisonWeight[u];
            const panPos = Math.max(-1, Math.min(1, item.pan + normPos * 0.75 * widthScalar));
            const panRad = (panPos + 1) * 0.25 * Math.PI;
            oscGainL[oscIdx] = Math.cos(panRad) * normFactor * w;
            oscGainR[oscIdx] = Math.sin(panRad) * normFactor * w;
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

      let modCutoffHz = phys?.cutoffMod
        ? this.evaluateWindowedModulation(phys.cutoffMod, normU, baseCutoffHz)
        : phys?.preSwell
          ? 240 + (baseCutoffHz - 240) * Math.pow(normU, 2.2)
          : baseCutoffHz;

      if (lpgSpec && (lpgSpec.mode === 'lp' || lpgSpec.mode === 'both')) {
        modCutoffHz = 110 + (modCutoffHz - 110) * Math.pow(vactrolEnv, 0.85);
      }

      const morphNorm = phys?.morphMod
        ? this.evaluateWindowedModulation(phys.morphMod, normU, 0) / 100
        : phys?.morphAmount !== undefined
          ? phys.morphAmount / 100
          : 0;
      if (morphNorm > 0) {
        modCutoffHz *= 1 + 1.4 * morphNorm;
      }

      if (phys?.vowelFormant) {
        const [f1From, f2From] = computeFormantVowelFrequencies(phys.vowelFormant.from);
        const [f1To, f2To] = computeFormantVowelFrequencies(phys.vowelFormant.to);
        const vLfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * phys.vowelFormant.rateHz * songTimeSec);
        const f1Active = f1From + (f1To - f1From) * vLfo;
        const f2Active = f2From + (f2To - f2From) * vLfo;
        modCutoffHz = 0.45 * f1Active + 0.55 * f2Active;
      }

      const effectiveCutoff = Math.max(55, Math.min(15500, modCutoffHz * keytrackRatio));
      const svfHalfF = Math.min(0.46, Math.sin((Math.PI * effectiveCutoff) * invSampleRate));

      const activeMetalizerPct = phys?.metalizerMod
        ? this.evaluateWindowedModulation(phys.metalizerMod, normU, 0)
        : phys?.metalizerAmount !== undefined
          ? phys.metalizerAmount
          : isPolyBrute
            ? 28
            : 0;
      const activeFoldPct = Math.max(
        activeMetalizerPct,
        phys?.wavefoldMod
          ? this.evaluateWindowedModulation(phys.wavefoldMod, normU, 0)
          : typeof phys?.wavefoldAmount === 'number'
            ? phys.wavefoldAmount
            : isBuchlaKrell || isBuchla200e
              ? 65
              : 0
      );
      const foldDrive = activeFoldPct > 0 ? 1 + (activeFoldPct / 100) * 3.8 : 1.0;

      const cp3Pct = phys?.cp3Drive ?? (isMoogMuse ? 35 : 0);
      const brutePct = phys?.bruteFactor ?? (isPolyBrute ? 25 : 0);
      const hardwareCircuitDrive = Math.max(cp3Pct, brutePct) / 100;

      const driveVal = phys?.driveMod
        ? this.evaluateWindowedModulation(phys.driveMod, normU, 0)
        : isReese
          ? 0.35
          : hardwareCircuitDrive;
      const driveScalar =
        driveVal > 0 || hardwareCircuitDrive > 0
          ? 1 + Math.max(driveVal > 1 ? driveVal / 100 : driveVal, hardwareCircuitDrive) * 2.8
          : 1.0;
      const blockFinalGain =
        ampEnv *
        (item.swell === 'crescendo' || item.swell === 'diminuendo' ? 1.0 : chordAmpAvg) *
        0.78;

      const isTriangleCore = isHauntologyPad || isBuchlaKrell || isBuchla200e || isPolyBrute;
      const isFastOscLoop = !hasPwm && fmPhaseInc === 0;
      const isFastSawPath =
        isFastOscLoop &&
        !isTriangleCore &&
        !hasWaveMirror &&
        !hasWaveBend &&
        !(hasBuchlaFold && foldDrive > 1.01) &&
        aliasStepHold <= 1 &&
        ringPhaseInc === 0 &&
        activeNoise <= 0.005 &&
        !combBufL &&
        driveScalar <= 1.01;

      if (isFastSawPath) {
        dspState[0] = subPhase;
        dspState[1] = lpL;
        dspState[2] = bpL;
        dspState[3] = lpR;
        dspState[4] = bpR;
        this.renderFastSawBlock(
          trackLeft,
          trackRight,
          startFrame + blockStart,
          blockEnd - blockStart,
          totalOscs,
          oscPhases,
          oscPhaseIncs,
          oscGainL,
          oscGainR,
          subLevel,
          subPhaseInc,
          qDamp,
          svfHalfF,
          airPct * 0.42,
          blockFinalGain,
          dspState
        );
        subPhase = dspState[0];
        lpL = dspState[1];
        bpL = dspState[2];
        lpR = dspState[3];
        bpR = dspState[4];
        continue;
      }

      // 4. Tight Branchless Inner Sample Loop (128 samples)
      for (let i = blockStart; i < blockEnd; i++) {
        let sigL = 0;
        let sigR = 0;

        if (isFastOscLoop) {
          if (isTriangleCore) {
            for (let o = 0; o < totalOscs; o++) {
              let ph = oscPhases[o] + oscPhaseIncs[o];
              if (ph >= 1) ph -= 1;
              oscPhases[o] = ph;
              const oscSample = 1 - 4 * Math.abs(ph - 0.5);
              sigL += oscSample * oscGainL[o];
              sigR += oscSample * oscGainR[o];
            }
          } else {
            for (let o = 0; o < totalOscs; o++) {
              let ph = oscPhases[o] + oscPhaseIncs[o];
              if (ph >= 1) ph -= 1;
              oscPhases[o] = ph;
              const oscSample = 2 * ph - 1;
              sigL += oscSample * oscGainL[o];
              sigR += oscSample * oscGainR[o];
            }
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

            const oscSample = hasPwm
              ? p < pwmThreshold
                ? 0.85
                : -0.85
              : isTriangleCore
                ? 1 - 4 * Math.abs(p - 0.5)
                : 2 * p - 1;

            sigL += oscSample * oscGainL[o];
            sigR += oscSample * oscGainR[o];
          }
        }

        // Apply wave-mirror, wave-bend, and branchless Buchla/Metalizer wavefolder once per summed stereo sample
        if (hasWaveMirror) {
          sigL = Math.abs(sigL) * 1.6 - 0.5;
          sigR = Math.abs(sigR) * 1.6 - 0.5;
        } else if (hasWaveBend) {
          const xL = sigL * waveBendScale;
          const xR = sigR * waveBendScale;
          sigL = xL / (1 + Math.abs(xL));
          sigR = xR / (1 + Math.abs(xR));
        }

        if (hasBuchlaFold && foldDrive > 1.01) {
          const fL = ((sigL * foldDrive * 0.5 + 0.5) % 2 + 2) % 2;
          const fR = ((sigR * foldDrive * 0.5 + 0.5) % 2 + 2) % 2;
          sigL = 2 * Math.abs(fL - 1) - 1;
          sigR = 2 * Math.abs(fR - 1) - 1;
        }

        if (aliasStepHold > 1) {
          if (i % aliasStepHold === 0) {
            heldSampleL = Math.round(sigL * 16) / 16;
            heldSampleR = Math.round(sigR * 16) / 16;
          }
          sigL = heldSampleL;
          sigR = heldSampleR;
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

        // 2x-Oversampled Chamberlin State-Variable Filter (rock-solid at high cutoff & resonance)
        let hpL = sigL - lpL - qDamp * bpL;
        bpL += svfHalfF * hpL;
        lpL += svfHalfF * bpL;
        hpL = sigL - lpL - qDamp * bpL;
        bpL += svfHalfF * hpL;
        lpL += svfHalfF * bpL;
        if (bpL > 4.0) bpL = 4.0;
        else if (bpL < -4.0) bpL = -4.0;

        let hpR = sigR - lpR - qDamp * bpR;
        bpR += svfHalfF * hpR;
        lpR += svfHalfF * bpR;
        hpR = sigR - lpR - qDamp * bpR;
        bpR += svfHalfF * hpR;
        lpR += svfHalfF * bpR;
        if (bpR > 4.0) bpR = 4.0;
        else if (bpR < -4.0) bpR = -4.0;

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
          const dL = (outL + 0.08 * hardwareCircuitDrive * outL * outL) * driveScalar;
          const dR = (outR + 0.08 * hardwareCircuitDrive * outR * outR) * driveScalar;
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

  private static renderFastSawBlock(
    trackLeft: Float32Array,
    trackRight: Float32Array,
    absStart: number,
    blockLen: number,
    totalOscs: number,
    oscPhases: Float32Array,
    oscPhaseIncs: Float32Array,
    oscGainL: Float32Array,
    oscGainR: Float32Array,
    subLevel: number,
    subPhaseInc: number,
    qDamp: number,
    svfHalfF: number,
    airScale: number,
    blockFinalGain: number,
    dspState: Float64Array
  ): void {
    let subPhase = dspState[0];
    let lpL = dspState[1];
    let bpL = dspState[2];
    let lpR = dspState[3];
    let bpR = dspState[4];
    const subAmp = subLevel * 0.52;

    for (let k = 0; k < blockLen; k++) {
      let sigL = 0;
      let sigR = 0;
      for (let o = 0; o < totalOscs; o++) {
        let ph = oscPhases[o] + oscPhaseIncs[o];
        if (ph >= 1) ph -= 1;
        oscPhases[o] = ph;
        const oscSample = 2 * ph - 1;
        sigL += oscSample * oscGainL[o];
        sigR += oscSample * oscGainR[o];
      }

      if (subAmp > 0.005) {
        subPhase += subPhaseInc;
        if (subPhase >= 1) subPhase -= 1;
        const sp = subPhase * 2 - 1;
        const subSample = 4 * sp * (1 - Math.abs(sp)) * subAmp;
        sigL += subSample;
        sigR += subSample;
      }

      let hpL = sigL - lpL - qDamp * bpL;
      bpL += svfHalfF * hpL;
      lpL += svfHalfF * bpL;
      hpL = sigL - lpL - qDamp * bpL;
      bpL += svfHalfF * hpL;
      lpL += svfHalfF * bpL;
      if (bpL > 4.0) bpL = 4.0;
      else if (bpL < -4.0) bpL = -4.0;

      let hpR = sigR - lpR - qDamp * bpR;
      bpR += svfHalfF * hpR;
      lpR += svfHalfF * bpR;
      hpR = sigR - lpR - qDamp * bpR;
      bpR += svfHalfF * hpR;
      lpR += svfHalfF * bpR;
      if (bpR > 4.0) bpR = 4.0;
      else if (bpR < -4.0) bpR = -4.0;

      let outL = lpL;
      let outR = lpR;
      if (airScale > 0.004) {
        const aL = hpL * 2.2;
        const aR = hpR * 2.2;
        outL += (aL / (1 + Math.abs(aL))) * airScale;
        outR += (aR / (1 + Math.abs(aR))) * airScale;
      }

      const absIdx = absStart + k;
      trackLeft[absIdx] += outL * blockFinalGain;
      trackRight[absIdx] += outR * blockFinalGain;
    }

    dspState[0] = subPhase;
    dspState[1] = lpL;
    dspState[2] = bpL;
    dspState[3] = lpR;
    dspState[4] = bpR;
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
