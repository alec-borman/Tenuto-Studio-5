import type { ContinuousVoiceNote } from '../synths/ContinuousSynthEngine';
import { PhonemeEngine } from '../PhonemeEngine';

export type DaisyStkPatchId =
  | 'daisy:string_voice'
  | 'daisy:modal_voice'
  | 'daisy:fm2'
  | 'daisy:vosim'
  | 'daisy:formant_osc'
  | 'stk:clar'
  | 'stk:flute'
  | 'stk:bowed'
  | 'stk:brass'
  | 'stk:saxofony'
  | 'stk:sitar'
  | 'stk:rhodey'
  | 'stk:wurley'
  | 'stk:bandedwg';

export interface DaisyStkPatchSpec {
  id: DaisyStkPatchId;
  engineLabel: string;
  topologySummary: string;
  primaryMacroLabel: string;
  defaultCutoffHz: number;
  defaultResonance: number;
}

const DAISY_STK_PATCH_SPECS: Record<DaisyStkPatchId, DaisyStkPatchSpec> = {
  'daisy:string_voice': {
    id: 'daisy:string_voice',
    engineLabel: 'DaisySP Extended Karplus-Strong String Voice (daisy:string_voice)',
    topologySummary: 'Dust/Mallet Exciter -> Non-Linear Dispersion Allpass + Damped String Waveguide',
    primaryMacroLabel: 'DAMPING (Sustain) / JAWARI (Bridge Dispersion) / BRIGHTNESS',
    defaultCutoffHz: 5400,
    defaultResonance: 0.28,
  },
  'daisy:modal_voice': {
    id: 'daisy:modal_voice',
    engineLabel: 'DaisySP Struck Bar & Plate Modal Voice (daisy:modal_voice)',
    topologySummary: 'Impact Exciter -> 6-Mode Inharmonic State-Variable Resonator Bank',
    primaryMacroLabel: 'STRUCTURE (Inharmonicity) / DAMPING (Ring Time) / ACCENT',
    defaultCutoffHz: 6400,
    defaultResonance: 0.32,
  },
  'daisy:fm2': {
    id: 'daisy:fm2',
    engineLabel: 'DaisySP 2-Operator Through-Zero FM Voice (daisy:fm2)',
    topologySummary: 'Quantized Harmonic Ratio Modulator -> Phase-Modulated Sine Carrier',
    primaryMacroLabel: 'TIMBRE (FM Index) / HARMONICS (Ratio)',
    defaultCutoffHz: 5800,
    defaultResonance: 0.24,
  },
  'daisy:vosim': {
    id: 'daisy:vosim',
    engineLabel: 'DaisySP Kaegi/Tempelaars VOSIM Formant Pulse Train (daisy:vosim)',
    topologySummary: 'Squared-Sine Formant Burst Train Sync-Reset at Fundamental Period',
    primaryMacroLabel: 'FORMANT 1 / FORMANT 2 / PULSE DECAY',
    defaultCutoffHz: 5200,
    defaultResonance: 0.35,
  },
  'daisy:formant_osc': {
    id: 'daisy:formant_osc',
    engineLabel: 'DaisySP Phase-Resetting Formant Oscillator (daisy:formant_osc)',
    topologySummary: 'Carrier-Synced Sine Formant Core + Windowed Crossfade',
    primaryMacroLabel: 'FORMANT FREQ / PHASE SHIFT',
    defaultCutoffHz: 5000,
    defaultResonance: 0.32,
  },
  'stk:clar': {
    id: 'stk:clar',
    engineLabel: 'Stanford STK Clarinet Reed Waveguide (stk:clar)',
    topologySummary: 'Non-Linear Pressure-Controlled Reed Table -> Cylindrical Bore Delay Line',
    primaryMacroLabel: 'BREATH (Blow Pressure) / REED STIFFNESS',
    defaultCutoffHz: 4200,
    defaultResonance: 0.3,
  },
  'stk:flute': {
    id: 'stk:flute',
    engineLabel: 'Stanford STK Jet-Delay Flute Waveguide (stk:flute)',
    topologySummary: 'Breath + Jet Delay Line -> Cubic Non-Linearity (x - x^3) -> Bore Waveguide',
    primaryMacroLabel: 'BREATH (Turbulence) / JET (Embouchure Ratio)',
    defaultCutoffHz: 4800,
    defaultResonance: 0.25,
  },
  'stk:bowed': {
    id: 'stk:bowed',
    engineLabel: 'Stanford STK Bowed String Waveguide (stk:bowed)',
    topologySummary: 'Friction Stick-Slip Bow Table -> Bridge/Nut Coupled Delay Lines + Body SVF',
    primaryMacroLabel: 'BOW PRESSURE / BOW POSITION',
    defaultCutoffHz: 4600,
    defaultResonance: 0.36,
  },
  'stk:brass': {
    id: 'stk:brass',
    engineLabel: 'Stanford STK Lip-Reed Brass Waveguide (stk:brass)',
    topologySummary: '2-Pole Mass-Spring Lip Filter -> Conical Bore Delay + Bell Reflection Filter',
    primaryMacroLabel: 'BREATH PRESSURE / LIP TENSION',
    defaultCutoffHz: 4400,
    defaultResonance: 0.34,
  },
  'stk:saxofony': {
    id: 'stk:saxofony',
    engineLabel: 'Stanford STK Conical Bore Saxophone Waveguide (stk:saxofony)',
    topologySummary: 'Asymmetric Soft-Reed Table -> Conical Bore Waveguide + Blow Position Tap',
    primaryMacroLabel: 'BREATH / BLOW POSITION',
    defaultCutoffHz: 4500,
    defaultResonance: 0.32,
  },
  'stk:sitar': {
    id: 'stk:sitar',
    engineLabel: 'Stanford STK Curved-Bridge Jawari Sitar Waveguide (stk:sitar)',
    topologySummary: 'Pluck Noise Burst -> Curved-Bridge Jawari Phase Modulation + Sympathetic Drone',
    primaryMacroLabel: 'JAWARI (Bridge Buzz) / DAMPING (String Sustain)',
    defaultCutoffHz: 5600,
    defaultResonance: 0.35,
  },
  'stk:rhodey': {
    id: 'stk:rhodey',
    engineLabel: 'Stanford STK Fender Rhodes Tine & Tonebar 4-Op FM (stk:rhodey)',
    topologySummary: 'Dual 2-Op FM Pairs (Tine Bell + Bark Carrier) -> Asymmetric Stereo Tremolo',
    primaryMacroLabel: 'TIMBRE (Hammer Bark) / TREMOLO',
    defaultCutoffHz: 4800,
    defaultResonance: 0.22,
  },
  'stk:wurley': {
    id: 'stk:wurley',
    engineLabel: 'Stanford STK Wurlitzer 200A Steel Reed FM (stk:wurley)',
    topologySummary: 'High-Ratio Reed Modulator + Warm Carrier -> Resonant 8Hz Tremolo Filter',
    primaryMacroLabel: 'TIMBRE (Reed Bite) / TREMOLO',
    defaultCutoffHz: 4600,
    defaultResonance: 0.28,
  },
  'stk:bandedwg': {
    id: 'stk:bandedwg',
    engineLabel: 'Stanford STK Banded Waveguide Tibetan Bowl / Glass Harp (stk:bandedwg)',
    topologySummary: 'Bow/Strike Exciter -> 4 Bandpass-Filtered Mode Delay Loops',
    primaryMacroLabel: 'BOW PRESSURE / MODE COUPLING',
    defaultCutoffHz: 6000,
    defaultResonance: 0.4,
  },
};

const MODAL_BAR_RATIOS = [1.0, 2.756, 5.404, 8.933, 13.34, 18.64];
const BANDED_BOWL_RATIOS = [1.0, 2.78, 5.18, 8.15];

function fastTanh(x: number): number {
  if (x <= -3) return -1;
  if (x >= 3) return 1;
  const x2 = x * x;
  return (x * (27 + x2)) / (27 + 9 * x2);
}

/**
 * Pure-MIT Electro-Smith DaisySP (`daisy:*`) & Stanford Synthesis ToolKit (`stk:*`)
 * Physical Modeling & Waveguide Synthesis Engine.
 */
export class DaisyStkEngine {
  public static readonly PATCH_CATALOG: DaisyStkPatchId[] = Object.keys(
    DAISY_STK_PATCH_SPECS
  ) as DaisyStkPatchId[];

  public static isDaisyStkPatch(patch?: string, style?: string): boolean {
    const cleanStyle = (style || '').trim().toLowerCase();
    if (cleanStyle === 'daisy' || cleanStyle === 'stk' || cleanStyle === 'waveguide') {
      return true;
    }
    const cleanPatch = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!cleanPatch) return false;
    if (
      cleanPatch.startsWith('daisy:') ||
      cleanPatch.startsWith('daisy_') ||
      cleanPatch.startsWith('stk:') ||
      cleanPatch.startsWith('stk_')
    ) {
      return true;
    }
    return cleanPatch in DAISY_STK_PATCH_SPECS;
  }

  public static normalizePatchId(patch?: string): DaisyStkPatchId {
    const raw = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!raw) return 'daisy:string_voice';
    if (raw in DAISY_STK_PATCH_SPECS) return raw as DaisyStkPatchId;
    const norm = raw.replace(/^daisy_/, 'daisy:').replace(/^stk_/, 'stk:');
    if (norm in DAISY_STK_PATCH_SPECS) return norm as DaisyStkPatchId;

    if (norm.includes('sitar')) return 'stk:sitar';
    if (norm.includes('flute')) return 'stk:flute';
    if (norm.includes('clar')) return 'stk:clar';
    if (norm.includes('bow')) return 'stk:bowed';
    if (norm.includes('brass')) return 'stk:brass';
    if (norm.includes('sax')) return 'stk:saxofony';
    if (norm.includes('rhod')) return 'stk:rhodey';
    if (norm.includes('wurl')) return 'stk:wurley';
    if (norm.includes('band') || norm.includes('bowl')) return 'stk:bandedwg';
    if (norm.includes('modal')) return 'daisy:modal_voice';
    if (norm.includes('fm2')) return 'daisy:fm2';
    if (norm.includes('vosim')) return 'daisy:vosim';
    if (norm.includes('formant')) return 'daisy:formant_osc';
    return 'daisy:string_voice';
  }

  public static getTopologySpec(patch?: string): {
    engineLabel: string;
    topologySummary: string;
    primaryMacroLabel: string;
  } {
    const spec = DAISY_STK_PATCH_SPECS[this.normalizePatchId(patch)];
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
    const spec = DAISY_STK_PATCH_SPECS[patchId];

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

    const isPlucked =
      patchId === 'daisy:string_voice' ||
      patchId === 'daisy:modal_voice' ||
      patchId === 'stk:sitar' ||
      patchId === 'stk:rhodey' ||
      patchId === 'stk:wurley';

    const attackSec = Math.max(
      0.002,
      Number(item.def?.env?.attack ?? (isPlucked ? 0.004 : 0.028))
    );
    const decaySec = Math.max(
      0.05,
      Number(item.def?.env?.decay ?? (isPlucked ? 0.65 : 0.35))
    );
    const sustainLevel = Math.max(
      0.0,
      Math.min(1.0, Number(item.def?.env?.sustain ?? (isPlucked ? 0.25 : 0.85)))
    );
    const releaseSec = Math.max(0.03, Number(item.def?.env?.release ?? 0.2));

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

    const dampingNorm = Math.max(
      0.05,
      Math.min(
        0.98,
        ((phys?.dampingAmount ?? macros.damping ?? 68) as number) / 100
      )
    );
    const jawariNorm = Math.max(
      0,
      Math.min(
        1,
        ((phys?.jawariAmount ?? macros.jawari ?? 55) as number) / 100
      )
    );
    const breathNorm = Math.max(
      0.05,
      Math.min(
        1,
        ((phys?.breathAmount ?? macros.breath ?? 55) as number) / 100
      )
    );
    const jetNorm = Math.max(
      0.08,
      Math.min(
        0.92,
        ((phys?.jetAmount ?? macros.jet ?? 48) as number) / 100
      )
    );
    const bowPressNorm = Math.max(
      0.1,
      Math.min(
        1,
        ((phys?.bowPressure ?? macros.bow_pressure ?? 65) as number) / 100
      )
    );
    const bowPosNorm = Math.max(
      0.05,
      Math.min(
        0.9,
        ((phys?.bowPosition ?? macros.bow_position ?? 22) as number) / 100
      )
    );
    const timbreNorm = Math.max(
      0,
      Math.min(
        1,
        ((phys?.timbreAmount ?? macros.timbre ?? 52) as number) / 100
      )
    );

    let rngState = ((voiceSeed ^ 0x9e3779b9) >>> 0) || 0x13579bdf;
    const nextRand = (): number => {
      rngState ^= rngState << 13;
      rngState ^= rngState >>> 17;
      rngState ^= rngState << 5;
      return ((rngState >>> 0) / 4294967296) * 2 - 1;
    };

    // Per-note delay lines for waveguide models
    const delayLines: Float32Array[] = [];
    const delayWriteIdx = new Int32Array(numNotes);
    const lpStates = new Float32Array(numNotes);
    const apStates = new Float32Array(numNotes);
    const phase1 = new Float64Array(numNotes);
    const phase2 = new Float64Array(numNotes);

    for (let n = 0; n < numNotes; n++) {
      const f0 = Math.max(25, chordNotes[n].freq);
      const dLen = Math.max(8, Math.min(4096, Math.round(sampleRate / f0)));
      const buf = new Float32Array(dLen);
      for (let k = 0; k < dLen; k++) {
        const win = Math.sin((Math.PI * k) / Math.max(1, dLen - 1));
        buf[k] = nextRand() * 0.8 * (0.35 + 0.65 * win);
      }
      delayLines.push(buf);
      phase1[n] = (nextRand() + 1) * 0.5;
      phase2[n] = (nextRand() + 1) * 0.5;
    }

    const vowelStr =
      typeof phys?.lyric === 'string'
        ? phys.lyric
        : typeof phys?.vowelFormant === 'string'
          ? phys.vowelFormant
          : phys?.vowelFormant?.from || 'a';
    const vowelSpec = PhonemeEngine.decomposeLyric(vowelStr).primaryVowel;

    const basePan = Math.max(-1, Math.min(1, item.pan ?? 0));
    const panAngle = (basePan + 1) * 0.25 * Math.PI;
    const gainL = Math.cos(panAngle) * chordScale * 0.58;
    const gainR = Math.sin(panAngle) * chordScale * 0.58;

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

      const vib = phys?.vibrato ? Math.sin(2 * Math.PI * 5.4 * tSec) * 0.004 : 0;

      let sumL = 0;
      let sumR = 0;

      for (let n = 0; n < numNotes; n++) {
        const cn = chordNotes[n];
        const f0 = Math.max(24, Math.min(14000, cn.freq * (1 + vib)));
        const dt = f0 * dtBase;
        const noteAmp = Math.max(0.05, Math.min(1.5, cn.amp || item.amp || 0.78));

        phase1[n] = (phase1[n] + dt) % 1.0;
        const ph = phase1[n];

        let sigL = 0;
        let sigR = 0;

        switch (patchId) {
          case 'stk:sitar':
          case 'daisy:string_voice': {
            const buf = delayLines[n];
            const dLen = buf.length;
            const rIdx = delayWriteIdx[n];
            const delayed = buf[rIdx];
            // Jawari curved-bridge nonlinear dispersion allpass & harmonic buzz
            const jawariBuzz =
              patchId === 'stk:sitar' || jawariNorm > 0.1
                ? fastTanh(delayed * (1.2 + jawariNorm * 3.4))
                : delayed;
            const fbGain = 0.982 + dampingNorm * 0.0165;
            const lpCoeff = 0.45 + jawariNorm * 0.42;
            const filtered = lpStates[n] + lpCoeff * (jawariBuzz - lpStates[n]);
            lpStates[n] = filtered;
            const apCoeff = 0.25 + jawariNorm * 0.45;
            const apOut = -apCoeff * filtered + apStates[n];
            apStates[n] = filtered + apCoeff * apOut;
            buf[rIdx] = apOut * fbGain;
            delayWriteIdx[n] = (rIdx + 1) % dLen;

            const symp =
              Math.sin(2 * Math.PI * f0 * 1.5 * tSec) * 0.14 * jawariNorm +
              Math.sin(2 * Math.PI * f0 * 2.0 * tSec) * 0.1 * jawariNorm;
            sigL = (filtered + symp) * 0.85;
            sigR = (apOut - symp) * 0.85;
            break;
          }

          case 'stk:flute':
          case 'stk:clar':
          case 'stk:saxofony':
          case 'stk:brass': {
            const buf = delayLines[n];
            const dLen = buf.length;
            const rIdx = delayWriteIdx[n];
            const boreOut = buf[rIdx];
            const jetIdx = (rIdx + Math.max(1, Math.floor(dLen * jetNorm * 0.5))) % dLen;
            const jetDelayed = buf[jetIdx];
            const breathNoise = nextRand() * (0.08 + breathNorm * 0.22);
            const pressureDiff = (0.65 + breathNorm * 0.35) * env + breathNoise - jetDelayed * 0.55;
            // STK Jet cubic nonlinearity: x - x^3 clamped
            const xClamped = Math.max(-1.1, Math.min(1.1, pressureDiff));
            const jetNonLin =
              patchId === 'stk:flute'
                ? xClamped - 0.33 * xClamped * xClamped * xClamped
                : fastTanh(xClamped * (1.6 + timbreNorm * 1.4));
            const boreIn = jetNonLin * 0.55 + boreOut * 0.72;
            const lp = lpStates[n] + 0.58 * (boreIn - lpStates[n]);
            lpStates[n] = lp;
            buf[rIdx] = lp;
            delayWriteIdx[n] = (rIdx + 1) % dLen;

            const fundamental = Math.sin(2 * Math.PI * ph) * 0.42;
            sigL = (lp * 0.7 + fundamental) * 0.82;
            sigR = (boreOut * 0.7 + fundamental) * 0.82;
            break;
          }

          case 'stk:bowed':
          case 'stk:bandedwg': {
            const bowVel = (0.4 + bowPressNorm * 0.6) * env;
            let modalSumL = 0;
            let modalSumR = 0;
            for (let m = 0; m < BANDED_BOWL_RATIOS.length; m++) {
              const ratio =
                patchId === 'stk:bandedwg'
                  ? BANDED_BOWL_RATIOS[m]
                  : (m + 1) * (1 + bowPosNorm * 0.015 * m);
              const ampM = Math.sin((m + 1) * Math.PI * bowPosNorm) / (m + 1);
              const s = Math.sin(2 * Math.PI * f0 * ratio * tSec);
              modalSumL += s * ampM;
              modalSumR += s * ampM * (m % 2 === 0 ? 1 : -0.85);
            }
            sigL = fastTanh(modalSumL * (1.4 + bowPressNorm * 1.8)) * bowVel;
            sigR = fastTanh(modalSumR * (1.4 + bowPressNorm * 1.8)) * bowVel;
            break;
          }

          case 'daisy:modal_voice': {
            let mL = 0;
            let mR = 0;
            for (let m = 0; m < MODAL_BAR_RATIOS.length; m++) {
              const modeDecay = Math.exp(-tSec * (1.8 + m * 1.4) * (1.3 - dampingNorm * 0.8));
              const s = Math.sin(2 * Math.PI * f0 * MODAL_BAR_RATIOS[m] * tSec) * modeDecay;
              const w = 1 / (m + 1);
              mL += s * w;
              mR += s * w * (m % 2 === 0 ? 1 : -0.8);
            }
            sigL = mL * 0.78;
            sigR = mR * 0.78;
            break;
          }

          case 'daisy:vosim':
          case 'daisy:formant_osc': {
            const f1 = vowelSpec.f1 || 730;
            const f2 = vowelSpec.f2 || 1090;
            const s1 = Math.sin(2 * Math.PI * f1 * ph);
            const s2 = Math.sin(2 * Math.PI * f2 * ph);
            const windowDecay = Math.exp(-ph * (2.2 + (1 - timbreNorm) * 2.5));
            const vosimPulse = (s1 * s1 + 0.65 * s2 * s2 - 0.5) * windowDecay;
            sigL = vosimPulse * 0.9;
            sigR = vosimPulse * 0.9;
            break;
          }

          case 'stk:rhodey':
          case 'stk:wurley':
          case 'daisy:fm2':
          default: {
            const ratio = patchId === 'stk:rhodey' ? 14.0 : patchId === 'stk:wurley' ? 7.0 : 2.0;
            const index = (1.2 + timbreNorm * 3.5) * Math.exp(-tSec * 4.5);
            const tine = Math.sin(2 * Math.PI * f0 * ratio * tSec) * index;
            const body = Math.sin(2 * Math.PI * ph + tine);
            const tremL = 1 + 0.18 * Math.sin(2 * Math.PI * 5.2 * tSec);
            const tremR = 1 - 0.18 * Math.sin(2 * Math.PI * 5.2 * tSec);
            sigL = body * tremL * 0.75;
            sigR = body * tremR * 0.75;
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

      // 1st-order DC blocker
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
