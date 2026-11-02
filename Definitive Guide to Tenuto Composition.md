# The Definitive Guide to Music Creation in Tenuto Studio 5 (`.ten`)
### Complete Grammar Specification, Synthesis Physics, Compositional Theory & Studio Engineering Manual (`v5.6.2`)

> **Self-Contained Reference:** This manual contains the complete **Tenuto 6.0 (`.ten`)** formal grammar, compiler rules, instrument & patch catalog, continuous synthesizer modifiers, outboard DSP effects, psychoacoustic voicing laws, and stylistic blueprints. A human composer or AI agent reading **only this document** has 100% of the knowledge required to write studio-mastered, multi-track `.ten` compositions from scratch.

---

## Table of Contents

1. [The Ontological Shift: Sound Design as Composition](#1-the-ontological-shift-sound-design-as-composition)
2. [Document Architecture & Top-Level Blocks](#2-document-architecture--top-level-blocks)
3. [Global Metadata, Scales, Microtonality & Non-Octave Tunings (`meta`)](#3-global-metadata-scales-microtonality--non-octave-tunings-meta)
4. [Track Definitions, Group Buses, Return Channels & Groove Pool (`def`, `group`, `return`, `groove`)](#4-track-definitions-group-buses-return-channels--groove-pool-def-group-return-groove)
5. [Complete Instrument & Patch Catalog (`style` & `patch`)](#5-complete-instrument--patch-catalog-style--patch)
6. [Pitch, Rhythm, Rational Time & The Golden Rule of Measure Math](#6-pitch-rhythm-rational-time--the-golden-rule-of-measure-math)
7. [Polyphony, Chords, Tuplets, Euclidean Rhythms, Macros & Ties](#7-polyphony-chords-tuplets-euclidean-rhythms-macros--ties)
8. [Classical Articulations, Dynamics, Ornaments & Lyrics](#8-classical-articulations-dynamics-ornaments--lyrics)
9. [Continuous Synthesizer Workflow & Intra-Note Windowed Modulation](#9-continuous-synthesizer-workflow--intra-note-windowed-modulation)
10. [Harmonic Architecture: Voicing Physics, Parallel Planing & Negative Harmony](#10-harmonic-architecture-voicing-physics-parallel-planing--negative-harmony)
11. [Sequenced, Generative & 3D Gestural Paradigms (`.ratchet`, `.eoc_cycle`, `.lpg`, MPE)](#11-sequenced-generative--3d-gestural-paradigms-ratchet-eoc_cycle-lpg-mpe)
12. [Studio Audio Effects, Outboard Processing & Z-Axis Automation (`.fx`, `.automate`)](#12-studio-audio-effects-outboard-processing--z-axis-automation-fx-automate)
13. [Six Complete Stylistic Blueprints (With Ready-to-Run `.ten` Code)](#13-six-complete-stylistic-blueprints-with-ready-to-run-ten-code)
14. [Pre-Flight Compiler Checklist & Master AI Composer Prompt](#14-pre-flight-compiler-checklist--master-ai-composer-prompt)

---

## 1. The Ontological Shift: Sound Design as Composition

In traditional acoustic notation, instrument luthiery and musical composition are separated: a composer writes pitches and rhythms assuming a fixed harmonic overtone spectrum. In **Tenuto Studio 5**, that boundary dissolves. Because `.ten` code simultaneously declares the **acoustic physics of the signal path** and the **musical score**, a single held note or chord with evolving intra-note modulation carries the structural weight of an entire orchestral phrase.

### The Three Laws of Tenuto Synthesis Composition

1. **The Law of Spectral Inverse Proportionality:**
   Whenever a synthesizer patch has high internal spectral complexity—such as 7-voice unison detuning (`detune=85`), dense upper sawtooth harmonics, West Coast wavefolding (`.fold(75%)`), or 8-oscillator ribbon cluster beating (`patch="ribbon_cluster_8"`)—**you must simplify or spread the vertical chord voicing**.
   - Playing close intervals (e.g., a major 2nd or minor 3rd) below `C3` (`MIDI 48`) on a harmonically dense synth causes severe lower-midrange **acoustic beating** (mud and phase roughness).
   - **Solution:** Use `.open_voice` (transposes the 2nd lowest chord tone up an octave into an open $R-5-3$ spread), `.rootless` (strips the root note so upper pads never clash with a dedicated sub-bass track), or quartal/suspended voicings (`.plane("quartal")`, `.plane("sus4")`).
2. **Parameter Automation Over Note Density:**
   When a synthesizer patch already occupies a wide spectral footprint, adding busy contrapuntal notes creates harmonic clutter. Instead, build narrative tension and release by **animating the timbre inside sustained notes**:
   - Sweep the low-pass filter across a bar (`.filter(900, 3800)`).
   - Open unison detune only during the middle of a phrase (`.detune(78%, 0.20..0.88)`).
   - Introduce localized rhythmic acceleration on specific steps via `.ratchet(3, "up")` rather than rewriting the global time signature.
3. **Engineered Imperfection & Psychoacoustic Phrasing:**
   The human ear tracks every sound across three phases:
   - **Phase 1 — Onset Transient ("The Head"):** Tells the brain how the sound was excited. Sculpted via `.zap` / `.pluck(18ms, 12st)`, `.noise(25%, "white", 0.0..0.15)`, `.lpg("both", 380ms)`, or `.pre_swell`.
   - **Phase 2 — Steady-State Spectral Profile:** Prevent digital listener fatigue by animating waveforms via `.warp_wave("bend", 30%)`, `.vowel("oh", "ooh", 0.2)`, `.wow_flutter(4.5, 0.42, 2.2, 9.5)`, or `.analog_slop(32%)`.
   - **Phase 3 — Long-Term Temporal Trajectory:** Connect notes across beats using `.legato`, `.glide(200ms)` (which automatically voice-leads every note in a polyphonic chord to the nearest note in the next chord), `.cresc` / `.dim`, and send buses (`sends=@{hall_bus: 0.65}`).

---

## 2. Document Architecture & Top-Level Blocks

Every complete Tenuto score is wrapped in `tenuto "6.0" { ... }` (or `"5.0"`) and organized into four declarative sections. Comments begin with `%%` (or `//`) and are ignored by the compiler.

```tenuto
tenuto "6.0" {
  %% 1. Global Score Metadata & Tuning Configuration
  meta @{
    title: "Song Title",
    tempo: 118,
    time: "4/4",
    key: "C",
    scale: "minor",
    temperament: "12tet",
    master_tune: 0,
    sidechain: "drums",
    sidechain_tap: "post_fx",
    quantize_launch: "1/1"
  }

  %% 2. Global Variables, Groove Pool & Reusable Macros (Optional)
  var lead_vol = 92
  groove mpc_swing "16th Pocket Swing" @{ base: "1/16", quantize: 90%, timing: 35%, random: 8%, velocity: 45% }
  macro ostinato_cell = { c2:8 c3:8 g2:8 c3:8 }

  %% 3. Return Buses, Instrument Definitions & Group Buses
  return hall_bus "Symphonic Hall Return"
    .fx(true_stereo_hall_reverb, @{ decay: 4.2, predelay: 24, rolloff_hz: 6400, mix: 1.0 })

  def lead "Soloist Synth" style=synth patch="morph_analog_12"
    group="synth_bus" vol=92 pan=-0.15 detune=58 cutoff=3400 resonance=1.3 sub=25 air=40 width=135 slop=24
    env=@{ attack: 0.04, decay: 0.8, sustain: 0.85, release: 0.6 }
    sends=@{ hall_bus: 0.55 }
    .fx(chorus, @{ rate: 0.4, amount: 0.35, mix: 0.4 })

  def drums "Studio Drum Rack" style=grid patch="tenuto_808_kit" groove="mpc_swing"
    .fx(gated_reverb, @{ decay: 2.8, gate_ms: 150, mix: 0.45 })

  group synth_bus "Master Synth Bus" tracks=[lead]
    .fx(dual_bus_silk_sum, @{ silk: "dual", texture: 0.55 })
    .fx(glue_compressor, @{ threshold: -12, ratio: 2.5, mix: 0.85 })

  %% 4. Arrangement Locators & Musical Timeline (Measures / Scenes / Clips)
  locator "I. Exposition" at measure 1

  measure 1 {
    lead:  c4:2.mp.cresc.legato.vib.detune(45%, 0.20..0.85).glide(180ms) g4:2.mf.legato.vib |
    drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8.ratchet(2, "up") h:8 h:8 h:8 h:8 oh:8 ]>
  }
}
```

> **Multi-Line `def` Declarations:** Track definitions (`def`, `return`) can span multiple indented lines for readability (as shown above), provided continuation lines do not begin with a top-level keyword (`measure`, `def`, `return`, `group`, `meta`, `locator`) or a `trackId:` assignment.

---

## 3. Global Metadata, Scales, Microtonality & Non-Octave Tunings (`meta`)

The `meta @{ ... }` block configures the global clock, key/scale quantization, microtonal tuning tables, and sidechain routing:

| Meta Key | Type | Default | Allowed Values & Musical Behavior |
| :--- | :--- | :--- | :--- |
| `title` | String | `"Untitled Score"` | Displays in the studio header and names exported `.wav` files. |
| `tempo` | Number | `120` | Project tempo in Beats Per Minute (`20`–`300`). Can also be automated per-measure by placing `meta @{ tempo: 84 }` inside any `measure N { ... }` block. |
| `time` | String | `"4/4"` | Time signature (`"4/4"`, `"3/4"`, `"6/8"`, `"5/4"`, `"7/8"`). |
| `key` | String | `"C"` | Root key (`"C"`, `"C#"`, `"Db"`, `"D"`, `"Eb"`, `"E"`, `"F"`, `"F#"`, `"Gb"`, `"G"`, `"Ab"`, `"A"`, `"Bb"`, `"B"`). Governs scale locking and `.neg_harm` reflection axis. |
| `scale` | String | `"chromatic"` | `chromatic`, `major`, `minor`, `natural_minor`, `harmonic_minor`, `melodic_minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `locrian`, `major_pentatonic`, `minor_pentatonic`, `blues`, `whole_tone`, `diminished_wh`, `diminished_hw`, `hungarian_minor`, `phrygian_dominant`, `hirajoshi`, `insen`, `arabic`. |
| `scale_lock` | Boolean | `false` | When `true`, out-of-scale pitches are quantized to the nearest degree in `key` + `scale`. Set `scale_lock: false` when using chromatic chord planing or microtonality. |
| `tuning` | String | `"12tet"` | `12tet`, `just_intonation` (5-limit pure ratios), `pythagorean`, `meantone`, `19tet`, `24tet`, `31tet`, `bohlen_pierce` (13-step tritave $3:1$), `slendro`, `pelog`. |
| `temperament` | String | `"12tet"` | `12tet`, `just`, `non_octave_alpha` ($78.0\text{ cents/step}$), `non_octave_beta` ($63.8\text{ cents/step}$), `non_octave_gamma` ($35.1\text{ cents/step}$). |
| `master_tune` | Number | `0` | Global cent offset (`-100` to `+100`). Setting `master_tune: -22` imparts a worn-cassette / hauntological flat tuning across the entire ensemble. |
| `a4_hz` | Number | `440.0` | Reference concert pitch in Hz (e.g., `432`, `440`, `442`). |
| `sidechain` | String | `null` | Track or group ID (e.g., `"drums"`) whose kick hits (`k` / `bd` on `grid` tracks, or all notes on melodic tracks) duck non-source tracks. |
| `sidechain_tap` | String | `"post_fx"` | `"pre_fx"`, `"post_fx"`, or `"post_mixer"`. |

---

## 4. Track Definitions, Group Buses, Return Channels & Groove Pool (`def`, `group`, `return`, `groove`)

### 4.1 Instrument Track (`def`)
```tenuto
def <trackId> "<Display Name>" style=<standard|synth|grid|simpler> patch="<patchName>"
  group="<groupId>" groove="<grooveId>" vol=<0..127> pan=<-1.0..1.0>
  detune=<0..100> cutoff=<60..16000> resonance=<0.5..18> sub=<0..100>
  air=<0..100> duck=<0..100> width=<0..200> slop=<0..100> noise=<0..100>
  env=@{ attack: 0.05, decay: 0.4, sustain: 0.8, release: 0.5 }
  macros=@{ cutoff: 80, resonance: 30, osc1_pos: 65, unison: 55, sub_level: 45 }
  sends=@{ <returnId>: <0.0..1.0> }
  .fx(<fxType>, @{ <param>: <val> })
```

### 4.2 Return Bus (`return`)
Creates a shared auxiliary FX bus fed by `sends=@{ <returnId>: <level> }` on individual tracks:
```tenuto
return hall_bus "Macro-Time Shimmer Space"
  .fx(hybrid_reverb, @{ decay: 5.5, predelay: 30, mix: 1.0 })
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

## 5. Complete Instrument & Patch Catalog (`style` & `patch`)

### 5.1 Studio Flagship & Virtual Hardware Synthesizers (`style=synth`)
> **Routing Rule:** Always declare `style=synth` on synthesizer tracks so the engine routes voices directly to Tenuto's native 64-bit continuous DSP synthesizers rather than acoustic SoundFont samples.

| `patch="..."` | Synthesis Paradigm & Circuit Topology | Primary Musical Applications |
| :--- | :--- | :--- |
| `"supersaw"` | **7-Voice Asymmetric Unison Saw + Sub:** Golden-ratio detune spread (`1.28x` center anchor prevents phase cancellation) + phase-locked sub-octave + high-air sheen. | Massive festival chord drops, wide trance leads, octaved synth stacks. |
| `"flutter_pad"` | **Animated LFO Filter Pad:** Multi-voice warm saw/triangle pad with tempo-synced amplitude/cutoff flutter and wide stereo dispersion. | Open-voiced chord planing, evolving ambient beds, lush harmonic cushions. |
| `"reese_bass"` / `"reese"` | **3-Saw Wide-Detuned Bass + Phase-Locked Sub:** Asymmetric detuned saws ($\pm 28\text{c}$) + heavy sine sub-oscillator + saturating ladder drive + `120 Hz` bass-mono crossover. | Deep drum & bass / cyberpunk sub-bass, sustained pedal tones, dark neuro basslines. |
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
| `"sc:default"`, `"sc:prophet"`, `"sc:tb303"`, `"sc:jp8000"`, `"sc:modal_bell"`, `"sc:klank_resonator"`, `"sc:dx7_brass"`, `"sc:formant_choir"`, `"sc:karplus_pluck"`, `"sc:gendy_stochastic"`, `"sc:pulsar_train"`, `"sc:hoover"` | **SuperCollider (`scsynth`) UGen-Graph Synthesizer Suite (`style=synth` or `style=scsynth`):** 100% MIT-licensed UGen-Graph synthesis topologies (`VarSaw`, `Pulse`/`RLPF`, `RLPFD` 303 diode, `Splay.ar` 7-saw, `Klank.ar` 6-mode bell, `DynKlank.ar` 8-mode resonator, `PMOsc.ar` 6-op FM brass, `Formant.ar` 3-vowel choir, `Pluck.ar` Karplus-Strong waveguide, `Gendy1.ar` Xenakis dynamic stochastic oscillator, `Blip.ar` pulsar train, and Alpha Juno Hoover) with binary OSC 1.1 `/s_new` bundle encoding and `.scd` (`SynthDef` + `Pbind`) score export. | Live-coding UGen synthesis, modal/resonator percussion, dynamic stochastic drones, and direct SuperCollider `.scd` export. |
| `"mi:plaits_va"`, `"mi:plaits_waveshaper"`, `"mi:plaits_fm"`, `"mi:plaits_grain"`, `"mi:plaits_additive"`, `"mi:plaits_swarm"`, `"mi:plaits_chord"`, `"mi:plaits_speech"`, `"mi:plaits_karplus"`, `"mi:plaits_modal"`, `"mi:rings_sympathetic"`, `"mi:clouds_texture"` | **Eurorack Macro-Oscillator & Modal Resonator Suite (`style=eurorack` or `style=synth`):** 100% MIT-licensed Eurorack synthesis models (`Plaits` Green/Red banks, `Rings` sympathetic coupled strings, and `Clouds` overlapping Hann-windowed granular diffuser) with internal Vactrol Low-Pass Gate (`LPG`), `HARMONICS` / `TIMBRE` / `MORPH` macro routing, `PhonemeEngine` formant integration, and 1st-order `R = 0.998` DC blocking. | West Coast wavefolded plucks, sympathetic string/mallet resonators, divide-down chord organs, formant speech, and diffused granular clouds. |

### 5.2 Multi-Sampled Acoustic & Orchestral Instruments (`style=standard`)
* **Pianos & Keyboards:** `"salamander_grand"`, `"acoustic_grand_piano"`, `"bright_piano"`, `"electric_piano_1"`, `"electric_piano_2"`, `"harpsichord"`, `"clavinet"`, `"celesta"`, `"church_organ"`, `"drawbar_organ"`, `"reed_organ"`, `"accordion"`
* **Chromatic Percussion:** `"vibraphone"`, `"marimba"`, `"xylophone"`, `"glockenspiel"`, `"tubular_bells"`, `"music_box"`, `"dulcimer"`
* **Orchestral Strings & Harp:** `"violin"`, `"viola"`, `"cello"`, `"contrabass"`, `"string_ensemble_1"`, `"chamber_strings"`, `"tremolo_strings"`, `"pizzicato_strings"`, `"orchestral_harp"`, `"timpani"`
* **Orchestral Winds, Brass & Choir:** `"flute"`, `"piccolo"`, `"oboe"`, `"english_horn"`, `"clarinet"`, `"bassoon"`, `"french_horn"`, `"trumpet"`, `"muted_trumpet"`, `"trombone"`, `"tuba"`, `"brass_section"`, `"choir_aahs"`, `"voice_oohs"`, `"synth_choir"`
* **Guitars, Basses & World:** `"nylon_guitar"`, `"steel_guitar"`, `"jazz_guitar"`, `"clean_guitar"`, `"overdriven_guitar"`, `"acoustic_bass"`, `"finger_bass"`, `"fretless_bass"`, `"sitar"`, `"koto"`, `"kalimba"`

### 5.3 Vocal Chop Slice Sampler (`style=simpler`)
Maps named time slices of an audio buffer or formant chop generator to custom pitch tokens:
```tenuto
def vox "Vocal Chop" style=simpler patch="simpler" map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s], harder: [0.85s, 1.25s] }
measure 1 {
  vox: doin:8 right:8.transpose(5).formant(3) harder:4.reverse r:2 |
}
```

### 5.4 128-Pad Drum Rack (`style=grid`)
Use `def drums "Kit" style=grid patch="tenuto_808_kit"` (or `patch="timpani"` / `patch="taiko_drum"` for orchestral percussion).
* **Drum Tokens:**
  * `k`, `bd`, `kick` — Bass Drum / 808 Kick (`MIDI 36`)
  * `s`, `sd`, `snare` — Snare Drum (`MIDI 38`)
  * `cp`, `clap` — 4-Burst Flam Hand Clap (`MIDI 39`)
  * `rim` — Rimshot (`MIDI 37`)
  * `h`, `hh`, `ch` — Closed Hi-Hat (`MIDI 42`, **Choke Group 1**: automatically mutes ringing Open Hi-Hats `oh`)
  * `oh` — Open Hi-Hat (`MIDI 46`, **Choke Group 1**)
  * `lt`, `mt`, `ht` — Low, Mid, High Tuned Toms (`MIDI 45, 47, 50`)
  * `cr`, `rd` — Crash & Ride Cymbals (`MIDI 49, 51`)

---

## 6. Pitch, Rhythm, Rational Time & The Golden Rule of Measure Math

### 6.1 Pitches, Microtones & Sticky Octave Inheritance
* **Standard Pitch Format:** `<note><accidental><octave>` — e.g., `c4` (Middle C, MIDI 60), `a4` (440 Hz, MIDI 69), `f#3`, `eb5`.
* **Microtonal Accidentals & Cent Offsets:**
  * `qs` ($+50\text{ cents}$ quarter-sharp, e.g., `aqs4`)
  * `qf` ($-50\text{ cents}$ quarter-flat, e.g., `aqf4`)
  * `tqs` ($+150\text{ cents}$ three-quarter-sharp), `tqf` ($-150\text{ cents}$ three-quarter-flat)
  * `x` ($+200\text{ cents}$ double-sharp)
  * Explicit cent deviation: `c4+25c` or `e4-14c`
* **Sticky Octave Rule:** Once a note specifies an octave in a voice, subsequent notes inherit that octave until a new octave number is written:
  * `c4:8 d e f g a b c5` compiles as `c4:8 d4:8 e4:8 f4:8 g4:8 a4:8 b4:8 c5:8`.
* **Rests & Automation Spacers:**
  * `r:<duration>` — Silence (e.g., `r:4` = quarter-note rest, `r:2` = half-note rest).
  * `s:<duration>` — Invisible automation spacer (used on secondary polyphonic voices to carry `.automate()` or `.cc()` curves without triggering a note).

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
  When attaching a `.modifier` to a **dotted duration** (such as `:2.` or `:4.` or `:8.`), write **two dots** (`..`)—the first dot belongs to the dotted duration and the second dot begins the modifier chain:
  * Correct: `a4:2..mp.legato.vib` (dotted half note `:2.` with `.mp.legato.vib`)
  * Correct: `c4:4..f.stacc` (dotted quarter note `:4.` with `.f.stacc`)

### 6.3 The Golden Rule of Measure Math
To guarantee that `measure 1`, `measure 2`, ..., `measure N` align 1-to-1 across all tracks without barline drift:
* In `"4/4"` time, **every active track and voice inside a `measure N { ... }` block MUST sum to exactly `1.0` whole note (`4.0` quarter-note beats)**:
  * `1` × `:1` = $4.0\text{ beats}$
  * `1` × `:2.` + `1` × `:4` = $3.0 + 1.0 = 4.0\text{ beats}$
  * `2` × `:2` = $2.0 + 2.0 = 4.0\text{ beats}$
  * `4` × `:4` = $4.0\text{ beats}$
  * `8` × `:8` = $4.0\text{ beats}$
  * `16` × `:16` = $4.0\text{ beats}$
* Always pad any partial melody line with explicit rests (`r:4`, `r:2`) so the line totals `4.0` beats.

---

## 7. Polyphony, Chords, Tuplets, Euclidean Rhythms, Macros & Ties

* **Chords (`[ ... ]:<dur>.<mods>`):**
  Group space-separated pitches inside square brackets and attach the duration and modifiers to the closing bracket:
  ```tenuto
  pad: [e2 b2 f#3 g#3 b3]:1.mp.open_voice.detune(55%, 0.2..0.9).filter(1100, 2800).glide(220ms) |
  ```
* **Parallel Polyphonic Voices (`<[ v1: ... | v2: ... ]>`):**
  Run independent rhythmic or contrapuntal layers simultaneously on the same track:
  ```tenuto
  pno: <[ v1: g5:2.mp.legato f#5:4.legato e5:4 | v2: [e2 b2 g3]:1.p.ped ]>
  ```
* **Tuplets (`(notes):<num>/<den>`):**
  Compresses `num` notes into the time of `den` notes:
  ```tenuto
  lead: (c5:8 d5:8 e5:8):3/2 g5:4 r:2 |   %% Three 8th-note triplets = 1 quarter beat
  ```
* **Euclidean Rhythms (`(<pitch>):<hits>/<steps>`):**
  Distributes `<hits>` as evenly as possible across `<steps>` using Bresenham's algorithm:
  ```tenuto
  drums: (k):3/8 (h):5/8 |                 %% 3-over-8 tresillo + 5-over-8 cinquillo
  ```
* **Inline Repeats (`repeat N { ... }`) & Macros (`macro name = { ... }` / `$name`):**
  ```tenuto
  macro bass_cell = { c2:16 c3:16 g2:16 c3:16 }
  seq: repeat 4 { $bass_cell } |           %% 4 * 4 sixteenths = 16 sixteenths (4 beats)
  ```
* **Forward-Looking Ties (`~`):**
  Merges consecutive notes or chords of identical pitch on the same track/voice into a single unbroken sustained event across beats or barlines:
  ```tenuto
  sub: e1:1.p.legato~ |
  ```

---

## 8. Classical Articulations, Dynamics, Ornaments & Lyrics

| Modifier | Category | Acoustic & DSP Behavior |
| :--- | :--- | :--- |
| `.pp`, `.p`, `.mp`, `.mf`, `.f`, `.ff`, `.sfz` | Dynamics | Sets MIDI velocity (`40`, `60`, `75`, `90`, `105`, `120`, `124`) and scales filter brightness. |
| `.vol(0..127)` | Dynamics | Sets exact MIDI velocity. |
| `.vel_range(low, high)` | Humanization | Randomizes velocity deterministically within `[low, high]`. |
| `.chance(0%..100%)` | Probability | Triggers the note with probability $N\%$. |
| `.pick_one` | Probability | On a chord `[c4 e4 g4]:4.pick_one`, randomly selects and plays exactly one voice from the chord. |
| `.cresc` / `.cresc(startVel, endVel)` | Swell | Smoothly swells amplitude and filter cutoff upward across a single held note or across a consecutive phrase of `.cresc` notes. |
| `.dim` / `.dim(startVel, endVel)` | Swell | Smoothly tapers amplitude and filter cutoff downward. |
| `.fp` / `.sfp` | Accent | Sharp *forte-piano* attack (`118`) that immediately drops to a soft sustain. |
| `.legato` / `.slur` | Articulation | Extends gate to `1.08x` for seamless phrase overlap and softens attack transient. |
| `.stacc` / `.staccato` | Articulation | Shortens gate to `0.48x` with a crisp release. |
| `.marc` / `.accent` | Articulation | Emphasizes attack transient. |
| `.pizz` | Articulation | Plucked string articulation with fast `8ms` attack and short `90ms` decay. |
| `.ped` / `.pedal` | Sustain | Extends damper sustain tail (`2.2x` duration). |
| `.arp` / `.strum` | Voicing | Rolls chord voices upward from lowest pitch to highest by `28ms` per voice. |
| `.fermata` / `.hold` | Temporal | Holds the note or chord for `1.65x` its written duration. |
| `.vib` / `.vibrato` | Ornament | Delayed-onset `5.5 Hz` sinusoidal pitch vibrato. |
| `.tr` / `.trill` | Ornament | Rapid whole-step alternation (`65ms` steps) over the sustained note. |
| `.mordent` | Ornament | Upper-neighbor ornamental flick (`25ms–65ms`) on the initial attack. |
| `.roll(N)` / `.trem` | Ornament | Subdivides the note or chord into `N` rapid articulated repetitions. |
| `.pull(ms)` / `.push(ms)` | Micro-Timing | Shifts physical playback late (`.pull(12ms)`) or early (`.push(8ms)`) without altering the logical grid. |
| `.pan(-1.0..1.0)` | Spatial | Per-note stereo pan (`-1.0` hard left, `0.0` center, `1.0` hard right). |
| `.lyric("word")` | Vocal / Formant | Decomposes English syllables into onset consonants, primary/secondary diphthong Klatt vowel formants ($F_1, F_2, F_3$), and coda sibilance; drives the 20-Band Talking Vocoder when paired with `.fx(vocoder)`. |

---

## 9. Continuous Synthesizer Workflow & Intra-Note Windowed Modulation

Tenuto's `ContinuousSynthEngine` evaluates synthesizer parameters in **128-sample Control-Rate (`k-rate`) blocks**, coalescing simultaneous chord notes on the same track into a shared filter/waveshaper/comb pipeline and summing all voices through a `120 Hz` bass-mono crossover before running track FX.

### 9.1 Intra-Note Windowed Modulation (`startNorm..endNorm`) & Multi-Point Curves (`[v0, v1, v2]`)
Any continuous modifier (`.detune`, `.detune_cents`, `.cutoff`, `.filter`, `.noise`, `.drive`, `.fold`, `.tri_fold`, `.morph`, `.swarm`, `.width`) accepts either:
1. **A Normalized Time Window (`0.0..1.0`):** Activates smoothly inside `[startNorm, endNorm]` using raised-cosine edge feathering so mid-note modulation never clicks, and automatically completes `6ms` before any trailing `.glide()` ramp:
   * `.detune(78%, 0.15..0.90)` — Starts with tight unison, blooms to `78%` spread across the middle of the note, and feathers back before the next note.
   * `.detune_cents(-18c, 0.10..0.90)` — Sags pitch by `-18 cents` across the middle of the held note.
2. **A Multi-Point Trajectory Array (`[start, mid, end]`):** Smoothstep-interpolates across any number of control points over the note's duration:
   * `.detune([68, 40, 18])` — Decays unison spread from `68%` down to `18%` as the chord resolves.
   * `.swarm([0.2, 3.4, 0.4])` — Expands an 8-oscillator cluster from `0.2` semitones to a `3.4`-semitone dread cluster and collapses back to `0.4` semitones.

### 9.2 Complete Reference of Continuous Synthesizer Modifiers

| Modifier Syntax | Acoustic & Circuit Mechanism |
| :--- | :--- |
| `.glide(180ms)` | **Automatic Polyphonic Voice-Leading Portamento:** Pairs sorted voices of consecutive chords or notes on the same track and glides every voice along its shortest semitone path during the final $22\%$ of the note. |
| `.detune(65%, 0.2..0.9)` or `.detune([0, 85, 20])` | **Asymmetric Golden-Ratio Unison Detune:** Controls unison pitch spread (`0%–100%`) using incommensurate detune offsets (`[-0.91, 0.0, +1.09]` for 3-voice; 7-voice JP-style curve for leads) with a `1.28x` center fundamental anchor so oscillators never phase-cancel into silence. |
| `.detune_cents(-16c, 0.15..0.90)` | **Intra-Note Microtonal Pitch Contour:** Bends pitch in cents (`-1200c..+1200c`) over the specified window or curve array. |
| `.filter(startHz, endHz)` | **2x-Oversampled State-Variable Filter Sweep:** Sweeps the low-pass filter cutoff smoothly from `startHz` to `endHz` (`60 Hz–16000 Hz`). Explicit note-level `.filter()` / `.cutoff()` values bypass implicit keytracking so low sub-bass notes (`e1`) retain their exact target Hz. |
| `.cutoff(hzOrCurve)` & `.res(0.5..18)` | Sets or modulates filter cutoff frequency and resonance Q. |
| `.warp_wave("bend" \| "mirror", 30%)` | **Once-Per-Sample Waveform Warping:** `"bend"` applies asymmetrical hyperbolic tangent compression (`30%` bend on a triangle wave creates a hollow hauntological body without sawtooth buzz); `"mirror"` folds the waveform around zero. |
| `.vowel("oh", "ooh", 0.2)` | **Formant Vowel Filter LFO:** Oscillates filter peaks between Klatt vowel formants (`"a"`, `"ah"`, `"e"`, `"eh"`, `"i"`, `"ee"`, `"o"`, `"oh"`, `"ooh"`, `"oo"`, `"u"`) at `rateHz` (`0.2 Hz`), triggering human speech-recognition centers. |
| `.wow_flutter(wowCents, wowHz, flutterCents, flutterHz)` | **Dual-LFO Magnetic Tape Transport Drift:** Combines a slow, irregular dual-sine **wow** ($0.12\text{–}2\text{ Hz}$ at $\pm 3\text{–}6\text{c}$ seasick pitch sag) with a fast **flutter** ($6\text{–}15\text{ Hz}$ transient blur). Shorthand `.wow_flutter` defaults to `(4.5, 0.42, 2.5, 9.5)`. |
| `.warble(depthPct, rateHz)` | Single-LFO pitch warble (`0..100`, `0.2..16 Hz`). |
| `.flutter(rateHzOrCurve)` | Amplitude LFO tremolo/flutter (`1..32 Hz` or curve `[8, 18]`). |
| `.swarm(stOrCurve)` | **8-Oscillator Ribbon Cluster Spread:** Spreads 8 oscillators across `0.0..12.0` semitones (or curve `[0.2, 3.2, 0.4]`) for continuous microtonal beating. |
| `.fold(pctOrCurve)` | **West Coast Harmonic Wavefolder:** Drives a branchless triangle wavefolder (`0%–100%`) to generate rich upper overtones at the oscillator source. |
| `.lpg("both" \| "vca" \| "lp", decayMs)` | **Vactrol Opto-Isolator Low-Pass Gate:** Models a photoresistive vactrol circuit (`4ms` fast strike impulse followed by a nonlinear dual-exponential decay over `decayMs`) where both filter brightness and amplitude ring out together like a struck marimba or membrane. |
| `.tri_fold(pct)` | Triangle wavefolder circuit (`.metalizer(pct)` alias) for `morph_analog_12` voices. |
| `.steiner_drive(pct)` | $12\text{ dB/oct}$ multimode filter feedback saturation (`.brute_factor(pct)` alias). |
| `.discrete_drive(pct)` | Asymmetrical transistor mixer overload before the ladder filter (`.cp3_drive(pct)` alias). |
| `.binaural(cents)` | **Binaural Left/Right Voice Split:** Separates even and odd unison oscillators into independent Left and Right ear voices detuned by `cents` (default `14c`). |
| `.spin(rateHz)` | **Four-Quadrant $360^\circ$ Infinite Panning:** Continuously rotates the stereo image in a $360^\circ$ circle at `rateHz` (`0.05..20 Hz`). |
| `.morph(pctOrCurve)` | Interpolates voice timbre and filter cutoff between Patch State A (`0%`) and Patch State B (`100%`). |
| `.touch_travel("at" \| "at_z" \| "pizz")` | Continuous vertical key-displacement articulation (`"pizz"` for snappy depth-plucks; `"at"` / `"at_z"` for hairline zero-threshold swells). |
| `.aliasing(pct)` | Stepped digital wavetable / firmware foldover decimation (`0%–100%`). |
| `.stack("octaves" \| "fifths" \| "seventh" \| "super")` | Locks upper unison oscillators to $+12\text{st}$ octaves, $+7\text{st}$ fifths, or $+10\text{st}$ sevenths. |
| `.noise(level, "white" \| "pink" \| "breath", start..end)` | Injects filtered noise (`0%–100%`) over the specified note window for transient heads or breath air. |
| `.sync(ratioOrSweep)` | Hard-syncs oscillator pitch by `1..16` (or sweep `[1, 3.5]`). |
| `.fm(amountPct, ratio)` & `.ring(amountPct, freqHz)` | Audio-rate Frequency Modulation and Ring Modulation. |
| `.pwm(duty, rateHz)` | Pulse-Width Modulation (`0.05..0.95` duty cycle, `0.1..16 Hz` LFO). |
| `.comb(freqHz, feedback)` | Tuned karplus/comb resonator (`60..4000 Hz`, `0.1..0.92` feedback). |
| `.duck(depthPct)` | Quarter-note sidechain pumping envelope (`0%–100%`). |
| `.gate([1, 0, 1, 1, 0, 1, 0, 1])` | Rhythmic trance-gate step sequencer mask across the note duration. |
| `.pluck(decayMs, semitones)` / `.zap` | Fast exponential pitch-drop transient head (e.g., `+18st` decaying over `18ms`). |
| `.pitch_dip(-7)` / `.tapestop` | Vinyl/tape pitch drop (`-7` semitones) at the end of the note. |
| `.haas(delayMs)` & `.width(0..200)` | Stereo Haas micro-delay (`0.5..35ms` on Right channel) and Mid/Side width expansion. |
| `.analog_slop(pct)` & `.keytrack(pct)` | Per-voice random analog tuning drift (`0%–100%`) and filter keyboard tracking (`0%–100%`). |
| `.air(pct)` & `.drive(pctOrCurve)` | High-frequency exciter sheen (`0%–100%`) and soft-clipping filter drive. |
| `.pre_swell` | Reverse-envelope pre-swell that blooms exponentially to the note's cutoff. |

---

## 10. Harmonic Architecture: Voicing Physics, Parallel Planing & Negative Harmony

### 10.1 Open Voicings & Rootless Structures (`.open_voice` & `.rootless`)
* **`.open_voice` (or `.drop2`):** Automatically takes the second-lowest note of any 3+ note chord and transposes it down an octave (or spreads closed triads into $R-5-3$ compound intervals), immediately clearing lower-midrange mud.
* **`.rootless`:** Automatically strips the lowest (root) pitch from any 3+ note chord (or `.plane()` expansion) so upper polyphonic pads never collide with a dedicated `sub` track in the bottom octave.

### 10.2 Parallel Harmonic Planing (`.plane("<type>")`)
Instead of classical SATB voice leading, underground Deep House, Detroit Techno, and Ambient IDM transpose a locked extended chord structure in parallel blocks across pentatonic or modal roots over a static bass pedal. Attaching `.plane("<type>")` to any single root note automatically expands it into the full multi-voice chord:

| `.plane(...)` Type | Semitone Intervals Generated | Harmonic Color |
| :--- | :--- | :--- |
| `.plane("m9")` | `[0, 3, 7, 10, 14]` | Classic Detroit/Deep House minor 9th block ($R - \flat3 - 5 - \flat7 - 9$). Combine with `.rootless` over a static `c1` bassline! |
| `.plane("maj9")` | `[0, 4, 7, 11, 14]` | Lush cinematic major 9th block ($R - 3 - 5 - 7 - 9$). |
| `.plane("dom9")` or `.plane("9")` | `[0, 4, 7, 10, 14]` | Jazz-inflected dominant 9th block. |
| `.plane("m7")` / `.plane("maj7")` | `[0, 3, 7, 10]` / `[0, 4, 7, 11]` | Four-voice minor 7th or major 7th block. |
| `.plane("m7b5")` / `.plane("dim7")` | `[0, 3, 6, 10]` / `[0, 3, 6, 9]` | Half-diminished or fully diminished tension block. |
| `.plane("add9")` / `.plane("madd9")` | `[0, 4, 7, 14]` / `[0, 3, 7, 14]` | Compound 9th triad without the 7th. |
| `.plane("sus4")` / `.plane("sus2")` | `[0, 5, 7, 10, 14]` / `[0, 2, 7, 10, 14]` | Floating, unresolved Synthwave suspended 9th voicings (no major/minor 3rd). |
| `.plane("quartal")` | `[0, 5, 10, 15]` | Four-voice quartal stack built in perfect 4ths (ambiguous, modern modal suspension). |
| `.plane("quintal")` | `[0, 7, 14]` | Wide open 5ths ($R - 5 - 9$) with zero 3rd beating. |
| `.plane("fifth")` / `.plane("fourth")` | `[0, 7]` / `[0, 5]` | Two-voice power fifth or fourth dyad. |

```tenuto
%% Detroit Minor 9th Rootless Planing along B Minor Pentatonic (B, D, E, F#, A) over a static C Pedal:
pad: b3:2.plane("m9").rootless d4:2.plane("m9").rootless |
sub: c1:1.f.legato.filter(160, 240) |
```

### 10.3 Negative Harmony (`.neg_harm` / `.negative_harmony`)
Reflects any note, chord, or `.plane()` block across the **Tonic–Dominant Axis** ($R + 3.5\text{ semitones}$ in the active `meta.key`) so every voice maintains the exact same intervallic gravity toward the tonic with inverted emotional polarity:
* In `key: "C"`, `[c4 e4 g4]:2.neg_harm` reflects C Major ($60, 64, 67$) across the C–G axis into C Minor ($60, 63, 67$), and `g4:2.plane("dom9").neg_harm` transforms a bright dominant 9th into a dark minor-6th/half-diminished cadence.

---

## 11. Sequenced, Generative & 3D Gestural Paradigms (`.ratchet`, `.eoc_cycle`, `.lpg`, MPE)

### 11.1 Step Ratcheting & Localized Accelerandi (`.ratchet(count, curve)`)
Subdivides any single note or chord step into `count` ($2\times$ to $32\times$) envelope re-triggers while keeping neighboring steps locked to the tempo grid:
* `.ratchet(2, "flat")` — Classic Berlin School $2\times$ 32nd-note sequencer burst at uniform velocity.
* `.ratchet(3, "up")` — $3\times$ triplet burst with an upward crescendo ($\nearrow$) velocity ramp (`45% -> 115%`).
* `.ratchet(4, "up")` — Modern Trap/Drill 64th-note hi-hat roll swelling into the next beat.
* `.ratchet(8, "down")` — IDM glitch micro-shutter turnaround with a downward decrescendo ($\searrow$) ramp (`100% -> 25%`).

### 11.2 Generative Cybernetics: End-of-Cycle Krell Patch (`.eoc_cycle(N)` / `.krell(N)`)
In an autonomous West Coast Krell patch, time is bound to the lifecycle of each note's envelope: only when an envelope finishes its decay does its End-of-Cycle (EOC) trigger fire Sample & Hold (S&H) to pick a new pitch and duration.
* Attaching `.eoc_cycle(5)` (or `.krell(5)`) to a whole note (`g4:1.eoc_cycle(5).fold(75%)`) deterministically subdivides the span into `5` asymmetric EOC events whose rational durations sum **strictly** to the parent note's duration (`1.0` whole note):
  * High-register S&H pitches flash by as short percussive blips (weight `1`).
  * Low-register S&H pitches swell and decay slowly (weight `3`) with automatic wavefolding and zero-attack pressure squeeze.

### 11.3 Three-Dimensional MPE Soloist Gestures (`.squeeze`, `.bend_voice`, `.mpe`)
* **`.squeeze(90%)`:** Zero-attack MPE key-dip pressure squeeze—initiates a whisper-quiet resonance and swells organically into the second resistance zone (`sin(u * pi)` contour) before tapering off.
* **`.bend_voice(voiceIdx, cents, startNorm..endNorm)`:** Articulates a **single inner voice** (`0`-based index from lowest pitch to highest) inside a held polyphonic chord by `cents` over `startNorm..endNorm` while surrounding chord tones remain rock-steady:
  * `[c4 g4 bb4 d5]:1.squeeze(90%).bend_voice(1, 50c, 0.2..0.8)` bends only the second voice (`g4`) up a quarter-tone ($+50\text{c}$) and back mid-chord.
* **`.mpe(@{ bend: [0, 2, 0], slide: [40, 110], pressure: [70, 120] })`:** Full 3-axis per-note pitch bend (in semitones), vertical Y-axis timbre slide (`0..127`), and Z-axis aftertouch pressure (`0..127`).

---

## 12. Studio Audio Effects, Outboard Processing & Z-Axis Automation (`.fx`, `.automate`)

Attach `.fx(<type>, @{ <params> })` to any `def` track, `group` bus, `return` bus, or individual note/chord:

### 12.1 Core Studio & Creative DSP Effects

| `.fx(...)` Device | Parameters & Musical Function |
| :--- | :--- |
| `eq_eight` | `@{ low_cut: 100, bell1_freq: 1200, bell1_db: 2.0, high_shelf_db: 1.5 }` — Surgical 8-band equalizer & sub rumble high-pass filter. |
| `auto_filter` | `@{ cutoff: 2400, res: 0.4, drive: 3.0, lfo_rate: 1.5, lfo_amount: 0.2, mix: 1.0 }` — LFO-modulated state-variable filter with drive. |
| `compressor` / `glue_compressor` | `@{ threshold: -14, ratio: 4, attack: 10, release: 120, makeup: 3, mix: 0.85 }` — Track dynamic control and VCA bus glue. |
| `multiband_dynamics` (`ott`) | `@{ amount: 0.5, low_gain: 2.0, mid_gain: 1.0, high_gain: 2.5 }` — 3-band upward + downward OTT dynamics processor. |
| `drum_buss` | `@{ drive: 0.35, crunch: 0.25, boom_amount: 0.45 }` — Analog drum saturator with tuned $56\text{ Hz}$ sub-boom enhancer. |
| `roar` / `saturator` | `@{ drive: 0.4, feedback: 0.2, mix: 0.85 }` — Multi-stage nonlinear feedback saturation. |
| `gated_reverb` | `@{ decay: 3.2, gate_ms: 160, threshold: -24, mix: 0.55 }` — Signature 1980s Synthwave hall reverb chopped by an envelope noise gate. |
| `tape_degrade` | `@{ wow_hz: 0.42, wow_depth_ms: 1.8, flutter_hz: 9.5, high_cut: 5200, drive: 0.32, mix: 1.0 }` — Hauntological cassette transport drift, $1\text{–}4\text{ dB}$ soft analog transient compression, and steep $4\text{–}7\text{ kHz}$ high-cut. |
| `hybrid_reverb` / `reverb` | `@{ decay: 3.2, predelay: 18, mix: 0.45 }` — Convolution + algorithmic shimmer hall blend. |
| `echo` / `delay` | `@{ time: 0.375, feedback: 0.45, mix: 0.35 }` — Ping-pong cross-feedback stereo delay (`0.375s` = dotted 8th at 120 BPM). |
| `chorus` | `@{ rate: 0.6, amount: 0.45, mix: 0.45 }` — Quadrature stereo bucket-brigade chorus. |
| `vocoder` | `@{ bands: 20, depth: 1.1, formant_shift: 0, mix: 0.95 }` — 20-Band ($90\text{ Hz}–9600\text{ Hz}$) Klatt Formant Talking Vocoder driven by `.lyric("...")`. |
| `spectral_resonator` / `auto_shift` | `@{ freq: 220, decay: 1.4, mix: 0.35 }` / `@{ semitones: 0, formant_shift: 2, vibrato: 0.15 }` — Tuned comb resonator and formant pitch shifter. |
| `utility` / `limiter` | `@{ width: 130, gain_db: 0, pan: 0 }` / `@{ ceiling: -0.3, gain_db: 2.0 }` — Mid/Side stereo width tool and brickwall lookahead limiter. |
| `signalsmith_reverb` / `signalsmith_stretch` / `signalsmith_chorus` | `@{ decay: 3.4, damp_hz: 5600, mod_depth: 0.35, mix: 0.45 }` / `@{ semitones: 7, tonality_hz: 3200, mix: 0.35 }` / `@{ rate: 0.55, depth_ms: 6.5, mix: 0.45 }` — MIT Signalsmith 4x4 Hadamard FDN stereo diffuser, formant-preserving dual-grain spectral pitch shifter, and quadrature 4-tap detuned chorus. |

### 12.2 Virtual Studio Outboard & Mastering Hardware Stack

| `.fx(...)` Device | Parameters & Hardware Circuit Emulation |
| :--- | :--- |
| `transformer_color_adc` | `@{ transformer: "bx1" \| "bx5" \| "bypass", drive: 0.45, filter: "classic" \| "aggressive", mix: 1.0 }` — Discrete Class-A op-amp + oversized nickel-core input/output transformer stage imparting low-mid weight and transient rounding. |
| `dual_bus_silk_sum` | `@{ silk: "blue" \| "red" \| "super", texture: 0.65, mix: 1.0 }` — Active Class-A transformer summing: `"blue"` saturates low/low-mids ($<240\text{ Hz}$) for thickness; `"red"` excites high-mid/high air ($>2.2\text{ kHz}$); `"super"` drives both simultaneously. |
| `fet_fast_limiter` | `@{ ratio: 4 \| 8 \| 12 \| 20 \| "all_buttons", saturation_mode: false, drive: 0.5, mix: 1.0 }` — Ultra-fast FET limiting with explosive `"all_buttons"` ratio mode and 1-knob transformer `saturation_mode: true`. |
| `vari_mu_tube_comp` | `@{ threshold: -14, thd: "medium" \| "high", mix: 1.0 }` — Program-dependent soft-knee Vari-Mu tube bus compressor with two-stage even-harmonic tube overload. |
| `mastering_clip_limiter` | `@{ ceiling: -0.3, gain_db: 2.5, odd_even_thd: 0.3 }` — $+27\text{ dBu}$ analog mastering limiter with intelligent release and odd/even harmonic clipper drive. |
| `spectral_pitch_harmonizer` | `@{ shift1_st: 7, shift2_st: -12, mix: 0.42 }` — Dual-voice polyphonic pitch-shifting prism harmonizer. |
| `true_stereo_hall_reverb` | `@{ decay: 2.8, predelay: 22, rolloff_hz: 6800, mix: 0.42 }` — True-stereo cross-coupled early-reflection and dense modulated late-field hall tank. |

### 12.3 Continuous Z-Axis Parameter & MIDI CC Automation (`.automate` & `.cc`)
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
3. **Explicit `style=synth` on Synthesizer Tracks:** Every synthesizer `def` includes `style=synth` so it routes to the continuous DSP synthesizer engine rather than acoustic SoundFont fallback.
4. **No Dangling Empty Track Labels:** Every `trackId:` inside a `measure` block has valid note/rest tokens on the same line before `|`.
5. **Spectral Inverse Proportionality:** Chords on dense unison or wavefolded synth tracks use `.open_voice` or `.rootless` so lower-midrange overtones do not collide with `sub` tracks.
6. **Scale Lock Awareness:** Set `scale_lock: false` in `meta @{ ... }` whenever using chromatic parallel chord planing (`.plane("m9")`), `.neg_harm`, or non-12-TET microtonality.

### 14.2 Copy-Paste Master Prompt for AI Composers (Gemini / Claude / ChatGPT)

```text
Write a studio-mastered, multi-track musical composition in Tenuto 6.0 DSL (.ten) and return ONLY the code inside a single ```tenuto code block.

Follow these strict Tenuto 6.0 rules:
1. Wrap the document in `tenuto "6.0" { ... }` with `meta @{ title: "...", tempo: ..., time: "4/4", key: "...", scale: "...", scale_lock: false, sidechain: "..." }`.
2. Define return buses (`return <id> "<Name>" .fx(...)`), tracks (`def <id> "<Name>" style=<standard|synth|grid|simpler> patch="<patch>" ...`), and optional group buses (`group <id> "<Name>" tracks=[...] .fx(...)`).
3. Available `style=synth` patches: "supersaw", "flutter_pad", "reese_bass", "pluck_lead", "saw_lead", "acid_lead", "riser", "morph_analog_12", "vintage_ladder_8", "hybrid_motor_12", "binaural_hybrid_20", "state_variable_8", "vintage_poly_10", "stepped_wavetable_24", "spectral_hybrid_16", "granular_workstation_80", "tape_nostalgia_pad", "ribbon_cluster_8", "west_coast_200", "cybernetic_eoc", "wavetable", "operator", "collision", "tension", "electric", "granulator".
4. Available `.fx(...)` processors: "eq_eight", "auto_filter", "compressor", "glue_compressor", "multiband_dynamics", "drum_buss", "roar", "saturator", "gated_reverb", "tape_degrade", "hybrid_reverb", "echo", "reverb", "delay", "chorus", "vocoder", "spectral_resonator", "utility", "limiter", "transformer_color_adc", "dual_bus_silk_sum", "fet_fast_limiter", "vari_mu_tube_comp", "mastering_clip_limiter", "spectral_pitch_harmonizer", "true_stereo_hall_reverb".
5. CRITICAL MEASURE MATH: In 4/4 time, every track/voice line inside a single `measure N { ... }` block MUST sum to exactly 4.0 quarter-note beats (:1 = 4 beats, :2. = 3 beats, :2 = 2 beats, :4. = 1.5 beats, :4 = 1 beat, :8 = 0.5 beats, :16 = 0.25 beats). When attaching a modifier to a dotted duration, always write two dots (e.g. `a4:2..mp.legato`).
6. Apply Spectral Inverse Proportionality: use `.open_voice` or `.rootless` on dense synth chords, and animate sustained notes using intra-note windowed modifiers: `.detune(70%, 0.15..0.90)`, `.detune([68, 40, 18])`, `.detune_cents(-16c, 0.15..0.90)`, `.filter(900, 3400)`, `.glide(200ms)`, `.vowel("oh", "ooh", 0.2)`, `.wow_flutter(5, 0.42, 2.5, 9.5)`, `.swarm([0.2, 3.2, 0.4])`, `.fold(75%)`, `.lpg("both", 380ms)`, `.eoc_cycle(5)`, `.plane("m9")`, `.neg_harm`, `.ratchet(3, "up")`, `.squeeze(90%)`, `.bend_voice(1, 50c, 0.2..0.8)`, `.binaural(14c)`, `.spin(0.8)`, `.haas(10ms)`.