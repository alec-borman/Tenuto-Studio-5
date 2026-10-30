<div align="center">
  <img width="1200" height="475" alt="Tenuto Studio 5 Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>𝄆 TENUTO STUDIO 5 𝄇</h1>
  <p><b>Declarative Code-to-Music Studio & Real-Time Scrolling Piano Roll Player</b></p>

  [![Release: v5.0.0](https://img.shields.io/badge/Release-v5.0.0-2563eb.svg)](./SPEC.md)
  [![Grammar Guide: TENUTO_GRAMMAR.md](https://img.shields.io/badge/Grammar_Guide-TENUTO__GRAMMAR.md-10b981.svg)](./TENUTO_GRAMMAR.md)
  [![Platform: macOS .pkg & Web](https://img.shields.io/badge/Platform-macOS_.pkg_%7C_Web-8b5cf6.svg)](#macos-desktop-app-pkg-installer)
  [![License: MIT](https://img.shields.io/badge/License-MIT-64748b.svg)](LICENSE)
</div>

---

## Overview

**Tenuto Studio 5** is a code-driven music studio and real-time piano roll player built around the **Tenuto 5.0** domain-specific language (`.ten`). 

It is designed for a fast, modern creative workflow: write a score directly in the editor—or ask an AI model like Gemini, Claude, or ChatGPT to compose a multi-track piece—paste the text into Tenuto Studio 5, and press **Play** (`Space`) to hear it rendered in real time or exported to a stereo `.wav` audio file.

* **Songwriting & Prompt Reference:** [**`TENUTO_GRAMMAR.md`**](./TENUTO_GRAMMAR.md)
* **Formal Language Specification:** [**`SPEC.md`**](./SPEC.md)

---

## Core Features

### 1. Split-Screen Studio Workspace
* **Left Pane — Syntax-Highlighted Tenuto Editor:** Built on Monaco Editor with a custom Tenuto 5.0 language grammar (`tenuto-dark` theme) that highlights keywords, track headers, scientific pitches, rational durations, chords, and audio modifiers.
* **Right Pane — Scrolling Piano Roll Player:** Automatically centers vertically on the pitch range of the active score, labels piano keys (`C3`, `C4`, `C5`) and measure bars (`M1`, `M2`, `M3`), lights up notes as they play, and scrolls horizontally in sync with the playhead.
* **Top Transport Bar:** Instant **Play / Pause** (`Space`), **Stop**, **Loop**, live **BPM & Measure:Beat** display, a built-in **Demo Score Selector**, and one-click **Export WAV**.

### 2. Full Tenuto 5.0 Compiler & LLM Paste Sanitizer
* **Automatic Markdown Fence Stripping:** Copy and paste code blocks straight from LLM chat responses (` ```tenuto ... ``` `) without manually deleting backticks.
* **Stateful Cursor (Sticky Octave & Duration):** Octave numbers and note durations persist across sequential notes until changed (`c4:8 d e f g:4`), keeping scores compact and readable.
* **Rich Musical Constructs:** Supports multi-track `measure` blocks, chords (`[c4 e4 g4]:2`), parallel polyphonic voices (`<[ v1: ... | v2: ... ]>`), tuplets (`(c4:8 d e):3/2`), Euclidean rhythms (`(k):3/8`), and reusable `$macros`.
* **Quick Sketch Mode:** Type a single line of notes (`pno: c4:8 d e f g:4`) without any file headers or setup blocks to audition melodies immediately.

### 3. Polyphonic Synthesis, Acoustic Piano & Drum Engine
* **Acoustic Instruments (`style=standard`):** Multi-harmonic grand piano synthesis (`salamander_grand`) with hammer attack transients and natural low-pass filter decay.
* **Polyphonic Synthesizers (`style=synth`):** Detuned sawtooth leads (`saw_lead`), warm analog and chamber string pads (`warm_pad`, `string_pad`), and deep sub-bass (`808_sub`) with portamento pitch `.glide()`.
* **Drum & Percussion Grid (`style=grid`):** Dedicated percussion synthesis (`tenuto_808_kit`) for kicks (`k`/`bd`), snares (`s`/`sd`), claps (`cp`), closed hi-hats (`h`), and open hi-hats (`oh`).
* **Real-Time Lookahead Scheduler:** Streams WebAudio nodes within a rolling 280ms lookahead window and cleans up finished nodes automatically, allowing long 60+ measure multi-instrument arrangements to play smoothly.
* **Mix & Effects Processing:** Supports per-note dynamics (`.pp` to `.ff`, `.vol()`), articulations (`.stacc`, `.marc`, `.ten`), stereo panning (`.pan()`), micro-timing pocket offsets (`.pull()`, `.push()`), stereo reverb/delay (`.fx()`), and kick-triggered sidechain ducking.

### 4. Full-Length Mastered WAV Export
* Clicking **Export WAV** renders the entire compiled score using a deterministic stereo Float32 PCM synthesis engine with stereo room reflections and soft-knee limiting, downloading a standard 44.1 kHz / 16-bit `.wav` file in seconds.

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
open release/"Tenuto Studio 5-5.0.0-arm64.pkg"
```

Once installed, launch **Tenuto Studio 5** from `/Applications` or Spotlight (`Cmd + Space`).

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
start "" "release\Tenuto Studio 5 Setup 5.0.0.exe"
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

To have an AI write a multi-track song that you can paste directly into Tenuto Studio 5, copy the prompt below into any LLM chat:

```text
Write a multi-track musical composition in Tenuto 5.0 DSL (.ten) and return ONLY the code inside a single ```tenuto code block.

Follow these strict Tenuto 5.0 rules:
1. Wrap the score in:
   tenuto "5.0" {
     meta @{ title: "Title", tempo: 120, time: "4/4", sidechain: "drums" }
     ...
   }
2. Define instruments using `def <id> "<Name>" style=<standard|synth|grid> patch="<salamander_grand|saw_lead|warm_pad|string_pad|808_sub|tenuto_808_kit>"`.
3. Use sequential measure blocks: `measure 1 { ... }`, `measure 2 { ... }`, etc.
4. MEASURE MATH: In 4/4 time, every track/voice line inside a single `measure N` block MUST sum to 4 quarter-note beats (one :1 whole note, two :2 half notes, four :4 quarter notes, eight :8 eighth notes, or sixteen :16 sixteenth notes). Never pack 8 beats into a single measure block.
5. Pitches: c4, d#4, eb3, f5, or r (rest). Durations: :1, :2, :2., :4, :4., :8, :8., :16.
6. Chords: [c4 e4 g4]:2. Polyphonic voices on one track: <[ v1: ... | v2: ... ]>.
7. Drum tokens on `style=grid` tracks: k (kick), s (snare), cp (clap), h (closed hat), oh (open hat).
8. Expressive modifiers: .stacc, .marc, .pp, .p, .mp, .mf, .f, .ff, .pan(-0.3), .pull(10ms), .fx(reverb, @{mix: 0.4}).
```

For the full grammar breakdown, see **[`TENUTO_GRAMMAR.md`](./TENUTO_GRAMMAR.md)**.

---

## Language Quick Reference

```tenuto
tenuto "5.0" {
  meta @{ title: "Midnight Patio", tempo: 86, time: "4/4" }

  def pno "Felt Grand Piano" style=standard patch="salamander_grand"
  def bass "Warm Sub Bass" style=synth patch="808_sub"
  def drums "Dusty Kit" style=grid patch="tenuto_808_kit"

  measure 1 {
    pno: <[ v1: r:8 a4:8.mf c5:8 e5:8 g5:4 f5:8 e5:8 | v2: [d3 f3 a3 c4]:2.fx(reverb, @{mix: 0.4}) [g2 b2 d3 f3]:2 ]>
    bass: d2:4. r:8 g1:2 |
    drums: <[ v1: k:4 r:8 k:8 r:2 | v2: r:4 s:4.pull(12ms) r:4 s:4.pull(12ms) | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 h:8 ]>
  }

  measure 2 {
    pno: <[ v1: d5:4. c5:8 a4:2 | v2: [c3 e3 g3 b3]:2 [a2 c#3 e3 g3]:2 ]>
    bass: c2:4. g1:8 a1:2 |
    drums: <[ v1: k:4 r:8 k:8 r:2 | v2: r:4 s:4.pull(12ms) r:4 s:4.pull(12ms) | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 oh:8 ]>
  }
}
```

| Feature | Syntax Example | Meaning |
| --- | --- | --- |
| **Pitch + Duration** | `c4:4`, `f#5:8`, `eb3:2.` | Middle C quarter note, F#5 eighth note, Eb3 dotted half note |
| **Sticky State** | `c4:8 d e f g:4` | Four eighth notes in octave 4 (`c4 d4 e4 f4`) followed by a quarter note `g4` |
| **Rest** | `r:4`, `r:8` | Quarter-note rest, eighth-note rest |
| **Chord** | `[c4 e4 g4 b4]:1` | C major 7th chord held for a whole note |
| **Polyphonic Voices** | `<[ v1: e5:2 d5:2 | v2: c3:1 ]>` | Two independent voices playing simultaneously on the same track |
| **Drum Grid Triggers** | `k:4 s:4 h:8 oh:8 cp:4` | Kick (`k`), snare (`s`), closed hat (`h`), open hat (`oh`), clap (`cp`) |
| **Euclidean Rhythm** | `(k):3/8` | Distributes 3 hits evenly across 8 eighth-note steps |
| **Modifiers** | `.stacc`, `.ff`, `.pan(-0.4)`, `.pull(12ms)` | Staccato gate, fortissimo velocity, stereo pan, laid-back micro-timing |

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Space` | Play / Pause score (when focus is outside the text editor) |
| `Cmd / Ctrl + Z` | Undo last code edit |
| `Cmd / Ctrl + Shift + Z` | Redo code edit |

---

## Project Layout & Testing

```text
├── electron/
│   └── main.cjs                   # Electron main process for macOS desktop build
├── src/
│   ├── audio/
│   │   ├── StudioAudioEngine.ts   # Polyphonic lookahead synth, drum & WAV export engine
│   │   ├── AudioContextManager.ts # WebAudio & SharedArrayBuffer manager
│   │   ├── PlaybackOrchestrator.ts# Audio buffer dispatcher
│   │   ├── SpatialAudioMatrix.ts  # Bus routing & cycle detection
│   │   ├── TCALManager.ts         # Core acoustic sample cache manager
│   │   └── TenutoProcessor.ts     # AudioWorklet DSP processor
│   ├── commands/
│   │   ├── ASTCommand.ts          # Editor mutation command
│   │   └── CommandManager.ts      # Undo / Redo stack manager
│   ├── components/
│   │   ├── CodeEditor.tsx         # Monaco editor with Tenuto 5.0 syntax highlighting
│   │   ├── SplitWorkspace.tsx     # 50/50 split studio workspace
│   │   ├── Transport.tsx          # Top transport bar, demo loader & WAV export trigger
│   │   └── WebGPUCanvas.tsx       # Auto-centered scrolling Piano Roll player
│   ├── parser/
│   │   ├── DocumentParser.ts      # Full Tenuto 5.0 compiler & markdown fence sanitizer
│   │   ├── IncrementalCompiler.ts # Real-time compiler bridge
│   │   ├── ASTSerializer.ts       # Token & modifier serializer
│   │   ├── PitchEngine.ts         # Scientific pitch, sticky octave & drum grid parser
│   │   └── TemporalEngine.ts      # Rational duration & sticky rhythm engine
│   └── presets/
│       └── presetScores.ts        # Built-in multi-track demo scores
├── tests/                         # Vitest unit & integration test suites
├── electron-builder.json          # macOS .pkg installer configuration
├── TENUTO_GRAMMAR.md              # Songwriting grammar & LLM prompt guide
├── SPEC.md                        # Canonical Tenuto 5.0.0 language specification
└── README.md
```

### Running Checks

```bash
# TypeScript type check
npm run lint

# Run Vitest test suites
npx vitest run

# Build production bundle
npm run build
```

---

## License

MIT License — Copyright (c) 2026 Alec Borman.