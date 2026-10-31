# Declarative Code-First DAW Architecture: The Tenuto 5.0 and 6.0 Language Specification, Continuous DSP Synthesis Engine, and Bi-Directional Compiler Theory

## 1. Architectural Paradigm of the Sovereign DAW

Modern music production environments have historically bifurcated into two incompatible paradigms: imperative graphical Digital Audio Workstations (DAWs) such as Ableton Live, which prioritize real-time signal manipulation and visual clip matrices at the expense of text-based version control and programmatic abstraction, and declarative music engraving or live-coding languages such as LilyPond, TidalCycles, and Strudel, which excel at structural notation or algorithmic pattern generation but lack native studio-grade synthesis, multi-bus mixing, and sample-accurate graphical synchronization. Tenuto Studio 5, supporting both the `tenuto "5.0"` and `tenuto "6.0"` domain-specific language specifications and architected internally as "The Sovereign DAW," resolves this dichotomy by unifying the complete instrument, effect, and session topology of Ableton Live 12 Suite with a bi-directional, projectional code-first compiler.

Within the Tenuto Studio architecture, the `.ten` source file operates as the single source of truth across four interconnected architectural layers: the Source and Surgical Abstract Syntax Tree (AST) Mutator layer, the Lexical and Temporal Compiler pipeline, the Multi-View DAW User Interface layer, and the Real-Time Hybrid Audio and Digital Signal Processing (DSP) engine. Rather than treating text as a static import or export format or a unidirectional script, the forward compilation pipeline routes the `.ten` document through `DocumentParser.ts`, `PitchEngine.ts`, `TemporalEngine.ts`, and `ASTSerializer.ts` to drive a Monaco-based code editor (`CodeEditor.tsx`), a multi-view graphical viewport (`WebGPUCanvas.tsx`), a stateless mixing console (`Mixer.tsx`), a parameter inspector (`Inspector.tsx`), and a hybrid WebAudio synthesis and sample-streaming engine (`StudioAudioEngine.ts`). Conversely, along the feedback path, user interactions in any visual surface—whether dragging a note rectangle in the Scrolling Piano Roll View, launching clips in the Session View matrix, adjusting locators in the Arrangement View timeline, or pulling a track fader in the Mixer—invoke the surgical AST mutator. This mutator leverages exact lexical character spans (`sourceStartOffset` to `sourceEndOffset`, alongside line and column coordinates) to rewrite only the targeted token in the `.ten` source buffer while preserving user comments (`%% ...`), whitespace formatting, and adjacent musical measures.

This bi-directional projectional architecture carries significant implications for human-AI collaborative composition and automated score validation. Because Large Language Models (LLMs) operate natively on sequential text tokens rather than opaque binary DAW project files, Tenuto Studio integrates a dedicated "Copy LLM Prompt" transport control alongside an automated LLM paste sanitizer inside `DocumentParser.ts` and `IncrementalCompiler.ts`. When an external language model generates a multi-track orchestration or electronic arrangement, the compiler automatically strips Markdown code fences, resolves sticky octave and duration states, repairs fused modifier tokens, and compiles the score into live WebAudio nodes and interactive Piano Roll geometry without manual cleanup.

| Subsystem Layer | Core TypeScript Modules | Primary Architectural Responsibilities |
| :--- | :--- | :--- |
| **Lexical & Syntactic Compiler** | `lexer.ts`, `DocumentParser.ts`, `ASTSerializer.ts`, `IncrementalCompiler.ts` | Tokenizes `.ten` source, strips LLM markdown fences, tracks character spans (`sourceStartOffset..sourceEndOffset`), enforces per-token fault tolerance, and serializes AST mutations. |
| **Pitch & Temporal Mathematics** | `PitchEngine.ts`, `TemporalEngine.ts` | Parses scientific and quarter-tone pitches (`qs`, `qf`, `tqs`, `tqf`, `x`, `±Nc`), applies Scala `.scl` microtonal tables, enforces 22-scale Global Scale Lock, and validates measure beat summations. |
| **Continuous & Suite Synthesis** | `ContinuousSynthEngine.ts`, `AbletonSynthSuite.ts`, `WavetableEngine.ts`, `SuiteParityEngine.ts` | Executes 19 flagship synth topologies, 20 continuous intra-note windowed modifiers (`0.0..1.0`), raised-cosine feathering, and polyphonic chord voice-leading portamento (`.glide()`). |
| **Sample, Vocal & Grid Engines** | `SoundfontLibrary.ts`, `SamplerAndDrumRackEngine.ts`, `PhonemeEngine.ts` | Streams and caches 128 MusyngKite HD General MIDI instruments (`tenuto-soundfont-vault-v1`), maps Simpler vocal slices, drives 128-pad Drum Racks with choke groups, and synthesizes vocoder formants. |
| **Audio FX, Groove & Routing** | `StudioAudioEngine.ts`, `AbletonAudioFxEngine.ts`, `GrooveEngine.ts`, `FollowActionEngine.ts` | Manages the 25ms lookahead scheduler, 48-voice polyphony cap, self-healing master bus, 30 Ableton audio effects, 9 MIDI effects, return buses, sidechain ducking, and `OfflineAudioContext` WAV export. |
| **Projectional UI & Transport** | `SplitWorkspace.tsx`, `CodeEditor.tsx`, `WebGPUCanvas.tsx`, `Transport.tsx`, `Mixer.tsx`, `Inspector.tsx` | Renders the Monaco editor with real-time Karaoke token fill, memoized SVG Piano Roll/Session/Arrangement viewports (Tab switchable), live Key/Scale selectors, and stateless mixer faders. |

---

## 2. Document Architecture, Execution Modes, and Lexical Invariants

A complete Tenuto composition is encapsulated within a versioned root block—either `tenuto "5.0" { ... }` or `tenuto "6.0" { ... }`—and is organized into three sequential declarative sections: global metadata (`meta @{ ... }`), signal routing and instrument definitions (`return`, `def`, and `var`), and the chronological musical timeline (`measure N { ... }`). For rapid ideation, the compiler also supports **Quick Sketch Mode**, wherein a single-line un-wrapped expression such as `pno: c4:8 d e f g:4` bypasses boilerplate declarations and compiles immediately using the `salamander_grand` acoustic piano patch at a default tempo of 120 BPM.

### 2.1 Global Metadata, Piecewise Tempo Maps, and Sidechain Topology

The `meta @{ ... }` dictionary governs global transport, harmonic quantization, and master bus dynamics. Beyond static parameters such as `title`, `tempo`, and `time` (for instance, `"4/4"`), the metadata block controls Ableton Live 12 Global Scale Lock through the `key`, `scale`, and `scale_lock` attributes. When `scale_lock: true` is declared alongside a root key (such as `"F#"` or `"D"`) and one of the 22 supported scale modes (such as `"minor"` or `"harmonic_minor"`), `PitchEngine.ts` intercepts any out-of-scale MIDI pitch generated in the score or via MIDI transformations and snaps it into the active harmonic scale. Simultaneously, `WebGPUCanvas.tsx` highlights the root and in-scale pitch rows across the Piano Roll viewport, while `Transport.tsx` binds live interactive Key and Scale selectors directly to the `meta` AST node.

In parallel with harmonic quantization, the global metadata block establishes master sidechain routing and piecewise tempo maps. Declaring `sidechain: "drums"` and `sidechain_tap: "post_fx"` inside `meta` configures a global ducking trigger sourced from the designated percussion bus, which interacts with track-level `duck` attributes to modulate synth and bus envelopes. While the root `meta` block defines the initial tempo of the arrangement, embedding a localized `meta @{ tempo: 84 }` statement inside any `measure N { ... }` block dynamically alters the tempo starting at that measure boundary via `meta.tempoMap`. `TemporalEngine.ts` and `StudioAudioEngine.ts` recalculate sample offsets across these piecewise tempo transitions so that audio scheduling, playhead scrolling, and real-time Karaoke code highlighting remain sample-accurate throughout the score.

### 2.2 Return Buses, Multi-Line Track Declarations, and Karaoke Highlighting

Before the musical timeline begins, auxiliary effects buses are declared via the `return` keyword—such as `return hall_bus "Shimmer Hall" .fx(hybrid_reverb, @{decay: 4.5, predelay: 20, mix: 1.0})`—and individual tracks are instantiated via `def`. To accommodate complex synthesis and mixing configurations without horizontal scrolling clutter, `DocumentParser.ts` supports both single-line declarations and multi-line indented continuation lines for `def` and `return` statements. Track-level producer parameters—specifically `vol`, `detune`, `cutoff`, `resonance`, `sub`, `air`, `duck`, `width`, `slop`, `noise`, and `sends=@{...}`—are written directly as first-class key-value attributes on the `def` declaration, eliminating legacy `macros=@{...}` wrapper boilerplate.

During active playback, Tenuto Studio 5 executes **Real-Time Karaoke Code Highlighting**. Using the exact token character offsets (`sourceStartOffset..sourceEndOffset`, `line`, `col`) emitted by the lexer, the Monaco editor highlights the currently sounding lines and sweeps a continuous progress fill across each individual note or chord token as its duration elapses. Consequently, architectural best practice dictates formatting each `measure N { ... }` block with one track per line, terminated by the pipe delimiter (`|`), ensuring the visual Karaoke spotlight tracks the multi-track arrangement with visual clarity.

### 2.3 Strict Lexical and Temporal Invariants

To guarantee deterministic compilation and prevent rhythmic desynchronization across parallel voices, the Tenuto compiler enforces four strict lexical and mathematical invariants:

1. **Strict Measure Beat Summation:** In $4/4$ time, every active track line inside a `measure N { ... }` block, as well as every parallel polyphonic voice (`v1`, `v2`, `v3`) encapsulated within a `<[ ... ]>` voice block, must sum to exactly $4.0$ quarter-note beats, equivalent to a $1/1$ whole note.
2. **The Double-Dot Rule:** Because Tenuto uses the period character (`.`) both as a rhythmic augmentation dot and as a method-chaining operator for modifiers, an unmodified dotted note takes a single dot (`d5:4.` or `g4:2.`), whereas a dotted note followed by any modifier must be written with two consecutive dots (`..`) prior to the first modifier identifier, as in `d5:4..f` or `a5:4..ff.zap.vib`. In this construction, the first dot completes the rhythmic token (`:4.`), while the second dot initiates the modifier chain (`.ff`); omitting the second dot (`d5:4.f`) causes the parser to consume the single dot as the modifier delimiter, silently dropping the rhythmic augmentation and parsing the event as a $1.0$-beat quarter note rather than a $1.5$-beat dotted quarter note.
3. **Explicit Octave Boundaries:** While Tenuto supports sticky octave and duration state within a continuous phrase (`c4:8 d e f g:4`), the compiler requires explicit octave digits (`0`–`8`) on the first note token of every measure, at the start of every polyphonic voice (`<[ v1: ... | v2: ... ]>`), and immediately following any melodic leap larger than a musical third.
4. **Scientific and Microtonal Pitch Orthography:** `PitchEngine.ts` accepts only pitch letters `[a-g]` paired with standard accidentals (`#`, `b`, `x` for double-sharp, `n` for natural), microtonal quarter-tone suffixes (`qs`, `qf`, `tqs`, `tqf`), or explicit cent deviations (`±Nc`, such as `c4+25c`), while rejecting LilyPond-style pitch suffixes (`cis`, `ees`, `fis`) with lexical error `E1001: Invalid PitchLit token`.

| Duration Token | Musical Fraction | Quarter-Note Beats (4/4) | Unmodified Syntax | Modified Syntax (Double-Dot Rule) | Euclidean / Polyphonic Context |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `:1` | $1/1$ (Whole) | $4.00$ beats | `[c4 e4 g4]:1` | `[c4 e4 g4]:1.ff.glide(140ms)` | Full-bar sustained pad or sub-bass |
| `:2.` | $3/4$ (Dotted Half) | $3.00$ beats | `g4:2.` | `g4:2..mf.vib` | Requires `:4` ($1.00$ beat) to complete $4/4$ bar |
| `:2` | $1/2$ (Half) | $2.00$ beats | `c3:2` | `c3:2.f.pan(-0.3)` | Two `:2` tokens sum to $4.00$ beats |
| `:4.` | $3/8$ (Dotted Quarter) | $1.50$ beats | `d5:4.` | `a5:4..ff.zap.vib` | Commonly paired with `:8` ($0.50$ beat) $= 2.00$ beats |
| `:4` | $1/4$ (Quarter) | $1.00$ beat | `k:4` | `s:4.ff.pull(12ms)` | Four `:4` tokens sum to $4.00$ beats |
| `:8.` | $3/16$ (Dotted Eighth) | $0.75$ beats | `f#4:8.` | `f#4:8..mp.stacc` | Paired with `:16` ($0.25$ beat) $= 1.00$ beat |
| `:8` | $1/8$ (Eighth) | $0.50$ beats | `ch:8` | `g#5:8.ff.legato` | Eight `:8` tokens or Euclidean `(k):3/8` |
| `:16` | $1/16$ (Sixteenth) | $0.25$ beats | `c5:16` | `c5:16.p.push(10ms)` | Sixteen `:16` tokens sum to $4.00$ beats |

---

## 3. Continuous Synth Engine Physics and Intra-Note Modulation

A primary limitation of traditional MIDI-based DAWs and early text-based music languages is that notes are treated as discrete, static triggers; achieving complex intra-note timbral evolution requires separate automation lanes or verbose multi-voice workarounds (`<[ v1 | v2: s:1.automate(...) ]>`). Tenuto Studio 5 replaces this paradigm with `ContinuousSynthEngine.ts`, which treats every note and chord token as a continuous, time-windowed DSP trajectory.

### 3.1 First-Class Producer Synth Patches

Rather than requiring composers to assemble basic oscillator waveforms from scratch, `ContinuousSynthEngine.ts` and `AbletonSynthSuite.ts` provide 19 native synthesizer topologies under `style=synth`, anchored by five flagship producer patches engineered for immediate commercial parity:

* **`patch="supersaw"`**: Instantiates a 7-voice free-running detuned festival supersaw stack integrated with a phase-locked sub-oscillator, a hard $120\text{ Hz}$ bass-mono crossover filter that prevents low-end phase cancellation in stereo mixes, and a top-end harmonic air exciter.
* **`patch="reese_bass"`** (alias `"reese"`): Pairs a wide stereo detuned sawtooth unison stack with a phase-locked sub-octave sine oscillator routed through a saturating ladder low-pass filter.
* **`patch="flutter_pad"`**: Provides a lush polyphonic chord synthesizer featuring global song-clock-synchronized LFO amplitude and filter flutter with stereo chorus widening.
* **`patch="pluck_lead"` & `patch="acid_lead"`**: Deliver snappy, transient-heavy lead topologies driven by fast resonant filter envelopes.
* **`patch="riser"`**: Functions as a dedicated transition generator that executes an automatic upward pitch and filter cutoff sweep across the exact duration of the declared note or chord token.

Beyond these five producer archetypes, `style=synth` encompasses the complete Ableton Live 12 native instrument suite: `wavetable`, `operator`, `meld`, `drift`, `analog`, `collision`, `tension`, `electric`, `granulator`, `saw_lead`, `warm_pad`, `string_pad`, and `808_sub`.

### 3.2 Intra-Note Time Windows, Multi-Point Curves, and Voice-Leading Glide

The defining architectural innovation of `ContinuousSynthEngine.ts` is the ability to scope any continuous modifier to a normalized **Sub-Note Time Window** (`start..end` within `0.0..1.0`) or a **Multi-Point Trajectory Curve** (`[v0, v1, ...]`) directly on the note token. When a composer writes `.detune(92%, 0.35..0.85)` or `.detune(85%, 0.35..0.85)` on a sustained whole-note chord across a $4.0$-beat measure, the synthesizer maintains a clean, phase-coherent $0\%$ detune attack for the initial $35\%$ of the note's duration ($0.00$ to $0.35$), blooms into full $85\%$ or $92\%$ unison detune spread between $35\%$ and $85\%$ of the bar ($0.35$ to $0.85$), and collapses cleanly back to $0\%$ for the final $15\%$ ($0.85$ to $1.00$). Crucially, the engine applies automatic raised-cosine edge feathering across the $0.35$ activation boundary and the $0.85$ release boundary, ensuring that mid-note parameter transitions never induce discontinuous step-function click transients in the audio buffer. Alternatively, passing a multi-point curve array such as `.detune([0, 95, 15])` or `.drive([0.3, 0.85])` interpolates continuously across the normalized duration, attacking at $0\%$ detune at $t = 0.0$ for a tight transient punch, swelling to a $95\%$ peak at mid-note ($t = 0.5$), and tapering smoothly to $15\%$ at note completion ($t = 1.0$).

For harmonic progressions, `ContinuousSynthEngine.ts` implements **Automatic Polyphonic Chord Voice-Leading Glide** via the `.glide(Nms)` modifier. When a 5-voice chord token carrying `.glide(180ms)`—specifically `[ab2 eb3 c4 g4 c5]:1.glide(180ms)` corresponding to MIDI pitches 44, 51, 60, 67, and 72—is followed in the next measure by `[ab2 eb3 f4 ab4 b4]:1` (MIDI pitches 44, 51, 65, 68, and 71), the compiler's voice-leading solver automatically pairs each constituent voice of Chord 1 with its corresponding target voice in Chord 2 and ramps all five oscillator frequencies independently along their shortest voice-leading pitch trajectories during the final $180\text{ ms}$ ($t = 0.90$ to $1.00$) of the bar. This architecture eliminates the need to manually split a 5-note chord into five separate monophonic `.mpe()` voices merely to achieve polyphonic portamento.

### 3.3 Complete Catalog of the 20 Continuous Synth Sound-Design Modifiers

Every modifier in `ContinuousSynthEngine.ts` can be chained directly onto individual notes or chords and accepts static values, sub-note time windows (`start..end`), or multi-point curves (`[...]`):

| # | Modifier Syntax | Parameter Domain & Units | DSP Signal-Processing Mechanism |
| :--- | :--- | :--- | :--- |
| **1** | `.detune(pct, start..end)` or `.detune([v0, v1, ...])` | $0..100\%$ spread; window $0.0..1.0$ | Modulates unison oscillator stack frequency spread with raised-cosine window feathering. |
| **2** | `.detune_cents(cents, start..end)` | $-1200..+1200\text{c}$; window $0.0..1.0$ | Applies fine pitch offset in cents to a targeted temporal slice of a held note. |
| **3** | `.filter(startHz, endHz)` / `.cutoff(hz, start..end)` / `.res(q)` | Cutoff $60..16000\text{ Hz}$; Resonance $0.5..18$ | Drives an inline State Variable Filter (SVF) cutoff trajectory and $Q$ resonance factor. |
| **4** | `.flutter(rateHz \| [startRate, endRate])` | Rate $1..32\text{ Hz}$ (scalar or ramp array) | Applies a song-clock-locked LFO amplitude and filter flutter gate, supporting accelerating or decelerating rates. |
| **5** | `.warble(depth, rateHz)` | Depth $0..100\%$; Rate $0.2..16\text{ Hz}$ | Simulates analog magnetic tape pitch wow and flutter instabilities. |
| **6** | `.pitch_dip(-N)` / `.tapestop` | $-N$ semitones (e.g., `-7`) | Executes a downward pitch dive at the tail of the bar and recovers, tailored for mid-drop turnarounds. |
| **7** | `.stack("octaves" \| "fifths" \| "seventh" \| "super")` | Enumerated harmonic interval mode | Re-pitches outer unison oscillators to $+12\text{st}$ octaves, $+7\text{st}$ fifths, or $+11\text{st}$ major sevenths. |
| **8** | `.noise(level, "white" \| "pink" \| "breath", start..end)` | Level $0..100\%$; color enum; window $0.0..1.0$ | Injects a time-windowed noise oscillator layer pre-filter for transient grit or breathy chording. |
| **9** | `.sync(ratio \| [startRatio, endRatio])` | Harmonic ratio $1.0..16.0$ | Sweeps a hard-sync slave oscillator ratio to generate classic tearing harmonic overtones. |
| **10** | `.fm(amount, ratio)` & `.ring(amount, freqHz)` | Amount $0..100\%$; ratio / $\text{freqHz}$ | Engages audio-rate linear Frequency Modulation (FM) or metallic ring modulation. |
| **11** | `.pwm(duty, rateHz)` & `.warp_wave("bend" \| "mirror", amount)` | Duty $0.05..0.95$; warp $0..100\%$ | Modulates pulse-width duty cycle or applies non-linear phase distortion waveform warping. |
| **12** | `.keytrack(pct)` | $0..100\%$ | Scales SVF filter cutoff frequency proportionally with note pitch relative to middle C ($\text{C4}$). |
| **13** | `.comb(freqHz, feedback)` | Freq $60..4000\text{ Hz}$; feedback $0..100\%$ | Routes the voice through a tuned delay-line comb and flanger physical resonator. |
| **14** | `.duck(depth)` (or `duck=80` on `def`) | Depth $0..100\%$ | Applies an internal quarter-note sidechain pumping envelope without requiring external compressor routing. |
| **15** | `.gate([1, 0, 1, 1, 0, 1, 0, 1])` | 8-step or 16-step binary array (`0` or `1`) | Chops sustained notes or chords through a tempo-synced rhythmic trance gate. |
| **16** | `.zap` / `.pluck(decayMs, semitones)` | $+12..24\text{st}$ over $15\text{ms}$ (or custom `decayMs`) | Injects an ultra-fast pitch-attack transient spike for punchy electronic leads and plucks. |
| **17** | `.haas(delayMs)` & `.width(pct \| [startPct, endPct])` | Haas $0.5..35\text{ms}$; Width $0..200\%$ | Applies stereo Haas micro-delay precedence widening and Mid/Side stereo field expansion. |
| **18** | `.analog_slop(pct)` (or `slop=35` on `def`) | $0..100\%$ | Introduces organic voice-to-voice hardware component drift in oscillator pitch and filter cutoff. |
| **19** | `.air(pct)` (or `air=85` on `def`) | $0..100\%$ | Boosts a high-shelf harmonic exciter above $5.5\text{ kHz}$ for crystalline supersaw presence. |
| **20** | `.pre_swell` & `.open_voice` / `.drop2` | Parameterless flags | Applies a reverse-envelope pre-drop suction swell (`.pre_swell`) or automatic cinematic Drop-2 chord voicing spread (`.open_voice` / `.drop2`). |

In addition to these 20 synth-specific modifiers, all Tenuto tracks support universal articulation, dynamic, spatial, and micro-timing modifiers: `.stacc` (staccato), `.marc` (marcato), `.ten` (tenuto), `.legato`, `.vib` (vibrato), `.pp`, `.p`, `.mp`, `.mf`, `.f`, `.ff`, `.vol(0..127)`, `.pan(-1.0..1.0)`, `.push(Nms)` (early micro-timing), and `.pull(Nms)` (laid-back micro-timing).

---

## 4. Acoustic SoundFont Vault, Drum Rack, Audio FX, and MIDI FX Roster

To achieve parity with a flagship studio environment across both orchestral scoring and electronic production, Tenuto Studio 5 pairs its continuous synthesis engine with an on-demand HD sample streaming vault (`SoundfontLibrary.ts`), a slice-mapped vocal sampler (`SamplerAndDrumRackEngine.ts`), a 30-unit audio DSP rack (`AbletonAudioFxEngine.ts`), and a 9-unit MIDI transformation chain.

### 4.1 The 128-Instrument HD SoundFont Vault and Intelligent Track Inference

Early iterations of WebAudio engines relied on mathematical sine, sawtooth, square, and triangle oscillators for all tracks, giving acoustic scores an artificial 8-bit timbre. `SoundfontLibrary.ts` resolves this limitation by integrating the MusyngKite and FluidR3_GM HD General MIDI SoundFont library across all 128 standard instruments and more than 80 producer aliases. Because composers or external language models frequently mislabel orchestral tracks with `style=synth`, `SoundfontLibrary.ts` implements automatic track-name and ID inference: it inspects both the `patch` attribute and the track identifier (`vln1`, `vln2`, `vla`, `vc`, `cb`, `hn`, `tpt`, `tbn`, `tba`, `fl`, `ob`, `cl`, `choir`, `soprano`, `alto`, `tenor`, `harp`, `pno`, `hps`, `clav`, `timp`, `ham`) and automatically maps them to their canonical multi-sampled acoustic banks even when `style=synth` was declared in the score.

Rather than downloading gigabytes of sample data at startup, `SoundfontLibrary.ts` scans the compiled AST, downloads only the instrument banks referenced in the active score, persists the raw responses in the persistent browser or Electron cache (`caches.open('tenuto-soundfont-vault-v1')`), and decodes only the active MIDI notes in parallel before playback starts. During live playback, `StudioAudioEngine.ts` triggers decoded `AudioBuffer` samples via `AudioBufferSourceNode` with an instant polyphonic synth fallback while samples stream, and during offline rendering (`exportWavBlob()`), it resamples the actual SoundFont PCM `AudioBuffer` data directly into the exported `.wav` file. Furthermore, to support cross-origin CDN fetches inside the packaged macOS `.pkg` and desktop Electron builds (`electron/main.cjs`), Tenuto Studio configures `'Cross-Origin-Embedder-Policy'` to `'credentialless'` rather than `'require-corp'`, keeping `SharedArrayBuffer` enabled for high-priority audio worklets (`TenutoProcessor.ts`) while allowing seamless SoundFont streaming from GitHub and jsDelivr CDNs.

| Instrument Family | Canonical Tenuto Patch Identifiers & Track Shorthand Aliases | Engine Style & Special Routing Behavior |
| :--- | :--- | :--- |
| **Strings & Orchestral Harp** | `violin` (`vln1`), `string_ensemble_1` (`vln2`), `chamber_strings`, `viola` (`vla`), `cello` (`vc`), `contrabass` (`cb`), `tremolo_strings`, `pizzicato_strings`, `orchestral_harp` (`harp`) | `style=standard`; auto-inferred from orchestral track IDs (`vln1`, `vla`, `vc`, `cb`, `harp`). |
| **Brass & Woodwinds** | `french_horn` (`hn`), `trumpet` (`tpt`), `muted_trumpet`, `trombone` (`tbn`), `tuba` (`tba`), `brass_section`, `flute` (`fl`), `piccolo`, `oboe` (`ob`), `english_horn`, `clarinet` (`cl`), `bassoon`, `alto_sax`, `tenor_sax` | `style=standard`; auto-inferred from wind/brass track IDs (`hn`, `tpt`, `tbn`, `tba`, `fl`, `ob`, `cl`). |
| **Choir, Pianos, Organs & Mallets** | `choir_aahs`, `voice_oohs`, `salamander_grand` (`pno`, `piano`, `gm_piano`), `acoustic_grand_piano`, `bright_piano`, `electric_grand`, `honky_tonk`, `rhodes` (`epiano`, `electric_piano_1`), `dx7` (`fm_epiano`, `electric_piano_2`), `harpsichord` (`hps`), `clavinet` (`clav`), `church_organ`, `vibraphone`, `marimba`, `celesta` | `style=standard`; `salamander_grand` serves as the default fallback in Quick Sketch Mode. |
| **Guitars & Acoustic/Electric Bass** | `nylon_guitar`, `steel_guitar`, `jazz_guitar`, `clean_guitar`, `overdriven_guitar`, `acoustic_bass`, `finger_bass` | `style=standard`; multi-sampled plucked string banks. |
| **Simpler Vocal Slice Maps** | `patch="simpler"` with `src="vox.wav"` and `map=@{ slice_name: [startSec, endSec] }` (e.g., `map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s] }`) | `style=simpler` or `style=concrete`; triggers time-sliced audio regions by identifier in measures. |
| **128-Pad Studio Drum Rack & Percussion** | `tenuto_808_kit` (`k` kick, `s` snare, `cp`/`c` clap, `rim` rimshot, `h`/`ch` closed hat, `oh` open hat, `lt` low tom, `mt` mid tom, `ht` high tom, `cr` crash, `rd` ride), `timpani` (`timp`), `taiko_drum` (`ham` Mahler hammer) | `style=grid`; `ch` and `oh` share Choke Group 1 (triggering `ch` immediately silences `oh`). |

### 4.2 Complete Roster of the 30 Ableton Audio Effects

Audio effects in Tenuto Studio 5 can be chained onto return buses, attached to track `def` declarations, or applied inline to individual notes and chords within a measure using `.fx(name, @{...})`. `AbletonAudioFxEngine.ts` implements all 30 Ableton Live 12 Suite audio processors:

| Category | Audio Effect Identifiers (`.fx(name, @{...})`) | Key Parameters & Architectural Usage |
| :--- | :--- | :--- |
| **EQ & Filtering (3)** | `eq_eight`, `eq_three`, `auto_filter` | Surgical multi-band equalization, DJ-style 3-band crossover isolation, and envelope/LFO-driven analog filtering. |
| **Dynamics & Bus Processing (6)** | `compressor`, `glue_compressor`, `multiband_dynamics` (alias `ott`), `drum_buss`, `limiter`, `gate` | Upward/downward 3-band compression (`multiband_dynamics, @{amount: 0.65}`), SSL-style bus cohesion (`glue_compressor`), and transient/sub boom enhancement (`drum_buss, @{drive: 0.4, boom_amount: 0.5}`). |
| **Drive, Color & Degradation (8)** | `roar`, `saturator`, `amp`, `cabinet`, `pedal`, `vinyl_distortion`, `redux`, `erosion` | Multi-stage nonlinear feedback saturation (`roar, @{drive: 0.5}`), bit/sample-rate reduction (`redux`), and modulated noise/sine sideband injection (`erosion, @{amount: 0.22}`). |
| **Reverb, Delay & Modulation (6)** | `hybrid_reverb`, `reverb`, `echo`, `delay`, `chorus`, `phaser_flanger` | Convolution + algorithmic shimmer blending (`hybrid_reverb, @{decay: 4.5, predelay: 20, mix: 1.0}`), tape delay (`echo`), and stereo modulation. |
| **Vocoder, Pitch & Spectral (6)** | `vocoder`, `auto_shift`, `shifter`, `frequency_shifter`, `spectral_resonator`, `spectral_time` | `vocoder` instantiates a 20-band talking formant vocoder driven by `PhonemeEngine.ts` when paired with note-level `.lyric("...")` tokens; real-time pitch correction (`auto_shift`) and FFT partial freezing (`spectral_time`). |
| **Physical Modeling, Glitch & Utility (5)** | `corpus`, `resonators`, `beat_repeat`, `looper`, `utility` | Acoustic beam/plate/membrane modeling (`corpus`), pitched harmonic resonators, buffer stutter (`beat_repeat`), and gain/phase/width management (`utility`). *(Note: With `ott` aliased to `multiband_dynamics`, the complete roster spans 34 distinct DSP unit identifiers covering the 30 flagship Suite categories).* |

### 4.3 Complete Specification of the 9 Ableton MIDI Effects

In a Tenuto device chain, `.midi_fx(name, @{...})` processors execute upstream of the synthesizer or SoundFont instrument, intercepting and transforming incoming note events—including pitch, velocity, duration, probability, and rhythmic repetition—before audio synthesis occurs. Tenuto Studio 5 unifies the 8 native Ableton Live 12 MIDI Effect devices (`arpeggiator`, `cc_control`, `chord`, `note_length`, `pitch`, `random`, `scale`, `velocity`) with the studio's dedicated `note_echo` MIDI delay processor to form the 9 Ableton MIDI Effects:

| # | MIDI Effect Identifier | Core Parameter Dictionary (`@{...}`) | Algorithmic Transformation & Scale-Lock Interaction |
| :--- | :--- | :--- | :--- |
| **1** | `note_echo` | `repeats` ($1..16$), `delay` (beat divisions, e.g., `2`), `feedback` ($0.0..1.0$, e.g., `0.45`), `pitch_shift` (semitones/degrees) | Generates tempo-synced decaying MIDI note repetitions prior to synthesis (e.g., `.midi_fx(note_echo, @{repeats: 1, delay: 2, feedback: 0.45})`). |
| **2** | `arpeggiator` | `style` (`"up"`, `"down"`, `"converge"`, `"diverge"`, `"play_order"`, `"chord_trigger"`, `"random"`, `"random_other"`, `"random_once"`), `rate`, `gate` ($\%$), `distance`, `steps`, `repeats`, `retrigger` (`"off"`, `"note"`, `"beat"`) | Splits held chords into rhythmic note sequences across 18 pattern styles; respects Global Scale Lock when transposing steps via `distance`. |
| **3** | `chord` | `shift1..shift6` ($-36..+36$ semitones or scale degrees), `velocity` ($1..200\%$), `chance` ($0..100\%$), `strum` ($0..400\text{ms}$), `tension`, `crescendo` | Harmonizes each incoming note with up to 6 additional voices, supporting articulated strumming acceleration (`tension`), velocity ramps (`crescendo`), and MPE propagation. |
| **4** | `note_length` | `trigger` (`"note_on"` \| `"note_off"`), `length`, `gate` ($\%$), `release_velocity` ($\%$), `decay_time`, `key_scale` | Rescales note durations relative to pitch (`key_scale` around $\text{C3}$) or delays triggering until MIDI Note Off release events. |
| **5** | `pitch` | `pitch` ($-128..+128$ semitones or $-30..+30$ scale degrees), `lowest`, `range`, `mode` (`"block"` \| `"fold"` \| `"limit"`), `step_width` | Transposes incoming MIDI pitches and constrains out-of-range notes by blocking them, folding them back by octaves, or clamping them to range limits. |
| **6** | `random` | `chance` ($0..100\%$), `choices` ($1..24$), `interval` (semitones/degrees), `sign` (`"add"` \| `"sub"` \| `"bi"`) | Applies stochastic pitch variation within a bounded window ($\text{choices} \times \text{interval}$) in unipolar (`add`/`sub`) or bipolar (`bi`) directions. |
| **7** | `scale` | `base` (root key), `scale` (scale topology), `transpose`, `fold` (`true`/`false`), `range` | Remaps each of the 12 pitch classes onto a custom $12 \times 12$ transposition matrix to enforce diatonic or modal harmony downstream of `random` or `arpeggiator`. |
| **8** | `velocity` | `mode` (`"clip"` \| `"gate"` \| `"fixed"`), `out_hi`, `out_low`, `range`, `lowest`, `drive`, `compand`, `random` | Reshapes incoming MIDI note velocities along nonlinear compression/expansion curves (`drive`, `compand`) or gates out notes falling outside the target velocity window. |
| **9** | `cc_control` | `mod_wheel` (CC 1), `pitch_bend`, `pressure`, `sustain` (Custom A / CC 64), `custom_b..custom_m` | Injects continuous MIDI controller envelopes, channel aftertouch, pitch bend, and sustain pedal messages directly into the instrument chain. |

---

## 5. Microtonal Pitch Mathematics and Global Scale Lock

While standard commercial DAWs hardcode 12-tone equal temperament (12-TET) into their piano roll geometry, Tenuto Studio 5 decouples pitch representation from equal-tempered MIDI integers inside `PitchEngine.ts`. By default, instantiating `new PitchEngine()` initializes the tuning reference to `12tet` at $\text{A4} = 440.0\text{ Hz}$ with `scaleLock = false` to maintain backward compatibility with standard scores and existing test suites (`tests/pitch_engine.test.ts`). However, composers can declare alternative tuning systems or microtonal accidentals at any point in a score.

### 5.1 Quarter-Tone Accidentals and Cent Offsets

Within any measure, `PitchEngine.ts` parses sub-semitone pitch tokens directly into exact floating-point frequencies ($f$ in $\text{Hz}$) and fractional MIDI values ($m \in \mathbb{R}$) according to the generalized logarithmic pitch equation:

$$f(m, \Delta c) = f_{\text{ref}} \cdot 2^{\left(\frac{m - 69 + \frac{\Delta c}{100}}{12}\right)}$$

where $f_{\text{ref}} = 440.0\text{ Hz}$ (MIDI note 69, $\text{A4}$) and $\Delta c$ represents the cumulative microtonal deviation in cents. Under this formulation, the quarter-sharp suffix (`qs`) adds $+50\text{ cents}$ ($+0.5$ semitones), mapping `aqs4` to $452.89\text{ Hz}$, whereas the quarter-flat suffix (`qf`) subtracts $-50\text{ cents}$ ($-0.5$ semitones), mapping `ebqf4` to $-150\text{ cents}$ below `e4`. Similarly, the three-quarter-sharp (`tqs`) and three-quarter-flat (`tqf`) suffixes shift pitch by $+150\text{ cents}$ ($+1.5$ semitones) and $-150\text{ cents}$ ($-1.5$ semitones), respectively, while the double-sharp suffix (`x`) shifts pitch by $+200\text{ cents}$ (`cx4`) and explicit cent offset literals (`±Nc`, such as `c4+25c` or `f#4-14c`) provide single-cent pitch resolution.

### 5.2 Native Scala Microtonal Tuning Tables

Beyond 12-TET cent offsets, `PitchEngine.ts` natively compiles raw Scala (`.scl`) tuning tables and provides 10 built-in historical, non-Western, and equal-division tuning presets via `meta @{ tuning: "..." }`:

* **Historical & Pure Harmonic Intonation:** `just_intonation` (based on pure integer harmonic ratios), `pythagorean` (constructed from stacked $3:2$ pure fifths), and `meantone` (quarter-comma meantone temperament).
* **Microtonal Equal Divisions of the Octave (EDO):** `19tet`, `24tet` (standard quarter-tone EDO), and `31tet` (Huygens' near-meantone division).
* **Non-Octave & Indonesian Gamelan Tunings:** `carlos_alpha` (Wendy Carlos's non-octave $\approx 78\text{-cent}$ step scale), `bohlen_pierce` (13 divisions of a $3:1$ tritave), `slendro` (5-tone Javanese equidistant pentatonic), and `pelog` (7-tone unequal Indonesian tuning).

---

## 6. Real-Time Audio Scheduling, Resilience Engineering, and AST Mutation

Scaling a web- and Electron-based DAW to execute 60-measure, 11-instrument symphonic scores in real time exposes severe concurrency hazards between the JavaScript main thread, React's virtual DOM reconciliation loop, and the WebAudio rendering graph. In Contract TDB-608, architectural profiling of `StudioAudioEngine.ts`, `WebGPUCanvas.tsx`, `SplitWorkspace.tsx`, and `DocumentParser.ts` uncovered five compounding failure modes that previously caused metallic reverb explosions, UI freezes, and permanent `AudioContext` silence.

### 6.1 Root-Cause Analysis of the Five Symphonic Playback Hazards

1. **Main-Thread 60 FPS SVG Re-Render Stalls & Phase-Locked Convolver Bursts:** During playback, `StudioAudioEngine.ts` previously invoked its `onProgress` callback on every `requestAnimationFrame` tick (60 times per second), updating `playheadBeat` state inside `SplitWorkspace.tsx`. Because `WebGPUCanvas.tsx` had not memoized the static piano roll grid lines and note rectangles separately from `playheadBeat`, React re-diffed and re-rendered more than 1,200 SVG `<rect>` and `<text>` nodes 60 times a second. Whenever a heavy React reconciliation frame stalled the main thread by $100\text{ ms}$, the audio lookahead `while` loop fell behind by 30 or more overdue notes at once. Crucially, the scheduling guard `const safeStart = Math.max(ctx.currentTime + 0.006, absStartSec)` clamped all 30 overdue notes onto the exact same microsecond (`ctx.currentTime + 0.006`). Firing 30+ phase-locked oscillators into the shared `ConvolverNode` on the exact same sample frame caused constructive phase summation and a sudden metallic feedback roar. Contract TDB-608 resolves this by separating the audio lookahead scheduler onto a steady $25\text{ ms}$ timer (`setInterval`), prohibiting overdue bursts from clamping onto the same sample frame, enforcing a 48-voice polyphony cap, and memoizing the static SVG piano roll grid and note geometry in `WebGPUCanvas.tsx` so only the single playhead line updates during playback.
2. **WebAudio Node Memory Leaks & `NaN` Poisoning:** Previously, every triggered note created five uncollected WebAudio nodes (`send`, `panner`, `filter`, `mix1`, `mix2`), and if a single parameter transient introduced a `NaN` value into the master `ConvolverNode` or `DynamicsCompressorNode`, the `AudioContext` went permanently silent across subsequent play commands. To eliminate this state corruption, `StudioAudioEngine.ts` now garbage-collects per-note nodes, consolidates reverb routing onto a single shared bus, and invokes `rebuildMasterChain()` on every `playScore()` call so the master bus self-heals on every playback start.
3. **Recursive WAV Export Feedback:** During offline `.wav` rendering (`exportWavBlob()`), the early-reflections processor previously relied on an in-place recursive delay loop (`left[i] += right[i - delay1]`) that compounded feedback on sustained tutti chords; replacing this with strictly feed-forward reflections sourced from an immutable dry buffer (`dryL` / `dryR`) makes feedback runaway mathematically impossible.
4. **UI Transport State Wedging:** In `SplitWorkspace.tsx`, `handleTogglePlay()` previously called `setIsPlaying(nextPlaying)` before `incrementalCompiler.compileDocument(sourceCode)` and captured a stale closure in the Spacebar listener; if compilation threw an exception on a malformed token, `isPlaying` became wedged in `true` while audio never started. Moving state transitions after compilation and binding the Spacebar shortcut via a stable React `ref` eliminates transport wedging.
5. **Fused-Modifier Lexical Fault Tolerance:** In Measure 47 of the 60-measure symphony (`pno: <[ v1: g5:4.ffbb5:4 a5:4 f5:4 ...`), the modifier `.ff` and the note `bb5:4` were fused without whitespace (`g5:4.ffbb5:4`). `DocumentParser.ts` now incorporates automatic fused-modifier splitting and per-token fault tolerance inside `measure N { ... }` blocks while still throwing on incomplete trailing syntax (`f:`) in single-line Quick Sketch mode so projectional editing retains its last valid state.

---

## 7. Production Benchmark Score Templates

The following validated benchmark templates demonstrate idiomatic Tenuto 6.0 architecture across electronic festival production—incorporating `ContinuousSynthEngine.ts` intra-note windows, polyphonic chord `.glide()`, vocoder formant synthesis, and Simpler vocal slicing—and orchestral scoring—incorporating `SoundfontLibrary.ts` HD acoustic banks, piecewise tempo maps, and microtonal harmony.

### 7.1 Benchmark 1: Electronic Festival and Talking Vocoder Arrangement

```tenuto
tenuto "6.0" {
  %% 1. Global Metadata, Scale Lock & Post-FX Sidechain Routing
  meta @{
    title: "Sovereign Horizon",
    tempo: 132,
    time: "4/4",
    key: "F#",
    scale: "minor",
    scale_lock: true,
    sidechain: "drums",
    sidechain_tap: "post_fx"
  }

  %% 2. Return Buses & Multi-Line Producer Synth Definitions
  return hall_bus "Shimmer Hall" .fx(hybrid_reverb, @{decay: 4.5, predelay: 20, mix: 1.0})
  return echo_bus "Stereo Ping" .fx(echo, @{delay: 0.375, feedback: 0.42, mix: 1.0})

  def saws "Heaven Supersaw" style=synth patch="supersaw"
    vol=104 detune=92 cutoff=11500 air=85 duck=78 width=145 slop=30
    sends=@{hall_bus: 0.55}
    .fx(multiband_dynamics, @{amount: 0.65})

  def reese "Reese Sub" style=synth patch="reese_bass"
    vol=108 detune=76 cutoff=520 resonance=2.2 sub=95 duck=72
    .fx(roar, @{drive: 0.5})
    .fx(erosion, @{amount: 0.22})

  def lead "Soaring Lead" style=synth patch="pluck_lead"
    vol=106 detune=72 air=75
    sends=@{echo_bus: 0.40}
    .midi_fx(note_echo, @{repeats: 1, delay: 2, feedback: 0.45})

  def vox_robot "Talking Vocoder" style=synth patch="saw_lead"
    vol=102 detune=45 cutoff=8500
    .fx(vocoder, @{bands: 20, depth: 1.0, release: 45})

  def chops "Vocal Chop Rack" style=simpler patch="simpler"
    src="vox.wav"
    map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s] }
    vol=100 sends=@{hall_bus: 0.35}

  def drums "Studio 808 Kit" style=grid patch="tenuto_808_kit"
    vol=110
    .fx(drum_buss, @{drive: 0.4, boom_amount: 0.5})

  %% 3. Musical Timeline (Strict 4.0-Beat Measure Summation & Double-Dot Modifiers)
  measure 1 {
    saws: [d3 a3 d4 e4 f#4 a4 c#5]:1.ff.stack("octaves").detune(92%, 0.35..0.85).glide(140ms) |
    reese: d1:1.ff.detune(78%, 0.2..0.9).warble(35, 2.5).drive([0.3, 0.85]).glide(140ms) |
    lead: a5:4..ff.zap.vib.detune(75%, 0.3..0.9).haas(10ms) g#5:8.ff.legato f#5:4.ff.legato e5:4.ff.glide(100ms) |
    vox_robot: [f#3 c#4 f#4]:2.f.lyric("sovereign") [e3 b3 e4]:2.f.lyric("system") |
    chops: doin:4.mf r:4 right:4.f r:4 |
    drums: <[ v1: k:4.ff r:4 k:4.ff r:4 | v2: r:4 s:4.ff.pull(10ms) r:4 s:4.ff.pull(10ms) | v3: cr:2.ff oh:8.f ch:8.f oh:8.f ch:8.f ]>
  }

  measure 2 {
    saws: [e3 b3 e4 f#4 g#4 b4 d5]:1.ff.open_voice.detune([0, 95, 20]).gate([1, 0, 1, 1, 0, 1, 0, 1]).pitch_dip(-7) |
    reese: e1:2..ff.filter(180, 950).res(4.5) f#1:4.ff.tapestop |
    lead: f#5:2..ff.pwm(0.75, 4.0).flutter([4, 16]) c#6:4.ff.pre_swell |
    vox_robot: [d3 a3 d4]:2.f.lyric("digital") [c#3 g#3 c#4]:2.f.lyric("future") |
    chops: r:2 doin:8.f doin:8.f right:4.ff |
    drums: <[ v1: (k):3/8 r:4. k:8.ff | v2: r:4 s:4.ff r:4 cp:8.ff s:8.ff | v3: ch:8.f ch:8.p oh:8.f ch:8.f ch:8.f ch:8.p oh:8.f ch:8.f ]>
  }
}
```

### 7.2 Benchmark 2: Symphonic and Microtonal Score

```tenuto
tenuto "6.0" {
  meta @{
    title: "Concertgebouw Elegy",
    tempo: 96,
    time: "4/4",
    key: "D",
    scale: "harmonic_minor",
    scale_lock: false
  }

  return concert_hall "Royal Hall" .fx(reverb, @{decay: 3.8, mix: 1.0})

  def vln1 "First Violins" style=standard patch="violin" vol=102 sends=@{concert_hall: 0.45}
  def vc "Solo Cello" style=standard patch="cello" vol=105 sends=@{concert_hall: 0.40}
  def hn "French Horns" style=standard patch="french_horn" vol=98 sends=@{concert_hall: 0.50}
  def pno "Concert Grand" style=standard patch="salamander_grand" vol=100 sends=@{concert_hall: 0.35}
  def timp "Orchestral Timpani" style=grid patch="timpani" vol=108 sends=@{concert_hall: 0.30}

  measure 1 {
    vln1: d5:4..f.vib f5:8.mf e5:4.mp dqs5:4.p |
    vc: d2:2.f.marc a2:2.mf.ten |
    hn: [d3 f3 a3]:2..mp.pre_swell [c#3 e3 g3 a3]:4.f |
    pno: <[ v1: r:8 a4:8.mf d5:8 f5:8 a5:4 g5:8 f5:8 | v2: [d3 f3 a3]:2 [a2 c#3 e3 g3]:2 ]> |
    timp: timp:4.f r:4 r:2
  }

  measure 2 {
    meta @{ tempo: 76 }
    vln1: c#5:2..mf.vib d5:4.pp |
    vc: a1:2.f d2:2.p |
    hn: [d3 f3 a3 d4]:1.p |
    pno: <[ v1: e5:4..mp d5:8 d5:2.p | v2: [g2 bb2 d3]:2 [d2 a2 d3 f3]:2.pp ]> |
    timp: r:2 timp:4.mp r:4
  }
}
```

---

## 8. Architectural Conclusions and Authoring Recommendations

The engineering synthesis of Tenuto Studio 5 and 6.0 demonstrates that declarative code-first music representation and studio-grade graphical DAW workflows are mutually reinforcing when coupled via a span-aware, bi-directional AST compiler. To maximize audio fidelity, compiler stability, and real-time UI responsiveness when authoring or debugging `.ten` scores, architects and composers should adhere to the following core practices:

* **Prioritize Native Producer Topologies:** Use first-class producer patches (`supersaw`, `reese_bass`, `flutter_pad`, `pluck_lead`, `riser`) with direct track-level attributes (`detune=`, `cutoff=`, `air=`, `duck=`, `width=`, `slop=`) on the `def` declaration.
* **Shape Intra-Note Evolution Declaratively:** Utilize normalized time windows (`.detune(92%, 0.35..0.85)`) and automatic polyphonic `.glide(Nms)` rather than legacy multi-voice automation blocks.
* **Audit Measure Beat Summations & Double-Dots:** Verify prior to compilation that all track lines and `<[ v1 | v2 | v3 ]>` voices sum to exactly $4.00$ quarter-note beats in $4/4$ time, and ensure every dotted duration carrying a modifier uses two consecutive dots (`:4..ff`, `:2..vib`) so rhythmic augmentations are never stripped by the method-chaining lexer.
* **Preserve Karaoke & Polyphony Budgets:** Maintain a clean one-track-per-line structure inside `measure N { ... }` blocks while routing orchestral tracks (`vln1`, `vla`, `vc`, `cb`, `hn`, `fl`, `pno`, `timp`) through shared `return` reverb buses to preserve both the real-time Karaoke token spotlight in the Monaco editor and the 48-voice polyphony budget of the $25\text{ ms}$ audio scheduler.