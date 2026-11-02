<div align="center">
  <img width="1200" height="475" alt="Tenuto Studio 5 Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>𝄆 TENUTO STUDIO 5 𝄇</h1>
  <p><b>Declarative Code-to-Music DAW, Multi-Engine Synthesizer Suite & Bi-Directional Projectional Studio</b></p>

  [![Live Web Studio](https://img.shields.io/badge/Try_Live_Web_Studio-tenuto--studio--5--production.up.railway.app-10b981?style=for-the-badge)](https://tenuto-studio-5-production.up.railway.app/)

  [![Release: v5.6.8](https://img.shields.io/badge/Release-v5.6.8-2563eb.svg)](./SPEC.md)
  [![Grammar Guide: TENUTO_GRAMMAR.md](https://img.shields.io/badge/Grammar_Guide-TENUTO__GRAMMAR.md-10b981.svg)](./TENUTO_GRAMMAR.md)
  [![Composition Manual](https://img.shields.io/badge/Composition_Guide-Definitive_Manual-f59e0b.svg)](./Definitive%20Guide%20to%20Tenuto%20Composition.md)
  [![Platform: macOS .pkg | Windows .exe | Web](https://img.shields.io/badge/Platform-macOS_.pkg_%7C_Windows_.exe_%7C_Web-8b5cf6.svg)](#installation--desktop-packaging)
  [![License: MIT](https://img.shields.io/badge/License-MIT-64748b.svg)](LICENSE)
</div>

---

## Try It Live in Your Browser

Launch **Tenuto Studio 5** immediately in your browser with zero installation:

👉 **[https://tenuto-studio-5-production.up.railway.app/](https://tenuto-studio-5-production.up.railway.app/)**

---

## What is Tenuto Studio 5?

**Tenuto Studio 5 (`v5.6.8`)** is a bi-directional, code-driven Digital Audio Workstation (DAW), multi-engine synthesizer workstation, and real-time scrolling score player built around the **Tenuto 5.0 / 6.0** domain-specific language (`.ten`).

In Tenuto Studio 5, **human-readable `.ten` source code is the single Source of Truth**:

1. **Text Projects the Entire Studio:** Writing or pasting `.ten` code (including raw Markdown blocks straight from Gemini, Claude, or ChatGPT) immediately compiles into **four synchronized visual viewports** (**Scrolling Piano Roll**, **6-String Guitar Tab & Chord Flow**, **Session View Clip Matrix**, and **Arrangement View Timeline**), **three interactive bottom studio docks** (**Console Mixer**, **Device Chain & 8-Macro Rack**, and **Context Note/Score Inspector**), and a **64-bit WebAudio / Web Worker PCM synthesis engine**.
2. **Every Visual Edit Rewrites Clean Code:** Dragging a note or chord on the Piano Roll, adjusting a channel fader or pre/post send in the Mixer, tweaking a Macro slider or EQ parameter in the Device Rack, unfolding a Z-axis Bezier automation lane, or clicking a Studio MIDI Generator surgically patches the exact character span (`[sourceStartOffset..sourceEndOffset]`) in the `.ten` source editor without stripping `%%` comments or formatting.
3. **Universal Open-Source Synthesis & Interoperability:** Native pure-MIT implementations of **Studio Continuous Analog/Hybrid Synths**, **SuperCollider (`scsynth`) UGen graphs (`sc:*`)**, **Eurorack Macro-Oscillators & Modal Resonators (`mi:*`)**, **Electro-Smith DaisySP & Stanford CCRMA STK Physical Waveguides (`daisy:*`, `stk:*`)**, **Soundpipe / IRCAM Chant FOF / Casio CZ Phase-Distortion (`sp:*`)**, **128-Instrument General MIDI HD SoundFonts**, and 1-click export to **`.wav`**, **SuperCollider (`.scd`)**, **Strudel / TidalCycles (`.strudel`)**, **MusicXML 4.0 (`.musicxml`)**, and **Faust (`.dsp`)**.

* **Live Production Web App:** [**`https://tenuto-studio-5-production.up.railway.app/`**](https://tenuto-studio-5-production.up.railway.app/)
* **Definitive Composition & DSP Manual:** [**`Definitive Guide to Tenuto Composition.md`**](./Definitive%20Guide%20to%20Tenuto%20Composition.md)
* **Songwriting & Prompt Reference:** [**`TENUTO_GRAMMAR.md`**](./TENUTO_GRAMMAR.md)
* **Formal Language Specification:** [**`SPEC.md`**](./SPEC.md)

---

## Key Capabilities at a Glance

| Pillar | Highlights |
| :--- | :--- |
| **Multi-Engine Synthesis** | **70+ Native Synth & Physical Modeling Topologies:** Studio Continuous Analog/Hybrid (`supersaw`, `morph_analog_12`, `binaural_hybrid_20`, `west_coast_200`, `ribbon_cluster_8`, `tape_nostalgia_pad`), SuperCollider UGen graphs (`sc:*`), Eurorack Plaits/Rings/Clouds (`mi:*`), DaisySP & Stanford STK Waveguides (`daisy:*`, `stk:*`), Soundpipe/Chant FOF/Casio CZ (`sp:*`), 4-Op FM (`operator`), Wavetable (`wavetable`), Granular (`granulator`), and 128-Instrument HD SoundFonts. |
| **38 Studio & Mastering FX** | **Track, Group, Return & Inline Note FX:** 20-Band Klatt Talking Vocoder (`vocoder`), Signalsmith 4x4 Hadamard FDN Reverb/Stretch/Chorus (`signalsmith_*`), Airwindows (`aw_galactic`, `aw_totape6`, `aw_console7`, `aw_pressure4`), Jon Dattorro Figure-8 Plate (`dattorro_plate`), PaulStretch (`paulstretch`), ChowTape hysteresis (`chow_tape`), Gated Reverb, Tape Degrade, OTT Multiband Dynamics, and 7 Mastering Outboard Processors. |
| **4 Projectional Views** | **Piano Roll** (bi-directional drag, `Shift+Click` beat-wide transpose, MPE curves, MIDI Tools), **Tab / Chord Flow** (per-instrument 6-string tab staves, live chord symbol & fretboard analyzer, 6 color themes + hex picker, 9:16 portrait stage), **Session View** (quantized clip/scene launcher & Follow Actions), and **Arrangement View** (stacked lanes, Group folders, Locators, Z-axis Bezier automation lanes). |
| **Zero-Reflow Karaoke Editor** | Custom Monaco `.ten` language mode with surgical core-note playback spotlighting (`tenuto-karaoke-token-active`), a `♫ Now Playing M<N>` progress ticker ribbon, always-centered active measure scrolling, and `500ms` debounced `localStorage` persistence (`DebouncedCodeMemory`). |
| **VSync-Locked Audio & Video** | Multi-worker off-main-thread synth baking (`VoiceBakePool` + circular `VoicePcmRingBuffer`), `128`-sample `k-rate` control blocks, monotonic Bluetooth/hardware latency guard, and automatic `60Hz–480Hz` native monitor VSync refresh calibration (`useDisplayRefreshRate`). |
| **Universal Export** | 1-click export to **16-bit Stereo `.wav`**, **SuperCollider `.scd`** (`SynthDef` + `Pbind` + binary OSC 1.1 bundles), **Strudel / TidalCycles `.strudel`**, **MusicXML 4.0 `.musicxml`** (with `DemarcationEngine` physics pruning), and **Faust `.dsp`**. |

---

## Multi-Engine Synthesizer & Acoustic Catalog

Tenuto Studio 5 unifies six synthesis and acoustic paradigms under a single declarative syntax (`def <id> "<Name>" style=<style> patch="<patch>"`):

### 1. Studio Continuous Analog, Hybrid & West Coast Synths (`style=synth`)
Evaluated in **128-sample Control-Rate (`k-rate`) blocks** with pre-humanization chord coalescing, asymmetric Golden-Ratio unison detune offsets (`ASYM_3` / `ASYM_7`) that prevent phase-cancellation dropouts, and a `120 Hz` Mid/Side bass-mono crossover:
* **Producer Flagships:** `"supersaw"` (7-voice asymmetric unison + sub), `"reese_bass"` (3 wide-detuned saws + phase-locked sub), `"flutter_pad"` (tempo-synced LFO filter pad), `"pluck_lead"`, `"saw_lead"`, `"acid_lead"`, `"riser"`.
* **Virtual Analog & Hybrid Polysynths:** `"morph_analog_12"` (triangle wavefolder + Steiner-Parker drive + A/B state `.morph()` + `.touch_travel()`), `"vintage_ladder_8"` (discrete transistor mixer drive `.discrete_drive()` + dual ladder filters), `"hybrid_motor_12"` (through-zero 4-quadrant VCA $360^\circ$ `.spin()`), `"binaural_hybrid_20"` (true Left/Right ear voice split `.binaural(14c)`), `"state_variable_8"`, `"vintage_poly_10"`, `"stepped_wavetable_24"`, `"spectral_hybrid_16"`, `"granular_workstation_80"`.
* **Hauntology, Ribbon Cluster & West Coast:** `"tape_nostalgia_pad"` (3-voice 30%-bent triangle + 900 Hz 4-pole LP + `.wow_flutter()` + `.vowel()`), `"ribbon_cluster_8"` (8-oscillator continuous pitch-spread `.swarm()`), `"west_coast_200"` / `"cybernetic_eoc"` (harmonic wavefolder `.fold()` + Vactrol Low-Pass Gate `.lpg("both", 380ms)` + End-of-Cycle `.eoc_cycle(5)`).
* **Ableton Flagship Suite:** `"wavetable"` (5 banks, 6 unison modes), `"operator"` (4-Op FM/Additive, 11 algorithms), `"meld"`, `"drift"`, `"analog"`, `"collision"`, `"tension"`, `"electric"`, `"granulator"`.

### 2. SuperCollider (`scsynth`) UGen-Graph Suite (`style=scsynth` or `style=synth`)
12 pure-MIT UGen topologies with inline `.rlpf(cutoff, res)`, `.dfm1(cutoff, res)`, `.moog_ff(cutoff, res)`, and `.klank(mode, decayPct)` modifiers, binary OSC 1.1 `/s_new` packet encoding, and standalone `.scd` export:
* `"sc:default"`, `"sc:prophet"`, `"sc:tb303"`, `"sc:jp8000"`, `"sc:modal_bell"`, `"sc:klank_resonator"`, `"sc:dx7_brass"`, `"sc:formant_choir"`, `"sc:karplus_pluck"`, `"sc:gendy_stochastic"`, `"sc:pulsar_train"`, `"sc:hoover"`.

### 3. Eurorack Macro-Oscillator & Modal Resonator Suite (`style=eurorack` or `style=synth`)
12 pure-MIT Eurorack models (`Plaits` Green/Red banks, `Rings` sympathetic strings, and `Clouds` granular texture diffuser) with internal Vactrol LPG coupling and inline `.timbre()`, `.harmonics()`, `.morph()`, `.structure()`, `.damping()`, and `.position()` modifiers:
* `"mi:plaits_va"`, `"mi:plaits_waveshaper"`, `"mi:plaits_fm"`, `"mi:plaits_grain"`, `"mi:plaits_additive"`, `"mi:plaits_swarm"`, `"mi:plaits_chord"`, `"mi:plaits_speech"`, `"mi:plaits_karplus"`, `"mi:plaits_modal"`, `"mi:rings_sympathetic"`, `"mi:clouds_texture"`.

### 4. Electro-Smith DaisySP & Stanford CCRMA STK Waveguides (`style=daisy` or `style=stk`)
16 physical modeling and vocal-formant engines with inline `.jawari(pct)` curved-bridge buzz, `.breath(pct)` turbulence, `.jet(pct)` embouchure delay, and `.bow(pressurePct, posPct)` friction controls:
* **DaisySP:** `"daisy:vosim"`, `"daisy:formant"`, `"daisy:harmonic"`, `"daisy:variable_saw"`, `"daisy:zosc"`, `"daisy:string_voice"`, `"daisy:modal_voice"`, `"daisy:drip"`.
* **Stanford STK:** `"stk:flute"`, `"stk:clarinet"`, `"stk:blown_bottle"`, `"stk:brass"`, `"stk:bowed"`, `"stk:sitar"`, `"stk:stif_karp"`, `"stk:banded_wg"`.

### 5. Soundpipe / Csound Heritage DSP Suite (`style=soundpipe`)
8 classical computer-music synthesis algorithms with inline `.pdhalf(pct)` Casio CZ phase-distortion skew, `.gbuzz(pct)` closed-form harmonic brightness, and `.fof("a"|"e"|"i"|"o"|"u")` IRCAM Chant vocal formants:
* `"sp:fof_choir"`, `"sp:gbuzz"`, `"sp:pdhalf"`, `"sp:widesaw"`, `"sp:bar_model"`, `"sp:drip_water"`, `"sp:bitcrush_lead"`, `"sp:jitter_pad"`.

### 6. 128-Instrument General MIDI HD SoundFonts, Vocal Simpler & 128-Pad Drum Rack
* **`style=standard` (128 GM HD SoundFonts):** Streams and caches multi-sampled recordings (`tenuto-soundfont-vault-v1`) with an **Energy-Gated Plateau Looper** (6.5s seamless Hann-crossfaded orchestral sustain), **2-Desk Orchestral Section Unison** (neighbor-key decorrelation), and **Deep-Body Legato Seeking** (`95ms–125ms` past bow/breath transients).
* **`style=simpler` / `style=concrete`:** Named time-slice maps (`map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s] }`) with `.slice(N)`, `.transpose(Nst)`, `.formant(N%)`, and `.reverse`.
* **`style=grid` (`patch="tenuto_808_kit"`, `"timpani"`, `"taiko_drum"`):** Multi-layer kick (`k`), dual-membrane snare (`s`), 4-burst flam clap (`cp`), rimshot (`rim`), tuned toms (`lt`, `mt`, `ht`), 6-oscillator bronze cymbals (`cr`, `rd`), and **Choke Group 1** hi-hats (`h`/`ch` chokes `oh`).

---

## 38 Studio, Algorithmic & Mastering Audio Effects (`.fx`)

Attach `.fx(<type>, @{ <params> })` to any `def` track, `group` bus, `return` bus, or individual note/chord:

* **Core Studio & Creative FX:** `eq_eight`, `auto_filter`, `compressor`, `glue_compressor`, `multiband_dynamics` (`ott`), `drum_buss`, `roar`, `saturator`, `hybrid_reverb`, `gated_reverb`, `tape_degrade`, `echo`, `reverb`, `delay`, `chorus`, `phaser`, `flanger`, `auto_shift`, `vocoder` (20-Band Klatt Formant Talking Vocoder driven by `.lyric("...")`), `spectral_resonator`, `utility`, `limiter`.
* **MIT Signalsmith, Airwindows, Dattorro, PaulStretch & ChowDSP Suite:**
  * `signalsmith_reverb` (4x4 Hadamard FDN stereo diffuser), `signalsmith_stretch` (formant-preserving dual-grain pitch shifter), `signalsmith_chorus` (quadrature 4-tap detuned chorus).
  * `aw_galactic` (12-stage super-ambient diffuser), `aw_totape6` (magnetic head-bump & hysteresis saturator), `aw_console7` (`sin`/`asin` console bus summing), `aw_pressure4` (vari-mu mewiness compressor).
  * `dattorro_plate` (Jon Dattorro 1997 CCRMA figure-8 tank plate reverb), `paulstretch` (stochastic-phase extreme ambient time-stretcher), `chow_tape` (physical magnetic hysteresis & playhead gap-loss processor).
  * **Inline Per-Note FX Shorthands:** `.galactic(45%)`, `.dattorro(38%)`, `.paulstretch(4.0)`, `.totape(50%)`, `.fdn_reverb(40%)`.
* **Virtual Mastering Outboard Stack:** `transformer_color_adc`, `dual_bus_silk_sum`, `fet_fast_limiter`, `vari_mu_tube_comp`, `mastering_clip_limiter`, `spectral_pitch_harmonizer`, `true_stereo_hall_reverb`.

---

## Four Projectional Views & Three Studio Docks

### 1. Two-Tier Transport & VSync Telemetry Header (`Transport.tsx`)
* **Tier 1:** Built-in Demo Score Selector (including *Neon Horizon*, *Architecture of Voltage & Gesture*, *The Crucible of Voltage & Gesture*, *The MIT Open-Source Synth & Waveguide Symphony*, and the 60-measure *Mahler Symphony No. 6 — Finale*), **Play / Pause** (`Space`), **Stop**, **Loop**, **Tap Tempo**, **Metronome Click Track**, **Count-In** (`0–4 Bars`), **Capture MIDI**, live BPM / Time Signature / `M<Bar>:<Beat>` / `<N> Hz` VSync badge, Master Volume (`0%–200%`), **1-Click Offline Pre-Download (`⬇ Pre-Download`)**, **Export `.wav` / `.scd` / `.strudel` / `.musicxml`**, **Rotate Portrait 9:16** (`393×852` logical / `1179×2556` physical `3x`), and **Fullscreen (`⛶ Fullscreen`)**.
* **Tier 2:** Collapsible `.ten` Code Editor toggle, Global **Key & Scale Lock** selectors, **Main View Switcher** (`Piano Roll` | `Tab / Chord Flow` | `Session` | `Arrangement`), and **Bottom Studio Dock Switcher** (`Mixer` | `Devices` | `Inspector`).

### 2. Zero-Reflow Karaoke Code Editor (`CodeEditor.tsx`)
* Highlights strictly the active core note/chord and duration token (`tenuto-karaoke-token-active`) with zero font-weight or character-width reflow, displays a locked `32px` **`♫ Now Playing M<N>`** progress ribbon, automatically keeps the active `measure N { ... }` centered in the viewport, and persists edits via `DebouncedCodeMemory` (`500ms` debounce + immediate `beforeunload` flush).

### 3. Four Synchronized Visual Viewports
* **Scrolling Piano Roll (`WebGPUCanvas.tsx`):** Bi-directional vertical pitch drag & right-edge duration resize, **`Shift + Click / Drag`** beat-wide multi-track transposition, track isolation pills, trackpad/touch pinch-to-zoom (`20%–300%`), MPE curves, Clip Envelope drawer, and **MIDI Tools** (`Arpeggiate`, `Strum`, `Connect`, `Ornament`, `Humanize`, `Negative Harmony`, `+ Gen Stacks`, `+ Gen Seed Melody`, `+ Gen Rhythm`, `+ Gen Krell`).
* **Tab & Voice-Leading Chord Flow (`TabChordFlowView.tsx`):** Dedicated per-instrument 6-string guitar tab staves, live chord symbol & 6-string fretboard analyzer (with sub-bass octave folding), detune shimmer waves, 6 studio color themes + custom hex picker, locked vertical stage geometry (`data-vertical-lock="true"`), playback auto-hide top bar, and a full-bleed 9:16 vertical portrait stage (`Clean HUD`).
* **Session View Clip Matrix (`SessionView.tsx`):** 2D track-by-scene launcher with quantized launch (`None` to `4 Bars`), virtual measure scene synthesis, and A/B probability Follow Actions.
* **Arrangement View Timeline (`ArrangementView.tsx`):** Multi-track timeline with collapsible Group folders, clickable `⚑ Locators`, Loop Brace, and unfoldable Z-axis SVG Bezier automation lanes (`AutomationLaneEditor.tsx`).

### 4. Three Bottom Studio Docks
* **`Dock: Mixer` (`Mixer.tsx`):** Category filters (`All`, `Groups`, `Tracks`, `Returns`), Global Sidechain Trigger & Tap Point (`Pre-FX`, `Post-FX`, `Post-Mixer`), `+ Add Return Bus`, per-track FX badges (`FX ↗`), Stereo & Split `L/R` Pan, Pre/Post Sends with `E4001` cycle detection, Volume faders, Peak/RMS meters, and Master Bus strip.
* **`Dock: Devices` (`DeviceChainDock.tsx`):** Track selector rail, full categorized Patch Catalog (including `sc:*`, `mi:*`, `daisy:*`, `stk:*`, `sp:*`), 1-click Producer Rigs, live SVG ADSR contour, 8-Macro Rack with presets, and interactive FX Device Cards.
* **`Dock: Inspector` (`Inspector.tsx`):** Global Score & Microtonal Tuning settings (`12tet`, `just_intonation`, `pythagorean`, `meantone`, `19tet`, `24tet`, `31tet`, `bohlen_pierce`, `slendro`, `pelog`, `non_octave_alpha/beta/gamma`) when idle, or surgical note editing (`◀ Prev Note` / `Next Note ▶`) when a note is selected.

---

## Language & Modifier Quick Reference

| Category | Syntax Example | Behavior |
| :--- | :--- | :--- |
| **Pitch, Rest & Sticky State** | `c4:8 d e f#4 g:4 r:4` | Scientific pitch (`c4`), microtonal (`aqs4`, `c4+25c`), sticky octave/duration, and rest (`r`) |
| **Dotted Duration + Modifiers** | `a4:2..mp.legato.vib` | Always write **two dots (`..`)** when attaching a modifier to a dotted duration (`:2.`, `:4.`, `:8.`) |
| **Chords & Voicing Physics** | `[d3 a3 d4 f#4]:2.arp.ped.open_voice` | Polyphonic chord with `.arp` strum, `.ped` sustain, `.open_voice` drop-2 spread, or `.rootless` |
| **Parallel Planing & Neg. Harmony** | `b3:2.plane("m9").rootless.neg_harm` | Expands root into locked chord intervals (`m9`, `maj9`, `dom9`, `sus4`, `quartal`, `quintal`) and reflects across tonic-dominant axis |
| **Polyphonic Voices & Tuplets** | `<[ v1: e5:2 d5:2 \| v2: c3:1 ]>`, `(c4:8 d e):3/2`, `(k):3/8` | Independent parallel voices, rational tuplets, and Bresenham Euclidean rhythms |
| **Strudel Pattern Combinators** | `fast 2 { c4:4 e4:4 }`, `slow 2 { c4:2 g4:2 }`, `rev { c4:8 e g b }`, `.ply(2)`, `.degrade(25%)` | Cycle compression/repetition (`fast`), stretching (`slow`), token reversal (`rev`), re-triggers (`.ply`), and stochastic drop (`.degrade`) |
| **Windowed Modulation & Glide** | `.detune(75%, 0.2..0.85)`, `.filter(600, 4200)`, `.glide(180ms)` | Intra-note windowed/curve modulation and automatic polyphonic chord voice-leading portamento |
| **Gesture, Ratchet & EOC Cyber** | `.ratchet(3, "up")`, `.eoc_cycle(5).fold(75%).lpg("both", 380ms)`, `.squeeze(90%).bend_voice(1, 50c, 0.2..0.8)` | Step ratcheting, autonomous West Coast Krell EOC cycling, Vactrol LPG, and 3D MPE inner-voice bending |
| **MIT Synth & Waveguide Modifiers** | `.timbre(72%)`, `.structure(68%)`, `.damping(82%)`, `.jawari(75%)`, `.breath(65%)`, `.jet(54%)`, `.bow(75%, 35%)`, `.pdhalf(78%)`, `.gbuzz(72%)`, `.fof("a")`, `.rlpf(2400, 1.8)`, `.dfm1(1800, 2.6)` | Inline macro & physical-modeling controls for `mi:*` (Plaits/Rings), `stk:*` (Sitar/Flute/Bowed), `sp:*` (CZ/GBuzz/Chant FOF), and `sc:*` (SuperCollider UGen filters) |
| **Inline Note-FX Shorthands** | `.galactic(45%)`, `.dattorro(38%)`, `.paulstretch(4.0)`, `.totape(50%)`, `.fdn_reverb(40%)` | Per-note Airwindows Galactic reverb, Dattorro figure-8 plate, PaulStretch spectral freeze, ToTape6 hysteresis, and Signalsmith Hadamard FDN reverb |

For the complete grammar specification and stylistic blueprints, see **[`TENUTO_GRAMMAR.md`](./TENUTO_GRAMMAR.md)** and **[`Definitive Guide to Tenuto Composition.md`](./Definitive%20Guide%20to%20Tenuto%20Composition.md)**.

---

## Installation & Desktop Packaging

### Option 1A: macOS Desktop App (`.pkg` Installer)

Tenuto Studio 5 packages into a native macOS `.pkg` installer that installs **Tenuto Studio 5.app** into `/Applications`:

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/alec-borman/Tenuto-Studio-5.git
cd Tenuto-Studio-5
npm install

# 2. Build the production bundle and package the macOS .pkg installer
npm run electron:build:mac

# 3. Run the macOS installer
open release/"Tenuto Studio 5-5.6.8-arm64.pkg"
```

### Option 1B: Windows Desktop App (`.exe` NSIS Setup Installer)

On Windows (x64), Tenuto Studio 5 packages into a standard `.exe` Setup Wizard that installs **Tenuto Studio 5** and creates Desktop and Start Menu shortcuts:

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/alec-borman/Tenuto-Studio-5.git
cd Tenuto-Studio-5
npm install

# 2. Build the production bundle and package the Windows .exe installer
npm run electron:build:win

# 3. Launch the generated Setup .exe inside the release/ folder
start "" "release\Tenuto Studio 5 Setup 5.6.8.exe"
```

### Option 2: Local Web Development & Verification

**Prerequisites:** Node.js 20+

```bash
# Install dependencies
npm install

# Start the Vite development server at http://localhost:3000
npm run dev

# Purge unreferenced paste dumps / bloat artifacts
npm run clean:bloat

# Run TypeScript type-checking and all 68 Vitest test suites
npm run lint
npx vitest run

# Build production bundle & pack repository snapshot using repomix.config.json
npm run build
npx repomix
```

---

## Keyboard Shortcuts & F12 Diagnostics

| Shortcut / Command | Action |
| :--- | :--- |
| `Space` | Play / Pause score (when focus is outside text inputs) |
| `Tab` | Cycle main studio views (`Piano Roll` $\rightarrow$ `Session` $\rightarrow$ `Arrangement`) |
| `Escape` | Exit Fullscreen or Vertical 9:16 Portrait stage mode |
| `Cmd / Ctrl + Z` | Undo last code, canvas, mixer, device, or inspector mutation |
| `Cmd / Ctrl + Shift + Z` | Redo mutation |
| `Shift + Click / Drag` (Piano Roll) | Repitch all notes and chords on that beat across all tracks to the target pitch |
| `Trackpad Pinch (Ctrl + Wheel)` | Smoothly zoom Piano Roll or Tab Flow (`20% – 300%`) |
| `__TENUTO_DIAG__.summary()` (F12 Console) | Prints full real-time audio signal, worker bake, ring buffer, and measure coverage telemetry |

---

## Repository Architecture

```text
├── electron/
│   └── main.cjs                              # Electron main process (macOS & Windows, COOP/COEP, uncapped VSync)
├── src/
│   ├── ai/
│   │   ├── LanceDBOrchestrator.ts            # RAG context & Ghost AST patch orchestrator
│   │   └── NeuralSynthesisEngine.ts          # Neural timeline payload mapper
│   ├── audio/
│   │   ├── daisy/
│   │   │   └── DaisyStkEngine.ts             # Electro-Smith DaisySP (daisy:*) & Stanford STK (stk:*) waveguides
│   │   ├── eurorack/
│   │   │   └── MutablePlaitsEngine.ts        # Eurorack Plaits, Rings & Clouds (mi:*) macro/modal engines
│   │   ├── export/
│   │   │   └── StrudelAndMusicXmlExporter.ts # Strudel (.strudel), MusicXML 4.0 (.musicxml) & Faust (.dsp) exporters
│   │   ├── fx/
│   │   │   └── AbletonAudioFxEngine.ts       # 38 Studio, Signalsmith, Airwindows, Dattorro & Mastering FX + Vocoder
│   │   ├── scsynth/
│   │   │   └── SuperColliderEngine.ts        # 12 SuperCollider (sc:*) UGen synths, OSC 1.1 encoder & .scd exporter
│   │   ├── soundpipe/
│   │   │   └── SoundpipeEngine.ts            # Soundpipe / IRCAM Chant FOF / Casio CZ phase-distortion (sp:*)
│   │   ├── synths/
│   │   │   ├── ContinuousSynthEngine.ts      # 128-sample k-rate continuous synth, chord coalescer & 40+ modifiers
│   │   │   ├── renderContinuousVoicePcm.ts   # Pure stereo PCM voice + FX renderer with DC blocker & NaN sanitizer
│   │   │   ├── WavetableEngine.ts            # Dual-oscillator morphing Wavetable synth & modulation matrix
│   │   │   ├── AbletonSynthSuite.ts          # 4-Op FM, Bi-Timbral Macro, Drift Analog, Mallet & String Synths
│   │   │   └── SamplerAndDrumRackEngine.ts   # Vocal chop slice maps, Granular Clouds & Drum Rack Choke Groups
│   │   ├── AudioRingBuffer.ts                # Fixed-capacity VoicePcmRingBuffer & power-of-2 StereoDelayRingBuffer
│   │   ├── VoiceBakePool.ts                  # Multi-worker off-main-thread synth voice rendering pool
│   │   ├── PlaybackDiagnostics.ts            # Real-time F12 DevTools signal, worker, ring & timeline telemetry
│   │   ├── StudioAudioEngine.ts              # Lookahead WebAudio scheduler, Symphonic hall & WAV exporter
│   │   ├── SoundfontLibrary.ts               # 128-instrument General MIDI HD loader & Energy-Gated Plateau Looper
│   │   ├── AutomationEngine.ts               # Multi-segment Bezier/exp/log/step .cc() & .automate() compiler
│   │   ├── FollowActionEngine.ts             # Session clip Follow Action & note probability evaluator
│   │   ├── GrooveEngine.ts                   # Non-destructive Groove Pool swing & humanizer
│   │   ├── MetronomeAndCaptureEngine.ts      # Tap Tempo detector, Metronome scheduler & Capture MIDI quantizer
│   │   ├── PhonemeEngine.ts                  # English G2P tokenizer & Klatt F1/F2/F3 vowel formant table
│   │   └── SpatialAudioMatrix.ts             # bus:// DAG router, E4001 cycle detector & Pre/Post send calculator
│   ├── commands/                             # ASTCommand & CommandManager (Infinite Undo/Redo)
│   ├── components/                           # SplitWorkspace, Transport, CodeEditor, 4 Views & 3 Studio Docks
│   ├── mutator/                              # TopologicalMutator & MidiTransformAndGeneratorEngine
│   ├── parser/                               # DocumentParser, ASTSerializer, IncrementalCompiler, Pitch/Temporal
│   ├── presets/
│   │   └── presetScores.ts                   # Built-in multi-track showcase, MIT Symphony & Mahler 6 Finale scores
│   └── utils/                                # DebouncedCodeMemory, useDisplayRefreshRate & usePlaybackAutoHideTopBar
├── tests/                                    # 68 Vitest unit & integration test suites
├── Definitive Guide to Tenuto Composition.md # Complete grammar, DSP physics & 6 stylistic blueprints manual
├── TENUTO_GRAMMAR.md                         # Songwriting grammar & LLM composer prompt guide
├── SPEC.md                                   # Canonical Tenuto 5.0.0 language specification
├── electron-builder.json                     # macOS (.pkg) and Windows (NSIS .exe) build configuration
├── repomix.config.json                       # Repomix configuration excluding paste dumps & build artifacts
└── README.md
```

---

## Release Notes (`v5.6.8`)

### Latest Releases

* **`v5.6.8` (Current):** Synchronized `TENUTO_GRAMMAR.md`, `Definitive Guide to Tenuto Composition.md`, and `README.md` with the complete MIT Open-Source Synthesis & Waveguide catalog (`sc:*`, `mi:*`, `daisy:*`, `stk:*`, `sp:*`), all 38 `.fx(...)` processors (`signalsmith_*`, `aw_*`, `dattorro_plate`, `paulstretch`, `chow_tape`), Strudel pattern combinators (`fast`, `slow`, `rev`, `.ply`, `.degrade`), and updated AI Composer master prompts; added inline SuperCollider UGen filter/resonator modifiers (`.rlpf(cutoff, res)`, `.dfm1(cutoff, res)`, `.moog_ff(cutoff, res)`, `.klank(mode, decayPct)`) in `ASTSerializer.ts`; and hardened `fast N { ... }` / `slow N { ... }` sticky-duration inheritance in `DocumentParser.ts`.
* **`v5.6.6`:** Added first-class `.ten` DSL inline modifiers, Strudel pattern combinators (`fast N { ... }`, `slow N { ... }`, `rev { ... }`, `.ply(N)`, `.degrade(pct)`), track-header macro shorthands (`timbre=`, `harmonics=`, `morph=`, `structure=`, `damping=`, `position=`, `breath=`, `jet=`, `jawari=`), and the built-in showcase score *"The MIT Open-Source Synth & Waveguide Symphony (SC + Plaits/Rings + STK + Soundpipe)"* (`mit_open_source_symphony`): wired `.timbre()`, `.harmonics()`, `.structure()`, `.damping()`, and `.position()` into `MutablePlaitsEngine.ts`; wired `.jawari()`, `.breath()`, `.jet()`, and `.bow()` into `DaisyStkEngine.ts`; wired `.pdhalf()`, `.gbuzz()`, and `.fof()` into `SoundpipeEngine.ts`; added inline note-FX shorthands (`.galactic()`, `.dattorro()`, `.paulstretch()`, `.totape()`, `.fdn_reverb()`) in `ASTSerializer.ts` and `AbletonAudioFxEngine.ts`; and updated the Monaco syntax highlighter (`CodeEditor.tsx`).
* **`v5.6.2`:** Added MIT **Signalsmith DSP 4x4 Hadamard FDN Reverb, Spectral Pitch Stretch & Quadrature Chorus (`signalsmith_reverb`, `signalsmith_stretch`, `signalsmith_chorus`)** in `AbletonAudioFxEngine.ts`, plus **Strudel / TidalCycles Mini-Notation (`.strudel`), MusicXML 4.0 Partwise Engraving (`.musicxml`), and Faust Functional DSP (`.dsp`) Score Exporters** (`src/audio/export/StrudelAndMusicXmlExporter.ts`): wired `DemarcationEngine` into `compileScoreToMusicXml` to prune unprintable DSP physics prior to XML engraving serialization; added 1-click **`Export .strudel`** (`export-strudel-btn`) and **`Export .musicxml`** (`export-musicxml-btn`) buttons to `Transport.tsx` and `SplitWorkspace.tsx`; registered Signalsmith FX defaults in `DeviceChainDock.tsx`; and documented the new FX processors in `Definitive Guide to Tenuto Composition.md`.

<details>
<summary><b>View Earlier Releases (v5.0.4 – v5.5.8)</b></summary>

<br />

* **`v5.5.8`:** Added a 100% MIT-licensed **Eurorack Macro-Oscillator & Modal Resonator Suite (`mi:*` — Plaits / Rings / Clouds)** (`src/audio/eurorack/MutablePlaitsEngine.ts`) and hardened `SuperColliderEngine.ts` with 1st-order DC blocking: implemented 12 pure-MIT Eurorack patches (`mi:plaits_va`, `mi:plaits_waveshaper`, `mi:plaits_fm`, `mi:plaits_grain`, `mi:plaits_additive`, `mi:plaits_swarm`, `mi:plaits_chord`, `mi:plaits_speech`, `mi:plaits_karplus`, `mi:plaits_modal`, `mi:rings_sympathetic`, `mi:clouds_texture`, plus `style=eurorack` / `style=modular` / `style=plaits`) with internal Vactrol Low-Pass Gate (`LPG`) coupling, `HARMONICS` / `TIMBRE` / `MORPH` macro routing, `PhonemeEngine` formant integration, and 1st-order `R = 0.998` DC-blocking high-pass filters across both `MutablePlaitsEngine` and `SuperColliderEngine`; wired `MutablePlaitsEngine` into `ContinuousSynthEngine.ts`, `AbletonSynthSuite.ts`, `SoundfontLibrary.ts`, and the `DeviceChainDock.tsx` patch catalog; and documented the `mi:*` suite in `Definitive Guide to Tenuto Composition.md`.
* **`v5.5.6`:** Added a 100% MIT-licensed **SuperCollider (`scsynth`) UGen-Graph Synthesis Engine, Binary OSC 1.1 Packet Encoder, and `.scd` (`sclang` `SynthDef` + `Pbind`) Score Exporter** (`src/audio/scsynth/SuperColliderEngine.ts`): implemented 12 canonical SuperCollider UGen-graph patches (`sc:default`, `sc:prophet`, `sc:tb303`, `sc:jp8000`, `sc:modal_bell`, `sc:klank_resonator`, `sc:dx7_brass`, `sc:formant_choir`, `sc:karplus_pluck`, `sc:gendy_stochastic`, `sc:pulsar_train`, `sc:hoover`, plus `style=scsynth` / `style=supercollider` / `style=superdirt` and `sonic-pi-*` aliases) with zero GPL/AGPL dependencies; added RFC-compliant binary OSC 1.1 `/s_new` message and `#bundle` NTP timetag packet encoding (`encodeOscSNewMessage`, `encodeOscTimedBundle`, `buildScoreOscBundles`); wired `SuperColliderEngine.renderUGenVoiceIntoStereo` into `ContinuousSynthEngine.ts` for both real-time lookahead playback and offline 44.1 kHz `.wav` rendering; added the **`SuperCollider UGen Synths (scsynth)`** patch group to `DeviceChainDock.tsx`; and added a 1-click **`Export .scd`** button (`export-scd-btn`) to `Transport.tsx` and `SplitWorkspace.tsx`.
* **`v5.5.4`:** Added automatic native monitor refresh-rate detection (`60Hz / 75Hz / 90Hz / 120Hz / 144Hz / 165Hz / 240Hz / 360Hz+`) and a VSync-locked sub-quantum playhead engine: created `src/utils/useDisplayRefreshRate.ts` (`estimateRefreshRateFromDeltas`, `snapToStandardRefreshRate`, `useDisplayRefreshRate`) using a trimmed-mean VSync frame-delta estimator that auto-calibrates on startup, window resize, and cross-monitor moves; removed the legacy `30 FPS` (`32ms`) and `60 FPS` (`16.66ms`) visual throttling gates in `StudioAudioEngine.ts` in favor of phase-locked sub-quantum playhead interpolation against `AudioContext.currentTime`; tightened the Piano Roll horizontal auto-scroll deadband in `WebGPUCanvas.tsx` from `6px` to `0.25px` for micro-stutter-free high-refresh scrolling; added a live `<N> Hz` VSync telemetry badge (`display-refresh-rate-badge`) to the `Transport.tsx` clock bar; and unlocked high-refresh Chromium rendering in `electron/main.cjs` (`disable-frame-rate-limit`).
* **`v5.5.2`:** Eliminated Monaco code editor line-wrap jitter during playback and recalibrated default multi-track audio headroom: enforced zero-reflow horizontal glyph width on `.tenuto-karaoke-token-active` (`font-weight: inherit !important`, `box-shadow: inset 0 -2px 0 #34d399`), enabled `wrappingStrategy: 'simple'` and `fontLigatures: false` in `CodeEditor.tsx`, locked the karaoke ticker ribbon height (`32px`) and desktop top toolbars so wrapped code lines never re-wrap or jump during playback; and lowered default Master Volume to `80%`, recalibrated `masterGain` (`0.48x` into a fast `2ms` `-2.4 dB` `12:1` limiter), reduced SoundFont sample scaling (`2.1 -> 0.85`) and prebaked synth voice gain (`0.58x`), and removed duplicate pre-DSP amplitude boosts in `AbletonAudioFxEngine.computeRealtimeChainModulation` for clean, un-clipped multi-track playback out of the box.
* **`v5.5.0`:** Added a monotonic playhead anti-flicker guard for Bluetooth/hardware `outputLatency` jitter, decoupled offline `.wav` exports from opening a live hardware `AudioContext`, and fixed real-time synth release-tail cutouts, whole-bar sidechain volume crushing, binaural/7-voice unison phase cancellation, and `tape_degrade` comb filtering: locked baseline hardware latency per session with a monotonic playhead floor in `StudioAudioEngine.ts` so Bluetooth A2DP buffer renegotiations never cause the visual playhead or screen to flicker backward; used `OfflineAudioContext` during WAV exports when no live context is active; passed `totalFrames` (including `releaseTailSec`) into `ContinuousSynthEngine.renderVoiceIntoTrackStem` and enabled 20-band `vocoder` processing inside `renderContinuousVoicePcm.ts`; anchored both Left (`u=0`) and Right (`u=1`) fundamental oscillators in binaural mode (`binaural_hybrid_20`) and bounded 7-voice side-oscillator weights (`<= 0.96` total vs `1.55` center) in `ContinuousSynthEngine.ts`; prevented `.squeeze()`, `.touch_travel()`, `.lpg()`, and `.vowel()` from pinching barline transitions or overwriting `.filter()` sweeps; made `tape_degrade` phase-coherent in `AbletonAudioFxEngine.ts`; and scaled static sidechain ducking by note duration while routing `reverbSendGain` to `reverbSendBus` for live prebaked voices.
* **`v5.4.8`:** Eliminated polyphonic Vocoder pre-filter intermodulation buzz, 24 Hz grain-boundary clicking in `spectral_pitch_harmonizer`, and premature whole-note `.glide(ms)` pitch sliding: removed pre-filter `Math.tanh` nonlinear intermodulation distortion in `AbletonAudioFxEngine.applyTalkingVocoderToSlice`, tightened formant filter selectivity (`qDamp = 0.055..0.075`), and added a `3600 Hz` vocal-tract low-pass roof filter so 4-note `.fx(vocoder)` chords sound warm and un-clipped; upgraded `spectral_pitch_harmonizer` to a Dual-Head 50%-Overlap Hann-Windowed Pitch Shifter with linear sample interpolation; and locked `.glide(ms)` timing in `ContinuousSynthEngine.ts` to `glideStartU = Math.max(0.65, 1.0 - glideSec / durSec)` (with `±5` semitone auto-chord voice-leading clamping) so long whole notes hold pitch rock-steady until the exact final `glideMs` window.
* **`v5.4.6`:** Eliminated Vocoder `+19.2 dB` resonator clipping, unison/bass-mono $180^\circ$ phase cancellation, periodic DSP volume cutouts, barline phase collisions, and master compressor pumping, and added unified single-buffer web playback (`renderScoreToStereoPcm`) + 1-click offline score pre-caching (`⬇ Pre-Download`): unity-gain-normalized the 3 Chamberlin SVF formant bandpass filters (`qDamp1/2/3`) in `AbletonAudioFxEngine.applyTalkingVocoderToSlice` with `35%` dry harmonic body blend, weighted the center unison fundamental at `1.55` vs `0.42` side oscillators (`ContinuousSynthEngine.ts`) and replaced L+R mono bass summing with a Mid/Side `< 120 Hz` Side-only high-pass crossover (`applyTrackBassMonoCrossover`) so sustained pads and `reese_bass` never cancel to `0.0`, calibrated un-parameterized `patch="flutter_pad"` from a 65% 12 Hz volume chop to an 8% 3.2 Hz shimmer, prevented whole-note `.legato` / `.glide()` synth voices from overrunning barlines by `1.08x` (+267ms), recalibrated the master bus (`0.92x` headroom, `-1.2 dB` / `3:1` mastering limiter), and added **`⬇ Pre-Download`** (`predownload-score-btn` / `predownloadAndCacheScore`) to pre-fetch SoundFont banks and master the full stereo mix buffer for zero-CPU single-`AudioBufferSourceNode` web playback.
* **`v5.4.4`:** Fixed web and desktop real-time playback dropouts across simple sketches and the 30-measure *"Crucible of Voltage & Gesture"* stress test: added synchronous `unlockAudioContext()` user-gesture unlocking before async worklet/sample initialization, guarded `ensureContext()` so `rebuildMasterChain()` only builds the master bus and impulse response once per `AudioContext`, fixed `foldMultilineDeclarations` in `DocumentParser.ts` when continuation lines begin with `group=` or `groove=` and folded multi-line `.fx(...)` chains onto `group` buses, capped `PlaybackOrchestrator` at 255 events without throwing or yielding per-note microtasks, applied track/event `.fx(...)` chains (including the 20-Band Talking Vocoder) to real-time prebaked synth buffers, upgraded polyphony management to a 128-voice duration-aware pool, fixed lookahead Drum Rack hi-hat choke timing (`oh` -> `ch`), and throttled visual playhead updates while restricting `TabChordFlowView` `clipPath` updates to playhead-straddling notes.
* **`v5.4.2`:** Standardized all user-facing UI labels, synth engine display specifications, preset scores, `TENUTO_GRAMMAR.md`, and `README.md` onto vendor-neutral acoustic and electrical-engineering terminology (`morph_analog_12`, `vintage_ladder_8`, `hybrid_motor_12`, `binaural_hybrid_20`, `state_variable_8`, `vintage_poly_10`, `stepped_wavetable_24`, `spectral_hybrid_16`, `granular_workstation_80`, `west_coast_200`, `ribbon_cluster_8`, `tape_nostalgia_pad`, `cybernetic_eoc`, `.tri_fold()`, `.steiner_drive()`, `.discrete_drive()`, `.touch_travel()`, `.eoc_cycle()`, `non_octave_alpha/beta/gamma`, `transformer_color_adc`, `dual_bus_silk_sum`, `fet_fast_limiter`, `vari_mu_tube_comp`, `mastering_clip_limiter`, `spectral_pitch_harmonizer`, `true_stereo_hall_reverb`) while preserving backwards-compatible parser and DSP aliases.
* **`v5.4.0`:** Added 10 Virtual Analog, Hybrid & West Coast Synthesizer Topologies (`morph_analog_12`, `vintage_ladder_8`, `hybrid_motor_12`, `binaural_hybrid_20`, `state_variable_8`, `vintage_poly_10`, `stepped_wavetable_24`, `spectral_hybrid_16`, `granular_workstation_80`, `west_coast_200`), 9 circuit & 3D MPE modifiers (`.lpg("both" | "vca" | "lp", decayMs)` vactrol low-pass gate, `.tri_fold(pct)`, `.steiner_drive(pct)`, `.discrete_drive(pct)`, `.binaural(cents)`, `.spin(rateHz)` $360^\circ$ 4-quadrant VCA rotation, `.morph()`, `.touch_travel()`, and `.aliasing()`), and 7 digitally controlled analog studio outboard FX processors (`transformer_color_adc`, `dual_bus_silk_sum`, `fet_fast_limiter`, `vari_mu_tube_comp`, `mastering_clip_limiter`, `spectral_pitch_harmonizer`, `true_stereo_hall_reverb`), alongside inner-loop waveshaper hoisting in `ContinuousSynthEngine.ts` and rolling `AudioBuffer` eviction behind the playhead in `prebakeContinuousSynthTimeline` (`StudioAudioEngine.ts`).
* **`v5.3.8`:** Completed the *Architecture of Voltage & Gesture* synthesis and compositional research suite and resolved multi-measure synth playback dropouts: added asymmetric Golden-Ratio unison detune offsets (`ASYM_3` / `ASYM_7`) with center-fundamental weighting to eliminate $180^\circ$ phase-cancellation nulls on long pad/Reese holds, pre-humanization polyphonic chord coalescing, rolling lookahead JIT `AudioBuffer` prebaking (`prebakeContinuousSynthTimeline`), 450ms scheduler lookahead with in-buffer offset recovery for late sustained notes, explicit note-filter keytrack bypass on sub-bass sweeps, horizontal-whitespace track-label parsing in `DocumentParser.ts`, span-gated Monaco karaoke decorations, dual-LFO `.wow_flutter` + `.fx(tape_degrade)`, Negative Harmony (`.neg_harm`), EOC cybernetic cycling (`.eoc_cycle(N)`), and the `"Architecture of Voltage & Gesture"` showcase preset scores.
* **`v5.3.6`:** Purged 56 unreferenced `public/assets/aistudio/Paste_*` chat-paste files and 6 unreferenced root dump artifacts (reducing repository size by ~784,000 tokens with zero code loss), added `repomix.config.json` and `.gitignore` rules, and added automated bloat-purge protection in `vite.config.ts` and `npm run clean:bloat` alongside the Voltage & Gesture synth engine expansion (`.ratchet`, `ribbon_cluster_8`, `tape_nostalgia_pad`, `.vowel`, `.plane`, `.rootless`, `.fold`, `.squeeze`, `.bend_voice`, `non_octave_alpha`, `gated_reverb`, `clampCurveWindowBeforeGlide`).
* **`v5.3.2`:** Restored native mobile long-press `Paste` popup callout support (`userSelect: 'text'`, `WebkitTouchCallout: 'default'`, and direct `onPaste` handling) on the `.ten` code editor `<textarea>` for mobile browsers, and added a one-tap **`📋 Paste .ten`** clipboard button (`paste-ten-code-btn` / `stage-paste-ten-btn`).
* **`v5.3.0`:** Added automatic top-bar hiding when playback starts (`data-topbar-hidden="true"`), revealing the top bar during playback only when the mouse moves over the top bar zone (`top-bar-hover-zone`) or when the touchpad is scrolled (`wheel` event), and locked the Top Hero Chord Banner, Measure Timeline Strip, and per-track Header Ribbons to fixed pixel heights with single-line `truncate` rules to eliminate vertical playback bounce.
* **`v5.2.8`:** Dedicated 100% of the vertical 9:16 portrait (`393×852`) and Fullscreen interface exclusively to the Guitar Tab or Piano Roll scroll view (eliminating all DAW headers, docks, sub-toolbars, and scrollbars), added an always-visible `↺ Undo Rotation` button (`undo-rotation-btn`) and `✕ Exit Fullscreen (Esc)` button (`exit-fullscreen-btn`), and wired global `Escape` key exit support.
* **`v5.2.6`:** Reimagined the vertical 9:16 portrait (`393×852` / `1179×2556`) and Fullscreen guitar tab UI for vertical video capture with a 100% full-bleed 6-string tab highway (eliminating the `212px` left blocker card in portrait mode), tall vertical string spacing, non-overlapping compact toolbars, and a `Clean HUD` mode.
* **`v5.2.4`:** Added a Rotate Viewport button (`Rotate Portrait 9:16`) that switches the Tenuto Studio 5 interface into a vertical 9:16 portrait layout (`393×852` logical / `1179×2556` physical `3x` resolution) across both standard and Fullscreen modes with `localStorage` persistence.
* **`v5.2.2`:** Added Fullscreen Studio Mode (`Toggle Fullscreen` with native Fullscreen API + `tenuto-fullscreen-active` iframe/mobile fallback), a responsive Mobile Web View (`100dvh` dynamic viewport, single-pane mobile switching, and `mobile-bottom-nav` bar), and mobile touch gestures (1-finger touch note dragging and 2-finger touch pinch-to-zoom) on the Piano Roll.
* **`v5.2.0`:** Added customizable Guitar Scroll color themes (`GUITAR_SCROLL_THEMES`: `Sunset Amber`, `Midnight Indigo`, `Emerald Stage`, `Ultraviolet Nebula`, `Crimson Velvet`, `Obsidian Studio`) and a live custom hex color picker (`buildCustomGuitarScrollPalette`) in `TabChordFlowView.tsx` with `localStorage` persistence, alongside detune-only tab voice modulation, proportional beat-duration bars, and Fullscreen / mobile touch pinch-to-zoom support.
* **`v5.1.8`:** Added `Shift + Click` and `Shift + Drag` beat-wide pitch transposition on the Piano Roll (`transposeBeatEventsInSource` in `TopologicalMutator.ts`, `WebGPUCanvas.tsx`, and `SplitWorkspace.tsx`), allowing users to repitch all notes and chords on a beat across all melodic tracks in one click or drag.
* **`v5.1.6`:** Fixed `TabChordFlowView.tsx` so low-register instruments (`Bb0` sub-bass, `Bb1` cellos/violas) always render fretted dots on their fretboard diagrams (`computeGuitarVoicing` octave folding), mapped per-instrument trajectory lines to true continuous MIDI pitch (`trackMidiToY`) for 100% melodic accuracy, and eliminated text overlap at the playhead and sticky track headers.
* **`v5.1.4`:** Added bi-directional Piano Roll click-and-drag note editing in `WebGPUCanvas.tsx`, `SplitWorkspace.tsx`, and `TopologicalMutator.ts`—supporting vertical semitone pitch dragging (for single notes, sticky-octave notes, and individual voices within chords), 1/16th-quantized horizontal duration resizing, live optimistic drag previews, and `CommandManager` Undo/Redo integration.
* **`v5.1.0`:** Upgraded `TabChordFlowView.tsx` with dedicated per-instrument 6-string Tab Staff lanes (`instrument-tab-staff-<trackId>`), per-track sticky fretboard headers, string/fret allocation (`allocateNotesToTabStrings`), trackpad pinch-to-zoom (`20%–300%`), `- / 100% / +` and `Fit All` zoom controls, `◀ / ▶` instrument pill scroll buttons, and horizontal playhead auto-scrolling.
* **`v5.0.8`:** Always-centered active measure playback scrolling in `CodeEditor.tsx` (`computeActiveMeasureScrollTarget` + `revealLinesInCenter` / `revealLineInCenter`), keeping the currently playing `measure N { ... }` block dead-center in the Monaco viewport at all times.
* **`v5.0.6`:** Comprehensive `README.md` overhaul documenting the complete Tenuto 6.0 DAW workspace, 4 projectional views (`Piano Roll`, `Tab / Chord Flow`, `Session`, `Arrangement`), 3 bottom studio docks (`Mixer`, `Devices`, `Inspector`), Surgical Core-Note Karaoke code spotlight, 500ms debounced `localStorage` code memory, 128-sample `k-rate` `ContinuousSynthEngine` with 20+ intra-note modifiers, Studio Flagship Synth/Sampler/FX Suite, 20-Band Talking Vocoder, and 128-instrument General MIDI HD SoundFont engine.
* **`v5.0.4`:** True multi-instrument voice-leading trajectories, exact playhead orb-to-line lock (`evaluateTrackedEventMidiAtWhole`), and all-instrument selector pills in `TabChordFlowView`.

</details>

---

## License

MIT License — Copyright (c) 2026 Alec Borman.
```
