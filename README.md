<div align="center">
  <img width="1200" height="475" alt="Tenuto Studio 5 Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>𝄆 TENUTO STUDIO 5 𝄇</h1>
  <p><b>Declarative Code-to-Music DAW, Continuous Synthesizer Suite & Bi-Directional Projectional Studio</b></p>

  [![Live Web Studio](https://img.shields.io/badge/Try_Live_Web_Studio-tenuto--studio--5--production.up.railway.app-10b981?style=for-the-badge)](https://tenuto-studio-5-production.up.railway.app/)

  [![Release: v5.2.2](https://img.shields.io/badge/Release-v5.2.2-2563eb.svg)](./SPEC.md)
  [![Grammar Guide: TENUTO_GRAMMAR.md](https://img.shields.io/badge/Grammar_Guide-TENUTO__GRAMMAR.md-10b981.svg)](./TENUTO_GRAMMAR.md)
  [![Platform: macOS .pkg | Windows .exe | Web](https://img.shields.io/badge/Platform-macOS_.pkg_%7C_Windows_.exe_%7C_Web-8b5cf6.svg)](#installation--desktop-packaging)
  [![License: MIT](https://img.shields.io/badge/License-MIT-64748b.svg)](LICENSE)
</div>

---

## Try It Live in Your Browser

Launch **Tenuto Studio 5** immediately in your browser with zero installation:

👉 **[https://tenuto-studio-5-production.up.railway.app/](https://tenuto-studio-5-production.up.railway.app/)**

---

## Overview

**Tenuto Studio 5** (`v5.2.2`) is a bi-directional, code-driven Digital Audio Workstation (DAW) and real-time multi-view player built around the **Tenuto 5.0 / 6.0** domain-specific language (`.ten`).

In Tenuto Studio 5, **human-readable `.ten` source code is the single Source of Truth**:
* **Code Projects the Entire Studio:** Writing or pasting `.ten` code (including raw Markdown blocks straight from Gemini, Claude, or ChatGPT) immediately compiles into four synchronized visual views (**Scrolling Piano Roll**, **Tab / Chord Flow**, **Session View Clip Matrix**, and **Arrangement View Timeline**), three interactive bottom studio docks (**Console Mixer**, **Device Chain & 8-Macro Rack**, and **Context Note/Score Inspector**), and a real-time WebAudio / PCM DSP engine.
* **Every Visual Edit Rewrites Clean Code:** Dragging a note duration on the Piano Roll, adjusting a channel fader or send in the Mixer, tweaking a Macro slider or EQ parameter in the Device Rack, unfolding a Z-axis Bezier automation lane, or clicking a Live 12 MIDI Generator surgically patches the exact character span (`[sourceStartOffset..sourceEndOffset]`) in the `.ten` source editor without stripping `%%` comments or formatting.

* **Live Production Web App:** [**`https://tenuto-studio-5-production.up.railway.app/`**](https://tenuto-studio-5-production.up.railway.app/)
* **Songwriting & Prompt Reference:** [**`TENUTO_GRAMMAR.md`**](./TENUTO_GRAMMAR.md)
* **Formal Language Specification:** [**`SPEC.md`**](./SPEC.md)
* **Multi-Model Composition Case Study:** [**`Case Study.md`**](./Case%20Study.md)

---

## Core Studio Architecture & Features

### 1. Two-Tier Studio Transport & Multi-View Workspace Shell
* **Tier 1 Primary Transport Bar (`Transport.tsx`):**
  * **Built-In Demo Score Selector:** Instant loading of multi-track showcase scores (*Neon Horizon*, *Midnight Patio*, *Glass Cathedral*, and the 60-measure, 16-section *Mahler Symphony No. 6 — Finale*).
  * **Playback & Timing Controls:** **Play / Pause** (`Space`), **Stop**, **Loop**, live **Tap Tempo** (`Tap` — computes interval BPM and updates `meta @{ tempo }` in code), pitched **Metronome Click Track** (`Click` — `1320 Hz` downbeat / `880 Hz` beat), **Count-In** (`No Count-In`, `1 Bar In`, `2 Bars In`, `4 Bars In`), and retroactive **Capture MIDI** (`Capture` — quantizes played notes into a new `4/4` `.ten` measure).
  * **Live Clock, Master Volume, Fullscreen & WAV Bounce:** Real-time BPM readout (tracking piecewise `meta @{ tempo }` changes per measure), Time Signature, `M<Measure>:<Beat>` counter, `0%–200%` Master Volume slider, 1-click **Export WAV**, and a **Fullscreen Studio Toggle (`⛶ Fullscreen`)** with mobile `100dvh` safe-area support and two-finger touchscreen pinch-to-zoom.
* **Tier 2 Studio Navigation Bar:**
  * **Collapsible Code Pane (`◀ Hide .ten Code` / `▶ Show .ten Code`):** Work in 50/50 split-screen or expand the visual DAW views to 100% width.
  * **Global Key & Scale Lock Selectors:** Live Root Key (`C` through `B`) and Scale Mode selectors synced bi-directionally with `meta @{ key, scale }`.
  * **4-Mode Main View Switcher:** Switch between **`Piano Roll`**, **`Tab / Chord Flow`**, **`Session`**, and **`Arrangement`** (or press `Tab` outside text inputs to cycle views).
  * **3-Mode Bottom Studio Dock Switcher:** Toggle **`Dock: Mixer`**, **`Dock: Devices`**, or **`Dock: Inspector`**.
* **Fullscreen Studio Mode & Responsive Mobile Web View (`TDB-742`):**
  * **Cross-Browser & Iframe Fullscreen (`Toggle Fullscreen`):** 1-click `⛶ Fullscreen` / `⤓ Exit Full` button in `Transport.tsx` combining the native Fullscreen API (`requestFullscreen` / `webkitRequestFullscreen`) with a fixed `100dvh` viewport-fill fallback (`tenuto-fullscreen-active`) for embedded webviews and iOS Safari.
  * **Single-Pane Mobile Studio & Mobile Bottom Navigation Bar (`mobile-bottom-nav`):** On mobile phones and narrow viewports (`< 768px`), automatically switches from a side-by-side split to a full-width single-pane mobile layout with a dedicated bottom bar (`Code`, `Roll`, `Tab`, `Session`, `Arrange`, `Mixer`, `FX`, `Inspect`) and touch gestures (1-finger note drag/resize and 2-finger touch pinch-to-zoom).

---

### 2. Theater-Grade Karaoke Code Editor & Debounced Code Memory
* **Custom Tenuto 5.0 / 6.0 Monarch Tokenizer (`CodeEditor.tsx`):** Syntax highlighting for DAW blocks (`tenuto`, `meta`, `def`, `return`, `group`, `scene`, `clip`, `locator`, `groove`, `measure`, `macro`, `repeat`), track headers, scientific & microtonal pitches, rational durations, and chained DSP modifiers.
* **Surgical Core-Note Karaoke Playback Highlighting & Always-Centered Measure Scrolling (`TDB-734` / `TDB-735`):**
  * **Core-Note-Only Token Highlight (`tenuto-karaoke-token-active`):** Highlights strictly the active note/chord and duration token (`d1:1` or `[f#3 c#4 f#4 a4 c#5]:1`) without bleeding into chained `.modifiers(...)`, rests (`r:2`), or `%%` comments.
  * **Track-Line Pulse, Intra-Token Progress Sweep & Always-Centered Measure Scrolling:** Highlights active note/chord tokens (`tenuto-karaoke-token-active`), renders a top **`♫ Now Playing M<N>`** ticker ribbon with `0% -> 100%` progress fills and sung lyrics, and continuously centers the active `measure N { ... }` block (`computeActiveMeasureScrollTarget` via `revealLinesInCenter` / `revealLineInCenter`) in the vertical center of the code editor viewport.
* **Debounced LocalStorage Code Memory (`DebouncedCodeMemory.ts`):**
  * Automatically saves `.ten` code edits to `localStorage` after `500ms` of idle time (`● Saving...` $\rightarrow$ `✓ Saved`), flushes pending edits immediately on window `beforeunload` (fast browser refresh), and provides a 1-click **Reset Memory** button.

---

### 3. Four Synchronized Projectional DAW Views (Right Hemisphere)

#### A. Scrolling Piano Roll View (`WebGPUCanvas.tsx`)
* **Bi-Directional Note Dragging & `Shift + Click` Beat-Wide Pitch Transposition:** Drag any note block vertically to transpose its pitch or drag its right edge to resize its rational `:duration`. Hold **`Shift` + Click** on any pitch row/key (or **`Shift` + Drag** any note) to repitch **all music on that beat across all tracks** simultaneously (`transposeBeatEventsInSource`) with a live ensemble preview and single-step `Cmd/Ctrl + Z` Undo/Redo.
* **Auto-Centered Pitch Grid & Scale Highlighting:** Automatically centers on the active pitch range (minimum 3-octave span), highlights Root Key and in-scale rows, and illuminates notes in emerald green as the playhead crosses them.
* **Mac Trackpad Pinch-to-Zoom & Track Isolation Navigator:** Two-finger pinch-to-zoom (`20%` to `300%`), `-` / `100%` / `+` / **`Fit All`** buttons, **`All Instruments (N)`** toggle, **`Jump to Track (N)...`** dropdown, and `◀` / `▶` scrollable color-coded track pills.
* **Rich Notation Overlays:** Displays `<` and `>` dynamic hairpin wedges on `.cresc` / `.dim` notes, ornament badges (`tr~`, `~`, `pizz`, `𝄐`), sung `.lyric("...")` syllables, and glowing cyan **MPE 3D pitch-bend curves**.
* **Expandable Clip Envelope Drawer (`Clip Env`) & Live 12 `MIDI Tools` Bar:**
  * **MIDI Transformations:** 1-click **`Arpeggiate`**, **`Strum (.arp)`**, **`Connect (.legato)`**, **`Ornament (.vib)`**, and **`Humanize Vel`**.
  * **Scale-Locked MIDI Generators:** 1-click **`+ Gen Stacks`** (diatonic 9th/11th chord progressions), **`+ Gen Seed Melody`**, and **`+ Gen Rhythm`** written directly into `.ten` code in the active Key and Scale.

#### B. Dynamic Code-Driven Tab & Voice-Leading Chord Flow View (`TabChordFlowView.tsx`)
* **Dedicated Per-Instrument 6-String Tab Staves (`instrument-tab-staff-<id>`):** In `All Instruments` mode, every instrument track renders on its own horizontal 6-string Guitar Tab Staff (`E4, B3, G3, D3, A2, E2`) with a sticky left header displaying that instrument's active chord symbol, live per-instrument 6-string fretboard diagram, and 1-click track focus toggle—preventing multi-track orb collisions.
* **Piano-Roll-Parity Pinch-to-Zoom, `Fit All` & Auto-Scroll:** Supports two-finger trackpad pinch-to-zoom (`20%` to `300%`), `-` / `100%` / `+` zoom buttons, 1-click **`Fit All`** (scaling both measure width and staff lane height to fit the viewport), `◀` / `▶` track pill scroll buttons, and real-time horizontal playhead auto-scrolling.
* **Detune/Glide-Only Voice Modulation & Proportional Beat Bars:** Standard notes render as flat, proportional beat-duration bars at their exact MIDI pitch height so every beat is 100% visible at any zoom level (`20%–300%`). Notes only slide or modulate their line when `.detune(...)` (rendering a dual-wave unison detune shimmer envelope across its `start..end` window), `.glide(...)`, or `.mpe(bend)` is explicitly attached.
* **Customizable Guitar Scroll Color Themes & Live Hex Picker (`GUITAR_SCROLL_THEMES`):** Switch the guitar scroll canvas between 6 studio themes (`Sunset Amber`, `Midnight Indigo`, `Emerald Stage`, `Ultraviolet Nebula`, `Crimson Velvet`, `Obsidian Studio`) or pick any custom hex color (`buildCustomGuitarScrollPalette`) to dynamically re-theme the radial backdrop, sticky fretboard headers, and tab fret pills with automatic `localStorage` persistence.
* **240 FPS Web Worker & Frame Pacer Engine (`frame240Worker.ts` / `frame240Engine.ts`):** Offloads `.ten` AST compilation, voice-leading chord extraction, and 6-string guitar tab fret allocation to a background Web Worker while running a 240Hz (`4.166ms` frame budget) lock-free sub-beat playhead interpolator (`data-testid="tab-240fps-worker-badge"`).

#### C. Ableton Session View Clip & Scene Matrix (`SessionView.tsx` & `FollowActionEngine.ts`)
* **2D Track-by-Scene Launch Grid:** Launch individual clips (`▶`), launch full horizontal scene rows (`▶ Scene` with optional scene tempo changes), or stop tracks (`■ Stop`).
* **Quantized Launch Clock & Virtual Measure Scenes:** Configurable launch quantization (`None`, `1/8`, `1/4`, `1/2`, `1/1`, `2 Bars`, `4 Bars`). Scores written purely with linear `measure` blocks automatically synthesize virtual launchable scene rows.
* **Clip Follow Actions & Note Probability:** Supports `@follow @{ bars: 4, actionA: "next", actionB: "any", chanceA: 80, chanceB: 20 }` state-machine transitions (`next`, `prev`, `first`, `last`, `any`, `other`, `play_again`, `stop`), per-note `.chance(N%)`, `.vel_range(low, high)`, `.pick_one` chord groups, and `+ Clip` empty-slot code generation.

#### D. Multi-Track Arrangement View Timeline (`ArrangementView.tsx` & `AutomationLaneEditor.tsx`)
* **Stacked Track Lanes & Collapsible Group Folders:** Horizontal measure timeline with mini-note clip previews, collapsible `Group` buses (`▼` / `▶`), and per-track Fold, Mute (`M`), and Solo (`S`) controls.
* **Interactive Loop Brace & Arrangement Locators:** Set arrangement loop ranges (`Loop Brace: M_start to M_end`), click `⚑ Locator` flags to seek directly to any measure, or click **`+ Locator`** to inject `locator "<Name>" at measure <N>` into `.ten` code.
* **Decoupled Z-Axis Bezier Automation Lanes (`A`):** Clicking `A` on any track header unfolds an interactive SVG curve editor (`AutomationLaneEditor.tsx`) supporting `cutoff`, `volume`, `pan`, `resonance`, `reverb_send`, and `delay_send` across `Linear`, `S-Curve (Bezier)`, `Exponential`, `Logarithmic`, and `Step Hold` shapes, writing `.automate("param", [values], "curve")` directly into `.ten` code.

---

### 4. Three Bi-Directional Bottom Studio Docks

1. **`Dock: Mixer` — Stateless Studio Console (`Mixer.tsx` & `SpatialAudioMatrix.ts`):**
   * **Zero-Clip Compact Channel Strips:** Category filter pills (`All`, `Groups`, `Tracks`, `Returns`), `◀` / `▶` horizontal scroll buttons, and a pinned **`MASTER`** bus meter strip (`-0.9 dBFS Lim`).
   * **Routing & Multi-Point Sidechain Matrix:** Global Sidechain Trigger selector, **Sidechain Tap Point** selector (`Pre-FX`, `Post-FX`, `Post-Mixer`), and **`+ Add Return Bus`** generator.
   * **Sends, Split Stereo Pan & Peak/RMS Metering:** Per-track FX rack (with `FX ↗` button to inspect in Devices), Stereo Pan (`-1..+1`) and Ableton **Split Stereo Pan (`L/R`)**, Send A/B spinbuttons (`0.00..1.00`) with **`Pre`/`Post`** fader tap toggles and `E4001` circular routing protection, Volume fader, dual Peak + RMS level meters with dB readouts, and `M` / `S` / `●` (Arm) buttons.
2. **`Dock: Devices` — Ableton Device Chain & 8-Macro Rack (`DeviceChainDock.tsx`):**
   * **Instrument Card & 1-Click Producer Rigs:** Track selector rail, full categorized Patch Catalog, 1-click Producer Rigs (`Supersaw Drop`, `Reese Sub`, `Ultraviolet Glide`, `Flutter Pad`), active Synth Topology badge, and live SVG ADSR envelope contour.
   * **8-Macro Rack & Macro Presets:** 8 Macro controls (`cutoff`, `resonance`, `osc1_pos`, `unison`, `sub_level`, `attack`, `decay`, `env_to_pos`) with both tactile horizontal drag sliders and numeric spinbuttons, plus 1-click Macro Presets (`warm analog`, `bright lead`, `deep sub`, `heaven supersaw`, `reese sub`, `ultraviolet glide`, `flutter chords`).
   * **Audio FX Device Chain Cards:** Interactive cards for every `.fx(type, @{...})` on the track with live SVG DSP transfer/frequency curves, editable parameter spinbuttons, `✕` remove button, and `+ Append Audio Effect` selector.
3. **`Dock: Inspector` — Dual-Mode Context Note & Global Score Inspector (`Inspector.tsx`):**
   * **Global Score & Microtonal Tuning Mode (when no note is selected):** Edit Project Tempo (BPM), Time Signature, **Microtonal Tuning System** (`12tet`, `just_intonation`, `pythagorean`, `meantone`, `19tet`, `24tet`, `31tet`, `bohlen_pierce`, `slendro`, `pelog`), Session Launch Quantize, and **Global Scale Lock** (`ON` / `OFF`), or click **`Inspect Note #1 →`**.
   * **Surgical Note Inspector Mode:** Step through every note in the score via **`◀ Prev Note`** / **`Next Note ▶`** and edit Duration, Velocity (`0–127` + `pp..ff` presets), Pitch Transpose (`-12`, `-1`, `+1`, `+12`), Articulation, Ornament/Pedal, Dynamic Swell (`< Crescendo`, `> Diminuendo`), `Chance%`, `Pocket ms`, `Detune%`, and Sung Lyric (`.lyric`).

---

### 5. Complete Synthesis, Sampling, SoundFont & Audio FX Engine

#### A. True Continuous Synth Workflow (`ContinuousSynthEngine.ts`)
* **128-Sample Control-Rate (`k-rate`) DSP & Chord Coalescing:** Coalesces simultaneous chord notes on the same synth track into a single shared filter/comb/drive/Haas pass and pre-bakes `AudioBuffer`s before the playback clock starts (`prebakeContinuousSynthTimeline`) for zero-lag realtime playback.
* **Summed Track FX Bus & Bass-Mono Crossover:** Sums all unison and chord voices per track through a `120 Hz` phase-locked bass-mono crossover before running the track's `.fx(...)` chain so chords intermodulate and glue together.
* **Intra-Note Windowed Modulation & 20+ Producer Modifiers:**
  * Target any slice of a sustained note using `start..end` normalized windows (e.g. `.detune(85%, 0.4..0.85)`) or multi-point curves (`.detune([0, 95, 20])`) with raised-cosine edge feathering.
  * **Supported Synth Modifiers:** `.detune()`, `.detune_cents()`, `.filter(startHz, endHz)`, `.cutoff()`, `.res()`, `.glide(ms)` (automatic voice-leading across polyphonic chords), `.stack("octaves" | "fifths" | "seventh" | "super")`, `.flutter()`, `.warble()`, `.pitch_dip()` / `.tapestop`, `.noise(level, "white" | "pink" | "breath", start..end)`, `.sync()`, `.fm()`, `.ring()`, `.pwm()`, `.warp_wave("bend" | "mirror")`, `.keytrack()`, `.comb()`, `.duck()`, `.gate([1,0,1,1,...])`, `.pluck()` / `.zap`, `.haas()`, `.width()`, `.analog_slop()`, `.air()`, `.pre_swell`, `.open_voice` / `.drop2`, `.drive()`, `.ott()`.

#### B. Ableton Flagship Synthesizers & Samplers (`WavetableEngine.ts`, `AbletonSynthSuite.ts`, `SamplerAndDrumRackEngine.ts`)
* **`supersaw`, `reese_bass`, `flutter_pad`, `riser`, `pluck_lead`, `acid_lead`:** Dedicated producer synth patches with shorthand track attributes (`detune=`, `cutoff=`, `resonance=`, `sub=`, `air=`, `duck=`, `width=`, `slop=`, `noise=`).
* **`wavetable`:** Dual morphing 24-harmonic wavetable oscillators across 5 banks (`basic_shapes`, `harmonics`, `digital_pwm`, `vintage_analog`, `formant_vocal`), 6 Unison modes (`classic`, `shimmer`, `noise`, `phase_sync`, `position_spread`), Sub-Oscillator, and Modulation Matrix.
* **`operator`:** 4-Operator FM & Additive synthesizer supporting all 11 routing algorithms (`env=@{algorithm: "4", ratioA: "1.0", ratioB: "3.5", ratioC: "7.0"}`).
* **`meld`, `drift`, `analog`:** Bi-timbral scale-aware swarm oscillators and organic voice-drifting analog subtractive synthesis.
* **`collision`, `tension`, `electric`:** Physical modeling engines using Euler-Bernoulli modal mallet bars (`collision`), Karplus-Strong string waveguides (`tension`), and tine-bell/reed pickups (`electric`).
* **`granulator` & `simpler` (`style=simpler | concrete`):** Granulator III raised-cosine grain clouds (`grain_size`, `density`, `spray`) and named vocal chop slice maps (`map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s] }`) with `.slice(N)`, `.transpose(Nst)`, `.formant(N%)`, and `.reverse`.
* **128-Pad Studio Drum Rack (`style=grid`):** Multi-layer kick, dual-membrane snare, 4-burst flam clap, tuned toms, 6-oscillator metallic bronze hi-hats/cymbals, **Choke Group 1** (closed hi-hat `h`/`ch` chokes open hi-hat `oh`), sampled orchestral `timpani`, and Mahler Wooden Box Hammer (`ham` / `taiko_drum`).

#### C. 128-Instrument MusyngKite HD SoundFont Engine (`SoundfontLibrary.ts`)
* **Persistent Sample Vault (`tenuto-soundfont-vault-v1`):** Streams and caches real multi-sampled recordings for all 128 General MIDI instruments plus 80+ studio aliases (`salamander_grand`, `violin`, `viola`, `cello`, `contrabass`, `orchestral_harp`, `flute`, `oboe`, `english_horn`, `clarinet`, `bassoon`, `french_horn`, `trumpet`, `trombone`, `tuba`, `choir_aahs`, `voice_oohs`, `timpani`, `rhodes`, `harpsichord`, `church_organ`, `vibraphone`, `marimba`, etc.).
* **Concertgebouw Performance Engine:** Features the **Energy-Gated Plateau Looper** (scans 15ms RMS windows to build a 6.5s unbroken Hann-crossfaded sustain buffer excluding MP3 tail silence), **2-Desk Orchestral Section Unison** (uses an independent neighbor-key recording on Desk 2 to eliminate comb filtering), **Deep-Body Legato Seeking** (skips `95ms–125ms` past attack transients on connected phrases), velocity-to-timbre harmonic filtering, and a **2.4-Second 6-Comb + 2-Allpass Amsterdam Concertgebouw Hall Diffuser**.

#### D. 18 Ableton Audio Effects & 20-Band Talking Vocoder (`AbletonAudioFxEngine.ts` & `PhonemeEngine.ts`)
* **Supported `.fx(type, @{...})` Processors:** `eq_eight`, `auto_filter`, `compressor`, `glue_compressor`, `multiband_dynamics` (`ott`), `drum_buss`, `roar`, `saturator`, `hybrid_reverb`, `echo`, `reverb`, `delay`, `chorus`, `auto_shift`, `vocoder`, `spectral_resonator`, `utility`, and `limiter`.
* **20-Band Klatt Formant Talking Vocoder & `.lyric("...")` Engine:** `PhonemeEngine.decomposeLyric()` breaks English syllables into onset consonants (`plosive`, `fricative`, `nasal`, `liquid`), primary/secondary diphthong Klatt vowel formants ($F_1, F_2, F_3$), and coda consonants—allowing chords with `.fx(vocoder).lyric("Harder")` to articulate recognizable words.

---

## Installation & Desktop Packaging

### Option 1A: macOS Desktop App (`.pkg` Installer)

Tenuto Studio 5 packages into a native macOS `.pkg` installer that installs **Tenuto Studio 5.app** into `/Applications`.

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/alec-borman/Tenuto-Studio-5.git
cd Tenuto-Studio-5
npm install

# 2. Build the production bundle and package the macOS .pkg installer
npm run electron:build:mac

# 3. Run the macOS installer
open release/"Tenuto Studio 5-5.2.2-arm64.pkg"
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
start "" "release\Tenuto Studio 5 Setup 5.2.2.exe"
```

### Option 2: Local Web Development

**Prerequisites:** Node.js 20+

```bash
# Install dependencies
npm install

# Start the Vite development server at http://localhost:3000
npm run dev
```

---

## Composing with an AI (Gemini / Claude / ChatGPT)

Copy the prompt below into any LLM chat to generate rich multi-track Tenuto 5.0 / 6.0 scores:

```text
Write a multi-track musical composition in Tenuto 6.0 DSL (.ten) and return ONLY the code inside a single ```tenuto code block.

Follow these strict Tenuto rules:
1. Wrap the score in:
   tenuto "6.0" {
     meta @{ title: "Title", tempo: 124, time: "4/4", key: "D", scale: "harmonic_minor", sidechain: "drums" }
     ...
   }
2. Define instruments using `def <id> "<Name>" style=<standard|synth|grid|simpler> patch="<patch>"`:
   - Acoustic/Orchestral patches (style=standard): "salamander_grand", "rhodes", "violin", "viola", "cello", "contrabass", "string_ensemble_1", "orchestral_harp", "flute", "oboe", "english_horn", "clarinet", "bassoon", "french_horn", "trumpet", "trombone", "tuba", "choir_aahs", "voice_oohs", "timpani".
   - Flagship Synth patches (style=synth): "supersaw", "reese_bass", "flutter_pad", "pluck_lead", "riser", "wavetable", "operator", "meld", "drift", "analog", "collision", "tension", "electric", "granulator" (supports shorthand attributes: detune=85 cutoff=9500 sub=75 air=80 duck=65 width=140 slop=30).
   - Drum Rack (style=grid): patch="tenuto_808_kit" (tokens: k, s, cp, rim, h, ch, oh, lt, mt, ht, cr, rd).
3. Optional DAW blocks: `return <id> "<Name>" .fx(hybrid_reverb, @{decay: 3.5, mix: 1.0})`, `group <id> "<Name>" tracks=[...]`, `groove <id> "<Name>" @{base: "1/16", timing: 35%}`, `locator "<Name>" at measure <N>`.
4. CRITICAL MEASURE MATH: In 4/4 time, every track/voice line inside a single `measure N { ... }` block MUST sum to 4 quarter-note beats (one :1 whole note, two :2 half notes, four :4 quarter notes, eight :8 eighth notes, or sixteen :16 sixteenth notes).
5. Expressive & Continuous Synth Modifiers: .stacc, .marc, .legato, .ped, .arp, .vib, .trill, .mordent, .roll(16), .fermata, .pp..ff, .cresc, .dim, .glide(180ms), .detune(85%, 0.4..0.85), .detune([0, 95, 20]), .filter(400, 8000), .stack("octaves"), .flutter([8, 18]), .warble(30, 2.0), .drive([0.2, 0.85]), .zap, .haas(12ms), .pre_swell, .open_voice, .lyric("Word"), .fx(vocoder).
```

For the full grammar breakdown, see **[`TENUTO_GRAMMAR.md`](./TENUTO_GRAMMAR.md)**.

---

## Language & Modifier Quick Reference

| Category | Syntax Example | Behavior |
| --- | --- | --- |
| **Pitch, Rest & Sticky State** | `c4:8 d e f#4 g:4 r:4` | Scientific pitch (`c4`), microtonal (`aqs4`, `c4+25c`), sticky octave/duration, and rest (`r`) |
| **Chords & Rolled Voicings** | `[d3 a3 d4 f#4]:2.arp.ped.open_voice` | Polyphonic chord with bottom-to-top `.arp` strum, `.ped` sustain, and `.open_voice` drop-2 spread |
| **Polyphonic Voices** | `<[ v1: e5:2 d5:2 | v2: c3:1 ]>` | Independent parallel voices on a single track |
| **Tuplets & Euclidean** | `(c4:8 d e):3/2`, `(k):3/8` | Rational tuplet scaling and Bresenham Euclidean rhythm generation |
| **Windowed Detune & Curves** | `.detune(85%, 0.4..0.85)`, `.detune([0, 95, 20])` | Intra-note windowed unison detune or multi-point smoothstep curve across a single note/chord |
| **Polyphonic Chord Glide** | `[ab2 eb3 c4 g4 c5]:1.glide(180ms)` | Automatically voice-leads every note in a chord along its shortest path into the next chord |
| **Continuous Synth Modifiers** | `.stack("octaves")`, `.filter(400, 9000)`, `.flutter([8, 18])`, `.warble(35, 2)`, `.zap`, `.pre_swell` | Octave/fifth unison stacks, filter sweeps, song-clock LFO flutter, tape warble, transient zap, reverse swell |
| **Classical & Sheet Ornaments** | `~`, `.cresc(40, 120)`, `.dim`, `.vib`, `.trill`, `.mordent`, `.roll(16)`, `.fermata`, `.fp` | Forward ties (`~`), continuous hairpin swells, delayed vibrato, trills, mordents, 32nd tremolos, fermatas |
| **Lyrics & Talking Vocoder** | `[d4 f4 a4]:4.fx(vocoder).lyric("Right")` | G2P consonant/vowel formant decomposition driving the 20-Band Klatt Talking Vocoder |
| **Z-Axis Automation** | `s:1.automate("cutoff", [300, 6400], "s_curve")` | Continuous parameter/CC envelope (`linear`, `s_curve`, `exp`, `log`, `step`) |
| **Probability & MPE** | `.chance(75%)`, `.vel_range(70, 110)`, `.pick_one`, `.mpe(@{bend: [0, 12, 0]})` | Stochastic note probability, humanized velocity ranges, chord pick-one, and 3D MPE expression |

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / Pause score (when focus is outside text inputs) |
| `Tab` | Cycle main studio views (`Piano Roll` $\rightarrow$ `Session` $\rightarrow$ `Arrangement`) |
| `Cmd / Ctrl + Z` | Undo last code, canvas, mixer, device, or inspector mutation |
| `Cmd / Ctrl + Shift + Z` | Redo mutation |
| `Shift + Click / Drag` (Piano Roll) | Repitch all notes and chords on that beat across all tracks to the target pitch |
| `Trackpad Pinch (Ctrl + Wheel)` | Smoothly zoom Piano Roll (`20% – 300%`) |

---

## Repository Architecture & Testing

```text
├── electron/
│   └── main.cjs                              # Electron main process (macOS & Windows, COOP/COEP headers)
├── src/
│   ├── ai/
│   │   ├── LanceDBOrchestrator.ts            # RAG context & Ghost AST patch orchestrator
│   │   └── NeuralSynthesisEngine.ts          # Neural timeline payload mapper
│   ├── audio/
│   │   ├── fx/
│   │   │   └── AbletonAudioFxEngine.ts       # 18 Ableton Audio Effects & 20-Band Talking Vocoder DSP
│   │   ├── synths/
│   │   │   ├── ContinuousSynthEngine.ts      # 128-sample k-rate continuous synth, chord coalescer & 20+ modifiers
│   │   │   ├── WavetableEngine.ts            # Dual-oscillator morphing Wavetable synth & modulation matrix
│   │   │   ├── AbletonSynthSuite.ts          # Operator 4-Op FM, Meld, Drift, Analog, Collision, Tension, Electric
│   │   │   └── SamplerAndDrumRackEngine.ts   # Simpler vocal chop maps, Granulator III & Drum Rack Choke Groups
│   │   ├── StudioAudioEngine.ts              # Lookahead WebAudio scheduler, Concertgebouw hall & WAV exporter
│   │   ├── SoundfontLibrary.ts               # 128-instrument MusyngKite HD loader & Energy-Gated Plateau Looper
│   │   ├── AutomationEngine.ts               # Multi-segment Bezier/exp/log/step .cc() & .automate() compiler
│   │   ├── FollowActionEngine.ts             # Session clip Follow Action & note probability evaluator
│   │   ├── GrooveEngine.ts                   # Non-destructive Ableton Groove Pool swing & humanizer
│   │   ├── MetronomeAndCaptureEngine.ts      # Tap Tempo detector, Metronome scheduler & Capture MIDI quantizer
│   │   ├── PhonemeEngine.ts                  # English G2P tokenizer & Klatt F1/F2/F3 vowel formant table
│   │   └── SpatialAudioMatrix.ts             # bus:// DAG router, E4001 cycle detector & Pre/Post send calculator
│   ├── commands/
│   │   ├── ASTCommand.ts                     # Surgical execute/undo command with mergeKey support
│   │   └── CommandManager.ts                 # Infinite undo/redo stack manager
│   ├── components/
│   │   ├── SplitWorkspace.tsx                # Multi-view studio shell, docks & DebouncedCodeMemory controller
│   │   ├── Transport.tsx                     # Two-tier responsive transport, view switcher & dock bar
│   │   ├── CodeEditor.tsx                    # Monaco editor with Theater-Grade Karaoke spotlight & ribbon
│   │   ├── WebGPUCanvas.tsx                  # Pinch-zoom Piano Roll, Track Navigator, Clip Env & MIDI Tools bar
│   │   ├── TabChordFlowView.tsx              # Live Code Chord analyzer, voice-leading orbs & 6-string Guitar tab
│   │   ├── SessionView.tsx                   # 2D Ableton Session View clip/scene launcher & Follow Action UI
│   │   ├── ArrangementView.tsx               # Multi-track timeline, Group folders, Locators & Loop Brace
│   │   ├── AutomationLaneEditor.tsx          # Interactive SVG Bezier/multi-segment Z-axis curve editor
│   │   ├── Mixer.tsx                         # Console Mixer with Peak/RMS meters, Split Pan, Sends & Master bus
│   │   ├── DeviceChainDock.tsx               # Ableton Device Chain, 8-Macro drag sliders & SVG DSP curves
│   │   └── Inspector.tsx                     # Dual-mode Note & Global Score/Tuning Inspector with note stepper
│   ├── mutator/
│   │   ├── TopologicalMutator.ts             # Span-exact bi-directional AST token & mixer/device code mutator
│   │   └── MidiTransformAndGeneratorEngine.ts# Live 12 MIDI Transformations & scale-locked pattern generators
│   ├── parser/
│   │   ├── DocumentParser.ts                 # Full Tenuto 5.0/6.0 compiler, LLM sanitizer & span tracker
│   │   ├── ASTSerializer.ts                  # Modifier & windowed modulation physics serializer
│   │   ├── IncrementalCompiler.ts            # Real-time incremental compiler bridge
│   │   ├── PitchEngine.ts                    # 22 scales, 11 microtonal tunings, Scala .scl & quarter-tones
│   │   └── TemporalEngine.ts                 # Exact rational duration & sticky rhythm engine
│   ├── presets/
│   │   └── presetScores.ts                   # Built-in multi-track showcase & Mahler 6 Finale scores
│   └── utils/
│       └── DebouncedCodeMemory.ts            # 500ms debounced localStorage persistence & beforeunload flush
├── tests/                                    # 56 Vitest unit & integration test suites
├── electron-builder.json                     # macOS (.pkg) and Windows (NSIS .exe) build configuration
├── TENUTO_GRAMMAR.md                         # Songwriting grammar & LLM composer prompt guide
├── Case Study.md                             # Multi-model iterative refinement & diff composition case study
├── SPEC.md                                   # Canonical Tenuto 5.0.0 language specification
└── README.md
```

### Running Verification Suites

```bash
# TypeScript type check
npm run lint

# Run all 56 Vitest unit & integration test suites
npx vitest run

# Build production bundle
npm run build
```

---

## Release Notes (`v5.2.2`)

* **`v5.2.2`:** Added a dedicated 240 FPS Web Worker (`src/workers/frame240Worker.ts`) and 240Hz Frame Pacer (`src/utils/frame240Engine.ts`) to keep the interface locked at 240 FPS (`4.166ms` frame budget) during live compilation and high-speed tab/chord scrolling, alongside Fullscreen Studio Mode (`Toggle Fullscreen` with native Fullscreen API + `tenuto-fullscreen-active` iframe/iOS fallback), a responsive Mobile Web View (`100dvh` dynamic viewport, single-pane mobile switching, and `mobile-bottom-nav` bar), and mobile touch gestures on the Piano Roll.
* **`v5.2.0`:** Added customizable Guitar Scroll color themes (`GUITAR_SCROLL_THEMES`: `Sunset Amber`, `Midnight Indigo`, `Emerald Stage`, `Ultraviolet Nebula`, `Crimson Velvet`, `Obsidian Studio`) and a live custom hex color picker (`buildCustomGuitarScrollPalette`) in `TabChordFlowView.tsx` with `localStorage` persistence, alongside detune-only tab voice modulation, proportional beat-duration bars, and Fullscreen / mobile touch pinch-to-zoom support.
* **`v5.1.8`:** Added `Shift + Click` and `Shift + Drag` beat-wide pitch transposition on the Piano Roll (`transposeBeatEventsInSource` in `TopologicalMutator.ts`, `WebGPUCanvas.tsx`, and `SplitWorkspace.tsx`), allowing users to repitch all notes and chords on a beat across all melodic tracks in one click or drag.
* **`v5.1.6`:** Fixed `TabChordFlowView.tsx` so low-register instruments (`Bb0` sub-bass, `Bb1` cellos/violas) always render fretted dots on their fretboard diagrams (`computeGuitarVoicing` octave folding), mapped per-instrument trajectory lines to true continuous MIDI pitch (`trackMidiToY`) for 100% melodic accuracy, and eliminated text overlap at the playhead and sticky track headers.
* **`v5.1.4`:** Added bi-directional Piano Roll click-and-drag note editing in `WebGPUCanvas.tsx`, `SplitWorkspace.tsx`, and `TopologicalMutator.ts`—supporting vertical semitone pitch dragging (for single notes, sticky-octave notes, and individual voices within chords), 1/16th-quantized horizontal duration resizing, live optimistic drag previews, and `CommandManager` Undo/Redo integration.
* **`v5.1.0`:** Upgraded `TabChordFlowView.tsx` with dedicated per-instrument 6-string Tab Staff lanes (`instrument-tab-staff-<trackId>`), per-track sticky fretboard headers, string/fret allocation (`allocateNotesToTabStrings`), trackpad pinch-to-zoom (`20%–300%`), `- / 100% / +` and `Fit All` zoom controls, `◀ / ▶` instrument pill scroll buttons, and horizontal playhead auto-scrolling.
* **`v5.0.8`**: Always-centered active measure playback scrolling in `CodeEditor.tsx` (`computeActiveMeasureScrollTarget` + `revealLinesInCenter` / `revealLineInCenter`), keeping the currently playing `measure N { ... }` block dead-center in the Monaco viewport at all times.
* **`v5.0.6`**: Comprehensive `README.md` overhaul documenting the complete Tenuto 6.0 DAW workspace, 4 projectional views (`Piano Roll`, `Tab / Chord Flow`, `Session`, `Arrangement`), 3 bottom studio docks (`Mixer`, `Devices`, `Inspector`), Surgical Core-Note Karaoke code spotlight, 500ms debounced `localStorage` code memory, 128-sample `k-rate` `ContinuousSynthEngine` with 20+ intra-note modifiers, Ableton Flagship Synth/Sampler/FX Suite, 20-Band Talking Vocoder, and 128-instrument MusyngKite HD SoundFont engine.
* **`v5.0.4`**: True multi-instrument voice-leading trajectories, exact playhead orb-to-line lock (`evaluateTrackedEventMidiAtWhole`), and all-instrument selector pills in `TabChordFlowView`.

---

## License

MIT License — Copyright (c) 2026 Alec Borman.