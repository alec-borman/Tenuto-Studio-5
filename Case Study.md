# Case Study: Multi-Model Iterative Refinement and Diff-Driven Composition in Tenuto Studio 6.0

## 1. Overview: Turning AI Music Creation into a Verifiable Code Workflow

Most AI music generators operate as black-box audio slot machines. When a prompt produces a three-minute audio waveform with muddy low-end voicing in bar 14, a harmonic clash in bar 23, or an abrupt dynamic jump in bar 50, there is no way to inspect the underlying score or patch those specific bars without regenerating the entire recording from scratch. Conversely, legacy symbolic formats like MusicXML 4.0 require roughly 18,500 lines of verbose XML tags for a 60-measure orchestral piece, which overwhelms LLM context windows and causes syntax errors during multi-turn editing.

By representing a complete multi-track DAW session (notes, chords, polyphonic voices, Groove Pool swing, Return buses, Group submixes, MPE envelopes, and 20-band Vocoder lyrics) in roughly 550 lines of human-readable `.ten` code, **Tenuto Studio 6.0** allows human composers and multiple AI models to collaborate using software engineering workflows: iterative code reviews, branch forking, and unified diffs (`diff -u`).

Across four iterations of the 60-measure hybrid symphonic work **"Nocturne and Protocol of the Glass Leviathan"**, each pass isolated and solved specific musical, acoustic, and compiler-level bottlenecks that would be invisible in a binary DAW project file.

---

## 2. The Four-Stage Multi-Model Iteration Timeline

| Iteration / Branch | Workflow Method | Key Changes Introduced | Compiler & Audio Engine Impact |
| :--- | :--- | :--- | :--- |
| **Iteration 1 (Baseline)** | Full 60-measure generation | Established the 4-movement C Harmonic Minor to C Major arc, 14 tracks, 3 Group buses, 2 Return buses, Vocoder choir, MPE lead, and 5 tempo changes. | Compiled all 60 measures at 4.0 beats per bar, but relied on single-note modifier defaults, sub-audible contrabass octaves (`C0` to `B0`), and global `sidechain: "timp"` ducking. |
| **Iteration 2 (Full-File Pass)** | Full 60-measure reprint | Fixed a fused pitch token (`eb4:16ab4:16` to `eb4:16 ab4:16`) in Measure 7, but appended trailing `\|` pipes after `]>` on 9 polyphonic `timp` lines. | Triggered a parser edge case in `DocumentParser.ts`: `<[ ... ]> \|` failed the `rhs.endsWith(']>')` check and fell through to the single-voice branch, serializing `v1` and `v2` sequentially (8 beats instead of 4). |
| **Iteration 3 (Fork Diff Pass)** | Surgical Unified Diff (`diff -u`) | Output only 5 targeted diff hunks (Measures 7, 13, 14, 16, and 17). Enriched left-hand piano chords and added a `.dim(120,45)` transition between Movements I and II. | Eliminated whole-file copying fatigue. Zero untouched measures were altered, avoiding the `<[ ... ]> \|` polyphonic pipe bug completely. |
| **Iteration 4 (Final Master)** | Engine-Aware Orchestral Revision | Split pitched `timp` (`style=standard`) from unpitched `perc` (`style=grid`), removed `sidechain: "timp"`, shifted `vc`/`cb` into playable range, wrote explicit per-note dynamics/pedal, fixed voice-leading in mm. 2–3, 19, 23, 32–33, 36–38, 45, and carved a dynamic valley in mm. 50–52. | Unlocked true pitched timpani samples, eliminated EDM sidechain pumping, prevented MIDI 21 floor clamping in `SoundfontLibrary.ts`, and activated 2-Desk Section Unison on the trumpets. |

---

## 3. Why Unified Diffs Outperform Full-File Rewrites in Multi-Model Loops

A key finding from Iterations 2 and 3 is the difference between asking an LLM to reprint an entire 60-measure score versus asking it to emit a **unified diff (`diff -u`)**:

1. **Eliminating Copy-Induced Syntax Drift:** In Iteration 2, the model had to emit roughly 8,000 tokens just to copy Measures 1 through 60. While normalizing line endings, it added a trailing `|` after `]>` on the polyphonic `timp` lines in Measures 5, 10, 15, 32, 35, 46, 51, 57, and 60 (`timp: <[ v1: ... | v2: ... ]> |`). In `src/parser/DocumentParser.ts`, the polyphonic branch checks `if ((rhs.startsWith('<[') && rhs.endsWith(']>')) || ...)`. Because the string ended with `|`, `rhs.endsWith(']>')` returned `false`, routing the line into the single-voice parser where `v1` and `v2` were concatenated back-to-back into an 8-beat bar.
2. **Concentrating Model Attention on Musical Choices:** When prompted for a unified diff in Iteration 3, the model spent 100% of its output budget on the five measures being improved (Measures 7, 13, 14, 16, and 17). Because every measure in the baseline was written with explicit octaves (`c4`) and explicit durations (`:16`), modifying a single line inside `measure 13` had zero side effects on `PitchEngine.currentOctave` or `TemporalEngine.lastDuration` in `measure 14`.

---

## 4. Six Compiler and Audio Engine Breakthroughs in the Final Score

Auditing the final score against the TypeScript implementation in `src/parser/` and `src/audio/` reveals how deeply the final revision aligns with the actual mechanics of the Tenuto engine.

### 4.1 Sticky Pitch/Duration vs. Stateless Physics Modifiers (`ASTSerializer.ts`)

In `src/parser/ASTSerializer.ts`, the compiler maintains sticky state for octave (`PitchEngine.currentOctave`) and rhythm (`TemporalEngine.lastDuration`), but **modifiers are evaluated statelessly on each individual token**. When `ASTSerializer.parseToken()` processes a token, it calls `parseModifiersToPhysics(modifiers, defaultVelocity = 80)`.

In Iteration 1, Measure 1 of the harp was written as:

```tenuto
harp: c3:8.p.ped g3:8 c4:8 eb4:8 g4:8 eb4:8 c4:8 g3:8 |

```

In the engine, only `c3:8` received `velocity: 60` (`.p`) and `pedal: true` (`.ped`). The remaining seven eighth notes lacked modifiers, so `ASTSerializer.ts` assigned them `physics: undefined` (reverting to default velocity `80` with `pedal: undefined` and cutting off after their 8th-note duration instead of ringing for `2.2x` duration under the damper pedal).

In the final score, every note in the harp and piano arpeggios carries explicit dynamics and pedal markings:

```tenuto
harp: c3:8.p.ped g3:8.ped.p c4:8.ped.p eb4:8.ped.p g4:8.ped.p eb4:8.ped.p c4:8.ped.p g3:8.ped.p |

```

Every harp note now triggers `ev.physics?.pedal === true` in `StudioAudioEngine.buildScheduledTimeline()`, sustaining each arpeggiated pitch across the bar while maintaining a true `p` (`velocity: 60`) dynamic contour.

### 4.2 Splitting Pitched `timp` (`style=standard`) from `perc` (`style=grid`) & Removing Sidechain Pumping

In Iteration 1, `meta` declared `sidechain: "timp"`, and `timp` was defined as `style=grid patch="timpani"` containing both timpani kicks (`k`) and kit snares/cymbals (`s`, `cr`, `h`, `oh`). That created three engine-level problems in `src/audio/StudioAudioEngine.ts`:

1. **Unwanted Orchestral Ducking:** Because `sidechain: "timp"` was active in `meta`, `StudioAudioEngine.computeSidechainDuckScalar()` ducked the gain of every string, wind, brass, and piano track down toward `0.22` for `240ms` every time a timpani note struck, causing an electronic pumping effect during orchestral climaxes.
2. **Fixed 3-Pitch Timpani Limitation:** In `triggerRealtimeVoice()`, when a `style=grid` track resolves to `sfInstrument === 'timpani'`, it maps `k`/`bd`/`lt` to MIDI 45 (`A2`), `mt` to MIDI 48 (`C3`), and `ht` to MIDI 52 (`E3`). In a piece in C minor, an `A2` timpani fundamental clashes with `Cm`, `Ab`, and `G7` harmonies.
3. **Groove Swing on Classical Timpani:** Binding `timp` to `groove="mpc_swing"` delayed off-beat orchestral timpani strikes via `GrooveEngine.applyGrooveToEvent()`.

The final score resolves all three issues:

* `sidechain: "timp"` is removed from `meta @{ ... }`, restoring natural symphonic headroom across all tutti passages.
* `timp` is defined as `def timp "Orchestral Timpani" style=standard patch="timpani"` (without `mpc_swing`), while `def perc "Hybrid Percussion Kit" style=grid patch="tenuto_808_kit" groove="mpc_swing"` handles the unpitched snare, crash, and hi-hats.
* Because `timp` is now `style=standard`, `SoundfontBankLoader` decodes the exact MIDI pitches written in the score (`c3`, `g2`, `f2`, `eb3`, `ab2`, `d3`, `c#3`, `f#2`, `bb2`, `e3`), allowing the timpani to retune per measure to match the exact root and fifth of the harmony, culminating in the double-stopped `[g2 c3]:1.ff.fermata` fifth in Measure 60.
* Splitting `timp` and `perc` into two separate tracks also eliminated every `<[ v1 | v2 ]>` block on the percussion tracks, making the `<[ ... ]> |` trailing-pipe bug from Iteration 2 impossible.

### 4.3 Moving Cellos (`vc`) and Contrabasses (`cb`) Out of the MIDI 21 Clamping Floor

In Iteration 1, `vc` frequently played down to `f1` and `g1` (below the physical `C2` = MIDI 36 bottom string of the cello), and `cb` played in Octave 0 (`f0` = MIDI 17, `f#0` = MIDI 18, `g0` = MIDI 19, `ab0` = MIDI 20).

In `src/audio/SoundfontLibrary.ts`, `midiToSoundfontKey()` and `decodeNoteBuffer()` clamp incoming MIDI pitches to the standard 88-key range starting at `A0` (MIDI 21):

```typescript
const clampedMidi = Math.max(21, Math.min(108, Math.round(midiNote)));

```

As a result, every `f0`, `f#0`, `g0`, and `ab0` written for `cb` in Iteration 1 was silently clamped to **MIDI 21 (`A0`)** when fetching SoundFont samples, causing the double basses to play a wrong `A0` pedal note underneath `F`, `F#`, `G`, and `Ab` chords!

By shifting `vc` into `C2–C4` and `cb` into `C1–G2` (`c2`, `ab1`, `f1`, `g1`, `eb2`, `d2`, `c#2`, `f#1`), every bass note in the final score falls above MIDI 24 (`C1`), resolving to its true pitched contrabass sample in `SoundfontBankLoader`.

### 4.4 Activating 2-Desk Section Unison on Trumpets (`SoundfontLibrary.ts`)

In Iteration 1, the trumpet track was declared as:

```tenuto
def tpt "Principal Trumpet" style=standard patch="trumpet"

```

Yet in Measures 37, 38, 45, and 56, `tpt` was asked to play 3-note and 4-note brass section chords. In `src/audio/SoundfontLibrary.ts`, `isEnsembleSectionTrack(trackId, trackName, sfInstrument)` explicitly checks:

```typescript
if (name.includes('solo') || name.includes('principal')) {
  return false;
}
return (
  ...
  name.includes('section') ||
  name.includes('trumpets') || ...
);

```

Because the track name in Iteration 1 contained `"Principal"`, `isEnsembleSectionTrack` returned `false`, rendering `tpt` as a dry solo voice. By changing the definition in the final score to:

```tenuto
def tpt "3 Trumpets Section" style=standard patch="trumpet"

```

`isEnsembleSectionTrack` now returns `true`, instructing `StudioAudioEngine` to render `tpt` with 2-Desk Orchestral Section Unison (using an independent neighbor-key recording on Desk 2 via `getIndependentDeskSampleForNote` with stereo spread and micro-detuning). Simultaneously, in Measures 37, 38, and 45, the 4-note trumpet chords were pared down to three-voice triads (`[f4 ab4 db5]`, `[e4 g4 c5]`, `[b4 d5 f5]`) matching the three players in the section, and in Measure 60 the solo oboe (`def ob "Principal Oboe"`) was changed from an impossible 3-note chord `[e5 g5 c6]` to a single `e5:1.ff.vib.fermata`.

### 4.5 True 32nd-Note Bowed Tremolos (`.roll(16)`) and Exact Semitone Trills (`repeat N { ... }`)

The final revision also upgraded how tremolos and trills interact with `DocumentParser.ts` and `StudioAudioEngine.ts`:

* **From `.trem` to `.roll(12)` / `.roll(16)`:** In `ASTSerializer.ts`, `.trem` is a shorthand for `physics.roll = 4`. On a half note (`:2`), `.trem` only subdivides the note into four eighth notes (`1/8`), which sounds like measured eighth-note repeats rather than an orchestral bowed tremolo. By replacing `.trem` on half notes with `.roll(16)` on strings (`vc`, `vln1`) and `.roll(12)` / `.roll(16)` on `timp`, `DocumentParser.ts` subdivides each half note into 12 or 16 rapid slices with `legato: true` on all continuation slices (`r > 0`), producing a continuous, click-free orchestral shimmer.
* **From Generic `.trill` to Explicit `repeat` 32nd-Note Trills:** In `StudioAudioEngine.ts`, `.trill` alternates between `baseFreq` and `baseFreq * Math.pow(2, 2 / 12)` (a fixed whole step of 2 semitones). However, in C Harmonic Minor, a trill on the dominant `G5` (Measure 36) requires a **half-step** upper neighbor to `Ab5` (the ♭6 degree), and a trill on the leading tone `B6` (Measure 45) requires a **half-step** upper neighbor to tonic `C7`. The final revision replaced `.trill` on `vln1` in Measure 36 with `repeat 4 { g5:32.ff ab5:32.ff }` and in Measure 45 with `repeat 8 { b6:32.ff c7:32.ff }`, guaranteeing exact half-step harmonic-minor pitch accuracy.

### 4.6 Voice-Leading, Harmonic Alignment, and Macro-Dynamic Shaping

Finally, the revision resolved several harmonic clashes and flattened dynamic plateaus across the four movements:

* **Measure 2 & Measure 3 (`harp`):** In Iteration 1, `harp` arpeggiated `Ab` across all 4 beats of Measure 2 while `vln2`, `vc`, and `cb` held tonic `Cm` for beats 1–2 before moving to `Ab` on beats 3–4. The final revision aligns `harp` in Measure 2 to arpeggiate `Cm` (`c3 g3 c4 eb4`) on beats 1–2 and `Ab` (`c4 ab3 eb3 ab2`) on beats 3–4, and updates beats 3–4 of Measure 3 to outline `G7` (`g2 d3 f3 b3`) in lockstep with the horns and lower strings.
* **Measure 19 & Measure 23 (`harp`):** In Measure 19, beats 3–4 of `harp` now outline `Bb` (`d4 bb3 f3 bb2`) instead of `Ab`, matching the `[bb1 f2 d3]` piano chord and `[bb3 d4 f4]` horn chord. In Measure 23, beat 4 of `harp` replaces `c5` with `bb4` so the arpeggio transitions cleanly into the `Eb` major harmony on beats 3–4.
* **Measures 32–33 (Scherzo Fugato):** In Measure 32, `vln1`, `pno`, `vc`, and `cb` replace `ab5`/`ab4`/`f2` on beat 1 with `bb5`/`bb4`/`g2`, eliminating a cross-relation against `wt_lead`'s G-minor/D-dominant fugal answer. In Measure 33, `vc` enters with the complete fugato subject (`c3:8.f.stacc g2:8.f.stacc eb3:8.f.stacc c3:8.f.stacc g3:4.ff.marc f#3:8.ff.legato g3:8.ff.legato`), turning a generic bass accompaniment into a true three-voice fugal exposition across `vln1` (M31), `wt_lead` (M32), and `vc` (M33).
* **Measures 50–52 (The Dynamic Valley) & Measure 59 (`tempo: 86`):** In Iteration 1, Movement IV stayed at `.f` and `.ff` continuously from Measure 46 to Measure 60, leaving nowhere to build when the Vocoder Choir enters at Measure 53. By dropping Measures 50–51 down to `.mf` (and `.mp` on `perc`) and building back up through a coordinated `.cresc` in Measure 52, the entrance of the `.ff` Flat-VI `Ab` major choir statement (`"Shine"`) at Measure 53 lands with genuine dramatic contrast, before `meta @{ tempo: 86 }` in Measure 59 broadens the final `I - V - I - V` cadential pillars into the Measure 60 fermata.
