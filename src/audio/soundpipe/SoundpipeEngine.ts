import type { ContinuousVoiceNote } from '../synths/ContinuousSynthEngine';
import { PhonemeEngine } from '../PhonemeEngine';

export type SoundpipePatchId =
  | 'sp:blsaw'
  | 'sp:blsquare'
  | 'sp:fosc'
  | 'sp:gbuzz'
  | 'sp:pdhalf'
  | 'sp:fof'
  | 'sp:drip'
  | 'sp:bar'
  | 'sp:jitter'
  | 'sp:streson'
  | 'sp:mincer'
  | 'sp:autowah';

export interface SoundpipePatchSpec {
  id: SoundpipePatchId;
  engineLabel: string;
  topologySummary: string;
  primaryMacroLabel: string;
  defaultCutoffHz: number;
}

const SOUNDPIPE_PATCH_SPECS: Record<SoundpipePatchId, SoundpipePatchSpec> = {
  'sp:blsaw': {
    id: 'sp:blsaw',
    engineLabel: 'Soundpipe Bandlimited Sawtooth (sp:blsaw)',
    topologySummary: 'PolyBLEP Bandlimited Sawtooth + Sub-Octave -> 2-Pole State-Variable Filter',
    primaryMacroLabel: 'CUTOFF / DETUNE',
    defaultCutoffHz: 5200,
  },
  'sp:blsquare': {
    id: 'sp:blsquare',
    engineLabel: 'Soundpipe Bandlimited Variable-Pulse Square (sp:blsquare)',
    topologySummary: 'PolyBLEP Variable-Duty Square Wave -> Resonant Filter',
    primaryMacroLabel: 'PWM DUTY / CUTOFF',
    defaultCutoffHz: 4800,
  },
  'sp:fosc': {
    id: 'sp:fosc',
    engineLabel: 'Soundpipe Chowning C:M:I FM Pair (sp:fosc)',
    topologySummary: 'Carrier:Modulator:Index FM Pair with Envelope Index Contour',
    primaryMacroLabel: 'TIMBRE (Mod Index) / HARMONICS (C:M Ratio)',
    defaultCutoffHz: 5600,
  },
  'sp:gbuzz': {
    id: 'sp:gbuzz',
    engineLabel: 'Soundpipe Closed-Form Harmonic Buzz Series (sp:gbuzz)',
    topologySummary: 'Closed-Form Cosine Partial Summation (k=1..N with Brightness Tilt r^k)',
    primaryMacroLabel: 'GBUZZ (Brightness Multiplier r) / PARTIAL COUNT',
    defaultCutoffHz: 6000,
  },
  'sp:pdhalf': {
    id: 'sp:pdhalf',
    engineLabel: 'Soundpipe Casio CZ Phase-Distortion Half-Sine (sp:pdhalf)',
    topologySummary: 'Piecewise Bilinear Phase Distortion Inflection Point -> CosineReadout',
    primaryMacroLabel: 'PDHALF (Phase Distortion Skew) / CUTOFF',
    defaultCutoffHz: 5800,
  },
  'sp:fof': {
    id: 'sp:fof',
    engineLabel: 'Soundpipe IRCAM Chant Formant-Wave-Function Vocal (sp:fof)',
    topologySummary: 'Glottal Epoch Impulse -> 3 Parallel FOF Skirt-Windowed Sine Bursts (F1/F2/F3)',
    primaryMacroLabel: 'FOF VOWEL ("a" | "e" | "i" | "o" | "u") / FORMANT SHIFT',
    defaultCutoffHz: 5400,
  },
  'sp:drip': {
    id: 'sp:drip',
    engineLabel: 'Soundpipe Perry Cook Physical Water Droplet (sp:drip)',
    topologySummary: 'Stochastic Bubble Cavity Impulse -> Chirped Exponentially-Swept Resonator',
    primaryMacroLabel: 'DAMPING / DRIP CHIRP',
    defaultCutoffHz: 6800,
  },
  'sp:bar': {
    id: 'sp:bar',
    engineLabel: 'Soundpipe Euler-Bernoulli Struck Metal/Wood Bar (sp:bar)',
    topologySummary: '4th-Order Stiff-Bar Finite Difference Modal Bank',
    primaryMacroLabel: 'STIFFNESS / DECAY',
    defaultCutoffHz: 6200,
  },
  'sp:jitter': {
    id: 'sp:jitter',
    engineLabel: 'Soundpipe Bandlimited Spline-Interpolated Jitter Synth (sp:jitter)',
    topologySummary: 'Piecewise-Linear Random Frequency Walk + Dual Detuned Oscillators',
    primaryMacroLabel: 'JITTER DEPTH / RATE',
    defaultCutoffHz: 4600,
  },
  'sp:streson': {
    id: 'sp:streson',
    engineLabel: 'Soundpipe String Resonator Comb Filter (sp:streson)',
    topologySummary: 'Broadband Exciter -> Tuned Fractional-Delay String Comb Feedback Loop',
    primaryMacroLabel: 'FEEDBACK / DAMPING',
    defaultCutoffHz: 5200,
  },
  'sp:mincer': {
    id: 'sp:mincer',
    engineLabel: 'Soundpipe Phase-Locked Vocoder Time-Smear Synth (sp:mincer)',
    topologySummary: 'Phase-Locked Overlapping Hann Grains + Harmonic Partial Bank',
    primaryMacroLabel: 'TIME SMEAR / HARMONICS',
    defaultCutoffHz: 4900,
  },
  'sp:autowah': {
    id: 'sp:autowah',
    engineLabel: 'Soundpipe Envelope-Follower Auto-Wah Synth (sp:autowah)',
    topologySummary: 'Peak Envelope Detector -> High-Q Bandpass/Lowpass Formant Sweep',
    primaryMacroLabel: 'WAH SENSITIVITY / RESONANCE',
    defaultCutoffHz: 4400,
  },
};

/**
 * Pure-MIT Paul Batchelor Soundpipe / Sporth (`sp:*`) Csound-Heritage Synthesis Engine.
 */
export class SoundpipeEngine {
  public static readonly PATCH_CATALOG: SoundpipePatchId[] = Object.keys(
    SOUNDPIPE_PATCH_SPECS
  ) as SoundpipePatchId[];

  public static isSoundpipePatch(patch?: string, style?: string): boolean {
    const cleanStyle = (style || '').trim().toLowerCase();
    if (cleanStyle === 'soundpipe' || cleanStyle === 'sporth' || cleanStyle === 'csound') {
      return true;
    }
    const cleanPatch = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!cleanPatch) return false;
    if (cleanPatch.startsWith('sp:') || cleanPatch.startsWith('sp_')) {
      return true;
    }
    return cleanPatch in SOUNDPIPE_PATCH_SPECS;
  }

  public static normalizePatchId(patch?: string): SoundpipePatchId {
    const raw = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!raw) return 'sp:pdhalf';
    const norm = raw.replace(/^sp_/, 'sp:');
    if (norm in SOUNDPIPE_PATCH_SPECS) return norm as SoundpipePatchId;
    if (norm.includes('pdhalf') || norm.includes('cz')) return 'sp:pdhalf';
    if (norm.includes('fof') || norm.includes('chant')) return 'sp:fof';
    if (norm.includes('gbuzz') || norm.includes('buzz')) return 'sp:gbuzz';
    if (norm.includes('fosc') || norm.includes('fm')) return 'sp:fosc';
    if (norm.includes('drip') || norm.includes('water')) return 'sp:drip';
    if (norm.includes('bar')) return 'sp:bar';
    if (norm.includes('jitter')) return 'sp:jitter';
    if (norm.includes('streson')) return 'sp:streson';
    if (norm.includes('mincer')) return 'sp:mincer';
    if (norm.includes('wah')) return 'sp:autowah';
    if (norm.includes('square')) return 'sp:blsquare';
    return 'sp:blsaw';
  }

  public static getTopologySpec(patch?: string): {
    engineLabel: string;
    topologySummary: string;
    primaryMacroLabel: string;
  } {
    const spec = SOUNDPIPE_PATCH_SPECS[this.normalizePatchId(patch)];
    return {
      engineLabel: spec.engineLabel,
      topologySummary: spec.topologySummary,
      primaryMacroLabel: spec.primaryMacroLabel,
    };
  }

  public static renderVoiceIntoStereo(
    trackLeft: Float32Array,
    trackRight: Float32Array,
    startFrame: number,
    noteFrames: number,
    sampleRate: number,
    _tempoBpm: number,
    voiceSeed: number,
    item: ContinuousVoiceNote
  ): void {
    const endFrame = Math.min(
      trackLeft.length,
      trackRight.length,
      startFrame + noteFrames
    );
    const len = endFrame - startFrame;
    if (len <= 0) return;

    const phys = item.event.physics;
    const macros = item.def?.macros || {};
    const patchId = this.normalizePatchId(item.event.patch || item.def?.patch);
    const spec = SOUNDPIPE_PATCH_SPECS[patchId];

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
    const chordScale = 1 / Math.sqrt(Math.max(1, numNotes));
    const dtBase = 1 / Math.max(8000, sampleRate);
    const durSec = Math.max(0.02, item.durSec || len * dtBase);

    const attackSec = Math.max(0.003, Number(item.def?.env?.attack ?? 0.012));
    const decaySec = Math.max(0.05, Number(item.def?.env?.decay ?? 0.38));
    const sustainLevel = Math.max(
      0.0,
      Math.min(1.0, Number(item.def?.env?.sustain ?? 0.82))
    );
    const releaseSec = Math.max(0.03, Number(item.def?.env?.release ?? 0.2));

    const pdhalfNorm = Math.max(
      0.04,
      Math.min(
        0.96,
        ((phys?.pdhalfAmount ?? phys?.timbreAmount ?? macros.pdhalf ?? macros.timbre ?? 65) as number) /
          100
      )
    );
    const gbuzzNorm = Math.max(
      0.1,
      Math.min(
        0.92,
        ((phys?.gbuzzAmount ?? phys?.harmonicsAmount ?? macros.gbuzz ?? macros.harmonics ?? 65) as number) /
          100
      )
    );

    const vowelStr =
      typeof phys?.lyric === 'string'
        ? phys.lyric
        : typeof phys?.vowelFormant === 'string'
          ? phys.vowelFormant
          : phys?.vowelFormant?.from || 'a';
    const vowelSpec = PhonemeEngine.decomposeLyric(vowelStr).primaryVowel;

    const baseCutoff = Math.max(
      120,
      Math.min(
        18000,
        Number(
          phys?.cutoff ??
            phys?.filterSweep?.[0] ??
            macros.cutoff ??
            spec.defaultCutoffHz
        )
      )
    );
    const targetCutoff = Math.max(
      120,
      Math.min(18000, Number(phys?.filterSweep?.[1] ?? baseCutoff))
    );

    const phases = new Float64Array(numNotes);
    for (let n = 0; n < numNotes; n++) {
      phases[n] = ((voiceSeed + n * 97) % 100) / 100;
    }

    const basePan = Math.max(-1, Math.min(1, item.pan ?? 0));
    const panAngle = (basePan + 1) * 0.25 * Math.PI;
    const gainL = Math.cos(panAngle) * chordScale * 0.56;
    const gainR = Math.sin(panAngle) * chordScale * 0.56;

    let svfLowL = 0;
    let svfBandL = 0;
    let svfLowR = 0;
    let svfBandR = 0;
    let dcInL = 0;
    let dcOutL = 0;
    let dcInR = 0;
    let dcOutR = 0;

    for (let i = 0; i < len; i++) {
      const tSec = i * dtBase;
      const uNorm = Math.min(1, i / Math.max(1, len - 1));

      let env = 1.0;
      if (tSec < attackSec) {
        env = tSec / attackSec;
      } else if (tSec < attackSec + decaySec) {
        const dProg = (tSec - attackSec) / decaySec;
        env = 1.0 - (1.0 - sustainLevel) * dProg;
      } else if (tSec < durSec - releaseSec) {
        env = sustainLevel;
      } else {
        const rProg = Math.min(
          1,
          Math.max(0, (tSec - Math.max(0, durSec - releaseSec)) / releaseSec)
        );
        env = sustainLevel * (1.0 - rProg);
      }

      let sumL = 0;
      let sumR = 0;

      for (let n = 0; n < numNotes; n++) {
        const cn = chordNotes[n];
        const f0 = Math.max(24, Math.min(14000, cn.freq));
        const dt = f0 * dtBase;
        const noteAmp = Math.max(0.05, Math.min(1.5, cn.amp || item.amp || 0.78));

        phases[n] = (phases[n] + dt) % 1.0;
        const ph = phases[n];

        let sigL = 0;
        let sigR = 0;

        switch (patchId) {
          case 'sp:pdhalf': {
            // Casio CZ Phase-Distortion Half-Sine: bilinear phase warp around pivot (1 - pdhalfNorm * 0.85)
            const pivot = Math.max(0.08, Math.min(0.92, 0.5 * (1 - pdhalfNorm * 0.82)));
            const warpedPh =
              ph < pivot
                ? 0.5 * (ph / pivot)
                : 0.5 + 0.5 * ((ph - pivot) / Math.max(0.01, 1.0 - pivot));
            const cz = -Math.cos(2 * Math.PI * warpedPh);
            const sub = Math.sin(Math.PI * ph) * 0.22;
            sigL = (cz + sub) * 0.82;
            sigR = (cz - sub * 0.5) * 0.82;
            break;
          }

          case 'sp:fof': {
            // IRCAM Chant Formant-Wave-Function (FOF): 3 parallel formant bursts synced to glottal epoch
            const f1 = vowelSpec.f1 || 730;
            const f2 = vowelSpec.f2 || 1090;
            const f3 = vowelSpec.f3 || 2440;
            const skirt = Math.sin(Math.PI * Math.min(1, ph * 4)) * Math.exp(-ph * 3.2);
            const burst1 = Math.sin(2 * Math.PI * (f1 / f0) * ph) * skirt;
            const burst2 = Math.sin(2 * Math.PI * (f2 / f0) * ph) * skirt * 0.65;
            const burst3 = Math.sin(2 * Math.PI * (f3 / f0) * ph) * skirt * 0.32;
            sigL = (burst1 + burst2 + burst3) * 0.88;
            sigR = (burst1 + burst2 * 0.9 - burst3 * 0.5) * 0.88;
            break;
          }

          case 'sp:gbuzz': {
            // Closed-form harmonic buzz summation: sum_{k=1..8} r^{k-1} cos(k * w * t)
            let buzz = 0;
            let rPow = 1.0;
            let normSum = 0;
            for (let k = 1; k <= 8; k++) {
              buzz += rPow * Math.cos(2 * Math.PI * k * ph);
              normSum += rPow;
              rPow *= gbuzzNorm;
            }
            const out = buzz / Math.max(1, normSum);
            sigL = out * 0.85;
            sigR = out * 0.85;
            break;
          }

          case 'sp:drip': {
            const chirpFreq = f0 * (1 + 0.65 * (1 - Math.exp(-tSec * 28)));
            const dropEnv = Math.exp(-tSec * 14);
            const s = Math.sin(2 * Math.PI * chirpFreq * tSec) * dropEnv;
            sigL = s * 0.9;
            sigR = s * 0.9;
            break;
          }

          case 'sp:fosc':
          default: {
            const mod = Math.sin(2 * Math.PI * 2.0 * ph) * (1.2 + pdhalfNorm * 2.8);
            const car = Math.sin(2 * Math.PI * ph + mod);
            sigL = car * 0.8;
            sigR = car * 0.8;
            break;
          }
        }

        sumL += sigL * noteAmp;
        sumR += sigR * noteAmp;
      }

      const instCutoff = baseCutoff + (targetCutoff - baseCutoff) * uNorm;
      const fSvf = Math.min(0.78, 2 * Math.sin((Math.PI * instCutoff) / sampleRate));
      const qSvf = 0.65;

      svfLowL += fSvf * svfBandL;
      const highL = sumL * env - svfLowL - qSvf * svfBandL;
      svfBandL += fSvf * highL;

      svfLowR += fSvf * svfBandR;
      const highR = sumR * env - svfLowR - qSvf * svfBandR;
      svfBandR += fSvf * highR;

      const rawOutL = svfLowL * gainL;
      const rawOutR = svfLowR * gainR;
      dcOutL = rawOutL - dcInL + 0.998 * dcOutL;
      dcInL = rawOutL;
      dcOutR = rawOutR - dcInR + 0.998 * dcOutR;
      dcInR = rawOutR;

      trackLeft[startFrame + i] += dcOutL;
      trackRight[startFrame + i] += dcOutR;
    }
  }
}
