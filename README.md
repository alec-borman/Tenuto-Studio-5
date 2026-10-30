<div align="center">
  <img width="1200" height="475" alt="Tenuto Studio 5 Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>𝄆 TENUTO STUDIO 5 𝄇</h1>
  <p><b>Declarative Code-to-Music DAW, Continuous Synthesizer Suite & Real-Time Visual Player</b></p>

  [![Live Web Studio](https://img.shields.io/badge/Try_Live_Web_Studio-tenuto--studio--5--production.up.railway.app-10b981?style=for-the-badge)](https://tenuto-studio-5-production.up.railway.app/)

  [![Release: v5.0.6](https://img.shields.io/badge/Release-v5.0.6-2563eb.svg)](./SPEC.md)
  [![Grammar Guide: TENUTO_GRAMMAR.md](https://img.shields.io/badge/Grammar_Guide-TENUTO__GRAMMAR.md-10b981.svg)](./TENUTO_GRAMMAR.md)
  [![Platform: Web | macOS .pkg | Windows .exe](https://img.shields.io/badge/Platform-Web_%7C_macOS_.pkg_%7C_Windows_.exe-8b5cf6.svg)](#installation--setup)
  [![License: MIT](https://img.shields.io/badge/License-MIT-64748b.svg)](LICENSE)
</div>

---

## Try It Live in Your Browser

Launch **Tenuto Studio 5** immediately in your browser with zero installation:

👉 **[https://tenuto-studio-5-production.up.railway.app/](https://tenuto-studio-5-production.up.railway.app/)**

---

## Overview

**Tenuto Studio 5 (`v5.0.6`)** is a declarative code-driven Digital Audio Workstation (DAW), continuous synthesizer suite, and real-time multi-view player built around the **Tenuto 5.0 / 6.0** domain-specific language (`.ten`).

Write a score directly in the editor—or ask an AI model like Gemini, Claude, or ChatGPT to compose a multi-track piece—paste the text into Tenuto Studio 5, and press **Play** (`Space`) to hear it rendered in real time or exported to a mastered stereo `.wav` or `.mid` file.

* **Live Production Web App:** [**`https://tenuto-studio-5-production.up.railway.app/`**](https://tenuto-studio-5-production.up.railway.app/)
* **Songwriting & Prompt Reference:** [**`TENUTO_GRAMMAR.md`**](./TENUTO_GRAMMAR.md)
* **Formal Language Specification:** [**`SPEC.md`**](./SPEC.md)

---

## Core Features (`v5.0.6`)

### 1. Multi-View Studio Workspace & Surgical Karaoke Code Highlighting
* **Left Pane — Syntax-Highlighted `.ten` Editor with Debounced Memory & Surgical Note Highlighting:**
  * Built on Monaco Editor (`tenuto-dark` theme) with a **500ms debounced `localStorage` code memory** (`● Saving...` -> `✓ Saved`) that automatically preserves and restores your active code across browser refreshes.
  * **Surgical Core-Note Karaoke Highlighting (`TDB-734`):** During playback, highlights strictly the active note/chord and duration token (`d1:1` or `[f#3 c#4 f#4 a4 c#5]:1`) without bleeding into `.modifier()` chains, rests (`r:2`), or `%%` comments.
* **Right Pane — 4-View Studio Viewport (`Tab` Switchable):**
  * **Scrolling Piano Roll View:** Auto-centers on the active octave span, supports macOS trackpad pinch-to-zoom (`20%–300%`) and `Fit All`, isolates any track in 1 click, and provides Ableton Live 12 **MIDI Transformations & Scale-Locked Generators**.
  * **Tab / Voice-Leading Chord Flow View:** Dynamically detects the live chord symbol (`Dmaj7`, `Bm7`, `A♭maj7`, `E♭/G`), renders scrolling per-instrument voice-leading trajectories with glowing playhead orbs locked onto every line, and displays a real-time 6-string `GUITAR` fretboard diagram.
  * **Session View (Clip & Scene Matrix):** 2D track-by-scene launch matrix with quantized launching and stochastic **Follow Actions**.
  * **Arrangement View (Multi-Track Timeline):** Horizontal track lanes, collapsible **Group** folders, clickable **Locators**, **Loop Brace**, and expandable Z-axis **Bezier Automation Lanes**.
* **Bottom Studio Dock (`Mixer` | `Devices` | `Inspector`):**
  * **Stateless Console Mixer:** Peak/RMS dB level meters, Stereo & Split Stereo (`L/R`) Pan, Pre/Post-Fader Sends (`bus://` DAG), Group strips, and Master bus.
  * **Device Chain & 8-Macro Rack:** Visual ADSR/DSP transfer curves, 1-click producer rig presets, and horizontal drag faders.
  * **Context Note & Score Inspector:** Surgical bi-directional editing for pitch transpose, duration, velocity, articulation, ornaments, probability (`%`), detune (`%`), and `.lyric("...")`.

### 2. True Continuous Synthesizer Workflow & 20 Producer Sound-Design Modifiers
* **Native Producer & Ableton Flagship Synths (`style=synth`):** `supersaw` (7-voice free-running detuned stack + sub + `120 Hz` bass-mono crossover + air sheen), `reese_bass`, `flutter_pad`, `pluck_lead`, `acid_lead`, `riser`, `wavetable`, `operator` (4-Op FM), `meld`, `drift`, `analog`, `collision`, `tension`, `electric`, and `granulator` (Granulator III).
* **Intra-Note Windowed Detune & Modulation:** Detune or modulate only a specific slice of a sustained note using sub-note windows (`.detune(85%, 0.35..0.85)`) or multi-point curves (`.detune([0, 95, 15])`) with raised-cosine edge feathering.
* **Automatic Polyphonic Chord Glide (`.glide(180ms)`):** Writing `.glide(180ms)` directly on a chord (`[ab2 eb3 c4 g4 c5]:1.glide(180ms)`) automatically pairs and glides every voice into the next chord.
* **20 Synth Modifiers:** `.detune()`, `.detune_cents()`, `.filter(startHz, endHz)`, `.flutter()`, `.warble()`, `.pitch_dip()`, `.stack("octaves"|"fifths")`, `.noise()`, `.sync()`, `.fm()`, `.ring()`, `.pwm()`, `.warp_wave()`, `.keytrack()`, `.comb()`, `.duck()`, `.gate()`, `.zap`/`.pluck()`, `.haas()`, `.width()`, `.analog_slop()`, `.air()`, `.pre_swell`, and `.open_voice`.

### 3. Royal Concertgebouw 128-Instrument HD SoundFont & Percussion Engine
* Streams and caches all **128 General MIDI MusyngKite HD SoundFonts** (`salamander_grand`, `violin`, `viola`, `cello`, `contrabass`, `flute`, `oboe`, `clarinet`, `french_horn`, `trumpet`, `trombone`, `tuba`, `orchestral_harp`, `choir_aahs`, `voice_oohs`, `timpani`, etc.) with 6.5-second energy-gated Hann sustain looping, deep-body legato transitions, multi-desk section unison, and a 2.4-second 6-comb + 2-allpass Concertgebouw hall diffuser.
* **30 Ableton Audio Effects & 20-Band Talking Vocoder:** Includes `eq_eight`, `auto_filter`, `compressor`, `glue_compressor`, `multiband_dynamics` (`ott`), `drum_buss`, `roar`, `saturator`, `hybrid_reverb`, `echo`, `chorus`, `phaser_flanger`, `redux`, `erosion`, `gate`, `corpus`, `resonators`, `spectral_resonator`, `spectral_time`, `beat_repeat`, `looper`, `amp`, `pedal`, `shifter`, `auto_shift`, `vocoder` (paired with `.lyric("...")`), `utility`, and `limiter`.

---

## Installation & Setup

### Option 1A: macOS Desktop App (`.pkg` Installer)

Tenuto Studio 5 packages directly into a native macOS `.pkg` installer that installs **Tenuto Studio 5.app** into your `/Applications` directory.

```bash
# 1. Clone the repository and install dependencies
git clone https://github.com/alec-borman/Tenuto-Studio-5.git
cd Tenuto-Studio-5
npm install

# 2. Build the production bundle and package the macOS .pkg installer
npm run electron:build:mac

# 3. Run the macOS installer
open release/"Tenuto Studio 5-5.0.6-arm64.pkg"
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
start "" "release\Tenuto Studio 5 Setup 5.0.6.exe"
```

### Option 2: Local Web Development

```bash
npm install
npm run dev
```

---

## Composing with an AI (Gemini / Claude / ChatGPT)

To have an AI write a multi-track song that you can paste directly into Tenuto Studio 5, copy the prompt below into any LLM chat:

```text
Write a multi-track musical composition in Tenuto 6.0 DSL (.ten) and return ONLY the code inside a single ```tenuto code block.

Follow these strict Tenuto rules:
1. Wrap the score in:
   tenuto "6.0" {
     meta @{ title: "Title", tempo: 128, time: "4/4", key: "F#", scale: "minor", sidechain: "drums" }
     ...
   }
2. Define instruments using `def <id> "<Name>" style=<standard|synth|grid> patch="<supersaw|reese_bass|flutter_pad|pluck_lead|wavetable|salamander_grand|violin|cello|french_horn|choir_aahs|tenuto_808_kit>"`.
3. Use sequential measure blocks: `measure 1 { ... }`, `measure 2 { ... }`, etc.
4. MEASURE MATH: In 4/4 time, every track/voice line inside a single `measure N` block MUST sum to 4 quarter-note beats (one :1 whole note, two :2 half notes, four :4 quarter notes, eight :8 eighth notes, or sixteen :16 sixteenth notes).
5. DOTTED NOTES WITH MODIFIERS: Always write two dots (`..`) before a modifier on a dotted note (e.g., `d5:4..f` or `a5:2..vib`).
6. Expressive modifiers: .glide(180ms), .detune(85%, 0.3..0.85), .filter(400, 8500), .stack("octaves"), .air(85%), .duck(75%), .pitch_dip(-7), .legato, .vib, .stacc, .marc, .cresc, .dim.
```

---

## License

MIT License — Copyright (c) 2026 Alec Borman.