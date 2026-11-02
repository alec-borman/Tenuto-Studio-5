# The Definitive Guide to Music Creation in Tenuto Studio 5 (`.ten`)
### Complete Grammar Specification, Multi-Engine Synthesis Physics, Compositional Theory & Studio Engineering Manual (`v5.6.8`)

> **Self-Contained Reference:** This manual contains the complete **Tenuto 6.0 (`.ten`)** formal grammar, compiler rules, 6-family instrument & patch catalog (`synth`, `sc:*`, `mi:*`, `daisy:*`, `stk:*`, `sp:*`, and 128 GM HD SoundFonts), continuous synthesizer & physical-modeling modifiers, Strudel pattern combinators, 38 studio & mastering DSP effects, psychoacoustic voicing laws, and ready-to-run stylistic blueprints. A human composer or AI agent reading **only this document** has 100% of the knowledge required to write studio-mastered, multi-track `.ten` compositions from scratch.

---

## Table of Contents

1. [The Ontological Shift: Sound Design as Composition](#1-the-ontological-shift-sound-design-as-composition)
2. [Document Architecture & Top-Level Blocks (`tenuto`, `meta`, `def`, `measure`, `scene`, `clip`)](#2-document-architecture--top-level-blocks-tenuto-meta-def-measure-scene-clip)
3. [Global Metadata, Scales, Microtonality & Non-Octave Tunings (`meta`)](#3-global-metadata-scales-microtonality--non-octave-tunings-meta)
4. [Track Definitions, Group Buses, Return Channels & Groove Pool (`def`, `group`, `return`, `groove`)](#4-track-definitions-group-buses-return-channels--groove-pool-def-group-return-groove)
5. [Complete Multi-Engine Instrument & Patch Catalog (`style` & `patch`)](#5-complete-multi-engine-instrument--patch-catalog-style--patch)
6. [Pitch, Rhythm, Rational Time & The Golden Rule of Measure Math](#6-pitch-rhythm-rational-time--the-golden-rule-of-measure-math)
7. [Polyphony, Chords, Tuplets, Euclidean Rhythms, Strudel Combinators & Ties](#7-polyphony-chords-tuplets-euclidean-rhythms-strudel-combinators--ties)
8. [Classical Articulations, Dynamics, Ornaments, Probability & Lyrics](#8-classical-articulations-dynamics-ornaments-probability--lyrics)
9. [Continuous Synthesizer, Eurorack, Waveguide & UGen Modifiers](#9-continuous-synthesizer-eurorack-waveguide--ugen-modifiers)
10. [Harmonic Architecture: Voicing Physics, Parallel Planing & Negative Harmony](#10-harmonic-architecture-voicing-physics-parallel-planing--negative-harmony)
11. [Sequenced, Generative & 3D Gestural Paradigms (`.ratchet`, `.eoc_cycle`, `.lpg`, MPE)](#11-sequenced-generative--3d-gestural-paradigms-ratchet-eoc_cycle-lpg-mpe)
12. [38 Studio Audio Effects, Mastering Outboard & Z-Axis Automation (`.fx`, `.automate`)](#12-38-studio-audio-effects-mastering-outboard--z-axis-automation-fx-automate)
13. [Six Complete Stylistic Blueprints (With Ready-to-Run `.ten` Code)](#13-six-complete-stylistic-blueprints-with-ready-to-run-ten-code)
14. [Pre-Flight Compiler Checklist & Master AI Composer Prompt](#14-pre-flight-compiler-checklist--master-ai-composer-prompt)

---

## 1. The Ontological Shift: Sound Design as Composition

In traditional acoustic notation, instrument luthiery and musical composition are separated: a composer writes pitches and rhythms assuming a fixed harmonic overtone spectrum. In **Tenuto Studio 5 (`v5.6.8`)**, that boundary dissolves. Because `.ten` code simultaneously declares the **acoustic physics of the signal path** and the **musical score**, a single held note or chord with evolving intra-note modulation carries the structural weight of an entire orchestral phrase.

### The Three Laws of Tenuto Synthesis Composition

1. **The Law of Spectral Inverse Proportionality:**
   Whenever a synthesizer patch has high internal spectral complexity—such as 7-voice unison detuning (`detune=85`), dense upper sawtooth harmonics, West Coast wavefolding (`.fold(75%)`), curved-bridge sitar dispersion (`.jawari(78%)`), or 8-oscillator ribbon cluster beating (`patch="ribbon_cluster_8"`)—**you must simplify or spread the vertical chord voicing**.
   * Playing close intervals (e.g., a major 2nd or minor 3rd) below `C3` (`MIDI 48`) on a harmonically dense synth causes severe lower-midrange **acoustic beating** (mud and phase roughness).
   * **Solution:** Use `.open_voice` (transposes the 2nd lowest chord tone up an octave into an open $R-5-3$ spread), `.rootless` (strips the root note so upper pads never clash with a dedicated sub-bass track), or quartal/suspended voicings (`.plane("quartal")`, `.plane("sus4")`).
2. **Parameter Automation Over Note Density:**
   When a synthesizer patch already occupies a wide spectral footprint, adding busy contrapuntal notes creates harmonic clutter. Instead, build narrative tension and release by **animating the timbre inside sustained notes**:
   * Sweep the low-pass filter across a bar (`.filter(900, 3800)`).
   * Open unison detune only during the middle of a phrase (`.detune(78%, 0.20..0.88)`).
   * Morph Eurorack `Plaits` / `Rings` timbres mid-phrase (`.timbre([35, 88, 45]).structure(68%)`).
   * Introduce localized rhythmic acceleration on specific steps via `.ratchet(3, "up")` or `.ply(2)` rather than rewriting the global time signature.
3. **Engineered Imperfection & Psychoacoustic Phrasing:**
   The human ear tracks every sound across three phases:
   * **Phase 1 — Onset Transient ("The Head"):** Tells the brain how the sound was excited. Sculpted via `.zap` / `.pluck(18ms, 12st)`, `.noise(25%, "white", 0.0..0.15)`, `.lpg("both", 380ms)`, `.breath(68%).jet(52%)`, or `.pre_swell`.
   * **Phase 2 — Steady-State Spectral Profile:** Prevent digital listener fatigue by animating waveforms via `.warp_wave("bend", 30%)`, `.vowel("oh", "ooh", 0.2)`, `.fof("a")`, `.wow_flutter(4.5, 0.42, 2.2, 9.5)`, or `.analog_slop(32%)`.
   * **Phase 3 — Long-Term Temporal Trajectory:** Connect notes across beats using `.legato`, `.glide(200ms)` (which automatically voice-leads every note in a polyphonic chord to the nearest note in the next chord), `.cresc` / `.dim`, and shared return buses (`sends=@{hall_bus: 0.65}`).

---

## 2. Document Architecture & Top-Level Blocks (`tenuto`, `meta`, `def`, `measure`, `scene`, `clip`)

Every complete Tenuto score is wrapped in `tenuto "6.0" { ... }` (or `"5.0"`). Comments begin with `%%` (or `//`) and are ignored by the compiler.

```tenuto
tenuto "6.0" {
  %% 1. Global Score Metadata & Tuning Configuration
  meta @{
    title: "Song Title",
    tempo: 118,
    time: "4/4",
    key: "D",
    scale: "dorian",
    scale_lock: false,
    temperament: "12tet",
    master_tune: 0,
    sidechain: "drums",
    sidechain_tap: "post_fx",
    quantize_launch: "1/1"
  }

  %% 2. Global Variables, Groove Pool & Reusable Macros (Optional)
  var lead_vol = 92
  groove mpc_swing "16th Pocket Swing" @{ base: "1/16", quantize: 90%, timing: 35%, random: 8%, velocity: 45% }
  macro ostinato_cell = { d2:16 a2:16 d3:16 f3:16 }

  %% 3. Return Buses, Instrument Definitions & Group Buses
  return hall_bus "Signalsmith + Dattorro Space"
    .fx(signalsmith_reverb, @{ decay: 4.2, damp_hz: 5800, mod_depth: 0.35, mix: 1.0 })
    .fx(dattorro_plate, @{ decay: 0.82, damping: 0.28, mix: 0.55 })

  def lead "Soloist Synth" style=synth patch="morph_analog_12"
    group="synth_bus" vol=92 pan=-0.15 detune=58 cutoff=3400 resonance=1.3 sub=25 air=40 width=135 slop=24
    env=@{ attack: 0.04, decay: 0.8, sustain: 0.85, release: 0.6 }
    sends=@{ hall_bus: 0.55 }
    .fx(signalsmith_chorus, @{ rate: 0.45, depth_ms: 5.5, mix: 0.38 })

  def rings "Sympathetic Resonator" style=eurorack patch="mi:rings_sympathetic"
    group="synth_bus" vol=84 pan=0.22 structure=66 damping=82 timbre=70
    sends=@{ hall_bus: 0.65 }

  def drums "Studio Drum Rack" style=grid patch="tenuto_808_kit" groove="mpc_swing"
    .fx(gated_reverb, @{ decay: 2.8, gate_ms: 150, mix: 0.45 })

  group synth_bus "Master Synth Bus" tracks=[lead, rings]
    .fx(dual_bus_silk_sum, @{ silk: "dual", texture: 0.55 })
    .fx(glue_compressor, @{ threshold: -12, ratio: 2.5, mix: 0.85 })

  %% 4. Arrangement Locators & Musical Timeline (Measures, Scenes, or Clips)
  locator "I. Exposition" at measure 1

  measure 1 {
    lead:  d4:2.mp.cresc.legato.vib.detune(45%, 0.20..0.85).glide(180ms) a4:2.mf.legato.vib |
    rings: repeat 2 { $ostinato_cell } f4:4.mp.structure(70%) a4:4.mf.ply(2) |
    drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8.ratchet(2, "up") h:8 h:8 h:8 h:8 oh:8 ]>
  }
}
```

### 2.1 Multi-Line Declaration Folding Rule
`def`, `def_return`, `return`, and `group` declarations can span multiple indented lines for readability (as shown above), provided continuation lines do not begin with a top-level keyword (`measure`, `def`, `return`, `group`, `meta`, `locator`, `scene`, `clip`) or a `trackId:` assignment.

### 2.2 Session View `scene` & `clip` Blocks (Optional Live-Launcher Syntax)
In addition to linear `measure N { ... }` blocks, Tenuto 6.0 supports non-linear Session View `clip` and `scene` blocks with probabilistic **Follow Actions** (`next`, `prev`, `first`, `last`, `any`, `other`, `play_again`, `stop`):

```tenuto
clip arp_intro "Arp Hook" track=lead scene=1 bars=1 follow=@{ bars: 4, actionA: "next", actionB: "play_again", chanceA: 75 } {
  d4:8.chance(90%) f4:8 a4:8 d5:8 [f5 a5 d6]:2.pick_one
}

scene 2 "Peak Drop" @{ tempo: 128 } {
  lead:  d5:4.f f5:4 a5:2 @follow @{ bars: 8, actionA: "any", chanceA: 85 }
  drums: k:4 s:4 k:4 s:4 |
}
```

---

## 3. Global Metadata, Scales, Microtonality & Non-Octave Tunings (`meta`)

The `meta @{ ... }` block configures the global clock, key/scale quantization, microtonal tuning tables, and sidechain routing:

| Meta Key | Type | Default | Allowed Values & Musical Behavior |
| :--- | :--- | :--- | :--- |
| `title` | String | `"Untitled Score"` | Displays in the studio header and names exported `.wav`, `.scd`, `.strudel`, and `.musicxml` files. |
| `tempo` | Number | `120` | Project tempo in Beats Per Minute (`20`–`300`). Can also be automated per-measure by placing `meta @{ tempo: 84 }` inside any `measure N { ... }` block. |
| `time` | String | `"4/4"` | Time signature (`"4/4"`, `"3/4"`, `"6/8"`, `"5/4"`, `"7/8"`). |
| `key` | String | `"C"` | Root key (`"C"`, `"C#"`, `"Db"`, `"D"`, `"Eb"`, `"E"`, `"F"`, `"F#"`, `"Gb"`, `"G"`, `"Ab"`, `"A"`, `"Bb"`, `"B"`). Governs scale locking and `.neg_harm` reflection axis. |
| `scale` | String | `"chromatic"` | `chromatic`, `major`, `ionian`, `minor`, `natural_minor`, `aeolian`, `harmonic_minor`, `melodic_minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `locrian`, `major_pentatonic`, `minor_pentatonic`, `blues`, `whole_tone`, `diminished_wh`, `diminished_hw`, `hungarian_minor`, `phrygian_dominant`, `hirajoshi`, `insen`, `arabic`. |
| `scale_lock` | Boolean | `false` | When `true`, out-of-scale pitches are quantized to the nearest degree in `key` + `scale`. Set `scale_lock: false` when using chromatic chord planing or microtonality. |
| `tuning` | String | `"12tet"` | `12tet`, `just_intonation` (5-limit pure ratios), `pythagorean`, `meantone`, `19tet`, `24tet`, `31tet`, `bohlen_pierce` (13-step tritave $3:1$), `slendro`, `pelog`, or raw Scala `.scl` text. |
| `temperament` | String | `"12tet"` | `12tet`, `just`, `non_octave_alpha` ($78.0\text{ cents/step}$), `non_octave_beta` ($63.8\text{ cents/step}$), `non_octave_gamma` ($35.1\text{ cents/step}$). |
| `master_tune` | Number | `0` | Global cent offset (`-100` to `+100`). Setting `master_tune: -22` imparts a worn-cassette / hauntological flat tuning across the entire ensemble. |
| `a4_hz` | Number | `440.0` | Reference concert pitch in Hz (e.g., `432`, `440`, `442`). |
| `sidechain` | String | `null` | Track or group ID (e.g., `"drums"`) whose kick hits (`k` / `bd` on `grid` tracks, or all notes on melodic tracks) duck non-source tracks. |
| `sidechain_tap` | String | `"post_fx"` | `"pre_fx"`, `"post_fx"`, or `"post_mixer"`. |
| `quantize_launch` | String | `"1/1"` | Session View clip launch quantization (`"none"`, `"1/8"`, `"1/4"`, `"1/2"`, `"1/1"`, `"2/1"`, `"4/1"`). |

---

## 4. Track Definitions, Group Buses, Return Channels & Groove Pool (`def`, `group`, `return`, `groove`)

### 4.1 Instrument Track (`def`)
```tenuto
def <trackId> "<Display Name>"
  style=<standard|synth|scsynth|eurorack|daisy|stk|soundpipe|grid|simpler>
  patch="<patchName>"
  group="<groupId>" groove="<grooveId>" vol=<0..127> pan=<-1.0..1.0>
  detune=<0..100> cutoff=<60..16000> resonance=<0.5..18> sub=<0..100>
  air=<0..100> duck=<0..100> width=<0..200> slop=<0..100> noise=<0..100>
  timbre=<0..100> harmonics=<0..100> morph=<0..100> structure=<0..100>
  damping=<0..100> position=<0..100> breath=<0..100> jet=<0..100> jawari=<0..100>
  env=@{ attack: 0.05, decay: 0.4, sustain: 0.8, release: 0.5 }
  macros=@{ cutoff: 80, resonance: 30, osc1_pos: 65, unison: 55, sub_level: 45 }
  sends=@{ <returnId>: <0.0..1.0> }
  .fx(<fxType>, @{ <param>: <val> })
```

### 4.2 Return Bus (`return`)
Creates a shared auxiliary FX bus fed by `sends=@{ <returnId>: <level> }` on individual tracks:
```tenuto
return hall_bus "Macro-Time Shimmer Space"
  .fx(signalsmith_reverb, @{ decay: 5.5, damp_hz: 5600, mix: 1.0 })
  .fx(glue_compressor, @{ threshold: -15, ratio: 2.0, mix: 0.85 })
```

### 4.3 Group Bus (`group`)
Sums multiple tracks into a shared bus with collective volume, mute/solo, and bus FX processing:
```tenuto
group synth_bus "Master Synth Bus" tracks=[lead, pad, seq, sub]
  .fx(dual_bus_silk_sum, @{ silk: "dual", texture: 0.6 })
  .fx(glue_compressor, @{ ratio: 2.5, threshold: -12, mix: 0.8 })
  .fx(mastering_clip_limiter, @{ ceiling: -1.0, gain_db: 1.5, odd_even_thd: 0.25 })
```

### 4.4 Groove Pool (`groove`)
Defines non-destructive timing quantization, off-beat MPC-style swing, micro-timing humanization, and velocity accents:
```tenuto
groove tape_pocket "Downtempo Pocket" @{ base: "1/16", quantize: 85%, timing: 42%, random: 12%, velocity: 35% }
```

---

## 5. Complete Multi-Engine Instrument & Patch Catalog (`style` & `patch`)

### 5.1 Studio Flagship & Virtual Analog/Hybrid Synthesizers (`style=synth`)
> **Routing Rule:** Always declare `style=synth` (or the engine-specific `style=scsynth|eurorack|daisy|stk|soundpipe`) on synthesizer tracks so the engine routes voices to Tenuto's native 64-bit continuous DSP synthesizers rather than acoustic SoundFont samples.

| `patch="..."` | Synthesis Paradigm & Circuit Topology | Primary Musical Applications |
| :--- | :--- | :--- |
| `"supersaw"` | **7-Voice Asymmetric Unison Saw + Sub:** Golden-ratio detune spread (`1.55x` center anchor prevents phase cancellation) + phase-locked sub-octave + high-air sheen. | Massive festival chord drops, wide trance leads, octaved synth stacks. |
| `"flutter_pad"` | **Animated LFO Filter Pad:** Multi-voice warm saw/triangle pad with tempo-synced amplitude/cutoff flutter and wide stereo dispersion. | Open-voiced chord planing, evolving ambient beds, lush harmonic cushions. |
| `"reese_bass"` / `"reese"` | **3-Saw Wide-Detuned Bass + Phase-Locked Sub:** Asymmetric detuned saws ($\pm 28\text{c}$) + heavy sine sub-oscillator + saturating ladder drive + `120 Hz` Mid/Side bass-mono crossover. | Deep drum & bass / cyberpunk sub-bass, sustained pedal tones, dark neuro basslines. |
| `"pluck_lead"` | **Fast-Transient Resonant Pluck:** Snappy `3ms` attack + exponential decay contour with high filter resonance (`3.2`). | Berlin School 16th-note step sequences, arpeggios, rhythmic synth stabs. |
| `"saw_lead"` | **Classic Analog Brass / Soloist Lead:** Dual-oscillator detuned saw/pulse with warm low-pass filter sweep and expressive vibrato. | Expressive MPE solo lines, synthwave melodies, soaring thematic leads. |
| `"acid_lead"` | **Resonant Acid Bass/Lead:** High-resonance (`18 dB/oct`) diode/ladder squelch with accentuated `.glide()` portamento. | Acid house/techno 16th-note squelch lines, aggressive filter-swept riffs. |
| `"riser"` | **Exponential Pitch & Filter Riser:** Sweeps pitch upward $+12\text{ semitones}$ while opening the ladder filter from $320\text{ Hz} \rightarrow 9800\text{ Hz}$. | Pre-drop transitions, cinematic tension builds. |
| `"morph_analog_12"` | **12-Voice Morphing Dual-Filter Analog Polysynth:** Dual VCOs with triangle wavefolding (`.tri_fold()`), $12\text{ dB/oct}$ Steiner-Parker drive (`.steiner_drive()`) + $24\text{ dB/oct}$ Ladder filter, A/B state morphing (`.morph()`), and continuous vertical key-travel sensing (`.touch_travel()`). | Expressive polyphonic pads, morphing brass-to-glass leads, 3D MPE chord swells. |
| `"vintage_ladder_8"` | **8-Voice Bi-Timbral Discrete Ladder Polysynth:** Variable Triangle/Saw VCO mix, analog ring modulation (`.ring()`), saturating discrete transistor mixer drive (`.discrete_drive()`), and dual $24\text{ dB/oct}$ transistor ladder filters. | Fat vintage basslines, warm modular-style polyphonic leads, saturated chords. |
| `"hybrid_motor_12"` | **12-Voice Hybrid Analog + Digital Wavetable Synth:** 2 analog VCOs + $96\text{ kHz}$ macro-wavetable oscillator into a 4-pole ladder filter and **four-quadrant through-zero stereo VCAs** supporting continuous $360^\circ$ rotation (`.spin()`). | Spatial swirling textures, hybrid wavetable/analog pads, animated stereo leads. |
| `"binaural_hybrid_20"` | **Binaural Dual-Voice Stereo Hybrid Synth:** Dedicates two independent synth voices (Left ear and Right ear) to every note played with independent super-wave detune (`.binaural(14c)`). | Ultra-wide panoramic pads and leads that envelop the listener without center mud. |
| `"state_variable_8"` | **True-Stereo State-Variable 8-Voice Polysynth:** Discrete $12\text{ dB/oct}$ state-variable filter character with wide per-voice stereo panning and organic voice-to-voice component drift (`slop=35`). | Wide cinematic brass swells, 1980s soundtrack beds. |
| `"vintage_poly_10"` | **10-Voice Cohesive Midrange Analog Polysynth:** Focused 4-pole Curtiss-style low-pass filter response that sits naturally in dense mixes without harsh upper-frequency fizz. | Warm accompaniment chords, dark polymod bass/pad layers. |
| `"stepped_wavetable_24"` | **Vintage Stepped Digital Wavetable + Analog Filter Hybrid:** Models 8-bit/12-bit stepped wavetable upper harmonic grit (`.aliasing(35%)`) smoothed through a warm analog low-pass filter. | Glassy 1980s digital bells, evolving hybrid pads. |
| `"spectral_hybrid_16"` | **16-Voice Spectral, Resonator & Kernel FM Hybrid:** Combines multi-harmonic wavetables, comb resonators (`.comb()`), and audio-rate FM (`.fm()`) with dual analog filters. | Sci-fi sound design, metallic plucked resonators, complex IDM textures. |
| `"granular_workstation_80"` | **Multi-Layer Granular & Phase-Vocoder Spectral Engine:** Raised-cosine grain clouds and time-decoupled spectral smears. | Time-frozen vocal/pad clouds, shimmering atmospheric textures. |
| `"tape_nostalgia_pad"` | **3-Voice Tape-Degraded Triangle Pad:** $30\%$-bent triangle wave (hollow body without saw buzz), 3 unison voices detuned by $8\text{ cents}$, steep $900\text{ Hz}$ 4-pole low-pass filter, $20\%$ sine sub, slow $800\text{ ms}$ attack, and dual-LFO tape transport drift (`.wow_flutter()`). | Hauntological, worn-cassette boards/library music pads, intimate nostalgic beds. |
| `"ribbon_cluster_8"` | **8-Oscillator Continuous Ribbon Cluster Synth:** 8 unquantized analog oscillators controlled by continuous pitch-spread ribbons (`.swarm(stOrCurve)`), creating primal acoustic beating. | Cinematic dread drones, industrial tension beds beneath delicate piano motifs. |
| `"west_coast_200"` / `"cybernetic_eoc"` | **West Coast Wavefolder + Vactrol Low-Pass Gate Synth:** Triangle core routed through a multi-stage harmonic wavefolder (`.fold()`), vactrol opto-isolator Low-Pass Gate (`.lpg("both", 420ms)`), and End-of-Cycle cybernetic generator (`.eoc_cycle(5)`). | Organic marimba/bell/membrane plucks, autonomous sci-fi Krell sequences, complex folded leads. |
| `"wavetable"` | **Dual-Oscillator 24-Harmonic Morphing Wavetable Synth:** 5 banks (`basic_shapes`, `harmonics`, `digital_pwm`, `vintage_analog`, `formant_vocal`) + 6 Unison modes (`classic`, `shimmer`, `noise`, `phase_sync`, `position_spread`). | Modern electronic leads, formant-morphing basses, shimmering unison chords. |
| `"operator"` | **4-Operator FM & Additive Synthesizer:** 11 routing algorithms (`env=@{algorithm: "4", ratioA: "1.0", ratioB: "3.5", ratioC: "7.0"}`). | Crisp FM basses, crystalline bells, metallic percussion, additive organ drawbars. |
| `"meld"` / `"drift"` / `"analog"` | **Bi-Timbral Macro & Organic Drift Subtractive Synths:** Scale-aware harmonic swarms and slow analog pitch/cutoff walk. | Organic electronic leads, warm lo-fi basslines. |
| `"collision"` / `"tension"` / `"electric"` | **Physical Modeling Suite:** Euler-Bernoulli modal mallet bars (`collision`), Karplus-Strong string waveguides (`tension`), and tine-bell electric pianos (`electric`). | Expressive mallets, plucked/bowed physical strings, barky tine electric pianos. |
| `"granulator"` | **Granulator III Cloud Synthesizer:** Configurable via `macros=@{ grain_size: 64, density: 24, spray: 28, pitch_jitter: 14, scan: 0.65 }`. | Textural grain clouds, evolving ambient washes. |

### 5.2 SuperCollider (`scsynth`) UGen-Graph Suite (`style=scsynth` or `style=synth`)
12 pure-MIT UGen topologies with binary OSC 1.1 `/s_new` bundle encoding, inline `.rlpf(cutoff, res)`, `.dfm1(cutoff, res)`, `.moog_ff(cutoff, res)`, and `.klank(mode, decayPct)` modifiers, and standalone `.scd` (`SynthDef` + `Pbind`) export:

| `patch="..."` | UGen Graph Topology | Musical Character |
| :--- | :--- | :--- |
| `"sc:default"` | `Linen.kr + VarSaw.ar([freq, freq*1.003]) -> LPF.ar` | Balanced stereo variable-slope saw synth. |
| `"sc:prophet"` | `5-Voice Pulse.ar(SinOsc.kr) + LFPulse.ar -> RLPF.ar` | Warm Prophet-5 PWM brass and polyphonic pads. |
| `"sc:tb303"` | `LFSaw/LFPulse.ar + ExpEnv Sweep -> RLPFD.ar + Tanh` | Squelchy 303 diode-ladder acid bassline. |
| `"sc:jp8000"` | `Splay.ar(Saw.ar(freq * detune7)) + SubSin -> RLPF.ar` | Wide 7-saw stereo supersaw pad & lead. |
| `"sc:modal_bell"` | `PinkNoiseStrike -> Klank.ar(6 Inharmonic Chime Modes)` | Crystalline 6-mode inharmonic chime & bell. |
| `"sc:klank_resonator"` | `Dust2/BrownNoise Exciter -> DynKlank.ar(8 Tuned Modes)` | Shimmering 8-mode tuned metallic/wooden resonator bank. |
| `"sc:dx7_brass"` | `PMOsc.ar Carrier/Modulator Pair + Feedback -> LPF.ar` | Punchy 6-operator FM brass & electric keyboard. |
| `"sc:formant_choir"` | `3-Formant.ar(fundfreq, formfreq, bwfreq) Vowel Bank` | Choral 3-formant vocal synth pad. |
| `"sc:karplus_pluck"` | `WhiteNoise Burst -> Pluck.ar(delaytime: 1/freq, coef: 0.24)` | Plucked acoustic waveguide string. |
| `"sc:gendy_stochastic"` | `Gendy1.ar(ampdist:1, durdist:1, minfreq, maxfreq) -> RLPF` | Xenakis dynamic stochastic breakpoint synthesis. |
| `"sc:pulsar_train"` | `Blip.ar(freq, numharm) + Hann Formant Window -> RLPF.ar` | Curtis Roads pulsar train & formant grain synth. |
| `"sc:hoover"` | `PWM Saw/Sub Stack + Pitch Dive Env -> Chorus -> RLPF.ar` | Classic Alpha Juno pitch-diving Hoover lead/bass. |

### 5.3 Eurorack Macro-Oscillator & Modal Resonator Suite (`style=eurorack` or `style=synth`)
12 pure-MIT Eurorack models (`Plaits` Green/Red banks, `Rings` sympathetic strings, and `Clouds` granular texture diffuser) with internal Vactrol Low-Pass Gate (`LPG`), 1st-order `R = 0.998` DC blocker, and inline `.timbre(pct)`, `.harmonics(pct)`, `.morph(pct)`, `.structure(pct)`, `.damping(pct)`, and `.position(pct)` modifiers:

| `patch="..."` | Eurorack Module & Synthesis Model | Primary Macros & Modifiers |
| :--- | :--- | :--- |
| `"mi:plaits_va"` | Variable-Slope Saw + Variable-Width Pulse + Sub -> LPG | `.harmonics()` (Detune), `.timbre()` (PWM), `.morph()` (Saw Slope) |
| `"mi:plaits_waveshaper"` | Triangle Core -> 4-Stage West Coast Diode Wavefolder -> LPG | `.timbre()` (Fold Gain), `.morph()` (Asymmetry) |
| `"mi:plaits_fm"` | Quantized Ratio Modulator w/ Feedback -> Sine Carrier -> LPG | `.harmonics()` (FM Ratio), `.timbre()` (Mod Index), `.morph()` (Feedback) |
| `"mi:plaits_grain"` | Zero-Phase Windowed Sine Grainlets + Formant Sync -> LPG | `.timbre()` (Formant Freq), `.morph()` (Grain Width) |
| `"mi:plaits_additive"` | 16-Partial Spectral Bump Bank + Chebyshev Comb -> LPG | `.harmonics()` (Bumps), `.timbre()` (Centroid), `.morph()` (Q) |
| `"mi:plaits_swarm"` | 7 Golden-Ratio Detuned Bandlimited Saws + Sub Anchor -> LPG | `.harmonics()` (Pitch Spread), `.timbre()` (Brightness) |
| `"mi:plaits_chord"` | 4-Voice Chord Voicing Quantizer + String-Machine Organ -> LPG | `.harmonics()` (Chord Type), `.timbre()` (Registration) |
| `"mi:plaits_speech"` | Glottal Impulse Train -> F1/F2/F3 Vocal Tract Filter -> LPG | `.lyric("...")`, `.timbre()` (Tract Shift), `.morph()` (Glottal Color) |
| `"mi:plaits_karplus"` | Colored Noise Burst -> Fractional Allpass String Loop -> LPG | `.timbre()` (Pluck Brightness), `.morph()` (String Decay) |
| `"mi:plaits_modal"` | Mallet Strike Exciter -> 6-Mode Inharmonic Plate/Bell Bank | `.harmonics()` (Inharmonicity), `.timbre()` (Hardness), `.morph()` (Decay) |
| `"mi:rings_sympathetic"` | Bowed/Plucked Exciter -> 4 Coupled Sympathetic Comb Strings | `.structure()` (Interval Coupling), `.timbre()` (Brightness), `.damping()` (Sustain) |
| `"mi:clouds_texture"` | 4 Overlapping Hann-Windowed Grains + Allpass Diffuser Network | `.harmonics()` (Grain Rate), `.timbre()` (Octave Shimmer), `.morph()` (Sub) |

### 5.4 Electro-Smith DaisySP & Stanford CCRMA STK Waveguides (`style=daisy` or `style=stk`)
16 physical modeling and vocal-formant engines controlled via `.jawari(pct)`, `.breath(pct)`, `.jet(pct)`, `.bow(pressurePct, posPct)`, and `.damping(pct)`:
* **DaisySP (`daisy:*`):** `"daisy:string_voice"` (Extended Karplus-Strong with dispersion allpass), `"daisy:modal_voice"` (6-mode struck bar/plate), `"daisy:fm2"` (2-Op through-zero FM), `"daisy:vosim"` (Kaegi/Tempelaars squared-sine formant pulse train), `"daisy:formant_osc"` / `"daisy:formant"`, `"daisy:harmonic"`, `"daisy:variable_saw"`, `"daisy:zosc"`, `"daisy:drip"`.
* **Stanford STK (`stk:*`):** `"stk:sitar"` (Curved-bridge nonlinear `jawari` buzz + sympathetic drone), `"stk:flute"` (Jet-delay embouchure cubic nonlinearity $x - x^3$ + bore waveguide), `"stk:clar"` / `"stk:clarinet"` (Reed table + cylindrical bore), `"stk:saxofony"`, `"stk:brass"` (Lip-reed mass-spring filter + conical bore), `"stk:bowed"` (Friction stick-slip bow table + coupled string delays), `"stk:rhodey"` (Fender Rhodes tine & tonebar 4-Op FM), `"stk:wurley"` (Wurlitzer 200A steel reed FM), `"stk:bandedwg"` / `"stk:banded_wg"` (Tibetan prayer bowl / glass harp banded waveguide), `"stk:blown_bottle"`, `"stk:stif_karp"`.

### 5.5 Paul Batchelor Soundpipe / Csound DSP Suite (`style=soundpipe`)
8 classical computer-music synthesis algorithms controlled via `.pdhalf(pct)`, `.gbuzz(pct)`, and `.fof("a"|"e"|"i"|"o"|"u")`:
* `"sp:pdhalf"` (Casio CZ piecewise bilinear phase-distortion half-sine), `"sp:fof"` / `"sp:fof_choir"` (IRCAM Chant 3-formant vocal skirt-windowed sine bursts), `"sp:gbuzz"` (Closed-form harmonic cosine buzz series $\sum r^{k-1} \cos(k\omega t)$), `"sp:fosc"` (Chowning C:M:I FM pair), `"sp:blsaw"` / `"sp:widesaw"`, `"sp:blsquare"`, `"sp:drip"` / `"sp:drip_water"` (Perry Cook physical water droplet), `"sp:bar"` / `"sp:bar_model"`, `"sp:jitter"` / `"sp:jitter_pad"`, `"sp:streson"`, `"sp:mincer"`, `"sp:autowah"`, `"sp:bitcrush_lead"`.

### 5.6 Multi-Sampled Acoustic & Orchestral Instruments (`style=standard`)
* **Pianos & Keyboards:** `"salamander_grand"`, `"acoustic_grand_piano"`, `"bright_piano"`, `"electric_piano_1"`, `"electric_piano_2"`, `"harpsichord"`, `"clavinet"`, `"celesta"`, `"church_organ"`, `"drawbar_organ"`, `"reed_organ"`, `"accordion"`
* **Chromatic Percussion:** `"vibraphone"`, `"marimba"`, `"xylophone"`, `"glockenspiel"`, `"tubular_bells"`, `"music_box"`, `"dulcimer"`
* **Orchestral Strings & Harp:** `"violin"`, `"viola"`, `"cello"`, `"contrabass"`, `"string_ensemble_1"`, `"chamber_strings"`, `"tremolo_strings"`, `"pizzicato_strings"`, `"orchestral_harp"`, `"timpani"`
* **Orchestral Winds, Brass & Choir:** `"flute"`, `"piccolo"`, `"oboe"`, `"english_horn"`, `"clarinet"`, `"bassoon"`, `"french_horn"`, `"trumpet"`, `"muted_trumpet"`, `"trombone"`, `"tuba"`, `"brass_section"`, `"choir_aahs"`, `"voice_oohs"`, `"synth_choir"`
* **Guitars, Basses & World:** `"nylon_guitar"`, `"steel_guitar"`, `"jazz_guitar"`, `"clean_guitar"`, `"overdriven_guitar"`, `"acoustic_bass"`, `"finger_bass"`, `"fretless_bass"`, `"sitar"`, `"koto"`, `"kalimba"`

### 5.7 Vocal Chop Slice Sampler (`style=simpler`) & 128-Pad Drum Rack (`style=grid`)
* **Simpler (`style=simpler`):** Maps named time slices via `map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s] }` and triggers them as pitch tokens (`doin:8 right:8.transpose(5).formant(3).reverse`).
* **Drum Rack (`style=grid` `patch="tenuto_808_kit"`):** Tokens `k`/`bd`/`kick` (36), `s`/`sd`/`snare` (38), `cp`/`clap` (39), `rim` (37), `h`/`hh`/`ch` (42, **Choke Group 1**), `oh` (46, **Choke Group 1**), `lt`/`mt`/`ht` (45, 47, 50), `cr`/`rd` (49, 51).

---

## 6. Pitch, Rhythm, Rational Time & The Golden Rule of Measure Math

### 6.1 Pitches, Microtones & Sticky Octave Inheritance
* **Standard Pitch Format:** `<note><accidental><octave>` — e.g., `c4` (Middle C, MIDI 60), `a4` (440 Hz, MIDI 69), `f#3`, `eb5`.
* **Microtonal Accidentals & Cent Offsets:** `qs` ($+50\text{c}$), `qf` ($-50\text{c}$), `tqs` ($+150\text{c}$), `tqf` ($-150\text{c}$), `x` ($+200\text{c}$), or explicit cent offsets (`c4+25c`, `e4-14c`).
* **Sticky Octave Rule:** Once a note specifies an octave in a voice, subsequent notes inherit that octave until a new octave number is written (`c4:8 d e f g a b c5`).
* **Rests & Automation Spacers:** `r:<duration>` (silence) and `s:<duration>` (invisible automation carrier).

### 6.2 Durations, Dotted Notes & Sticky Rhythm Inheritance
Tenuto evaluates all rhythm using exact **Rational Arithmetic ($\frac{P}{Q}$)** with zero floating-point drift:

| Duration Token | Musical Name | Fraction of Whole Note | Quarter-Note Beats (in `4/4`) |
| :--- | :--- | :--- | :--- |
| `:1` | Whole note | $1/1$ | **$4.0\text{ beats}$** |
| `:2.` | Dotted half note | $3/4$ | **$3.0\text{ beats}$** |
| `:2` | Half note | $1/2$ | **$2.0\text{ beats}$** |
| `:4.` | Dotted quarter note | $3/8$ | **$1.5\text{ beats}$** |
| `:4` | Quarter note | $1/4$ | **$1.0\text{ beat}$** |
| `:8.` | Dotted eighth note | $3/16$ | **$0.75\text{ beats}$** |
| `:8` | Eighth note | $1/8$ | **$0.5\text{ beats}$** |
| `:16.` | Dotted sixteenth note | $3/32$ | **$0.375\text{ beats}$** |
| `:16` | Sixteenth note | $1/16$ | **$0.25\text{ beats}$** |
| `:32` | Thirty-second note | $1/32$ | **$0.125\text{ beats}$** |
| `:3/8` | Explicit rational fraction | $3/8$ | **$1.5\text{ beats}$** |
| `:4*3` | Multiplier suffix | $3/4$ | **$3.0\text{ beats}$** |
| `:grace` | Atemporal grace note | $0/1$ | **$0.0\text{ beats}$** (triggers `45ms` pre-beat) |

* **Sticky Duration Rule:** If a note omits `:duration`, it inherits the previous duration in that voice (`c4:16 d e f g:4` = four 16th notes + one quarter note).
* **CRITICAL SYNTAX RULE FOR DOTTED NOTES WITH MODIFIERS:**
  When attaching a `.modifier` to a **dotted duration** (such as `:2.`, `:4.`, or `:8.`), write **two dots** (`..`)—the first dot belongs to the dotted duration and the second dot begins the modifier chain:
  * Correct: `a4:2..mp.legato.vib` (dotted half note `:2.` with `.mp.legato.vib`)
  * Correct: `c4:4..f.stacc` (dotted quarter note `:4.` with `.f.stacc`)

### 6.3 The Golden Rule of Measure Math
To guarantee that `measure 1`, `measure 2`, ..., `measure N` align 1-to-1 across all tracks without barline drift:
* In `"4/4"` time, **every active track and voice inside a `measure N { ... }` block MUST sum to `1.0` whole note (`4.0` quarter-note beats)**. Always pad partial melody lines with explicit rests (`r:4`, `r:2`).

---

## 7. Polyphony, Chords, Tuplets, Euclidean Rhythms, Strudel Combinators & Ties

* **Chords (`[ ... ]:<dur>.<mods>`):**
  ```tenuto
  pad: [e2 b2 f#3 g#3 b3]:1.mp.open_voice.detune(55%, 0.2..0.9).filter(1100, 2800).glide(220ms) |
  ```
* **Parallel Polyphonic Voices (`<[ v1: ... | v2: ... ]>`):**
  ```tenuto
  pno: <[ v1: g5:2.mp.legato f#5:4.legato e5:4 | v2: [e2 b2 g3]:1.p.ped ]>
  ```
* **Tuplets (`(notes):<num>/<den>`) & Euclidean Rhythms (`(<pitch>):<hits>/<steps>`):**
  ```tenuto
  lead:  (c5:8 d5:8 e5:8):3/2 g5:4 r:2 |   %% Three 8th-note triplets = 1 quarter beat
  drums: (k):3/8 r:2 |                     %% 3-over-8 tresillo (2 beats) + half rest (2 beats)
  ```
* **Strudel Pattern Combinators (`repeat N`, `fast N`, `slow N`, `rev`) & Macros (`macro name = { ... }` / `$name`):**
  * `repeat N { ... }` — Repeats the inner token block `N` times.
  * `fast N { ... }` — Scales inner durations by `1/N` (e.g., `:4` becomes `:8`) and repeats the compressed cycle `N` times so total beat duration stays unchanged!
  * `slow N { ... }` — Stretches inner durations by `N` (e.g., `:4` becomes `:2`).
  * `rev { ... }` — Reverses the token order of the block (retrograde mirror canon).
  ```tenuto
  macro bass_cell = { c2:16 c3:16 g2:16 c3:16 }
  seq: repeat 2 { $bass_cell } fast 2 { c3:8 eb3:8 } rev { g3:8 bb3:8.ply(2) } |
  ```
* **Forward-Looking Ties (`~`):**
  Merges consecutive notes or chords of identical pitch on the same track/voice into a single unbroken sustained event across beats or barlines (`sub: e1:1.p.legato~ |`).

---

## 8. Classical Articulations, Dynamics, Ornaments, Probability & Lyrics

| Modifier | Category | Acoustic & DSP Behavior |
| :--- | :--- | :--- |
| `.pp`, `.p`, `.mp`, `.mf`, `.f`, `.ff`, `.sfz` | Dynamics | Sets MIDI velocity (`40`, `60`, `75`, `90`, `105`, `120`, `124`) and scales filter brightness. |
| `.vol(0..127)` & `.vel_range(low, high)` | Dynamics | Sets exact MIDI velocity or humanizes velocity deterministically within `[low, high]`. |
| `.chance(0%..100%)` & `.degrade(dropPct)` | Probability | Triggers the note with probability $N\%$ (`.degrade(25%)` sets `.chance(75%)`). |
| `.pick_one` | Probability | On a chord `[c4 e4 g4]:4.pick_one`, randomly selects and plays one voice from the chord. |
| `.cresc` / `.cresc(startVel, endVel)` | Swell | Smoothly swells amplitude and filter cutoff upward across a note or consecutive phrase. |
| `.dim` / `.dim(startVel, endVel)` | Swell | Smoothly tapers amplitude and filter cutoff downward. |
| `.fp` / `.sfp` | Accent | Sharp *forte-piano* attack (`118`) that immediately drops to a soft sustain. |
| `.legato` / `.slur` & `.stacc` / `.marc` | Articulation | Connected phrase overlap (`.legato`), crisp short gate (`0.48x`, `.stacc`), or accented attack (`.marc`). |
| `.pizz`, `.ped`, `.arp` & `.fermata` | Expression | Plucked string (`.pizz`), damper sustain (`.ped`), bottom-to-top `28ms`/voice chord roll (`.arp`), or `1.65x` hold (`.fermata`). |
| `.vib`, `.tr` / `.trill`, `.mordent`, `.roll(N)` | Ornaments | Delayed `5.5 Hz` vibrato, whole-step trill, upper-neighbor mordent flick, or `N`-hit tremolo subdivision. |
| `.pull(ms)` / `.push(ms)` & `.pan(-1..1)` | Space / Time | Shifts physical playback late/early without altering the grid; sets per-note stereo pan. |
| `.lyric("word")` | Vocal / Formant | Decomposes English syllables into Klatt vowel formants ($F_1, F_2, F_3$) and consonants; drives `.fx(vocoder)`. |

---

## 9. Continuous Synthesizer, Eurorack, Waveguide & UGen Modifiers

### 9.1 Intra-Note Windowed Modulation (`startNorm..endNorm`) & Multi-Point Curves (`[v0, v1, v2]`)
Any continuous modifier (`.detune`, `.detune_cents`, `.cutoff`, `.filter`, `.noise`, `.drive`, `.fold`, `.tri_fold`, `.morph`, `.swarm`, `.width`, `.timbre`) accepts either:
1. **A Normalized Time Window (`0.0..1.0`):** Activates smoothly inside `[startNorm, endNorm]` with raised-cosine edge feathering and automatically completes `6ms` before any trailing `.glide()` ramp (`.detune(78%, 0.15..0.90)`).
2. **A Multi-Point Trajectory Array (`[start, mid, end]`):** Smoothstep-interpolates across control points over the note's duration (`.detune([68, 40, 18])`, `.timbre([35, 88, 45])`).

### 9.2 Complete Reference of Synth, Eurorack, Waveguide & UGen Modifiers

| Modifier Syntax | Target Engine(s) & Circuit Mechanism |
| :--- | :--- |
| `.glide(180ms)` | **Automatic Polyphonic Voice-Leading Portamento:** Pairs sorted voices of consecutive chords/notes and glides every voice along its shortest semitone path during the final $22\%$ of the note. |
| `.detune(65%, 0.2..0.9)` / `.detune_cents(-16c, 0.15..0.90)` | **Asymmetric Golden-Ratio Unison Detune & Microtonal Pitch Contour:** Controls unison spread (`0%–100%`) or intra-note cent contour (`-1200c..+1200c`). |
| `.filter(startHz, endHz)` / `.cutoff(hz)` / `.res(0.5..18)` | **2x-Oversampled State-Variable Filter Sweep:** Sweeps low-pass cutoff smoothly from `startHz` to `endHz` (`60 Hz–16000 Hz`). |
| `.warp_wave("bend" \| "mirror", 30%)` | **Waveform Warping:** Asymmetrical hyperbolic tangent compression (`"bend"`) or zero-crossing fold (`"mirror"`). |
| `.vowel("oh", "ooh", 0.2)` & `.fof("a"\|"e"\|"i"\|"o"\|"u")` | **Formant Vowel LFO & IRCAM Chant FOF Vowel Target:** Oscillates Klatt vowel formants or sets the `sp:fof_choir` / `daisy:vosim` vowel target. |
| `.wow_flutter(wowCents, wowHz, flutterCents, flutterHz)` | **Dual-LFO Magnetic Tape Drift:** Irregular dual-sine seasick tape wow + fast transient-blurring flutter. |
| `.swarm(stOrCurve)` | **8-Oscillator Ribbon Cluster Spread:** Spreads 8 oscillators across `0.0..12.0` semitones (or curve `[0.2, 3.2, 0.4]`). |
| `.fold(pctOrCurve)` & `.lpg("both" \| "vca" \| "lp", decayMs)` | **West Coast Wavefolder & Vactrol Low-Pass Gate:** Multi-stage harmonic wavefolder (`0%–100%`) + photoresistive vactrol decay (`decayMs`). |
| `.tri_fold(pct)`, `.steiner_drive(pct)`, `.discrete_drive(pct)` | **Analog Circuit Drives:** Triangle wavefolder (`morph_analog_12`), $12\text{ dB/oct}$ Steiner feedback saturation, and discrete transistor mixer overload (`vintage_ladder_8`). |
| `.binaural(cents)` & `.spin(rateHz)` | **Binaural Left/Right Voice Split & $360^\circ$ VCA Rotation:** Decorrelates L/R ear unison voices (`14c`) and rotates the stereo image at `rateHz`. |
| `.morph(pctOrCurve)`, `.touch_travel("at" \| "at_z" \| "pizz")`, `.aliasing(pct)` | **State Morphing, Vertical Key-Travel & Stepped Decimation:** Interpolates Patch A/B state, shapes key-dip envelopes, and adds vintage sample-hold grit. |
| `.stack("octaves" \| "fifths" \| "seventh" \| "super")` | Locks upper unison oscillators to $+12\text{st}$ octaves, $+7\text{st}$ fifths, or $+10\text{st}$ sevenths. |
| `.noise(level, "white" \| "pink" \| "breath", start..end)` | Injects filtered noise (`0%–100%`) over the specified note window. |
| `.sync(ratio)`, `.fm(amt, ratio)`, `.ring(amt, hz)`, `.pwm(duty, hz)`, `.comb(hz, fb)` | Hard oscillator sync, audio-rate FM, ring modulation, PWM, and tuned Karplus/comb resonator. |
| `.duck(depthPct)`, `.gate([1,0,1,1,...])`, `.pluck(ms, st)` / `.zap`, `.pitch_dip(-7)` | Quarter-note sidechain pump, rhythmic trance gate, transient pitch zap, and vinyl tapestop dip. |
| `.haas(delayMs)`, `.width(0..200)`, `.analog_slop(pct)`, `.keytrack(pct)`, `.air(pct)`, `.drive(pct)`, `.pre_swell` | Stereo Haas delay, Mid/Side width, random voice drift, filter keytracking, high-air sheen, soft-clip drive, and reverse-envelope pre-swell. |
| `.timbre(pctOrCurve)`, `.harmonics(pct)`, `.structure(pct)`, `.damping(pct)`, `.position(pct)` | **Eurorack (`mi:*`) Macro & Modal Controls:** Controls `Plaits` `TIMBRE`/`HARMONICS` and `Rings` sympathetic `STRUCTURE` (interval coupling) & `DAMPING` (ring decay). |
| `.jawari(pct)`, `.breath(pct)`, `.jet(pct)`, `.bow(pressurePct, posPct)` | **DaisySP (`daisy:*`) & Stanford STK (`stk:*`) Waveguide Controls:** Controls curved-bridge sitar `jawari` buzz (`stk:sitar`), wind turbulence & embouchure jet delay (`stk:flute`), and bow friction (`stk:bowed`). |
| `.pdhalf(pct)` & `.gbuzz(pct)` | **Soundpipe (`sp:*`) Controls:** Controls Casio CZ bilinear phase-distortion inflection skew (`sp:pdhalf`) and harmonic cosine buzz brightness (`sp:gbuzz`). |
| `.rlpf(cutoffHz, res)`, `.dfm1(cutoffHz, res)`, `.moog_ff(cutoffHz, res)`, `.klank(mode, decayPct)` | **SuperCollider (`sc:*`) UGen Filter & Resonator Controls:** Controls `RLPF.ar`, self-oscillating analog diode filter `DFM1.ar`, 4-pole ladder `MoogFF.ar`, and `Klank.ar` modal ring decay. |
| `.galactic(mixPct)`, `.dattorro(mixPct)`, `.paulstretch(ratioX)`, `.totape(slamPct)`, `.fdn_reverb(mixPct)` | **Inline Per-Note FX Shorthands:** Attaches `aw_galactic`, `dattorro_plate`, `paulstretch`, `aw_totape6`, or `signalsmith_reverb` directly to an individual note or chord. |

---

## 10. Harmonic Architecture: Voicing Physics, Parallel Planing & Negative Harmony

### 10.1 Open Voicings & Rootless Structures (`.open_voice` & `.rootless`)
* **`.open_voice` (or `.drop2`):** Transposes the second-lowest note of any 3+ note chord down an octave (or spreads closed triads into $R-5-3$ compound intervals), eliminating lower-midrange mud.
* **`.rootless`:** Strips the lowest (root) pitch from any 3+ note chord (or `.plane()` expansion) so upper polyphonic pads never collide with a dedicated `sub` track in the bottom octave.

### 10.2 Parallel Harmonic Planing (`.plane("<type>")`)
Attaching `.plane("<type>")` to any single root note automatically expands it into a locked multi-voice chord block:
* `.plane("m9")` (`[0, 3, 7, 10, 14]`), `.plane("maj9")` (`[0, 4, 7, 11, 14]`), `.plane("dom9")` / `.plane("9")` (`[0, 4, 7, 10, 14]`), `.plane("m7")` (`[0, 3, 7, 10]`), `.plane("maj7")` (`[0, 4, 7, 11]`), `.plane("m7b5")` (`[0, 3, 6, 10]`), `.plane("dim7")` (`[0, 3, 6, 9]`), `.plane("add9")` (`[0, 4, 7, 14]`), `.plane("madd9")` (`[0, 3, 7, 14]`), `.plane("sus4")` (`[0, 5, 7, 10, 14]`), `.plane("sus2")` (`[0, 2, 7, 10, 14]`), `.plane("quartal")` (`[0, 5, 10, 15]`), `.plane("quintal")` (`[0, 7, 14]`), `.plane("fifth")` (`[0, 7]`), `.plane("fourth")` (`[0, 5]`).

### 10.3 Negative Harmony (`.neg_harm` / `.negative_harmony`)
Reflects any note, chord, or `.plane()` block across the **Tonic–Dominant Axis** ($R + 3.5\text{ semitones}$ in the active `meta.key`). In `key: "C"`, `[c4 e4 g4]:2.neg_harm` reflects C Major ($60, 64, 67$) into C Minor ($60, 63, 67$).

---

## 11. Sequenced, Generative & 3D Gestural Paradigms (`.ratchet`, `.eoc_cycle`, `.lpg`, MPE)

* **Step Ratcheting (`.ratchet(count, "flat" | "up" | "down")` & `.ply(count)`):** Subdivides any single note or chord step into `count` ($2\times$ to $32\times$) envelope re-triggers while keeping neighboring steps locked to the tempo grid.
* **Generative Cybernetics: End-of-Cycle Krell Patch (`.eoc_cycle(N)` / `.krell(N)`):** Deterministically subdivides a sustained span into `N` asymmetric EOC events whose rational durations sum strictly to the parent note's duration (`1.0` whole note)—high-register S&H pitches flash by as short blips (weight `1`) while low-register S&H pitches swell slowly (weight `3`) with wavefolding and pressure squeeze.
* **Three-Dimensional MPE Soloist Gestures (`.squeeze(90%)`, `.bend_voice(voiceIdx, cents, startNorm..endNorm)`, `.mpe(@{ bend, slide, pressure })`):** Zero-attack MPE key-dip pressure swells and independent single-finger pitch bending of a single inner voice inside a held chord.

---

## 12. 38 Studio Audio Effects, Mastering Outboard & Z-Axis Automation (`.fx`, `.automate`)

### 12.1 Core Studio, Signalsmith, Airwindows, Dattorro & Mastering FX

| Category | `.fx(...)` Processor Names & Key Parameters |
| :--- | :--- |
| **EQ, Filtering & Dynamics** | `eq_eight` (`@{ low_cut: 100, bell1_freq: 1200, bell1_db: 2.0, high_shelf_db: 1.5 }`), `auto_filter` (`@{ cutoff: 2400, res: 0.4, drive: 3.0 }`), `compressor`, `glue_compressor` (`@{ threshold: -12, ratio: 4, makeup: 2, mix: 0.85 }`), `multiband_dynamics` / `ott` (`@{ amount: 0.5, low_gain: 2.0, high_gain: 2.5 }`), `limiter` (`@{ ceiling: -0.3, gain_db: 2.0 }`), `utility` (`@{ width: 130, gain_db: 0 }`). |
| **Drive, Tape & Drum Saturation** | `drum_buss` (`@{ drive: 0.35, crunch: 0.25, boom_amount: 0.45 }`), `roar` (`@{ drive: 0.4, feedback: 0.2, mix: 0.85 }`), `saturator` (`@{ drive: 6.0, mix: 0.8 }`), `tape_degrade` (`@{ wow_hz: 0.42, wow_depth_ms: 1.8, flutter_hz: 9.5, high_cut: 5200, drive: 0.32 }`), `aw_totape6` (`@{ slam: 0.5, head_bump: 0.45, mix: 1.0 }`), `chow_tape` (`@{ drive: 0.6, saturation: 0.58, bias: 0.5, gap_loss: 0.35 }`). |
| **Reverbs, Plates & Shimmer Spaces** | `signalsmith_reverb` (`@{ decay: 3.8, damp_hz: 5400, mod_depth: 0.35, mix: 0.45 }`), `dattorro_plate` (`@{ decay: 0.84, damping: 0.3, mix: 0.4 }`), `aw_galactic` (`@{ replace: 0.72, detune: 0.35, bigness: 0.85, mix: 0.45 }`), `paulstretch` (`@{ stretch: 4.0, window_ms: 120, mix: 0.85 }`), `true_stereo_hall_reverb` (`@{ decay: 3.2, predelay: 22, rolloff_hz: 6800, mix: 0.42 }`), `hybrid_reverb`, `reverb`, `gated_reverb` (`@{ decay: 3.2, gate_ms: 160, threshold: -24, mix: 0.55 }`). |
| **Delays, Modulation, Pitch & Vocoder** | `echo` / `delay` (`@{ time: 0.375, feedback: 0.45, mix: 0.35 }`), `signalsmith_chorus` (`@{ rate: 0.55, depth_ms: 6.5, mix: 0.45 }`), `chorus`, `phaser`, `flanger`, `vocoder` (`@{ bands: 20, depth: 1.1, mix: 0.95 }` + `.lyric("...")`), `signalsmith_stretch` (`@{ semitones: 7, tonality_hz: 3200, mix: 0.35 }`), `spectral_pitch_harmonizer` (`@{ shift1_st: 7, shift2_st: -12, mix: 0.35 }`), `spectral_resonator`, `auto_shift`. |
| **Mastering & Bus Outboard Stack** | `transformer_color_adc` (`@{ transformer: "bx1", drive: 0.45 }`), `dual_bus_silk_sum` (`@{ silk: "dual", texture: 0.6 }`), `fet_fast_limiter` (`@{ ratio: "all_buttons", drive: 0.5 }`), `vari_mu_tube_comp` (`@{ threshold: -14, thd: "medium" }`), `mastering_clip_limiter` (`@{ ceiling: -0.3, gain_db: 2.0, odd_even_thd: 0.25 }`), `aw_console7`, `aw_pressure4`. |

### 12.2 Continuous Z-Axis Parameter & MIDI CC Automation (`.automate` & `.cc`)
Use an invisible spacer `s:1` on a parallel voice `v2` (or attach directly to a note) to sweep track parameters across a measure using `"linear"`, `"s_curve"`, `"exp"`, `"log"`, or `"step"` interpolation:
```tenuto
lead: <[
  v1: c4:4 e4:4 g4:4 c5:4 |
  v2: s:1.automate("cutoff", [400, 5200, 1200], "s_curve").cc(10, [20, 108], "linear")
]>
```

---

## 13. Six Complete Stylistic Blueprints (With Ready-to-Run `.ten` Code)

### Blueprint 1: Berlin School Dual-Temporality & Step Ratcheting
Combines a relentless 16th-note micro-time analog sequence featuring $2\times$ flat and $3\times$ crescendo ratchets against a beatless macro-time choir pad, resolving via **climax by subtraction** (dropping the sequencer out in Measure 2):

```tenuto
tenuto "6.0" {
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

  %% Climax by Subtraction: Sequencer drops out into echo trails while Choir blooms
  measure 2 {
    seq:   d3:4.mp.dim r:4 r:2 |
    choir: [c3 g3 e4 a4]:1.f.dim.open_voice.filter(3200, 1100) |
  }
}
```

### Blueprint 2: Detroit Techno / Deep House Parallel Chord Planing Over Static Pedal
Transposes a locked rootless minor-9th chord block (`.plane("m9").rootless`) along a B minor pentatonic scale (`B3, D4, E4, F#4`) while `sub` holds a static `C1` pedal, dissolving functional cadence expectation into a floating Lydian/jazz suspension:

```tenuto
tenuto "6.0" {
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
}
```

### Blueprint 3: Hauntology, Lost Futures & Tape Degradation
Uses a $30\%$-bent triangle wave (`patch="tape_nostalgia_pad"`), a steep $900\text{ Hz}$ dashboard low-pass filter, global flat cassette tuning (`master_tune: -24`), a $0.2\text{ Hz}$ `"oh" -> "ooh"` vowel filter LFO, dual-LFO tape transport `.wow_flutter()`, and `.fx(tape_degrade)`:

```tenuto
tenuto "6.0" {
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
}
```

### Blueprint 4: Cinematic Ribbon Clusters, West Coast EOC Cybernetics & 3D MPE
Combines a delicate acoustic piano motif with an 8-oscillator microtonal ribbon cluster drone (`patch="ribbon_cluster_8"`), an autonomous West Coast End-of-Cycle wavefolded Krell voice (`patch="west_coast_200"` with `.eoc_cycle(5)` and `.lpg("both", 380ms)`), and a 3D MPE soloist chord with zero-attack `.squeeze(90%)` and single-finger inner-voice bending (`.bend_voice(1, 50c, 0.2..0.8)`):

```tenuto
tenuto "6.0" {
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
}
```

### Blueprint 5: Outrun / Synthwave Retro-Futurism
Anchors an $Fm - D\flat maj7$ progression with open $sus2/sus4$ voicings, a driving 8th-note arpeggiated bassline, and punchy drums drenched in `.fx(gated_reverb)`:

```tenuto
tenuto "6.0" {
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
}
```

### Blueprint 6: Non-Octave Microtonal Counterpoint (`non_octave_alpha`)
Pairs the $78.0\text{ cents/step}$ non-octave equal temperament (`temperament: "non_octave_alpha"`) with a binaural spectral hybrid voice (`patch="binaural_hybrid_20"`) and $360^\circ$ through-zero VCA panning (`.spin(0.8)`):

```tenuto
tenuto "6.0" {
  meta @{ title: "Non-Octave Alpha Essay", tempo: 82, time: "4/4", temperament: "non_octave_alpha", scale_lock: false }

  def vox1 "Binaural Alpha Voice" style=synth patch="binaural_hybrid_20" vol=86 cutoff=3200
  def vox2 "Rotating Motor Voice" style=synth patch="hybrid_motor_12"    vol=82 cutoff=2600

  measure 1 {
    vox1: c4:4.mp.legato.binaural(14c) e4:4.mp.legato.binaural(14c) g4:2.mf.legato.binaural(16c).vib |
    vox2: [c3 g3 e4]:1.p.open_voice.spin(0.75).morph([15, 85, 25]).filter(1100, 2900) |
  }
}
```

---

## 14. Pre-Flight Compiler Checklist & Master AI Composer Prompt

### 14.1 Pre-Flight Verification Checklist
Before finalizing any `.ten` file, verify these 6 rules:
1. **Exact Measure Math:** In `4/4` time, every track line and every `<[ v1: ... | v2: ... ]>` voice inside a `measure N { ... }` block sums to **at most `4.0` quarter-note beats (`1.0` whole note)**.
2. **Dotted Duration + Modifier Double-Dot (`..`):** Whenever a dotted duration (`:2.`, `:4.`, `:8.`) is followed by a modifier, write two dots (`a4:2..mp.legato`, never `a4:2.mp`).
3. **Explicit `style` on Synthesizer Tracks:** Every synthesizer `def` includes `style=synth` (or `style=scsynth|eurorack|daisy|stk|soundpipe`) so it routes to the native 64-bit DSP synthesizer engines rather than acoustic SoundFont fallback.
4. **No Dangling Empty Track Labels:** Every `trackId:` inside a `measure` block has valid note/rest tokens on the same line before `|`.
5. **Spectral Inverse Proportionality:** Chords on dense unison or wavefolded synth tracks use `.open_voice` or `.rootless` so lower-midrange overtones do not collide with `sub` tracks.
6. **Scale Lock Awareness:** Set `scale_lock: false` in `meta @{ ... }` whenever using chromatic parallel chord planing (`.plane("m9")`), `.neg_harm`, or non-12-TET microtonality.

### 14.2 Copy-Paste Master Prompt for AI Composers (Gemini / Claude / ChatGPT)

```text
Write a studio-mastered, multi-track musical composition in Tenuto 6.0 DSL (.ten) and return ONLY the code inside a single ```tenuto code block.

Follow these strict Tenuto 6.0 rules:
1. Wrap the document in `tenuto "6.0" { ... }` with `meta @{ title: "...", tempo: ..., time: "4/4", key: "...", scale: "...", scale_lock: false, sidechain: "..." }`.
2. Define return buses (`return <id> "<Name>" .fx(...)`), tracks (`def <id> "<Name>" style=<standard|synth|scsynth|eurorack|daisy|stk|soundpipe|grid|simpler> patch="<patch>" ...`), and optional group buses (`group <id> "<Name>" tracks=[...] .fx(...)`).
3. Available patches by engine family:
   - Studio Synths (`style=synth`): "supersaw", "flutter_pad", "reese_bass", "pluck_lead", "saw_lead", "acid_lead", "riser", "morph_analog_12", "vintage_ladder_8", "hybrid_motor_12", "binaural_hybrid_20", "state_variable_8", "vintage_poly_10", "stepped_wavetable_24", "spectral_hybrid_16", "granular_workstation_80", "tape_nostalgia_pad", "ribbon_cluster_8", "west_coast_200", "cybernetic_eoc", "wavetable", "operator", "collision", "tension", "electric", "granulator".
   - SuperCollider UGen Synths (`style=scsynth` or `style=synth`): "sc:default", "sc:prophet", "sc:tb303", "sc:jp8000", "sc:modal_bell", "sc:klank_resonator", "sc:dx7_brass", "sc:formant_choir", "sc:karplus_pluck", "sc:gendy_stochastic", "sc:pulsar_train", "sc:hoover".
   - Eurorack Plaits/Rings/Clouds (`style=eurorack` or `style=synth`): "mi:plaits_va", "mi:plaits_waveshaper", "mi:plaits_fm", "mi:plaits_grain", "mi:plaits_additive", "mi:plaits_swarm", "mi:plaits_chord", "mi:plaits_speech", "mi:plaits_karplus", "mi:plaits_modal", "mi:rings_sympathetic", "mi:clouds_texture".
   - DaisySP & Stanford STK Physical Waveguides (`style=daisy` or `style=stk`): "daisy:vosim", "daisy:formant", "daisy:harmonic", "daisy:variable_saw", "daisy:zosc", "daisy:string_voice", "daisy:modal_voice", "daisy:drip", "stk:flute", "stk:clarinet", "stk:blown_bottle", "stk:brass", "stk:bowed", "stk:sitar", "stk:stif_karp", "stk:banded_wg".
   - Soundpipe / Csound DSP (`style=soundpipe`): "sp:fof_choir", "sp:gbuzz", "sp:pdhalf", "sp:widesaw", "sp:bar_model", "sp:drip_water", "sp:bitcrush_lead", "sp:jitter_pad".
   - Acoustic/Orchestral (`style=standard`): "salamander_grand", "electric_piano_1", "harpsichord", "violin", "viola", "cello", "contrabass", "string_ensemble_1", "orchestral_harp", "flute", "oboe", "clarinet", "french_horn", "trumpet", "trombone", "tuba", "choir_aahs", "voice_oohs", "timpani".
   - Drum Rack (`style=grid`): "tenuto_808_kit" (tokens: k, s, cp, rim, h, ch, oh, lt, mt, ht, cr, rd).
4. Available `.fx(...)` processors: "eq_eight", "auto_filter", "compressor", "glue_compressor", "multiband_dynamics", "drum_buss", "roar", "saturator", "gated_reverb", "tape_degrade", "hybrid_reverb", "echo", "reverb", "delay", "chorus", "vocoder", "spectral_resonator", "utility", "limiter", "signalsmith_reverb", "signalsmith_stretch", "signalsmith_chorus", "aw_galactic", "aw_totape6", "aw_console7", "aw_pressure4", "dattorro_plate", "paulstretch", "chow_tape", "transformer_color_adc", "dual_bus_silk_sum", "fet_fast_limiter", "vari_mu_tube_comp", "mastering_clip_limiter", "spectral_pitch_harmonizer", "true_stereo_hall_reverb".
5. CRITICAL MEASURE MATH: In 4/4 time, every track/voice line inside a single `measure N { ... }` block MUST sum to exactly 4.0 quarter-note beats (:1 = 4 beats, :2. = 3 beats, :2 = 2 beats, :4. = 1.5 beats, :4 = 1 beat, :8 = 0.5 beats, :16 = 0.25 beats). When attaching a modifier to a dotted duration, always write two dots (e.g. `a4:2..mp.legato`). You can also use pattern combinators `repeat N { ... }`, `fast N { ... }`, `slow N { ... }`, and `rev { ... }`.
6. Apply Spectral Inverse Proportionality: use `.open_voice` or `.rootless` on dense synth chords, and animate sustained notes using intra-note windowed & physical-modeling modifiers: `.detune(70%, 0.15..0.90)`, `.detune([68, 40, 18])`, `.detune_cents(-16c, 0.15..0.90)`, `.filter(900, 3400)`, `.glide(200ms)`, `.vowel("oh", "ooh", 0.2)`, `.wow_flutter(5, 0.42, 2.5, 9.5)`, `.swarm([0.2, 3.2, 0.4])`, `.fold(75%)`, `.lpg("both", 380ms)`, `.eoc_cycle(5)`, `.plane("m9")`, `.neg_harm`, `.ratchet(3, "up")`, `.ply(2)`, `.degrade(25%)`, `.squeeze(90%)`, `.bend_voice(1, 50c, 0.2..0.8)`, `.binaural(14c)`, `.spin(0.8)`, `.timbre(72%)`, `.harmonics(65%)`, `.structure(68%)`, `.damping(82%)`, `.jawari(75%)`, `.breath(65%)`, `.jet(54%)`, `.bow(75%, 35%)`, `.pdhalf(78%)`, `.gbuzz(72%)`, `.fof("a")`, `.rlpf(2400, 1.8)`, `.dfm1(1800, 2.6)`, `.moog_ff(2200, 2.2)`, `.klank("bell", 80%)`, `.galactic(45%)`, `.dattorro(38%)`, `.paulstretch(4.0)`, `.totape(50%)`, `.fdn_reverb(40%)`.
