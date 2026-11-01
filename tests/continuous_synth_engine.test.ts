import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/compiler/DocumentParser';
import { applyTemperamentAndMasterTune } from '../src/compiler/PitchEngine';
import {
  ContinuousSynthEngine,
  clampCurveWindowBeforeGlide,
  computeFormantVowelFrequencies,
} from '../src/audio/ContinuousSynthEngine';
import { AbletonAudioFxEngine } from '../src/audio/AbletonAudioFxEngine';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('TDB-750: Anti-Skip AudioParam Guard, Wavetable Cache & Voltage/Gesture Synth Expansion (v5.4.0)', () => {
  it('prevents setValueCurveAtTime / linearRampToValueAtTime collisions via clampCurveWindowBeforeGlide', () => {
    const win = clampCurveWindowBeforeGlide(2.0, 1.0, 0.25, 0.95, 0.14);
    expect(win.startSec).toBeGreaterThanOrEqual(2.25);
    // Must finish strictly before the glide ramp begins at (2.0 + 1.0 - 0.14 = 2.86s)
    expect(win.startSec + win.durationSec).toBeLessThanOrEqual(2.855);
  });

  it('subdivides steps via .ratchet(3, "up") and .ratchet(4, "down") with exact duration conservation and velocity curves', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Berlin Ratchet Test", tempo: 120, time: "4/4" }
        def seq "Step Sequencer" style=synth patch="pluck_lead"
        measure 1 {
          seq: c3:4.mf.ratchet(3, "up") g3:4.f.ratchet(4, "down") r:2 |
        }
      }
    `);

    const upPulses = score.events.slice(0, 3);
    expect(upPulses).toHaveLength(3);
    const upTotalDur = upPulses.reduce(
      (sum, ev) => sum + ev.duration.numerator / ev.duration.denominator,
      0
    );
    expect(upTotalDur).toBeCloseTo(0.25, 5);
    expect(upPulses[0].ratchet).toEqual({ count: 3, curve: 'up' });
    expect(upPulses[0].velocity!).toBeLessThan(upPulses[1].velocity!);
    expect(upPulses[1].velocity!).toBeLessThan(upPulses[2].velocity!);

    const downPulses = score.events.slice(3, 7);
    expect(downPulses).toHaveLength(4);
    const downTotalDur = downPulses.reduce(
      (sum, ev) => sum + ev.duration.numerator / ev.duration.denominator,
      0
    );
    expect(downTotalDur).toBeCloseTo(0.25, 5);
    expect(downPulses[0].ratchet).toEqual({ count: 4, curve: 'down' });
    expect(downPulses[0].velocity!).toBeGreaterThan(downPulses[1].velocity!);
    expect(downPulses[1].velocity!).toBeGreaterThan(downPulses[2].velocity!);
    expect(downPulses[2].velocity!).toBeGreaterThan(downPulses[3].velocity!);
  });

  it('expands parallel harmonic planing via .plane("m9") and strips the root via .rootless', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Parallel Chord Planing", tempo: 118, time: "4/4", key: "C", scale: "major", scale_lock: true }
        def pad "Planing Pad" style=synth patch="flutter_pad"
        measure 1 {
          pad: b3:2.plane("m9") b3:2.plane("m9").rootless |
        }
      }
    `);

    const beat1Voices = score.events.filter(
      (ev) => ev.startTime && ev.startTime.numerator === 0
    );
    // B3 minor 9th: B3 (59), D4 (62), F#4 (66), A4 (69), C#5 (73)
    expect(beat1Voices).toHaveLength(5);
    expect(beat1Voices.map((v) => v.pitch.midi)).toEqual([59, 62, 66, 69, 73]);
    expect(beat1Voices[0].noteNames).toEqual(['B3', 'D4', 'F#4', 'A4', 'C#5']);
    expect(beat1Voices[0].harmonicPlane).toBe('m9');

    const beat2Voices = score.events.filter(
      (ev) => ev.startTime && ev.startTime.numerator === 1 && ev.startTime.denominator === 2
    );
    // Rootless B3 minor 9th strips B3 (59) -> D4 (62), F#4 (66), A4 (69), C#5 (73)
    expect(beat2Voices).toHaveLength(4);
    expect(beat2Voices.map((v) => v.pitch.midi)).toEqual([62, 66, 69, 73]);
    expect(beat2Voices[0].noteNames).toEqual(['D4', 'F#4', 'A4', 'C#5']);
    expect(beat2Voices[0].rootlessVoicing).toBe(true);
  });

  it('parses .swarm, .vowel, .fold, .squeeze, .bend_voice and computes Carlos non-octave temperaments, formant vowels, and gated_reverb', async () => {
    expect(computeFormantVowelFrequencies('oh')).toEqual([490, 880]);
    expect(computeFormantVowelFrequencies('ooh')).toEqual([320, 800]);
    expect(ContinuousSynthEngine.computeFormantVowelFrequencies('a')).toEqual([730, 1090]);

    // Wendy Carlos Alpha (78.0c/step) & master_tune (-25c)
    const baseC4 = 261.625565;
    const tunedC4 = applyTemperamentAndMasterTune(baseC4, 60, '12tet', -25, 60);
    expect(tunedC4).toBeCloseTo(baseC4 * Math.pow(2, -25 / 1200), 4);

    const baseC5 = 523.25113;
    const alphaC5 = applyTemperamentAndMasterTune(baseC5, 72, 'carlos_alpha', 0, 60);
    // 12 steps above root in Carlos Alpha = 12 * 78c = 936c above C4 (or -264c relative to 12-TET C5)
    expect(alphaC5).toBeCloseTo(baseC5 * Math.pow(2, (12 * (78 - 100)) / 1200), 4);

    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{
          title: "Voltage and Gesture",
          tempo: 78,
          time: "4/4",
          temperament: "carlos_alpha",
          master_tune: -25
        }
        def swarm "Swarmatron" style=synth patch="swarmatron"
        def haunt "Boards Pad" style=synth patch="hauntology_pad"
        def krell "Buchla Krell" style=synth patch="buchla_krell" .fx(gated_reverb, @{ decay: 3.2, gate_ms: 160, mix: 0.55 })

        measure 1 {
          swarm: e3:1.swarm([0.2, 3.0, 0.5]) |
          haunt: [e3 b3 g4]:1.vowel("oh", "ooh", 0.2).squeeze(90%).bend_voice(1, 50c, 0.2..0.8) |
          krell: b3:1.fold(75%) |
        }
      }
    `);

    expect(score.meta.temperament).toBe('carlos_alpha');
    expect(score.meta.masterTune).toBe(-25);

    const swarmEv = score.events.find((e) => e.trackId === 'swarm')!;
    expect(swarmEv.swarmSpreadSemitones).toEqual([0.2, 3.0, 0.5]);

    const hauntEv = score.events.find((e) => e.trackId === 'haunt')!;
    expect(hauntEv.vowelFormant).toEqual({ from: 'oh', to: 'ooh', rateHz: 0.2 });
    expect(hauntEv.osmoseSqueeze).toBe(90);
    expect(hauntEv.voiceBend).toEqual({
      voiceIndex: 1,
      cents: 50,
      startWindow: 0.2,
      endWindow: 0.8,
    });

    const krellEv = score.events.find((e) => e.trackId === 'krell')!;
    expect(krellEv.wavefoldAmount).toBe(75);
    expect(AbletonAudioFxEngine.isSupportedFx('gated_reverb')).toBe(true);

    const engine = new StudioAudioEngine();
    const wav = await engine.exportWavBlob(score);
    expect(wav.type).toBe('audio/wav');
    expect(wav.size).toBeGreaterThan(44100 * 2);
  });

  it('compiles .wow_flutter, .neg_harm (Negative Harmony), .krell(N) EOC cybernetics, .plane("quartal"), and tape_degrade FX', async () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Cybernetics & Hauntology", tempo: 118, time: "4/4", key: "C" }
        def haunt "Hauntology" style=synth patch="hauntology_pad" .fx(tape_degrade, @{ wow_hz: 0.42, flutter_hz: 9.5, high_cut: 5200, drive: 0.3 })
        def krell "Buchla Krell" style=synth patch="buchla_krell"
        def plan  "Quartal & Negative Harmony" style=synth patch="flutter_pad"

        measure 1 {
          haunt: c4:1.wow_flutter(5, 0.42, 2.5, 9.5) |
          krell: c4:1.krell(5).fold(75%) |
          plan:  [c4 e4 g4]:2.neg_harm c4:2.plane("quartal") |
        }
      }
    `);

    const hauntEv = score.events.find((e) => e.trackId === 'haunt')!;
    expect(hauntEv.wowFlutter).toEqual({
      wowCents: 5,
      wowHz: 0.42,
      flutterCents: 2.5,
      flutterHz: 9.5,
    });
    expect(AbletonAudioFxEngine.isSupportedFx('tape_degrade')).toBe(true);

    // Krell patch subdivides c4:1 into 5 autonomous EOC events whose durations sum to 1.0 whole note
    const krellEvents = score.events.filter((e) => e.trackId === 'krell');
    expect(krellEvents).toHaveLength(5);
    const krellTotalDur = krellEvents.reduce(
      (sum, ev) => sum + ev.duration.numerator / ev.duration.denominator,
      0
    );
    expect(krellTotalDur).toBeCloseTo(1.0, 5);

    // Negative Harmony reflects [c4 e4 g4] (60, 64, 67) across C-G axis to C minor [c4 eb4 g4] (60, 63, 67)
    const negEvents = score.events.filter(
      (e) => e.trackId === 'plan' && e.startTime && e.startTime.numerator === 0
    );
    expect(negEvents.map((e) => e.pitch.midi)).toEqual([60, 63, 67]);

    // Quartal planing on C4 (60) builds [60, 65, 70, 75]
    const quartalEvents = score.events.filter(
      (e) => e.trackId === 'plan' && e.startTime && e.startTime.numerator === 1 && e.startTime.denominator === 2
    );
    expect(quartalEvents.map((e) => e.pitch.midi)).toEqual([60, 65, 70, 75]);

    const engine = new StudioAudioEngine();
    const wav = await engine.exportWavBlob(score);
    expect(wav.size).toBeGreaterThan(44100 * 2);
  });

  it('eliminates 3-voice unison phase-cancellation dropouts, preserves explicit sub-bass .filter(120, 175) cutoffs, coalesces chords before humanization, and ignores dangling track labels', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Multi-Measure Dropout Regression", tempo: 72, time: "4/4", key: "E" }
        def lead "Lead" style=synth patch="saw_lead"
        def pad "Pad" style=synth patch="flutter_pad"
        def sub "Sub" style=synth patch="reese_bass" cutoff=145 sub=90

        measure 1 {
          gtr_lead_or_lead_note:
          lead: a4:2.mp b4:2.mp |
          pad:  [f#3 a3 c#4 e4]:1.p.detune([28, 72, 34]).filter(460, 2200) |
          sub:  e1:1.mp.detune([12, 48, 16]).filter(120, 175) |
        }
        measure 2 {
          lead: g#4:1.mp |
          pad:  [e3 g#3 b3 d#4]:1.p.detune([24, 64, 28]).filter(440, 1900) |
          sub:  e1:1.mp.detune([14, 42, 16]).filter(115, 165) |
        }
      }
    `);

    // 1. Dangling label `gtr_lead_or_lead_note:` must NOT swallow `lead: a4:2.mp b4:2.mp`
    const m1LeadEvents = score.events.filter((e) => e.trackId === 'lead' && e.measureNumber === 1);
    expect(m1LeadEvents).toHaveLength(2);
    expect(m1LeadEvents.map((e) => e.pitch.midi)).toEqual([69, 71]);

    // 2. Build scheduled timeline and verify 4-note pad chords coalesce into 1 shared voice even with humanizeTimelinePhrasing
    const engine = new StudioAudioEngine();
    const timeline = (engine as any).buildScheduledTimeline(score);
    const padVoices = timeline.filter((item: any) => item.event.trackId === 'pad');
    expect(padVoices).toHaveLength(2);
    expect(padVoices[0].chordVoices).toHaveLength(4);
    expect(padVoices[1].chordVoices).toHaveLength(4);

    // 3. Render the 3.33s M1 pad chord and verify asymmetric unison never phase-cancels to near-zero RMS mid-hold
    const sr = 44100;
    const frames = Math.floor(padVoices[0].durSec * sr);
    const padL = new Float32Array(frames);
    const padR = new Float32Array(frames);
    ContinuousSynthEngine.renderVoiceIntoTrackStem(padL, padR, 0, frames, sr, 72, 1, padVoices[0]);

    const windowFrames = Math.floor(0.15 * sr);
    for (let wStart = Math.floor(0.2 * sr); wStart + windowFrames < frames - Math.floor(0.2 * sr); wStart += windowFrames) {
      let sumSq = 0;
      for (let i = wStart; i < wStart + windowFrames; i++) {
        sumSq += padL[i] * padL[i] + padR[i] * padR[i];
      }
      const rms = Math.sqrt(sumSq / (windowFrames * 2));
      expect(rms).toBeGreaterThan(0.015);
    }

    // 4. Render the M1 sub-bass note (`e1` = 41.2 Hz with `.filter(120, 175)`) and verify explicit filter cutoff is not crushed by keytracking
    const subItem = timeline.find((item: any) => item.event.trackId === 'sub')!;
    const subFrames = Math.floor(subItem.durSec * sr);
    const subL = new Float32Array(subFrames);
    const subR = new Float32Array(subFrames);
    ContinuousSynthEngine.renderVoiceIntoTrackStem(subL, subR, 0, subFrames, sr, 72, 2, subItem);
    let subSumSq = 0;
    for (let i = Math.floor(0.2 * sr); i < Math.floor(1.5 * sr); i++) {
      subSumSq += subL[i] * subL[i];
    }
    const subRms = Math.sqrt(subSumSq / Math.floor(1.3 * sr));
    expect(subRms).toBeGreaterThan(0.04);

    // 5. Verify rolling AudioBuffer eviction behind fromSec in prebakeContinuousSynthTimeline when isLooping is false
    const mockCtx = {
      sampleRate: 44100,
      createBuffer: (channels: number, length: number, sampleRate: number) => ({
        numberOfChannels: channels,
        length,
        sampleRate,
        duration: length / sampleRate,
        getChannelData: () => new Float32Array(length),
      }),
    } as any;
    (engine as any).isLooping = false;
    engine.prebakeContinuousSynthTimeline(mockCtx, timeline, 72, 0, 2.0, 8);
    expect(padVoices[0].prebakedBuffer).toBeDefined();

    // Advance window past M1 (startSec=0, durSec=3.33s -> 3.33 + 0.6 < 4.5s) and verify eviction
    engine.prebakeContinuousSynthTimeline(mockCtx, timeline, 72, 4.5, 8.0, 8);
    expect(padVoices[0].prebakedBuffer).toBeUndefined();
    expect(padVoices[1].prebakedBuffer).toBeDefined();
  });

  it('compiles flagship hardware synth patches (polybrute_12, moog_muse, nina_motor, super_gemini, buchla_200e), circuit modifiers (.lpg, .metalizer, .brute_factor, .cp3_drive, .binaural, .spin, .morph, .fulltouch, .aliasing), and 7 DCA outboard FX', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Flagship Hardware & DCA Outboard Stack", tempo: 120, time: "4/4", key: "C" }
        def pb "PolyBrute 12" style=synth patch="polybrute_12" .fx(burl_mothership, @{ transformer: "bx1", drive: 0.45 }) .fx(neve_5059, @{ silk: "super", texture: 0.7 })
        def muse "Moog Muse" style=synth patch="moog_muse" .fx(wes_mimas, @{ ratio: "all_buttons", drive: 0.55 }) .fx(wes_rhea, @{ threshold: -14, thd: "high" })
        def nina "Melbourne NINA" style=synth patch="nina_motor" .fx(eventide_h9000, @{ shift1_st: 7, shift2_st: -12, mix: 0.4 })
        def gemini "UDO Super Gemini" style=synth patch="super_gemini" .fx(bricasti_m7, @{ decay: 2.8, predelay: 24, mix: 0.45 })
        def buchla "Buchla 200e" style=synth patch="buchla_200e" .fx(bettermaker_limiter, @{ gain_db: 3.0, ceiling: -0.3, odd_even_thd: 0.35 })

        measure 1 {
          pb: [c4 e4 g4]:2.mf.metalizer(65%).brute_factor(55%).morph([0, 90, 20]).fulltouch("at") r:2 |
          muse: c2:2.f.cp3_drive(60%) r:2 |
          nina: g4:2.mp.spin(1.5) r:2 |
          gemini: [c4 g4 b4]:2.mp.binaural(14c) r:2 |
          buchla: e3:2.mf.lpg("both", 380ms).aliasing(40%) r:2 |
        }
      }
    `);

    const pbEv = score.events.find((e) => e.trackId === 'pb')!;
    expect(pbEv.metalizerAmount).toBe(65);
    expect(pbEv.bruteFactor).toBe(55);
    expect(pbEv.morphAmount).toBe(20);
    expect(pbEv.fullTouchMode).toBe('at');

    const museEv = score.events.find((e) => e.trackId === 'muse')!;
    expect(museEv.cp3Drive).toBe(60);

    const ninaEv = score.events.find((e) => e.trackId === 'nina')!;
    expect(ninaEv.spinRateHz).toBe(1.5);

    const geminiEv = score.events.find((e) => e.trackId === 'gemini')!;
    expect(geminiEv.binauralSpreadCents).toBe(14);

    const buchlaEv = score.events.find((e) => e.trackId === 'buchla')!;
    expect(buchlaEv.lpg).toEqual({ mode: 'both', decayMs: 380 });
    expect(buchlaEv.aliasingAmount).toBe(40);

    const engine = new StudioAudioEngine();
    const timeline = (engine as any).buildScheduledTimeline(score);
    expect(timeline.every((item: any) => item.sfInstrument === null)).toBe(true);

    const sr = 44100;
    const frames = Math.floor(0.35 * sr);
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);

    for (const item of timeline) {
      ContinuousSynthEngine.renderVoiceIntoTrackStem(left, right, 0, frames, sr, 120, 1, item);
      const fxChain = AbletonAudioFxEngine.resolveActiveFxChain(item.def, item.event);
      expect(fxChain.length).toBeGreaterThan(0);
      for (const fx of fxChain) {
        expect(AbletonAudioFxEngine.isSupportedFx(fx.type)).toBe(true);
      }
      AbletonAudioFxEngine.applyFxChainToSlice(left, right, 0, frames, sr, fxChain, {
        tempoBpm: 120,
      });
    }

    let energy = 0;
    for (let i = 0; i < frames; i++) {
      expect(Number.isFinite(left[i])).toBe(true);
      expect(Number.isFinite(right[i])).toBe(true);
      energy += left[i] * left[i] + right[i] * right[i];
    }
    expect(energy).toBeGreaterThan(1.0);
  });

  it('compiles and renders vendor-neutral canonical patches (morph_analog_12, vintage_ladder_8, hybrid_motor_12, binaural_hybrid_20, west_coast_200, ribbon_cluster_8, tape_nostalgia_pad), modifiers (.tri_fold, .steiner_drive, .discrete_drive, .touch_travel, .eoc_cycle), non_octave_alpha temperament, and 7 studio outboard FX', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Vendor-Neutral Studio Stack", tempo: 120, time: "4/4", key: "C", temperament: "non_octave_alpha" }
        def morph "Morph Analog 12" style=synth patch="morph_analog_12" .fx(transformer_color_adc, @{ transformer: "input_iron", drive: 0.45 }) .fx(dual_bus_silk_sum, @{ mode: "dual", texture: 0.7 })
        def ladder "Vintage Ladder 8" style=synth patch="vintage_ladder_8" .fx(fet_fast_limiter, @{ ratio: "all_buttons", drive: 0.55 }) .fx(vari_mu_tube_comp, @{ threshold: -14, thd: "high" })
        def motor "Hybrid Motor 12" style=synth patch="hybrid_motor_12" .fx(spectral_pitch_harmonizer, @{ shift1_st: 7, shift2_st: -12, mix: 0.4 })
        def binaural "Binaural Hybrid 20" style=synth patch="binaural_hybrid_20" .fx(true_stereo_hall_reverb, @{ decay: 2.8, predelay: 24, mix: 0.45 })
        def wc "West Coast 200" style=synth patch="west_coast_200" .fx(mastering_clip_limiter, @{ gain_db: 3.0, ceiling: -0.3, odd_even_thd: 0.35 })

        measure 1 {
          morph: [c4 e4 g4]:2.mf.tri_fold(65%).steiner_drive(55%).morph([0, 90, 20]).touch_travel("at") r:2 |
          ladder: c2:2.f.discrete_drive(60%) r:2 |
          motor: g4:2.mp.spin(1.5) r:2 |
          binaural: [c4 g4 b4]:2.mp.binaural(14c) r:2 |
          wc: e3:2.mf.eoc_cycle(3).lpg("both", 380ms).aliasing(40%) r:2 |
        }
      }
    `);

    const morphEv = score.events.find((e) => e.trackId === 'morph')!;
    expect(morphEv.metalizerAmount).toBe(65);
    expect(morphEv.bruteFactor).toBe(55);
    expect(morphEv.fullTouchMode).toBe('at');

    const ladderEv = score.events.find((e) => e.trackId === 'ladder')!;
    expect(ladderEv.cp3Drive).toBe(60);

    const wcEvs = score.events.filter((e) => e.trackId === 'wc');
    expect(wcEvs).toHaveLength(3);
    expect(wcEvs[0].lpg).toEqual({ mode: 'both', decayMs: 380 });

    const engine = new StudioAudioEngine();
    const timeline = (engine as any).buildScheduledTimeline(score);
    expect(timeline.every((item: any) => item.sfInstrument === null)).toBe(true);

    const sr = 44100;
    const frames = Math.floor(0.25 * sr);
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);

    for (const item of timeline) {
      ContinuousSynthEngine.renderVoiceIntoTrackStem(left, right, 0, frames, sr, 120, 1, item);
      const fxChain = AbletonAudioFxEngine.resolveActiveFxChain(item.def, item.event);
      for (const fx of fxChain) {
        expect(AbletonAudioFxEngine.isSupportedFx(fx.type)).toBe(true);
      }
      AbletonAudioFxEngine.applyFxChainToSlice(left, right, 0, frames, sr, fxChain, {
        tempoBpm: 120,
      });
    }

    let energy = 0;
    for (let i = 0; i < frames; i++) {
      energy += left[i] * left[i] + right[i] * right[i];
    }
    expect(energy).toBeGreaterThan(0.5);
  });

  it('compiles all 6 complete stylistic blueprints from Definitive Guide to Tenuto Composition.md with zero errors', () => {
    const blueprints = [
      `tenuto "6.0" {
        meta @{ title: "Berlin School Dual Temporality", tempo: 124, time: "4/4", key: "D", scale: "dorian" }
        return bbd_echo "Bucket-Brigade Dotted-8th Delay"
          .fx(echo, @{ time: 0.362, feedback: 0.52, mix: 1.0 })
          .fx(chorus, @{ rate: 0.35, amount: 0.4, mix: 0.45 })
        def seq   "Micro-Time Step Sequencer" style=synth patch="pluck_lead" cutoff=2800 resonance=2.2 sends=@{ bbd_echo: 0.65 }
        def choir "Macro-Time Mellotron Choir" style=synth patch="flutter_pad" detune=48 cutoff=2400 sends=@{ bbd_echo: 0.45 }
          .fx(true_stereo_hall_reverb, @{ decay: 5.2, predelay: 28, mix: 0.55 })
        measure 1 {
          seq:   d2:16 a2:16 d3:16 d3:16.ratchet(2, "flat") f2:16 c3:16 d3:16 a2:16.ratchet(3, "up") g2:16 d3:16 f3:16 e3:16 d2:16 a2:16 c3:16 a2:16 |
          choir: [d3 a3 f4 g4]:1.p.cresc.open_voice.filter(900, 3200).glide(240ms) |
        }
        measure 2 {
          seq:   d3:4.mp.dim r:4 r:2 |
          choir: [c3 g3 e4 a4]:1.f.dim.open_voice.filter(3200, 1100) |
        }
      }`,
      `tenuto "6.0" {
        meta @{ title: "Parallel Minor-9th Chord Planing", tempo: 122, time: "4/4", key: "C", scale_lock: false, sidechain: "drums" }
        def plan  "Planing Chord Stab" style=synth patch="morph_analog_12" cutoff=2600 detune=55 width=145
          .fx(dual_bus_silk_sum, @{ silk: "red", texture: 0.55 })
          .fx(echo, @{ time: 0.368, feedback: 0.42, mix: 0.32 })
        def sub   "Static C Pedal Sub" style=synth patch="reese_bass" cutoff=210 sub=90
        def drums "House Kit"          style=grid  patch="tenuto_808_kit"
        measure 1 {
          plan:  b3:2.mp.plane("m9").rootless.filter(1200, 3400).glide(180ms) d4:2.mf.plane("m9").rootless.filter(1400, 3800).glide(180ms) |
          sub:   c1:2.f.legato.filter(150, 210) c2:2.mf.legato.filter(160, 220) |
          drums: <[ v1: k:4 k:4 k:4 k:4 | v2: r:4 cp:4 r:4 cp:4 | v3: r:8 oh:8 r:8 oh:8 r:8 oh:8 r:8 oh:8 ]>
        }
        measure 2 {
          plan:  e4:2.f.plane("m9").rootless.filter(1600, 4200).glide(180ms) f#4:2.f.plane("m9").rootless.neg_harm.filter(2800, 1400) |
          sub:   c1:1.f.legato.filter(170, 190) |
          drums: <[ v1: k:4 k:4 k:4 k:4 | v2: r:4 cp:4 r:4 cp:4 | v3: r:8 oh:8 r:8 oh:8 r:8 oh:8 h:16.ratchet(2, "up") oh:16 ]>
        }
      }`,
      `tenuto "6.0" {
        meta @{ title: "Lost Futures (Hauntology Study)", tempo: 68, time: "4/4", key: "F", scale: "dorian", master_tune: -24 }
        def pad  "Dashboard Tape Pad" style=synth patch="tape_nostalgia_pad" vol=86 cutoff=900 sub=20
          .fx(tape_degrade, @{ wow_hz: 0.38, wow_depth_ms: 2.1, flutter_hz: 9.2, high_cut: 4800, drive: 0.34, mix: 1.0 })
        def lead "Underwater Vowel Lead" style=synth patch="tape_nostalgia_pad" vol=88 cutoff=1600
          .fx(chorus, @{ rate: 0.8, amount: 0.35, mix: 0.45 })
          .fx(reverb, @{ decay: 2.0, predelay: 20, mix: 0.40 })
        measure 1 {
          pad:  [f2 c3 ab3 eb4]:1.p.open_voice.warp_wave("bend", 30%).detune(18%, 0.15..0.90).filter(780, 1050).wow_flutter(5.2, 0.38, 2.6, 9.2).glide(280ms) |
          lead: r:4 c5:2.mp.legato.vowel("oh", "ooh", 0.2).wow_flutter(4.8, 0.42, 2.2, 8.8).glide(220ms) ab4:4.p.legato.vowel("ooh", "oh", 0.2) |
        }
        measure 2 {
          pad:  [db2 ab2 f3 c4]:1.p.open_voice.warp_wave("bend", 30%).detune(20%, 0.15..0.90).filter(820, 920).wow_flutter(5.5, 0.36, 2.8, 9.5) |
          lead: g4:2..p.legato.vowel("oh", "ooh", 0.2).wow_flutter(5.0, 0.40, 2.4, 9.0) f4:4.pp.dim |
        }
      }`,
      `tenuto "6.0" {
        meta @{ title: "Ribbon Dread & 3D MPE Gesture", tempo: 74, time: "4/4", key: "D", scale: "minor" }
        def pno   "Felt Acoustic Piano"  style=standard patch="salamander_grand" vol=84
          .fx(true_stereo_hall_reverb, @{ decay: 3.4, predelay: 20, mix: 0.38 })
        def mpe   "3D MPE Soloist"       style=synth    patch="morph_analog_12"  vol=88 cutoff=2800
        def swarm "8-Osc Ribbon Cluster" style=synth    patch="ribbon_cluster_8" vol=78 cutoff=2200
        def krell "West Coast Cyber"     style=synth    patch="west_coast_200"   vol=80
        measure 1 {
          pno:   [d3 a3 f4]:2.p.ped [a2 e3 c#4]:2.p.ped |
          mpe:   [d4 a4 c5 f5]:1.mp.squeeze(92%).bend_voice(1, 50c, 0.20..0.80).tri_fold(45%).glide(220ms) |
          swarm: d1:1.p.cresc.swarm([0.15, 3.2, 0.35]).filter(400, 1900) |
          krell: a4:1.mp.eoc_cycle(5).fold(72%).lpg("both", 380ms) |
        }
      }`,
      `tenuto "6.0" {
        meta @{ title: "Outrun Horizon", tempo: 112, time: "4/4", key: "F", scale: "minor", sidechain: "drums" }
        def lead  "Analog Brass Lead" style=synth patch="state_variable_8" vol=92 detune=62 cutoff=4200 width=140
          .fx(chorus, @{ rate: 0.45, amount: 0.4, mix: 0.42 })
          .fx(echo, @{ time: 0.401, feedback: 0.4, mix: 0.35 })
        def pad   "Suspended 9th Pad" style=synth patch="supersaw" vol=84 detune=72 cutoff=3600
        def bass  "Driving 8th Bass"  style=synth patch="vintage_ladder_8" vol=90 cutoff=1450 resonance=1.8
        def drums "Gated Drum Kit"    style=grid  patch="tenuto_808_kit"
          .fx(gated_reverb, @{ decay: 3.4, gate_ms: 165, threshold: -22, mix: 0.55 })
        measure 1 {
          lead:  r:4 c5:4.f.legato.vib.glide(140ms) g5:4..ff.legato.vib f5:8.f.legato |
          pad:   f3:1.mf.plane("sus4").open_voice.filter(1400, 3800) |
          bass:  f1:8.stacc.discrete_drive(55%) f2:8.stacc f1:8.stacc f2:8.stacc f1:8.stacc f2:8.stacc g1:8.stacc g2:8.stacc |
          drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 oh:8 ]>
        }
        measure 2 {
          lead:  eb5:2.f.legato.vib.glide(160ms) c5:2.mf.dim.vib |
          pad:   db3:1.mf.plane("maj9").open_voice.filter(3800, 1800) |
          bass:  db1:8.stacc.discrete_drive(55%) db2:8.stacc db1:8.stacc db2:8.stacc db1:8.stacc db2:8.stacc eb1:8.stacc eb2:8.stacc |
          drums: <[ v1: k:4 r:8 k:8 r:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8 h:8 h:8 h:8 lt:16 mt:16 ht:8 ]>
        }
      }`,
      `tenuto "6.0" {
        meta @{ title: "Non-Octave Alpha Essay", tempo: 82, time: "4/4", temperament: "non_octave_alpha", scale_lock: false }
        def vox1 "Binaural Alpha Voice" style=synth patch="binaural_hybrid_20" vol=86 cutoff=3200
        def vox2 "Rotating Motor Voice" style=synth patch="hybrid_motor_12"    vol=82 cutoff=2600
        measure 1 {
          vox1: c4:4.mp.legato.binaural(14c) e4:4.mp.legato.binaural(14c) g4:2.mf.legato.binaural(16c).vib |
          vox2: [c3 g3 e4]:1.p.open_voice.spin(0.75).morph([15, 85, 25]).filter(1100, 2900) |
        }
      }`,
    ];

    const parser = new DocumentParser();
    for (const src of blueprints) {
      const score = parser.compile(src);
      expect(score.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
      expect(score.events.length).toBeGreaterThan(0);
    }
  });
});




