import { AtomicEvent } from '../../parser/ASTSerializer';
import { CompiledScore, TrackDefinition } from '../../parser/DocumentParser';
import { ContinuousVoiceNote, ContinuousSynthEngine } from '../synths/ContinuousSynthEngine';
import { SynthEngineDisplaySpec } from '../synths/AbletonSynthSuite';

export type SuperColliderPatchId =
  | 'sc:default'
  | 'sc:prophet'
  | 'sc:tb303'
  | 'sc:jp8000'
  | 'sc:modal_bell'
  | 'sc:klank_resonator'
  | 'sc:dx7_brass'
  | 'sc:formant_choir'
  | 'sc:karplus_pluck'
  | 'sc:gendy_stochastic'
  | 'sc:pulsar_train'
  | 'sc:hoover';

interface SuperColliderPatchMeta {
  id: SuperColliderPatchId;
  synthDefName: string;
  engineLabel: string;
  topologySummary: string;
  primaryMacroLabel: string;
  defaultCutoffHz: number;
  defaultResonance: number;
  sclangBody: string;
}

const SC_PATCH_SPECS: Record<SuperColliderPatchId, SuperColliderPatchMeta> = {
  'sc:default': {
    id: 'sc:default',
    synthDefName: 'tenuto_sc_default',
    engineLabel: 'SuperCollider Default UGen (sc:default)',
    topologySummary: 'Linen.kr + VarSaw.ar([freq, freq*1.003]) -> LPF.ar -> OffsetOut.ar',
    primaryMacroLabel: 'VarSaw Width & LPF Cutoff',
    defaultCutoffHz: 2800,
    defaultResonance: 0.25,
    sclangBody: `var sig = Mix(VarSaw.ar([freq, freq * 1.003], 0, 0.35, 0.5));
  sig = LPF.ar(sig, cutoff.clip(80, 18000));`,
  },
  'sc:prophet': {
    id: 'sc:prophet',
    synthDefName: 'tenuto_sc_prophet',
    engineLabel: 'SuperCollider Prophet-5 Rev2 UGen (sc:prophet)',
    topologySummary: '5-Voice Pulse.ar(SinOsc.kr) + LFPulse.ar -> RLPF.ar -> Pan2.ar',
    primaryMacroLabel: 'PWM LFO Depth & RLPF Cutoff',
    defaultCutoffHz: 2600,
    defaultResonance: 0.42,
    sclangBody: `var pwm = SinOsc.kr(0.45, Rand(0, 6.28), 0.28, 0.5);
  var sig = Mix(Pulse.ar(freq * [0.996, 0.9985, 1.0, 1.0018, 1.0042], pwm)) * 0.24;
  sig = RLPF.ar(sig, cutoff.clip(90, 16000), (1.0 - (res * 0.75)).clip(0.12, 0.95));`,
  },
  'sc:tb303': {
    id: 'sc:tb303',
    synthDefName: 'tenuto_sc_tb303',
    engineLabel: 'SuperCollider Acid 303 Diode UGen (sc:tb303)',
    topologySummary: 'LFSaw/LFPulse.ar + ExpEnv Sweep -> RLPFD.ar + Tanh Diode Clip',
    primaryMacroLabel: 'Env Mod Sweep & Accent Resonance',
    defaultCutoffHz: 1100,
    defaultResonance: 0.72,
    sclangBody: `var fenv = EnvGen.kr(Env.perc(0.004, 0.24, 1.0, -5.0));
  var sig = Mix([LFSaw.ar(freq, 0, 0.65), LFPulse.ar(freq * 0.5, 0, 0.5, 0.35)]);
  sig = RLPF.ar(sig, (cutoff + (fenv * 3400)).clip(70, 16000), (1.0 - (res * 0.82)).clip(0.08, 0.92)).tanh;`,
  },
  'sc:jp8000': {
    id: 'sc:jp8000',
    synthDefName: 'tenuto_sc_jp8000',
    engineLabel: 'SuperCollider Splay.ar 7-Saw UGen (sc:jp8000)',
    topologySummary: 'Splay.ar(Saw.ar(freq * detune7)) + SubSin -> RLPF.ar +HPF.ar',
    primaryMacroLabel: 'Splay Detune & High-Pass Air',
    defaultCutoffHz: 4600,
    defaultResonance: 0.32,
    sclangBody: `var ratios = [0.989, 0.994, 0.998, 1.0, 1.0023, 1.0061, 1.0112];
  var sig = Mix(Saw.ar(freq * ratios)) * 0.22 + SinOsc.ar(freq * 0.5, 0, 0.25);
  sig = RLPF.ar(HPF.ar(sig, 85), cutoff.clip(120, 18000), (1.0 - (res * 0.7)).clip(0.15, 0.95));`,
  },
  'sc:modal_bell': {
    id: 'sc:modal_bell',
    synthDefName: 'tenuto_sc_modal_bell',
    engineLabel: 'SuperCollider Klank Modal Bell UGen (sc:modal_bell)',
    topologySummary: 'PinkNoiseStrike -> Klank.ar(6 Inharmonic Chime Modes)',
    primaryMacroLabel: 'Modal Decay & Partial Tilt',
    defaultCutoffHz: 6400,
    defaultResonance: 0.55,
    sclangBody: `var exc = Impulse.ar(0) + (PinkNoise.ar(0.18) * EnvGen.ar(Env.perc(0.001, 0.018)));
  var sig = Klank.ar(\`[[1.0, 2.0, 2.756, 3.86, 5.404, 7.13], [1.0, 0.48, 0.34, 0.22, 0.14, 0.08], [2.4, 1.9, 1.4, 1.0, 0.7, 0.45]], exc, freq) * 0.22;`,
  },
  'sc:klank_resonator': {
    id: 'sc:klank_resonator',
    synthDefName: 'tenuto_sc_klank_resonator',
    engineLabel: 'SuperCollider DynKlank Bank UGen (sc:klank_resonator)',
    topologySummary: 'Dust2/BrownNoise Exciter -> DynKlank.ar(8 Tuned Resonators)',
    primaryMacroLabel: 'Resonator Ring Time & Brightness',
    defaultCutoffHz: 4800,
    defaultResonance: 0.65,
    sclangBody: `var exc = BrownNoise.ar(0.08) + Dust2.ar(24, 0.22);
  var sig = DynKlank.ar(\`[[1.0, 1.498, 2.0, 2.52, 3.0, 3.99, 5.04, 6.0], [1.0, 0.55, 0.45, 0.32, 0.26, 0.18, 0.12, 0.08], [1.6, 1.3, 1.1, 0.95, 0.8, 0.65, 0.5, 0.4]], exc, freq) * 0.25;`,
  },
  'sc:dx7_brass': {
    id: 'sc:dx7_brass',
    synthDefName: 'tenuto_sc_dx7_brass',
    engineLabel: 'SuperCollider PMOsc 6-Op FM Brass UGen (sc:dx7_brass)',
    topologySummary: 'PMOsc.ar Carrier/Modulator Pair + Feedback -> LPF.ar',
    primaryMacroLabel: 'PMOsc Modulation Index & Bite',
    defaultCutoffHz: 5200,
    defaultResonance: 0.3,
    sclangBody: `var modEnv = EnvGen.kr(Env.adsr(0.03, 0.35, 0.55, 0.4));
  var sig = PMOsc.ar(freq, freq * 1.0, modEnv * 2.8, SinOsc.ar(freq * 3.0, 0, 0.35));
  sig = LPF.ar(sig, cutoff.clip(180, 18000));`,
  },
  'sc:formant_choir': {
    id: 'sc:formant_choir',
    synthDefName: 'tenuto_sc_formant_choir',
    engineLabel: 'SuperCollider Formant.ar Choir UGen (sc:formant_choir)',
    topologySummary: '3-Formant.ar(fundfreq, formfreq, bwfreq) Vowel Morph Bank',
    primaryMacroLabel: 'Formant Vowel Shift & Choir Width',
    defaultCutoffHz: 3800,
    defaultResonance: 0.5,
    sclangBody: `var f1 = Formant.ar(freq, 730, 90) * 0.55;
  var f2 = Formant.ar(freq * 1.002, 1090, 110) * 0.38;
  var f3 = Formant.ar(freq * 0.998, 2440, 160) * 0.22;
  var sig = LPF.ar(f1 + f2 + f3, cutoff.clip(250, 16000));`,
  },
  'sc:karplus_pluck': {
    id: 'sc:karplus_pluck',
    synthDefName: 'tenuto_sc_karplus_pluck',
    engineLabel: 'SuperCollider Pluck.ar Waveguide UGen (sc:karplus_pluck)',
    topologySummary: 'WhiteNoise Burst -> Pluck.ar(delaytime: 1/freq, coef: 0.24)',
    primaryMacroLabel: 'Waveguide Damping Coef & Pick Pos',
    defaultCutoffHz: 4200,
    defaultResonance: 0.35,
    sclangBody: `var trig = Impulse.ar(0);
  var sig = Pluck.ar(WhiteNoise.ar(0.65), trig, 0.05, (1.0 / freq.clip(25, 4000)), 3.2, 0.24);`,
  },
  'sc:gendy_stochastic': {
    id: 'sc:gendy_stochastic',
    synthDefName: 'tenuto_sc_gendy_stochastic',
    engineLabel: 'SuperCollider Gendy1.ar Xenakis UGen (sc:gendy_stochastic)',
    topologySummary: 'Gendy1.ar(ampdist:1, durdist:1, minfreq, maxfreq) -> RLPF.ar',
    primaryMacroLabel: 'Stochastic Breakpoint Drift & Filter',
    defaultCutoffHz: 3200,
    defaultResonance: 0.45,
    sclangBody: `var sig = Gendy1.ar(1, 1, 1.0, 1.0, freq * 0.985, freq * 1.015, 0.08, 0.06, 12) * 0.55;
  sig = RLPF.ar(sig, cutoff.clip(120, 16000), (1.0 - (res * 0.72)).clip(0.15, 0.95));`,
  },
  'sc:pulsar_train': {
    id: 'sc:pulsar_train',
    synthDefName: 'tenuto_sc_pulsar_train',
    engineLabel: 'SuperCollider Blip/GrainSin Pulsar UGen (sc:pulsar_train)',
    topologySummary: 'Blip.ar(freq, numharm) + Formant Window -> RLPF.ar',
    primaryMacroLabel: 'Pulsar Duty Cycle & Harmonics',
    defaultCutoffHz: 3900,
    defaultResonance: 0.4,
    sclangBody: `var nharm = (cutoff / freq.max(20)).clip(2, 48);
  var sig = Blip.ar(freq, nharm) * 0.55 + SinOsc.ar(freq * 2.0, 0, 0.25);
  sig = RLPF.ar(sig, cutoff.clip(140, 18000), (1.0 - (res * 0.7)).clip(0.15, 0.95));`,
  },
  'sc:hoover': {
    id: 'sc:hoover',
    synthDefName: 'tenuto_sc_hoover',
    engineLabel: 'SuperCollider Alpha Juno Hoover UGen (sc:hoover)',
    topologySummary: 'PWM Saw/Sub Stack + Pitch Env -> Dual Chorus Delay -> RLPF.ar',
    primaryMacroLabel: 'Hoover Pitch Dive & Chorus Rate',
    defaultCutoffHz: 3600,
    defaultResonance: 0.48,
    sclangBody: `var penv = EnvGen.kr(Env([0.88, 1.08, 1.0], [0.09, 0.22], \\exp));
  var f = freq * penv;
  var sig = Mix(VarSaw.ar(f * [0.5, 0.993, 1.0, 1.007, 2.002], 0, SinOsc.kr(3.2, 0, 0.35, 0.5))) * 0.26;
  sig = RLPF.ar(sig, cutoff.clip(110, 16000), (1.0 - (res * 0.72)).clip(0.14, 0.95));`,
  },
};

const MODAL_BELL_RATIOS = [1.0, 2.0, 2.756, 3.86, 5.404, 7.13];
const MODAL_BELL_AMPS = [1.0, 0.48, 0.34, 0.22, 0.14, 0.08];
const MODAL_BELL_DECAYS = [2.4, 1.9, 1.4, 1.0, 0.7, 0.45];

const KLANK_RESONATOR_RATIOS = [1.0, 1.498, 2.0, 2.52, 3.0, 3.99, 5.04, 6.0];
const KLANK_RESONATOR_AMPS = [1.0, 0.55, 0.45, 0.32, 0.26, 0.18, 0.12, 0.08];
const KLANK_RESONATOR_DECAYS = [1.6, 1.3, 1.1, 0.95, 0.8, 0.65, 0.5, 0.4];

const FORMANT_VOWELS: Record<string, [number, number, number]> = {
  a: [730, 1090, 2440],
  e: [530, 1840, 2480],
  i: [270, 2290, 3010],
  o: [570, 840, 2410],
  u: [300, 870, 2240],
};

function polyBlep(t: number, dt: number): number {
  if (dt <= 0) return 0;
  if (t < dt) {
    const u = t / dt;
    return u + u - u * u - 1.0;
  }
  if (t > 1.0 - dt) {
    const u = (t - 1.0) / dt;
    return u * u + u + u + 1.0;
  }
  return 0.0;
}

/**
 * Pure-MIT SuperCollider (`scsynth`) UGen-Graph Synthesis Engine,
 * RFC-Compliant Binary OSC 1.1 Packet Encoder (`/s_new`, `#bundle`),
 * and `.scd` (`sclang` `SynthDef` + `Pbind`) Score Exporter.
 *
 * Licensing: 100% original TypeScript / WebAudio DSP authored under the MIT License.
 * Contains zero GPL/AGPL code while remaining wire-compatible with `scsynth` OSC 1.1 and `sclang`.
 */
export class SuperColliderEngine {
  public static readonly SC_PATCH_CATALOG: SuperColliderPatchId[] = Object.keys(
    SC_PATCH_SPECS
  ) as SuperColliderPatchId[];

  public static isSuperColliderPatch(patch?: string, style?: string): boolean {
    const cleanStyle = (style || '').trim().toLowerCase();
    if (
      cleanStyle === 'scsynth' ||
      cleanStyle === 'supercollider' ||
      cleanStyle === 'superdirt'
    ) {
      return true;
    }
    const cleanPatch = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!cleanPatch) return false;
    if (
      cleanPatch.startsWith('sc:') ||
      cleanPatch.startsWith('sc_') ||
      cleanPatch.startsWith('sonic-pi-')
    ) {
      return true;
    }
    return cleanPatch in SC_PATCH_SPECS;
  }

  public static normalizePatchId(patch?: string): SuperColliderPatchId {
    const raw = (patch || '').trim().toLowerCase().replace(/^"|"$/g, '');
    if (!raw) return 'sc:default';
    const stripped = raw
      .replace(/^sc:/, '')
      .replace(/^sc_/, '')
      .replace(/^sonic-pi-/, '');
    const candidate = `sc:${stripped}` as SuperColliderPatchId;
    if (candidate in SC_PATCH_SPECS) {
      return candidate;
    }
    if (stripped.includes('prophet')) return 'sc:prophet';
    if (stripped.includes('303') || stripped.includes('tb303') || stripped.includes('acid')) {
      return 'sc:tb303';
    }
    if (stripped.includes('jp8000') || stripped.includes('supersaw') || stripped.includes('splay')) {
      return 'sc:jp8000';
    }
    if (stripped.includes('bell') || stripped.includes('modal')) return 'sc:modal_bell';
    if (stripped.includes('klank') || stripped.includes('reson')) return 'sc:klank_resonator';
    if (stripped.includes('dx7') || stripped.includes('pmosc') || stripped.includes('fm')) {
      return 'sc:dx7_brass';
    }
    if (stripped.includes('formant') || stripped.includes('choir')) return 'sc:formant_choir';
    if (stripped.includes('pluck') || stripped.includes('karplus')) return 'sc:karplus_pluck';
    if (stripped.includes('gendy') || stripped.includes('stochastic')) {
      return 'sc:gendy_stochastic';
    }
    if (stripped.includes('pulsar') || stripped.includes('blip') || stripped.includes('grain')) {
      return 'sc:pulsar_train';
    }
    if (stripped.includes('hoover') || stripped.includes('juno')) return 'sc:hoover';
    return 'sc:default';
  }

  public static getPatchSpec(patch?: string): SuperColliderPatchMeta {
    const id = this.normalizePatchId(patch);
    return SC_PATCH_SPECS[id] || SC_PATCH_SPECS['sc:default'];
  }

  public static getEngineDisplaySpec(patch?: string): SynthEngineDisplaySpec {
    const spec = this.getPatchSpec(patch);
    return {
      engineLabel: spec.engineLabel,
      topologySummary: spec.topologySummary,
      primaryMacroLabel: spec.primaryMacroLabel,
    };
  }

  /**
   * Encodes an ASCII string into a 4-byte null-padded OSC 1.1 string buffer.
   */
  public static encodeOscString(str: string): Uint8Array {
    const rawLen = str.length + 1; // +1 for mandatory null terminator
    const paddedLen = (rawLen + 3) & ~3;
    const out = new Uint8Array(paddedLen);
    for (let i = 0; i < str.length; i++) {
      out[i] = str.charCodeAt(i) & 0x7f;
    }
    return out;
  }

  /**
   * Encodes an `scsynth` `/s_new` OSC 1.1 message packet:
   * `/s_new`, `synthDefName` (s), `nodeId` (i), `addAction` (i), `targetGroupId` (i),
   * followed by `key` (s), `value` (f | i | s) pairs.
   */
  public static encodeOscSNewMessage(
    synthDefName: string,
    nodeId: number = -1,
    addAction: number = 0,
    targetGroupId: number = 1,
    controls: Record<string, number | string> = {}
  ): Uint8Array {
    const entries = Object.entries(controls);
    let typeTags = ',siii';
    for (const [, val] of entries) {
      if (typeof val === 'string') {
        typeTags += 'ss';
      } else if (Number.isInteger(val) && Math.abs(val) < 0x7fffffff && false) {
        typeTags += 'si';
      } else {
        typeTags += 'sf';
      }
    }

    const addrBytes = this.encodeOscString('/s_new');
    const tagBytes = this.encodeOscString(typeTags);
    const defBytes = this.encodeOscString(synthDefName);

    const argChunks: Uint8Array[] = [];
    const headerInts = new ArrayBuffer(12);
    const headerView = new DataView(headerInts);
    headerView.setInt32(0, nodeId, false);
    headerView.setInt32(4, addAction, false);
    headerView.setInt32(8, targetGroupId, false);
    argChunks.push(new Uint8Array(headerInts));

    for (const [key, val] of entries) {
      argChunks.push(this.encodeOscString(key));
      if (typeof val === 'string') {
        argChunks.push(this.encodeOscString(val));
      } else {
        const fBuf = new ArrayBuffer(4);
        new DataView(fBuf).setFloat32(0, Number(val), false);
        argChunks.push(new Uint8Array(fBuf));
      }
    }

    const totalLen =
      addrBytes.length +
      tagBytes.length +
      defBytes.length +
      argChunks.reduce((acc, c) => acc + c.length, 0);
    const packet = new Uint8Array(totalLen);
    let offset = 0;
    packet.set(addrBytes, offset);
    offset += addrBytes.length;
    packet.set(tagBytes, offset);
    offset += tagBytes.length;
    packet.set(defBytes, offset);
    offset += defBytes.length;
    for (const chunk of argChunks) {
      packet.set(chunk, offset);
      offset += chunk.length;
    }
    return packet;
  }

  /**
   * Wraps one or more binary OSC messages into a timestamped OSC 1.1 `#bundle` packet.
   */
  public static encodeOscTimedBundle(
    timeSeconds: number,
    messages: Uint8Array[]
  ): Uint8Array {
    const bundleHeader = this.encodeOscString('#bundle'); // 8 bytes
    const timetagBuf = new ArrayBuffer(8);
    const ttView = new DataView(timetagBuf);
    const secInt = Math.max(0, Math.floor(timeSeconds));
    const fracInt = Math.floor((Math.max(0, timeSeconds) - secInt) * 4294967296);
    ttView.setUint32(0, secInt + 2208988800, false); // NTP epoch offset
    ttView.setUint32(4, fracInt >>> 0, false);

    const totalMessagesLen = messages.reduce((sum, m) => sum + 4 + m.length, 0);
    const out = new Uint8Array(8 + 8 + totalMessagesLen);
    out.set(bundleHeader, 0);
    out.set(new Uint8Array(timetagBuf), 8);

    let offset = 16;
    const outView = new DataView(out.buffer);
    for (const msg of messages) {
      outView.setInt32(offset, msg.length, false);
      offset += 4;
      out.set(msg, offset);
      offset += msg.length;
    }
    return out;
  }

  /**
   * Compiles all melodic events in a `CompiledScore` into a sequence of timestamped
   * binary OSC 1.1 `#bundle` packets ready for UDP/WebSocket transmission to `scsynth`.
   */
  public static buildScoreOscBundles(score: CompiledScore): Uint8Array[] {
    const tempo = Math.max(20, score.meta?.tempo || 120);
    const secPerWhole = (60 / tempo) * 4;
    const defsById = new Map<string, TrackDefinition>();
    for (const d of score.defs || []) {
      defsById.set(d.id, d);
    }

    const bundles: Uint8Array[] = [];
    let nextNodeId = 1000;

    for (const ev of score.events || []) {
      if (!ev.pitch || ev.pitch.isRest || ev.pitch.isSpacer || !ev.startTime) continue;
      const def = defsById.get(ev.trackId || '');
      const spec = this.getPatchSpec(ev.patch || def?.patch);
      const startWhole = ev.startTime.numerator / Math.max(1, ev.startTime.denominator);
      const durWhole = ev.duration.numerator / Math.max(1, ev.duration.denominator);
      const startSec = startWhole * secPerWhole;
      const sustainSec = Math.max(0.03, durWhole * secPerWhole);
      const freq =
        typeof ev.pitch.frequency === 'number' && ev.pitch.frequency > 0
          ? ev.pitch.frequency
          : 440 * Math.pow(2, (ev.pitch.midi - 69) / 12);
      const amp = Math.max(0.01, Math.min(1.0, (ev.velocity ?? 90) / 127));
      const pan = Math.max(-1, Math.min(1, ev.physics?.pan ?? def?.pan ?? 0));
      const cutoff =
        ev.physics?.cutoff ??
        ev.physics?.filterSweep?.[1] ??
        (def?.macros?.cutoff as number | undefined) ??
        spec.defaultCutoffHz;
      const res =
        ev.physics?.resonance ??
        (def?.macros?.resonance as number | undefined) ??
        spec.defaultResonance;

      const msg = this.encodeOscSNewMessage(spec.synthDefName, nextNodeId++, 0, 1, {
        freq,
        amp,
        sustain: sustainSec,
        pan,
        cutoff: Number(cutoff),
        res: Number(res),
      });
      bundles.push(this.encodeOscTimedBundle(startSec, [msg]));
    }
    return bundles;
  }

  /**
   * Exports a `CompiledScore` into a standalone, self-booting SuperCollider (`.scd`)
   * `sclang` script containing `SynthDef(...).add` declarations and `Ppar` / `Pbind` patterns.
   */
  public static exportSuperColliderScd(score: CompiledScore): string {
    const title = score.meta?.title || 'Tenuto Studio 5 Composition';
    const tempo = Math.max(20, score.meta?.tempo || 120);
    const defsById = new Map<string, TrackDefinition>();
    for (const d of score.defs || []) {
      defsById.set(d.id, d);
    }

    const usedPatchIds = new Set<SuperColliderPatchId>();
    for (const d of score.defs || []) {
      usedPatchIds.add(this.normalizePatchId(d.patch));
    }
    for (const ev of score.events || []) {
      if (ev.patch) usedPatchIds.add(this.normalizePatchId(ev.patch));
    }
    if (usedPatchIds.size === 0) {
      usedPatchIds.add('sc:default');
    }

    const lines: string[] = [
      `// ============================================================================`,
      `// Tenuto Studio 5 (v5.5.6) — SuperCollider (.scd) UGen-Graph & Pbind Export`,
      `// Title: ${title}`,
      `// Tempo: ${tempo} BPM | License: MIT`,
      `// ============================================================================`,
      `s.waitForBoot({`,
      `  TempoClock.default.tempo = ${(tempo / 60).toFixed(4)};`,
      ``,
    ];

    for (const patchId of usedPatchIds) {
      const spec = SC_PATCH_SPECS[patchId] || SC_PATCH_SPECS['sc:default'];
      lines.push(
        `  // ${spec.engineLabel} — ${spec.topologySummary}`,
        `  SynthDef(\\${spec.synthDefName}, { |out=0, freq=440, amp=0.35, sustain=0.5, pan=0.0, cutoff=${spec.defaultCutoffHz}, res=${spec.defaultResonance}|`,
        `    var env = EnvGen.kr(Env.linen(0.012, sustain.max(0.02), 0.14, 1.0, \\sin), doneAction: Done.freeSelf);`,
        `    ${spec.sclangBody}`,
        `    OffsetOut.ar(out, Pan2.ar(sig * env * amp, pan));`,
        `  }).add;`,
        ``
      );
    }

    lines.push(`  s.sync;`, ``);

    const eventsByTrack = new Map<string, AtomicEvent[]>();
    for (const ev of score.events || []) {
      if (!ev.pitch || ev.pitch.isSpacer || !ev.startTime) continue;
      const tid = ev.trackId || 'main';
      let list = eventsByTrack.get(tid);
      if (!list) {
        list = [];
        eventsByTrack.set(tid, list);
      }
      list.push(ev);
    }

    const pbindBlocks: string[] = [];
    for (const [trackId, evs] of eventsByTrack.entries()) {
      evs.sort((a, b) => {
        const sa = a.startTime!.numerator / Math.max(1, a.startTime!.denominator);
        const sb = b.startTime!.numerator / Math.max(1, b.startTime!.denominator);
        return sa - sb;
      });
      const def = defsById.get(trackId);
      const spec = this.getPatchSpec(def?.patch);
      const midis: string[] = [];
      const durs: string[] = [];
      const amps: string[] = [];

      for (const ev of evs) {
        const durBeats =
          (ev.duration.numerator / Math.max(1, ev.duration.denominator)) * 4;
        durs.push(Number(durBeats.toFixed(4)).toString());
        if (ev.pitch.isRest) {
          midis.push('\\rest');
          amps.push('0.0');
        } else {
          midis.push(ev.pitch.midi.toString());
          amps.push(((ev.velocity ?? 90) / 127).toFixed(3));
        }
      }

      const panVal = (def?.pan ?? 0).toFixed(2);
      const cutoffVal = Number(def?.macros?.cutoff ?? spec.defaultCutoffHz).toFixed(1);
      pbindBlocks.push(
        `    // Track: ${def?.name || trackId} (${spec.id})\n` +
          `    Pbind(\n` +
          `      \\instrument, \\${spec.synthDefName},\n` +
          `      \\midinote, Pseq([${midis.join(', ')}], 1),\n` +
          `      \\dur, Pseq([${durs.join(', ')}], 1),\n` +
          `      \\amp, Pseq([${amps.join(', ')}], 1),\n` +
          `      \\pan, ${panVal},\n` +
          `      \\cutoff, ${cutoffVal}\n` +
          `    )`
      );
    }

    if (pbindBlocks.length > 0) {
      lines.push(`  Ppar([`, pbindBlocks.join(',\n'), `  ]).play;`);
    }
    lines.push(`});`, ``);
    return lines.join('\n');
  }

  /**
   * Synthesizes a `sc:*` UGen-Graph voice directly into `trackLeft` and `trackRight` stereo PCM stems.
   * Supports polyphonic chords (`item.chordVoices`), `.glide(ms)` / `mpeBend`, `.filter(start, end)`,
   * `.detune()`, `.vowel()`, and ADSR envelopes with zero external dependencies.
   */
  public static renderUGenVoiceIntoStereo(
    trackLeft: Float32Array,
    trackRight: Float32Array,
    startFrame: number,
    noteFrames: number,
    sampleRate: number,
    _tempoBpm: number,
    voiceSeed: number,
    item: ContinuousVoiceNote
  ): void {
    const endFrame = Math.min(trackLeft.length, trackRight.length, startFrame + noteFrames);
    const len = endFrame - startFrame;
    if (len <= 0) return;

    const phys = item.event.physics;
    const macros = item.def?.macros || {};
    const patchId = this.normalizePatchId(item.event.patch || item.def?.patch);
    const spec = SC_PATCH_SPECS[patchId] || SC_PATCH_SPECS['sc:default'];

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

    const envSpec = item.def?.env;
    const attackSec = Math.max(
      0.002,
      Number(
        envSpec?.attack ??
          (patchId === 'sc:modal_bell' ||
          patchId === 'sc:karplus_pluck' ||
          patchId === 'sc:tb303'
            ? 0.003
            : patchId === 'sc:formant_choir'
              ? 0.09
              : 0.015)
      )
    );
    const decaySec = Math.max(0.04, Number(envSpec?.decay ?? 0.35));
    const sustainLevel = Math.max(
      0.0,
      Math.min(
        1.0,
        Number(
          envSpec?.sustain ??
            (patchId === 'sc:modal_bell' || patchId === 'sc:karplus_pluck' ? 0.15 : 0.78)
        )
      )
    );
    const releaseSec = Math.max(0.03, Number(envSpec?.release ?? 0.2));

    const baseCutoff = Math.max(
      60,
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
      60,
      Math.min(
        18000,
        Number(phys?.filterSweep?.[1] ?? baseCutoff)
      )
    );
    const resNorm = Math.max(
      0.05,
      Math.min(
        0.92,
        Number(phys?.resonance ?? macros.resonance ?? spec.defaultResonance)
      )
    );

    const basePan = Math.max(-1, Math.min(1, item.pan ?? 0));
    const panAngle = (basePan + 1) * 0.25 * Math.PI;
    const gainL = Math.cos(panAngle) * chordScale * 0.58;
    const gainR = Math.sin(panAngle) * chordScale * 0.58;

    let rngState = ((voiceSeed ^ 0x9e3779b9) >>> 0) || 0x12345678;
    const nextRand = (): number => {
      rngState ^= rngState << 13;
      rngState ^= rngState >>> 17;
      rngState ^= rngState << 5;
      return ((rngState >>> 0) / 4294967296) * 2 - 1;
    };

    // Per-note state arrays for oscillators / waveguides / Gendy breakpoints
    const p1 = new Float64Array(numNotes);
    const p2 = new Float64Array(numNotes);
    const p3 = new Float64Array(numNotes);
    const p4 = new Float64Array(numNotes);
    const p5 = new Float64Array(numNotes);

    for (let n = 0; n < numNotes; n++) {
      p1[n] = (nextRand() + 1) * 0.5;
      p2[n] = (nextRand() + 1) * 0.5;
      p3[n] = (nextRand() + 1) * 0.5;
      p4[n] = (nextRand() + 1) * 0.5;
      p5[n] = (nextRand() + 1) * 0.5;
    }

    // Karplus-Strong delay lines (`Pluck.ar`)
    const ksLines: Float32Array[] = [];
    const ksWriteIdx = new Int32Array(numNotes);
    const ksLpState = new Float32Array(numNotes);
    if (patchId === 'sc:karplus_pluck') {
      for (let n = 0; n < numNotes; n++) {
        const f0 = Math.max(25, chordNotes[n].freq);
        const delayLen = Math.max(8, Math.min(4096, Math.round(sampleRate / f0)));
        const buf = new Float32Array(delayLen);
        for (let k = 0; k < delayLen; k++) {
          buf[k] = nextRand() * 0.85;
        }
        ksLines.push(buf);
      }
    }

    // Gendy1 stochastic states
    const gendyAmp = new Float32Array(numNotes);
    const gendyTarget = new Float32Array(numNotes);
    const gendyPhase = new Float32Array(numNotes);
    if (patchId === 'sc:gendy_stochastic') {
      for (let n = 0; n < numNotes; n++) {
        gendyAmp[n] = nextRand() * 0.5;
        gendyTarget[n] = nextRand() * 0.7;
      }
    }

    // Chamberlin 2-pole SVF state (`RLPF.ar` / `LPF.ar`)
    let svfLowL = 0;
    let svfBandL = 0;
    let svfLowR = 0;
    let svfBandR = 0;

    const glideSec = (phys?.glideMs ?? 0) / 1000;
    const glideStartU =
      glideSec > 0 ? Math.max(0.65, 1.0 - glideSec / Math.max(0.05, durSec)) : 1.0;

    const rawVowel = phys?.vowelFormant;
    const vowelKey = (
      typeof rawVowel === 'string' ? rawVowel : rawVowel?.from || 'a'
    )
      .toLowerCase()
      .charAt(0);
    const formants = FORMANT_VOWELS[vowelKey] || FORMANT_VOWELS.a;

    for (let i = 0; i < len; i++) {
      const tSec = i * dtBase;
      const uNorm = Math.min(1, i / Math.max(1, len - 1));

      // Linen / ADSR envelope (`EnvGen.kr`)
      let env = 1.0;
      if (tSec < attackSec) {
        env = tSec / attackSec;
      } else if (tSec < attackSec + decaySec) {
        const dU = (tSec - attackSec) / decaySec;
        env = 1.0 - (1.0 - sustainLevel) * dU;
      } else if (tSec <= durSec) {
        env = sustainLevel;
      } else {
        const relT = tSec - durSec;
        env = sustainLevel * Math.exp(-relT / Math.max(0.015, releaseSec * 0.38));
      }

      // Dynamic filter cutoff sweep
      let instCutoff = baseCutoff + (targetCutoff - baseCutoff) * uNorm;
      if (phys?.cutoffMod) {
        instCutoff = ContinuousSynthEngine.evaluateWindowedModulation(
          phys.cutoffMod,
          uNorm,
          baseCutoff,
          durSec,
          glideSec
        );
      }
      if (patchId === 'sc:tb303') {
        const acidEnv = Math.exp(-tSec / 0.16);
        instCutoff += acidEnv * 3200;
      }

      let sigL = 0;
      let sigR = 0;

      for (let n = 0; n < numNotes; n++) {
        const cn = chordNotes[n];
        let noteFreq = cn.freq;
        if (cn.mpeBend && cn.mpeBend.length >= 2) {
          const bendTarget = cn.mpeBend[cn.mpeBend.length - 1] || 0;
          if (uNorm >= glideStartU && Math.abs(bendTarget) > 1e-4) {
            const gU = (uNorm - glideStartU) / Math.max(1e-4, 1.0 - glideStartU);
            const smoothG = gU * gU * (3 - 2 * gU);
            noteFreq *= Math.pow(2, (bendTarget * smoothG) / 12);
          }
        }
        const dt = Math.min(0.45, Math.max(1e-5, noteFreq * dtBase));
        const noteAmp = cn.amp;

        let voiceSampleL = 0;
        let voiceSampleR = 0;

        switch (patchId) {
          case 'sc:prophet': {
            const pwm = 0.5 + 0.28 * Math.sin(2 * Math.PI * 0.45 * tSec + n);
            const dtA = dt * 0.9975;
            const dtB = dt * 1.0025;
            p1[n] = (p1[n] + dtA) % 1.0;
            p2[n] = (p2[n] + dtB) % 1.0;
            p3[n] = (p3[n] + dt * 0.5) % 1.0;
            const sawA = 2 * p1[n] - 1 - polyBlep(p1[n], dtA);
            const pulseB =
              (p2[n] < pwm ? 1 : -1) -
              polyBlep(p2[n], dtB) +
              polyBlep((p2[n] - pwm + 1.0) % 1.0, dtB);
            const subSq = p3[n] < 0.5 ? 0.35 : -0.35;
            voiceSampleL = (sawA * 0.48 + pulseB * 0.38 + subSq) * noteAmp;
            voiceSampleR = (sawA * 0.38 + pulseB * 0.48 + subSq) * noteAmp;
            break;
          }
          case 'sc:tb303': {
            p1[n] = (p1[n] + dt) % 1.0;
            p2[n] = (p2[n] + dt * 0.5) % 1.0;
            const saw = 2 * p1[n] - 1 - polyBlep(p1[n], dt);
            const sqSub = p2[n] < 0.5 ? 0.32 : -0.32;
            const raw = Math.tanh((saw * 0.78 + sqSub) * 1.85) * noteAmp;
            voiceSampleL = raw;
            voiceSampleR = raw;
            break;
          }
          case 'sc:jp8000': {
            const d1 = dt * 0.991;
            const d2 = dt * 0.997;
            const d3 = dt * 1.0;
            const d4 = dt * 1.0035;
            const d5 = dt * 1.0095;
            p1[n] = (p1[n] + d1) % 1.0;
            p2[n] = (p2[n] + d2) % 1.0;
            p3[n] = (p3[n] + d3) % 1.0;
            p4[n] = (p4[n] + d4) % 1.0;
            p5[n] = (p5[n] + d5) % 1.0;
            const s1 = 2 * p1[n] - 1 - polyBlep(p1[n], d1);
            const s2 = 2 * p2[n] - 1 - polyBlep(p2[n], d2);
            const s3 = 2 * p3[n] - 1 - polyBlep(p3[n], d3);
            const s4 = 2 * p4[n] - 1 - polyBlep(p4[n], d4);
            const s5 = 2 * p5[n] - 1 - polyBlep(p5[n], d5);
            voiceSampleL = (s3 * 0.45 + s1 * 0.28 + s2 * 0.24 + s4 * 0.14) * noteAmp;
            voiceSampleR = (s3 * 0.45 + s5 * 0.28 + s4 * 0.24 + s2 * 0.14) * noteAmp;
            break;
          }
          case 'sc:modal_bell': {
            let sumL = 0;
            let sumR = 0;
            for (let m = 0; m < MODAL_BELL_RATIOS.length; m++) {
              const modeFreq = noteFreq * MODAL_BELL_RATIOS[m];
              if (modeFreq >= sampleRate * 0.47) continue;
              const modeEnv = Math.exp(-tSec / MODAL_BELL_DECAYS[m]);
              const ph = 2 * Math.PI * modeFreq * tSec + m * 0.7;
              const partial = Math.sin(ph) * MODAL_BELL_AMPS[m] * modeEnv;
              sumL += partial * (m % 2 === 0 ? 1.0 : 0.75);
              sumR += partial * (m % 2 === 1 ? 1.0 : 0.75);
            }
            const strike = tSec < 0.015 ? nextRand() * Math.exp(-tSec / 0.004) * 0.25 : 0;
            voiceSampleL = (sumL * 0.42 + strike) * noteAmp;
            voiceSampleR = (sumR * 0.42 + strike) * noteAmp;
            break;
          }
          case 'sc:klank_resonator': {
            let sumL = 0;
            let sumR = 0;
            for (let m = 0; m < KLANK_RESONATOR_RATIOS.length; m++) {
              const modeFreq = noteFreq * KLANK_RESONATOR_RATIOS[m];
              if (modeFreq >= sampleRate * 0.47) continue;
              const modeEnv = Math.exp(-tSec / KLANK_RESONATOR_DECAYS[m]);
              const shimmer = 1.0 + 0.12 * Math.sin(2 * Math.PI * (1.4 + m * 0.3) * tSec);
              const partial =
                Math.sin(2 * Math.PI * modeFreq * tSec + m * 1.1) *
                KLANK_RESONATOR_AMPS[m] *
                modeEnv *
                shimmer;
              sumL += partial * (m % 2 === 0 ? 0.95 : 0.7);
              sumR += partial * (m % 2 === 1 ? 0.95 : 0.7);
            }
            voiceSampleL = sumL * 0.44 * noteAmp;
            voiceSampleR = sumR * 0.44 * noteAmp;
            break;
          }
          case 'sc:dx7_brass': {
            p1[n] = (p1[n] + dt) % 1.0;
            p2[n] = (p2[n] + dt * 1.0015) % 1.0;
            p3[n] = (p3[n] + dt * 3.0) % 1.0;
            const modIndex = 2.6 * Math.exp(-tSec / 0.45) + 0.85;
            const mod3 = Math.sin(2 * Math.PI * p3[n]) * 0.35;
            const mod1 = Math.sin(2 * Math.PI * p2[n] + mod3) * modIndex;
            const carrierL = Math.sin(2 * Math.PI * p1[n] + mod1);
            const carrierR = Math.sin(2 * Math.PI * p2[n] + mod1 * 0.96);
            voiceSampleL = carrierL * 0.62 * noteAmp;
            voiceSampleR = carrierR * 0.62 * noteAmp;
            break;
          }
          case 'sc:formant_choir': {
            p1[n] = (p1[n] + dt * 0.9985) % 1.0;
            p2[n] = (p2[n] + dt * 1.0015) % 1.0;
            const r1 = Math.max(1, Math.round(formants[0] / Math.max(40, noteFreq)));
            const r2 = Math.max(2, Math.round(formants[1] / Math.max(40, noteFreq)));
            const r3 = Math.max(3, Math.round(formants[2] / Math.max(40, noteFreq)));
            const wL = 0.55 * (1 + Math.cos(2 * Math.PI * p1[n]));
            const wR = 0.55 * (1 + Math.cos(2 * Math.PI * p2[n]));
            const fL =
              (Math.sin(2 * Math.PI * p1[n] * r1) * 0.55 +
                Math.sin(2 * Math.PI * p1[n] * r2) * 0.32 +
                Math.sin(2 * Math.PI * p1[n] * r3) * 0.16) *
              wL;
            const fR =
              (Math.sin(2 * Math.PI * p2[n] * r1) * 0.55 +
                Math.sin(2 * Math.PI * p2[n] * r2) * 0.32 +
                Math.sin(2 * Math.PI * p2[n] * r3) * 0.16) *
              wR;
            voiceSampleL = fL * 0.65 * noteAmp;
            voiceSampleR = fR * 0.65 * noteAmp;
            break;
          }
          case 'sc:karplus_pluck': {
            const line = ksLines[n];
            if (line && line.length > 0) {
              const idx = ksWriteIdx[n];
              const nextIdx = (idx + 1) % line.length;
              const currentOut = line[idx];
              const avg = 0.5 * (currentOut + line[nextIdx]);
              ksLpState[n] = ksLpState[n] * 0.22 + avg * 0.78;
              line[idx] = ksLpState[n] * 0.994;
              ksWriteIdx[n] = nextIdx;
              voiceSampleL = currentOut * 0.72 * noteAmp;
              voiceSampleR = line[nextIdx] * 0.72 * noteAmp;
            }
            break;
          }
          case 'sc:gendy_stochastic': {
            gendyPhase[n] += dt;
            if (gendyPhase[n] >= 1.0) {
              gendyPhase[n] -= 1.0;
              gendyAmp[n] = gendyTarget[n];
              const step = nextRand() * 0.28;
              gendyTarget[n] = Math.max(-0.85, Math.min(0.85, gendyTarget[n] + step));
            }
            const interp =
              gendyAmp[n] + (gendyTarget[n] - gendyAmp[n]) * gendyPhase[n];
            p1[n] = (p1[n] + dt) % 1.0;
            const anchorSaw = 2 * p1[n] - 1 - polyBlep(p1[n], dt);
            voiceSampleL = (interp * 0.55 + anchorSaw * 0.35) * noteAmp;
            voiceSampleR = (interp * 0.48 + anchorSaw * 0.42) * noteAmp;
            break;
          }
          case 'sc:pulsar_train': {
            p1[n] = (p1[n] + dt) % 1.0;
            const duty = 0.28 + 0.15 * Math.sin(2 * Math.PI * 1.8 * tSec);
            let pulsaret = 0;
            if (p1[n] < duty) {
              const uP = p1[n] / duty;
              const hann = 0.5 * (1 - Math.cos(2 * Math.PI * uP));
              pulsaret = Math.sin(2 * Math.PI * 3.0 * uP) * hann;
            }
            const sub = Math.sin(2 * Math.PI * p1[n]) * 0.35;
            voiceSampleL = (pulsaret * 0.68 + sub) * noteAmp;
            voiceSampleR = (pulsaret * 0.64 + sub) * noteAmp;
            break;
          }
          case 'sc:hoover': {
            const hooverEnv =
              tSec < 0.09
                ? 0.88 + (tSec / 0.09) * 0.2
                : 1.0 + 0.08 * Math.exp(-(tSec - 0.09) / 0.18);
            const hDt = Math.min(0.45, dt * hooverEnv);
            const pwm = 0.5 + 0.34 * Math.sin(2 * Math.PI * 3.4 * tSec + n);
            p1[n] = (p1[n] + hDt * 0.993) % 1.0;
            p2[n] = (p2[n] + hDt * 1.007) % 1.0;
            p3[n] = (p3[n] + hDt * 0.5) % 1.0;
            const sawL = 2 * p1[n] - 1 - polyBlep(p1[n], hDt);
            const sawR = 2 * p2[n] - 1 - polyBlep(p2[n], hDt);
            const pwmSub = p3[n] < pwm ? 0.42 : -0.42;
            voiceSampleL = (sawL * 0.52 + sawR * 0.22 + pwmSub) * noteAmp;
            voiceSampleR = (sawR * 0.52 + sawL * 0.22 + pwmSub) * noteAmp;
            break;
          }
          case 'sc:default':
          default: {
            const dL = dt * 0.9985;
            const dR = dt * 1.0015;
            p1[n] = (p1[n] + dL) % 1.0;
            p2[n] = (p2[n] + dR) % 1.0;
            const sL = 2 * p1[n] - 1 - polyBlep(p1[n], dL);
            const sR = 2 * p2[n] - 1 - polyBlep(p2[n], dR);
            voiceSampleL = (sL * 0.52 + Math.sin(2 * Math.PI * p1[n]) * 0.25) * noteAmp;
            voiceSampleR = (sR * 0.52 + Math.sin(2 * Math.PI * p2[n]) * 0.25) * noteAmp;
            break;
          }
        }

        sigL += voiceSampleL;
        sigR += voiceSampleR;
      }

      // 2-Pole Chamberlin SVF Low-Pass (`RLPF.ar` / `LPF.ar`)
      const fCoeff = Math.min(
        0.78,
        2 * Math.sin(Math.PI * Math.min(0.42, instCutoff * dtBase))
      );
      const qDamp = Math.max(0.14, 1.0 - resNorm * 0.78);

      svfLowL += fCoeff * svfBandL;
      const highL = sigL - svfLowL - qDamp * svfBandL;
      svfBandL += fCoeff * highL;

      svfLowR += fCoeff * svfBandR;
      const highR = sigR - svfLowR - qDamp * svfBandR;
      svfBandR += fCoeff * highR;

      const outL =
        patchId === 'sc:modal_bell' || patchId === 'sc:klank_resonator'
          ? sigL * 0.65 + svfLowL * 0.35
          : svfLowL;
      const outR =
        patchId === 'sc:modal_bell' || patchId === 'sc:klank_resonator'
          ? sigR * 0.65 + svfLowR * 0.35
          : svfLowR;

      const idx = startFrame + i;
      trackLeft[idx] += outL * env * gainL;
      trackRight[idx] += outR * env * gainR;
    }
  }
}
