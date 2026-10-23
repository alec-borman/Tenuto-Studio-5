# Tenuto 5.0 Songwriting & Grammar Specification (`.ten`)

Tenuto 5.0 is a human-readable, token-efficient musical language designed so you (or an LLM like Gemini or Claude) can write complete multi-track arrangements in plain text, paste them into **Tenuto Studio 5**, and immediately hear them rendered with polyphonic synthesis, acoustic piano, drums, and studio effects.

---

## 1. Document Skeleton

Every full Tenuto 5.0 score follows a three-part layout wrapped in `tenuto "5.0" { ... }`:

```tenuto
tenuto "5.0" {
  %% 1. Global Metadata
  meta @{ title: "Song Title", tempo: 120, time: "4/4", sidechain: "drums" }

  %% 2. Instrument Definitions
  def pno "Grand Piano" style=standard patch="salamander_grand"
  def lead "Synth Lead" style=synth patch="saw_lead"
  def pad "Warm Pad" style=synth patch="warm_pad"
  def bass "Sub Bass" style=synth patch="808_sub"
  def drums "Drum Kit" style=grid patch="tenuto_808_kit"

  %% 3. Sequential Measures
  measure 1 {
    pno: <[ v1: c5:4 d5:8 e5:8 f5:2 | v2: [c3 g3 c4]:1 ]>
    lead: r:2 g5:4. f5:8 |
    pad: [c4 e4 g4 b4]:1.fx(reverb, @{mix: 0.5}) |
    bass: c2:8.stacc c3:8 c2:8 c3:8 c2:8 c3:8 g1:8 g2:8 |
    drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 oh:8 ]>
  }
}
```

> **Quick Sketch Mode:** You can also type raw single-line sketches without any wrapper boilerplate (for example: `pno: c4:8 d e f g:4 a b c5:2`) and Tenuto Studio 5 will compile and play them automatically.

---

## 2. Global Metadata (`meta @{ ... }`)

The `meta` block configures global timing and mix behavior:

| Key | Type | Example | Description |
| --- | --- | --- | --- |
| `title` | String | `"Neon Horizon"` | Displays in the top transport bar and sets the default filename for `.wav` exports. |
| `tempo` | Number | `118` | Tempo in Beats Per Minute (BPM). |
| `time` | String | `"4/4"` | Time signature (`"4/4"`, `"3/4"`, `"6/8"`, `"5/4"`). |
| `key` | String | `"Am"` | Optional key signature metadata. |
| `sidechain` | String | `"drums"` | Automatically ducks non-drum tracks whenever a kick (`k` or `bd`) hits on the specified track. |

---

## 3. Instrument Definitions (`def`)

Define as many tracks as your arrangement needs using `def <trackId> "<Display Name>" style=<style> patch="<patch>"`:

| `style` | `patch` Options | Timbre & Behavior |
| --- | --- | --- |
| `standard` | `"salamander_grand"` | Multi-harmonic acoustic concert grand piano with hammer transient and natural decay. |
| `synth` | `"saw_lead"` | Detuned dual-oscillator analog brass/sawtooth lead with low-pass filter sweep. |
| `synth` | `"warm_pad"`, `"string_pad"` | Lush, slow-attack polyphonic chorus pad / chamber string ensemble. |
| `synth` | `"808_sub"` | Deep sine/triangle sub-bass with punchy low-pass envelope. |
| `grid` | `"tenuto_808_kit"` | Percussion trigger grid supporting kick, snare, clap, hi-hats, toms, and cymbals. |

---

## 4. Pitches, Drum Keys, Rests & Sticky Octaves

### 4.1 Melodic Pitches (`style=standard` and `style=synth`)

* **Format:** `<note><accidental><octave>`
* **Note letters:** `c`, `d`, `e`, `f`, `g`, `a`, `b`
* **Accidentals:** `#` (sharp) or `b` (flat) — e.g., `f#4`, `eb3`, `c#5`
* **Octaves:** `0` through `8` (`c4` is Middle C, `a4` is 440 Hz)
* **Sticky Octave Rule:** Once you specify an octave on a voice, subsequent notes inherit that octave until you write a new octave number:
  * `c4:8 d e f g a b c5` compiles as `c4:8 d4:8 e4:8 f4:8 g4:8 a4:8 b4:8 c5:8`.

### 4.2 Drum & Percussion Keys (`style=grid`)

On any `style=grid` track, use these shorthand trigger tokens instead of melodic pitches:

| Token(s) | Drum Sound | MIDI Note |
| --- | --- | --- |
| `k`, `bd`, `kick` | 808 / Acoustic Bass Drum (Kick) | 36 |
| `s`, `sd`, `snare` | Snare Drum | 38 |
| `cp`, `clap` | Hand Clap | 39 |
| `rim` | Rimshot | 37 |
| `h`, `hh`, `ch` | Closed Hi-Hat | 42 |
| `oh` | Open Hi-Hat | 46 |
| `lt`, `mt`, `ht` | Low, Mid, High Tom | 45, 47, 50 |
| `cr`, `rd` | Crash / Ride Cymbal | 49, 51 |

### 4.3 Rests & Spacers

* `r` — Silence for the specified duration (e.g., `r:4` is a quarter-note rest).
* `s` — Invisible automation spacer (on non-grid tracks).

---

## 5. Durations & Sticky Rhythm Math

Durations are appended to a pitch, chord, or rest using a colon (`:`):

| Token | Musical Value | Fraction of a `4/4` Bar | Quarter-Note Beats |
| --- | --- | --- | --- |
| `:1` | Whole note | `1/1` | `4.0` beats |
| `:2.` | Dotted half note | `3/4` | `3.0` beats |
| `:2` | Half note | `1/2` | `2.0` beats |
| `:4.` | Dotted quarter note | `3/8` | `1.5` beats |
| `:4` | Quarter note | `1/4` | `1.0` beat |
| `:8.` | Dotted eighth note | `3/16` | `0.75` beats |
| `:8` | Eighth note | `1/8` | `0.5` beats |
| `:16` | Sixteenth note | `1/16` | `0.25` beats |
| `:32` | Thirty-second note | `1/32` | `0.125` beats |
| `:grace` | Grace note | `0` | `0` beats |

* **Sticky Duration Rule:** If a note omits `:duration`, it automatically reuses the previous duration in that voice:
  * `c4:16 g4 c5 d5 e5:4` = four 16th notes (`1.0` beat total) followed by one quarter note (`1.0` beat).
* **Multipliers:** Append `*N` to multiply a duration (e.g., `c4:4*3` equals three quarter notes).

---

## 6. Chords, Polyphonic Voices, Tuplets & Euclidean Rhythms

* **Chords (`[ ... ]`):** Group pitches inside square brackets and attach the duration/modifiers to the closing bracket:
  * `[c4 e4 g4 b4]:2.mp` (C major 7th half-note chord)
* **Parallel Polyphonic Voices (`<[ v1: ... | v2: ... ]>`):** Run independent melodies, chords, or drum layers simultaneously on a single track:
  * `pno: <[ v1: e5:4 d5:4 c5:2 | v2: [a2 e3 a3]:2 [g2 d3 g3]:2 ]>`
  * `drums: <[ v1: k:4 r:4 k:4 r:4 | v2: r:4 s:4 r:4 s:4 | v3: h:8 h:8 h:8 h:8 h:8 h:8 h:8 oh:8 ]>`
* **Euclidean Rhythms (`(pitch):hits/steps`):** Distribute `hits` evenly across `steps`:
  * `(k):3/8` generates the classic 3-over-8 tresillo pattern (`k:8 r:8 r:8 k:8 r:8 r:8 k:8 r:8`).
* **Tuplets (`(notes):num/den`):** Scale a group of notes by a rational ratio:
  * `(c4:8 d4:8 e4:8):3/2` fits three eighth-note triplets into the space of two eighth notes (1 quarter beat).
* **Macros (`macro name = { ... }` and `$name`):** Define reusable motifs once and invoke them with `$`:
  * `macro arp_motif = { a3:16 e4 a4 c5 e5 c5 a4 e4 }`
  * `pno: $arp_motif $arp_motif |`

---

## 7. Articulations, Dynamics, Micro-Timing & DSP Effects

Chain dot modifiers directly onto any note or chord:

* **Articulations:**
  * `.stacc` / `.staccato` (short, detached gate)
  * `.ten` / `.tenuto` (full, slightly lengthened sustain)
  * `.marc` / `.accent` (emphasized attack)
* **Dynamics & Velocity:**
  * `.pp` (`40`), `.p` (`60`), `.mp` (`75`), `.mf` (`90`), `.f` (`105`), `.ff` (`120`), `.sfz` (`124`)
  * `.vol(0..127)` for exact MIDI velocity (e.g., `c4:8.vol(110)`)
* **Spatial Panning:**
  * `.pan(-1.0..1.0)` where `-1.0` is hard left, `0.0` is center, and `1.0` is hard right (e.g., `arp: c5:8.pan(-0.4)`).
* **Micro-Timing ("The Pocket") & Portamento:**
  * `.pull(12ms)` delays the physical note slightly behind the grid (great for laid-back lo-fi snares).
  * `.push(8ms)` plays the note slightly ahead of the beat.
  * `.glide(80ms)` slides pitch smoothly into the next note on `style=synth` tracks.
* **DSP Effects:**
  * `.fx(reverb, @{mix: 0.5})`
  * `.fx(delay, @{mix: 0.3})`

---

## 8. The Golden Rule of Measure Math (`4/4` Alignment)

To ensure `measure 1`, `measure 2`, `measure 3`, etc. in your code line up 1-to-1 with `M1`, `M2`, `M3` on the Scrolling Piano Roll Player:

* In `4/4` time, **every voice inside a `measure N { ... }` block must sum to at most 4 quarter-note beats (`1/1` whole note)**:
  * `1` whole note (`:1`) = **4 beats**
  * `2` half notes (`:2 :2`) = **4 beats**
  * `4` quarter notes (`:4 :4 :4 :4`) = **4 beats**
  * `8` eighth notes (`:8` × 8) = **4 beats**
  * `16` sixteenth notes (`:16` × 16) = **4 beats**
* Never pack 8 beats (such as two `:1` whole-note chords or 32 `:16` notes) into a single `measure` block—split them into `measure 1 { ... }` and `measure 2 { ... }`.

---

## 9. Copy-Paste Prompt for Gemini / Claude / ChatGPT

Copy the prompt block below into any LLM chat when you want it to write a new song for Tenuto Studio 5:

```text
Write a multi-track musical composition in Tenuto 5.0 DSL (.ten) and return ONLY the code inside a single ```tenuto code block.

Follow these strict Tenuto 5.0 rules:
1. Wrap the score in:
   tenuto "5.0" {
     meta @{ title: "Title", tempo: 120, time: "4/4", sidechain: "drums" }
     ...
   }
2. Define instruments using `def <id> "<Name>" style=<standard|synth|grid> patch="<salamander_grand|saw_lead|warm_pad|string_pad|808_sub|tenuto_808_kit>"`.
3. Use `measure 1 { ... }`, `measure 2 { ... }`, etc.
4. CRITICAL MEASURE MATH: In 4/4 time, every track/voice line inside a single `measure N` block MUST sum to exactly 4 quarter-note beats (1 whole note = :1, two :2 notes, four :4 notes, eight :8 notes, or sixteen :16 notes). Never put 8 beats inside one measure block.
5. Pitches: c4, d#4, eb3, f5, or r (rest). Durations: :1, :2, :2., :4, :4., :8, :8., :16.
6. Chords: [c4 e4 g4]:2. Polyphonic voices on one track: <[ v1: ... | v2: ... ]>.
7. Drum tokens on `style=grid` tracks: k (kick), s (snare), cp (clap), h (closed hat), oh (open hat).
8. Expressive modifiers: .stacc, .marc, .pp, .p, .mp, .mf, .f, .ff, .pan(-0.3), .pull(10ms), .fx(reverb, @{mix: 0.4}).
```
