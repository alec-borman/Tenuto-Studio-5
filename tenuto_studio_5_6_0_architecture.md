# Declarative Audio Architecture and Symbolic Compression in Tenuto Studio 5 and 6.0

## Executive Thesis: Abolishing the Binary DAW Dichotomy

For over two decades, digital music creation has operated across a fractured technological landscape divided between visual Digital Audio Workstations (DAWs), imperative text-based audio programming languages, and opaque end-to-end neural audio generators. Flagship visual environments such as Ableton Live 12 Suite, Logic Pro, and Pro Tools provide tactile mixing consoles, non-linear clip launching, elastic time-stretching, expressive MIDI Polyphonic Expression (MPE) synthesizers, and modular digital signal processing (DSP) chains. However, these platforms serialize musical and sonic state inside monolithic binary or gzipped-XML project containers (`.als`, `.logicx`, `.ptx`) that routinely span $5\text{ MB}$ to $500\text{ MB}$. Because traditional DAW files dump exhaustive C++ object memory properties—including unused filter bands, UI scroll coordinates, panel fold states, and redundant automation nodes—they are incompatible with line-by-line version control (`git diff`), fragile across operating system generations, and unusable within the context windows of autoregressive Large Language Models (LLMs), where a single uncompressed `.als` file exceeds $1,200,000\text{ tokens}$.

Conversely, code-first music environments (SuperCollider, TidalCycles, ChucK, LilyPond) and legacy symbolic interchange formats (MusicXML 4.0, ABC notation, raw MIDI token streams) offer programmatic editability and compact file footprints, but historically sacrifice either the visual ergonomics and integrated DSP device racks of a modern DAW or the token efficiency required for long-horizon transformer attention. Meanwhile, end-to-end latent audio diffusion and neural codec models (such as Suno, Udio, EnCodec, and SoundStream) emit continuous spectrographic frames requiring hundreds of tokens per second of audio. Lacking an internal symbolic ontology for barlines, voice-leading suspensions, or harmonic inversions, frame-based audio models suffer severe attention degradation beyond $15$ to $30\text{ seconds}$ and produce static waveforms that cannot be surgically edited at the note or device level.

Tenuto Studio 5 and its Tenuto 6.0 architecture abolish this historical trade-off by unifying $100\%$ of Ableton Live 12 Suite's functional, visual, and sonic capabilities with a declarative, ultra-compact domain-specific language (`.ten`). Engineered across a rigorous contract roadmap (`TDB-601` through `TDB-750`), the platform enforces a foundational architectural invariant: **the UTF-8 `.ten` source file is the sole, sovereign Source of Truth**. Every graphical interaction in the React 19, PixiJS 8 (WebGPU/WebGL), and WebAudio workspace—whether dragging an EQ Eight filter node, sweeping a Wavetable unison macro, launching a Session View scene, or resizing a note on the Piano Roll—executes a span-exact surgical mutation in the Monaco code editor in under $2\text{ ms}$. Simultaneously, every line of `.ten` code compiles in under $3\text{ ms}$ into a synchronized Session View Clip Matrix, an Arrangement View Timeline, a Continuous Synth Engine, a 128-instrument High-Definition SoundFont sampler, and a modular WebAudio/AudioWorklet DSP routing graph.

| Architectural Dimension | Tenuto Studio 5 / 6.0 (`.ten`) | Ableton Live 12 Suite (`.als`) | Logic Pro / Pro Tools (`.logicx` / `.ptx`) | MusicXML 4.0 (`.musicxml`) | TidalCycles / SuperCollider | End-to-End Audio AI (Suno / Udio) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Source of Truth** | Declarative UTF-8 `.ten` Code ($100\%$ Bi-Directional) | Gzipped Monolithic XML / Binary Blob | Proprietary Binary Package | Verbose Print Typesetting XML | Imperative One-Way Script | Opaque Neural Spectrogram |
| **Workspace Paradigm** | Dual-View Session + Arrangement + Live `.ten` Sync | Dual-View Session + Arrangement (Tab Toggle) | Arrangement + Live Loops | Static Sheet Music Engraver | Text REPL Only (No DAW UI) | Prompt-to-WAV Only |
| **Typical Project Footprint** | $15\text{ KB}$ – $60\text{ KB}$ Text (`.ten` + `.tenpack` zip) | $5\text{ MB}$ – $150\text{ MB}$ Binary / Uncompressed XML | $25\text{ MB}$ – $500\text{ MB}$ Binary | $500\text{ KB}$ – $2\text{ MB}$ XML | $2\text{ KB}$ – $20\text{ KB}$ Script | $25\text{ MB}$ Static `.wav` |
| **LLM Context Token Cost** | $1,500$ – $8,000\text{ tokens}$ (Full Multi-Track Score) | $1,200,000+\text{ tokens}$ (Exceeds Context Window) | Unparseable Binary | $148,000\text{ tokens}$ (60-Bar Orchestra) | $2,000\text{ tokens}$ (No Native DAW/DSP) | Non-Symbolic Frame Stream |
| **Temporal Resolution** | Exact Rational Arithmetic ($\mathbb{Q} = P/Q$) + Groove Pool | Floating-Point / PPQ Grid + Groove Pool | Integer PPQ Tick Grid | Integer Divisions per Quarter | Rational Cycles | Frame-Based (Metric Drift) |
| **Native Synthesis & Sampling** | Continuous Synth, Wavetable, Operator, Meld, Drift, Analog, Physical Models, Simpler, Granulator III, 128-Pad Drum Rack, 128 HD SoundFonts | Wavetable, Operator, Meld, Drift, Analog, Physical Models, Simpler, Sampler, Granulator III, Drum Rack | Alchemy, Sculpture, Vintage Synths, Sampler | None (External MIDI Playback Only) | Custom SynthDef Code Required | Baked into Static Waveform |
| **Audio Warping & Stems** | 5 Elastic Warp Modes (AudioWorklet), Comping, 4-Stem AI Split | 5 Elastic Warp Modes, Take Comping, Stem Split | Flex Time, Take Folders, Stem Split | None | Manual Buffer Slicing | None |
| **Version Control (`git diff`)** | Native Line-by-Line Semantic Diffs & Merge | Impossible (Binary/Blob Conflict) | Impossible | Impractical ($18,500+$ Lines/Score) | Native Text Diffs | Impossible |

---

## Information-Theoretic Compression and Compiler Mechanics

The necessity of extreme symbolic compression in computer-assisted composition is dictated by the scaling laws of autoregressive transformer architectures. Because transformer self-attention complexity scales quadratically ($\mathcal{O}(N^2)$) with sequence length, empirical retrieval accuracy and structural coherence degrade rapidly as the token distance between interdependent musical events increases. Unlike natural language prose, where syntactic validity is governed primarily by local word adjacency, polyphonic music requires simultaneous mathematical adherence across three distinct temporal horizons:

1. **Micro-timescale (Intra-beat vertical counterpoint):** Passing tones, chord extensions, vocal formants, and percussion transients must align vertically across all active instruments on every fractional subdivision of a beat.
2. **Meso-timescale (Phrase and barline architecture):** Harmonic progressions must sequence logically across four- and eight-bar phrases while every parallel voice within every measure sums to the exact rational time signature capacity ($4/4 = 1/1\text{ whole note}$).
3. **Macro-timescale (Thematic transformation):** Intervallic motifs introduced in an opening measure must remain within the high-resolution focal window of the model so they can be inverted, developed in a mid-piece fugato, or recapitulated dozens of measures later without thematic amnesia.

When an LLM or notation engine emits MusicXML 4.0, a single orchestral measure of 50 note events consumes approximately $2,400\text{ tokens}$ due to nested XML tags (`<note>`, `<pitch>`, `<step>`, `<alter>`, `<octave>`, `<duration>`, `<voice>`, `<type>`, `<notations>`, and `<backup>` cursor rewinds). By Measure 16, the representation exceeds $38,000\text{ tokens}$, causing attention dilution, metric drift across integer division grids, and hallucinated closing tags. Tenuto 5.0 and 6.0 resolve this bottleneck through **Axiom 1 (Inference Over Redundancy via the Stateful Cursor)** and **Default-Elided DSP Dictionaries**.

In the 60-measure, four-movement orchestral stress test (*Symphony No. 5 in D Minor / D Major: The Celestial Architecture*, `celestial_architecture_symphony_60m.ten`), scored for six sections (`pno`, `vln1`, `vln2`, `brass`, `bass`, and `timp`), the complete work compiles $2,689$ discrete note and percussion events, $393$ multi-note chords, and $111$ parallel polyphonic voice blocks inside a $29.5\text{ KB}$ UTF-8 file comprising $617$ lines and approximately $7,850\text{ LLM tokens}$. Across the entire file—including `meta` headers, `def` declarations, and structural comments—Tenuto averages $2.92\text{ tokens}$ per compiled musical event, shrinking a 50-event orchestral measure from $2,400\text{ tokens}$ in MusicXML 4.0 down to $130\text{ tokens}$. At the micro-stave level, such as the Measure 5 Concert Grand Piano two-handed sixteenth-note bariolage accompaniment (`v1` playing 16 sixteenth notes against `v2` playing two half-note octave dyads, totaling 20 discrete note events), Tenuto encodes the stave in $148$ characters ($38\text{ tokens}$, or $1.90\text{ tokens/event}$) compared to $412$ lines ($3,100\text{ tokens}$, or $155.00\text{ tokens/event}$) in MusicXML 4.0—an $81.58\times$ localized compression ratio ($98.77\%$ reduction). When exploiting full sticky state by eliding redundant octave and `:16` duration suffixes (`d4:16.mp f a d5 a4 f d f d f a d5 a4 f d f`), the right-hand stream drops from $98$ characters to $44$ characters, driving token cost below $1.15\text{ tokens per note}$.

### Pure TypeScript Recursive-Descent Compiler Pipeline

Because a $10,000$-note symphonic score is compressed into a dense token stream rather than megabytes of nested XML DOM nodes, Tenuto Studio 5 and 6.0 eliminate the external Rust WebAssembly compilation layer (`tenutoc` and the `tenutod` UDP/WebSocket daemon from Tenuto Studio 3) as well as the heavy Pyodide Python Web Worker layer (Lark parser in Tenuto Studio 4). The pure TypeScript recursive-descent compiler (`src/parser/DocumentParser.ts`, `ASTSerializer.ts`, `PitchEngine.ts`, `TemporalEngine.ts`, `PolyphonicEngine.ts`, and `IncrementalCompiler.ts`) compiles $10,000$ notes in under $3\text{ milliseconds}$ natively on the browser main thread. During single-line live coding, `IncrementalCompiler.update()` diffs incoming tokens against `this.cachedTokens[i]` and reuses the exact object reference `this.cachedEvents[i]` (`astV2[i] === astV1[i]`) for unmodified notes, preventing React and PixiJS garbage collection stalls.

The compiler achieves its extreme token density through eleven formal state-machine and intensional expansion mechanisms summarized below:

| Compiler Construct | `.ten` Syntax Example | Underlying Compiler & DSP Mechanism (`src/parser/` & `src/audio/`) | Information-Theoretic Compression Effect |
| :--- | :--- | :--- | :--- |
| **Sticky Pitch Cursor** | `c4:8 d e f# g a b c5` | `PitchEngine.ts` maintains `private currentOctave: number = 4`. Omitted octaves inherit `this.currentOctave`, computing MIDI via $(\text{currentOctave} + 1) \times 12 + \text{offset}$. | Eliminates explicit octave digits across stepwise/diatonic passages; reduces BPE subword fragmentation. |
| **Relative Pitch Heuristics** | `style=relative` | Overrides absolute sticky octaves with the Closest Interval (Tritone) Rule, automatically selecting the octave within $\pm 6\text{ semitones}$ of the prior pitch. | Prevents runaway octave drift during wide AI-generated arpeggio leaps. |
| **Sticky Temporal Cursor & Multipliers** | `c4:16 d e f g:4*3` | `TemporalEngine.ts` maintains `lastDuration = { numerator: 1, denominator: 4 }`. Multipliers (`*N`) scale the numerator and reduce via Euclid's $\gcd$ algorithm. | Eliminates repeated `:duration` suffixes and folds multi-beat tied sustains or long rests (`r:1*4`) into 1 token. |
| **Bracketed Chord Vectorization** | `[c3 g3 c4 e4]:2.mp.arp.ped` | `DocumentParser.ts` parses `^\[([^\]]+)\](.*)$`, attaches duration/modifiers to pitch $i = 0$, and clones `chordDuration` and `sharedPhysics` across members $i = 1 \dots N-1$. | Replaces $N$ separate note blocks with 1 token; `.arp` sorts MIDI low-to-high and staggers `pullMs` by $\text{rollIdx} \times 28\text{ ms}$. |
| **Inline Polyphonic Multiplexing** | `<[ v1: e5:2 d:2 \| v2: c3:1 ]>` | Instantiates isolated `ASTSerializer` instances per `trackId:{voiceId}` persisted across measures; resets each pipe segment to `measureStartTime`. | Eliminates XML `<backup>` cursor-rewind blocks; `PolyphonicEngine.ts` auto-pads short voices with `r:${bestDen}`. |
| **Euclidean Bresenham Generator** | `(k):3/8` or `(c2):3/8:16.stacc` | `DocumentParser.expandEuclideanPattern(hits, steps)` executes Bresenham's algorithm $((i \times \text{hits}) \bmod \text{steps} < \text{hits})$ across `steps` iterations. | Compresses an 8-step tresillo or 16-step polyrhythm of hits and rests into an 8-to-12-character intensional expression. |
| **Tremolo & Ratchet Subdivider** | `c5:4.roll(4)` or `[d3 f3 a3]:1.trem` | Subdivides rational duration by $N$ (`subDen = duration.denominator * rollCount`), reduces via $\gcd$, and emits $N$ articulated events along `sliceCursor`. | Achieves a $4\times$ to $64\times$ token reduction on orchestral string tremolos, timpani rolls, and trap hi-hat ratchets. |
| **Phrase Swell Interpolation** | `c5:8.cresc d:8.cresc e:8.cresc` | `applyPhraseSwellInterpolation()` groups contiguous `.cresc` or `.dim` steps and linearly interpolates `startVelocity` and `endVelocity` across the run. | Eliminates per-note `.vol(N)` calls; `StudioAudioEngine.ts` ramps both `GainNode` amplitude and `BiquadFilterNode` cutoff. |
| **Forward-Looking Tie Folding** | `d5:2~ d5:4.vib` | `mergeTiedEvents()` scans linearized events sharing `trackId:{voiceId}:${midi}`, verifies contiguous rational boundaries, sums durations, and prunes re-triggers. | Eliminates separate sustain automation and prevents envelope re-striking across beat or barline boundaries. |
| **AST Macro & Repeat Unrolling** | `macro m = { ... }` / `repeat 4 { ... }` | `parseVoiceTokensToEvents()` intercepts inline `repeat N { ... }` blocks (up to $32\times$) and `$macro` subtree calls (with optional `+N`/`-N` semitone transposition). | Compresses recurring multi-bar accompaniment or vocoder chord gates ($54\text{ tokens}$) into a 4-token `$macro` call. |
| **Default-Elided DSP Dictionaries** | `.fx(vocoder, @{bands: 20, bw: 0.35})` | Every synth and FX device in `StudioAudioEngine.ts` defines a canonical default vector; `.ten` serializes only non-default topological deltas. | Compresses $184,000\text{ characters}$ ($4,200$ XML lines) of Ableton `.als` device state into $78\text{ characters}$ ($22\text{ tokens}$). |

---

## Lexical Invariants, Disambiguation and Automated LLM Resilience

Operating a high-density musical grammar where pitch, duration, articulation, dynamics, and DSP parameters are concatenated into space-delimited tokens introduces strict lexical boundaries. Stress-testing across 60-measure symphonic scores and multi-track electronic arrangements establishes four mandatory compiler invariants alongside automated compiler healing passes.

### Strict Measure Beat Summation and Dynamic Overflow Protection

In $4/4$ time, every track assignment and every parallel voice inside a `measure N { ... }` block must sum to exactly $4$ quarter-note beats ($1/1\text{ whole note}$) so that written measure numbers align 1-to-1 with `M1`, `M2`, `M3` on the visual Piano Roll and Arrangement timeline. The canonical duration tokens map to rational bar fractions and quarter-note beat counts as follows:

| Duration Token | Musical Value | Fraction of $4/4$ Bar | Quarter-Note Beats ($4/4$) | Temporal Engine Behavior (`TemporalEngine.ts`) |
| :--- | :--- | :--- | :--- | :--- |
| `:1` | Whole note | $1/1$ | $4.0\text{ beats}$ | Updates `lastDuration` sticky cursor to `{1, 1}`. |
| `:2.` | Dotted half note | $3/4$ | $3.0\text{ beats}$ | Single dot ($d=1$) scales $1/2$ by $3/2 = 3/4$. |
| `:2` | Half note | $1/2$ | $2.0\text{ beats}$ | Updates `lastDuration` sticky cursor to `{1, 2}`. |
| `:4.` | Dotted quarter note | $3/8$ | $1.5\text{ beats}$ | Single dot ($d=1$) scales $1/4$ by $3/2 = 3/8$. |
| `:4` | Quarter note | $1/4$ | $1.0\text{ beat}$ | Default initial `lastDuration` state `{1, 4}`. |
| `:8.` | Dotted eighth note | $3/16$ | $0.75\text{ beats}$ | Single dot ($d=1$) scales $1/8$ by $3/2 = 3/16$. |
| `:8` | Eighth note | $1/8$ | $0.5\text{ beats}$ | Updates `lastDuration` sticky cursor to `{1, 8}`. |
| `:16` | Sixteenth note | $1/16$ | $0.25\text{ beats}$ | Updates `lastDuration` sticky cursor to `{1, 16}`. |
| `:32` | Thirty-second note | $1/32$ | $0.125\text{ beats}$ | Updates `lastDuration` sticky cursor to `{1, 32}`. |
| `:grace` | Atemporal grace note | $0/1$ | $0.0\text{ beats}$ | Sets `isGrace: true`; does not advance logical grid or overwrite `lastDuration`. |

For arbitrary augmentation dots ($d \ge 1$) and scalar multipliers ($M \ge 1$) matched by `^:([0-9]+)(\.+)?(?:\*([0-9]+))?$`, `TemporalEngine.parseDuration()` computes the exact rational duration $(N, D)$ prior to Euclidean $\gcd$ reduction as:

$$\frac{N}{D} = \frac{(2^{d+1} - 1) \cdot M}{D_{\text{base}} \cdot 2^d}$$

To prevent catastrophic timeline collisions if an external LLM ever packs 8 beats (two whole notes) into a single measure block—a failure mode identified and resolved in Contract `TDB-605`—`DocumentParser.compile()` tracks `maxVoiceDurationInMeasure` across all tracks and voices in each measure and advances the master timeline cursor `currentScoreTime` by $\max(\text{measureCapacity}, \text{maxVoiceDurationInMeasure})$. Furthermore, when a secondary voice in a `<[ v1: ... | v2: ... ]>` block falls short of the primary voice, `PolyphonicEngine.ts` (`meta @{ auto_pad_voices: true }`, enabled by default) computes the rational deficit across denominators up to $256$ and injects a terminal rest token (`r:${bestDen}`), preventing `E3002: Voice Sync Failure` crashes.

### The Double-Dot Rule for Dotted Durations with Modifiers (`:4..f`)

Within a Tenuto token, the period character (`.`) is overloaded to serve two distinct syntactic roles: it functions as a rhythmic augmentation dot immediately following a duration denominator (e.g., `d5:4.` $= 3/8\text{ whole note} = 1.5\text{ quarter beats}$), and it acts as the attribute accessor delimiter for chained modifiers (e.g., `.f`, `.stacc`, `.zap`, `.vib`). In `src/parser/ASTSerializer.ts` (and mirrored in `TopologicalMutator.decomposeToken()`), `splitModifiers(raw: string)` disambiguates these roles at top-level bracket/parenthesis/quote depth using a single-character lookahead (`nextChar = raw[i + 1] || ''`):

$$\text{isDottedDuration} = (\text{core} \equiv \text{null}) \land (\text{`:'} \in \text{current}) \land (\text{nextChar} \in \{\text{`'}, \text{`.'}, \text{`*'}\})$$

Consequently, if a score contains an unmodified dotted note (`d5:4.`), `nextChar` is `''` (end of string), so `isDottedDuration` evaluates to `true` and retains the dot inside `core = "d5:4."` ($1.5\text{ beats}$). However, if an author or LLM writes `d5:4.f` intending a dotted quarter note with a *forte* dynamic, when the scanner reaches `.`, `nextChar` is `'f'`. Because `'f'` is neither `''`, `'.'`, nor `'*'`, `isDottedDuration` evaluates to `false`, terminating `core = "d5:4"` ($1.0\text{ beat}$) and pushing `"f"` into the modifier array—silently truncating $0.5\text{ quarter beats}$ from the measure.

When chaining any modifier onto a dotted note, the syntax must use **two dots (`..`)** before the first modifier (e.g., `d5:4..f`, `a5:4..ff.zap.vib`, `g2:2..p.vib`). At the first dot, `nextChar` is `'.'`, so `isDottedDuration` evaluates to `true` and appends the augmentation dot to `current` (`"d5:4."`); at the second dot, `nextChar` is `'f'`, which cleanly splits `core = "d5:4."` and `modifiers = ["f"]`. Alternatively, writing the explicit reduced rational fraction (`d5:3/8.f` or `g2:3/4.p.vib`) bypasses augmentation dot scanning entirely while producing the identical rational duration.

### Explicit Octave Boundaries, Scientific Pitch Spelling and Automated Healing

Because `ASTSerializer` instances persist across sequential `measure` blocks for each `trackId:{voiceId}` pair, omitting an octave digit at the start of a new measure inherits the final octave of the preceding measure. To prevent unintended register displacement when editing or rearranging measures, composers must write an explicit octave integer (`0`–`8`) on the first note of every measure and after any melodic leap larger than a 3rd. Furthermore, `PitchEngine.ts` strictly enforces Scientific Pitch Notation (`[a-g]` followed by `#`, `b`, double-sharp `x`, natural `n`, quarter-tone `qs`, `qf`, `tqs`, `tqf`, octave `0`–`8`, and optional `±Nc` cent offsets such as `c#4`, `eb5`, `aqs4`, `c4+25c`), rejecting LilyPond-style suffixes (`cis`, `ees`, `fis`) with `E1001: Invalid PitchLit token`.

To guarantee fault-tolerant playback when ingesting raw LLM outputs (`TDB-601` and `TDB-608`), `DocumentParser.ts` implements three automated self-healing layers:

1. `sanitizeLLMInput()` strips surrounding Markdown code fences (`` ```tenuto ... ``` ``) and conversational prose when users copy and paste responses directly from Gemini, Claude, or ChatGPT.
2. `tokenizeVoiceStream()` heals fused modifier-pitch tokens—such as `g5:4.ffbb5:4` observed in Measure 47 of the 60-measure symphony when an LLM omits whitespace after a dynamic modifier—by matching `^([a-gA-G][#b]*[0-9]*:[0-9.]+\.(?:pp|p|mp|mf|f|ff|sfz|stacc|ten|marc|cresc|crescendo|dim|diminuendo))([a-gA-G][#b]*[0-9]*:[0-9.].*)$` and splitting the string into `['g5:4.ff', 'bb5:4']` prior to AST serialization.
3. Full multi-measure compilation passes `skipInvalidTokens = true` into `parseVoiceTokensToEvents()` so an isolated unrecognized token never aborts playback of a 60-measure arrangement, whereas single-line REPL Sketch Mode (`pno: c4:8 d e f:`) retains strict validation (`skipInvalidTokens = false`) so incomplete typing states trigger graceful UI fallback to the last valid AST state ("Never Stop the Music" rule).

---

## Bi-Directional Projectional Editing and Dual-Horizon Workspace

Tenuto Studio 5 and 6.0 formalize **Projectional Editing** (`SPEC.md` Addendum J and Contracts `TDB-701`–`TDB-715`), wherein the graphical DAW interface holds zero proprietary binary state and operates strictly as a $60$–$120\text{ FPS}$ projection of the compiled `.ten` Abstract Syntax Tree.

### Span-Exact Surgical AST Patching (`TDB-702`) and Karaoke Highlighting

Early text-based music tools either prohibited visual editing or regenerated the entire text file from an in-memory AST—wiping out user `%%` comments, custom line breaks, and code formatting. Conversely, naive substring replacement (`sourceCode.replace(oldToken, newToken)`) corrupts multi-measure scores whenever two measures contain identical tokens (e.g., dragging a `c4:4` in Measure 12 erroneously rewrites the `c4:4` in Measure 1).

In Tenuto Studio 5 and 6.0 (`TDB-702`), `DocumentParser.attachSourceLocations(rawSource, events)` executes a post-compilation pass that maps every `AtomicEvent` (in both Sketch Mode and Full Document Mode) to its exact UTF-8 character span $[S_{\text{start}}, S_{\text{end}})$ (`sourceStartOffset` and `sourceEndOffset`) and 1-based `(line, col)` coordinates via binary search over line-start indices, explicitly skipping matches inside `%%` or `//` comments and verifying lexical boundary delimiters (`[\s:{\[(|<>]` before and `[\s|}\])>~]` after). When a user resizes a note duration, transposes a pitch or chord on the canvas, or edits velocity/articulation in the `<Inspector />`, `TopologicalMutator.ts` decomposes the token into `{ pitchPart, durationPart, modifiers, hasTie }`, computes the new rational value via Euclid's $\gcd$ algorithm, recomposes the token (automatically inserting `..` if a dotted duration has modifiers), and splices only bytes $[S_{\text{start}}, S_{\text{end}})$:

$$\text{Source}_{\text{next}} = \text{Source}[0 \dots S_{\text{start}} - 1] \;\Vert\; \text{MutatedToken} \;\Vert\; \text{Source}[S_{\text{end}} \dots N]$$

During playback, these exact `sourceStartOffset..sourceEndOffset` spans drive **Real-Time Karaoke Code Highlighting** in the Monaco editor, illuminating active lines and sweeping a progress fill ribbon across each playing token in exact synchronization with the audio playhead. Formatting each `measure N { ... }` block with one track per line ensures the Karaoke spotlight tracks the arrangement cleanly. Furthermore, when a user sweeps a mixer fader or device knob across 60 frames, `CommandManager.executeCommand()` coalesces consecutive `ASTCommand` instances sharing a deterministic `mergeKey` (such as `"fx:lead:eq_eight:freq1"` or `"mixer:vox:vol"`), ensuring `Cmd/Ctrl + Z` undoes the entire human gesture in a single step.

### Unifying Non-Linear Session View with Linear Arrangement View

Tenuto 6.0 (`TDB-701`, `TDB-706`–`TDB-714`) unifies Ableton Live's dual-horizon workflow inside a single `.ten` file, allowing users to toggle seamlessly between `SessionView.tsx`, `ArrangementView.tsx`, `WebGPUCanvas.tsx` (Scrolling Piano Roll), and `TabChordFlowView.tsx`. In Session View, producers declare standalone looping clips (`clip <id> "<Name>" track=<trackId> scene=<N> bars=<B> loop=true follow=@{...} { ... }`) or full horizontal Session View rows (`scene <index> "<Name>" @{ tempo: 126 } { ... }`). Clicking a clip or scene launcher schedules playback on the next global quantization boundary (`meta @{ quantize_launch: "1/1" | "1/4" | "1/8" | "none" }`). At the conclusion of a clip's `follow.bars` span, `FollowActionEngine.ts` evaluates a weighted Bernoulli trial using `chanceA` and `chanceB`:

$$P(\text{Action}_A) = \frac{\text{chance}_A}{\text{chance}_A + \text{chance}_B}, \quad P(\text{Action}_B) = 1 - P(\text{Action}_A)$$

This state machine automatically transitions to `"next"`, `"prev"`, `"first"`, `"last"`, `"any"`, `"other"`, `"play_again"`, or `"stop"`. If a document is authored purely in `scene` or `clip` blocks without explicit `measure` blocks, `DocumentParser.compile()` automatically projects the scene and clip events onto the linear playback timeline so immediate playback and `.wav` export work out of the box. Conversely, engaging **Record to Arrangement** while improvising clip launches in Session View writes the launched clips directly into sequential `measure N { ... }` blocks in the `.ten` source.

In Arrangement View, linear compositions are structured in `measure N { ... }` (or `measure 1-4 { ... }`) blocks accompanied by timeline jump flags (`locator "Main Drop" at measure 17`). Placing `meta @{ tempo: 76 }` inside any `measure N { ... }` block executes a **Piecewise Tempo Change** (`meta.tempoMap`) starting at that bar with sample-accurate playhead and Karaoke synchronization. Decoupled Z-axis automation lanes (`AutomationLaneEditor.tsx` / `AutomationEngine.ts`) compile from invisible spacer tokens `s:4.cc(controller, [v0, v1, ...], "exp" | "linear" | "scurve")`, rendering interactive Bezier curves for filter sweeps, volume ramps, and pan trajectories. Signal routing is declared at the top of the `.ten` score using `return <busId> "<Name>" .fx(...)` (or `def_return`), `sends=@{hall_bus: 0.58, tape_bus: 0.25}` on individual tracks, and submix buses via `group <groupId> "<Name>" tracks=[lead, pad, fm_bell] .fx(...)`, complete with DJ crossfader assignments (`crossfade="A" | "B"` and `meta @{ crossfader: 0.0 }`) and per-track hardware or plugin latency compensation (`delay=-8ms`).

---

## Continuous Synthesis Physics, Instrument Suite and Vocal Formant DSP

A major architectural advancement in Tenuto Studio 5 and 6.0 is the **True Continuous Synth Workflow** (`ContinuousSynthEngine.ts`), which eliminates verbose multi-voice `<[ v1 | v2: s:1.automate(...) ]>` workarounds in favor of direct producer patches, track-level shorthand attributes, intra-note windowed modifiers, and automatic polyphonic voice-leading portamento.

### First-Class Producer Synth Patches and Intra-Note Modifiers

Rather than requiring verbose `macros=@{...}` dictionaries for common electronic production parameters, `def` declarations on `style=synth` tracks accept inline shorthand attributes directly: `vol=104 detune=85 cutoff=9500 resonance=2.0 sub=60 air=80 duck=75 width=140 slop=35 noise=20` alongside `env=@{attack: 0.22, decay: 1.2, sustain: 0.92, release: 2.6}`. `ContinuousSynthEngine.ts` provides five dedicated producer patches that anchor modern electronic arrangements:

* `patch="supersaw"`: Instantiates a 7-voice free-running detuned festival supersaw stack equipped with a phase-locked sub-oscillator, a $120\text{ Hz}$ bass-mono crossover filter that keeps sub-bass frequencies phase-coherent in mono while the upper unison saws spread wide in stereo, and a high-shelf harmonic exciter above $5.5\text{ kHz}$ (`air`).
* `patch="reese_bass"` (or `"reese"`): Pairs a wide stereo detuned sawtooth stack with a phase-locked sub-octave sine oscillator and a saturating ladder low-pass filter.
* `patch="flutter_pad"`: Provides a lush chord synth with global song-clock LFO amplitude and filter flutter plus stereo chorus.
* `patch="pluck_lead"` / `"acid_lead"`: Delivers a snappy resonant filter-envelope lead with transient punch.
* `patch="riser"`: Executes an automatic upward pitch and filter sweep calibrated across the exact rational duration of the note or chord.

Every continuous synth modifier in Tenuto can target a sub-note time slice (`start..end` within `0.0..1.0`)—using automatic raised-cosine edge feathering so mid-note activations never produce discontinuous amplitude or phase clicks—or trace a multi-point interpolation curve (`[v0, v1, ...]`) across the note's sustain. For example, writing `[d3 a3 d4 e4 f#4 a4 c#5]:1.ff.stack("octaves").detune(92%, 0.35..0.85).glide(140ms)` attacks with a clean, phase-focused transient for the first $35\%$ of the bar, blooms into a $92\%$ octave-stacked unison wall between $35\%$ and $85\%$ of the bar, and reconverges cleanly for the final $15\%$ as it glides into the next chord. Similarly, writing `.detune([10, 95, 25])` or `.drive([0.3, 0.85])` interpolates smoothly across the array checkpoints from note onset to release. Furthermore, attaching `.glide(180ms)` to a bracketed chord such as `[ab2 eb3 c4 g4 c5]:1.glide(180ms)` followed by `[ab2 eb3 f4 ab4 b4]:1` instructs the synth engine to automatically pair each voice $v_i$ of Chord 1 with the corresponding voice of Chord 2 and glide all voices independently along their shortest voice-leading trajectory over the final $180\text{ ms}$ of the bar, eliminating any need to split chords into separate `.mpe()` voices for polyphonic portamento.

| # | Continuous Modifier Syntax | Parameter Range & Units | DSP Physical Mechanism in `ContinuousSynthEngine.ts` |
| :--- | :--- | :--- | :--- |
| 1 | `.detune(pct, start..end)` / `.detune([...])` | `0..100%`, window `0.0..1.0` | Controls unison oscillator stack pitch spread with raised-cosine windowing or multi-point curves. |
| 2 | `.detune_cents(cents, start..end)` | `-1200..+1200c`, `0.0..1.0` | Applies a fine pitch offset in cents to any specific slice of a sustained note. |
| 3 | `.filter(startHz, endHz)` / `.cutoff(hz, s..e)` / `.res(q)` | Cutoff $60\dots16000\text{ Hz}$, $Q\ 0.5\dots18$ | Inline State-Variable Filter (SVF) cutoff frequency sweep and resonance control. |
| 4 | `.flutter(rateHz \| [startRate, endRate])` | $1\dots32\text{ Hz}$ | Song-clock synchronized LFO amplitude/filter flutter gate supporting accelerating/decelerating ramps. |
| 5 | `.warble(depth, rateHz)` | Depth `0..100%`, Rate $0.2\dots16\text{ Hz}$ | Analog tape pitch wow and flutter modulation. |
| 6 | `.pitch_dip(-N)` / `.tapestop` | `-1..-24` semitones | Dips pitch by $-N$ semitones at the end of the bar and recovers for mid-drop turnarounds. |
| 7 | `.stack("octaves" \| "fifths" \| "seventh" \| "super")` | Enum string | Shifts outer unison oscillators to $+12\text{ st}$ octaves, $+7\text{ st}$ fifths, $+11\text{ st}$ 7ths, or full super-stack. |
| 8 | `.noise(level, "white" \| "pink" \| "breath", s..e)` | `0..100%`, window `0.0..1.0` | Injects a windowed pre-filter noise oscillator layer (white, pink, or breath air). |
| 9 | `.sync(ratio \| [startRatio, endRatio])` | `1.0..16.0` | Sweeps hard-sync slave oscillator harmonic ratio across the note duration. |
| 10 | `.fm(amount, ratio)` & `.ring(amount, freqHz)` | Amount `0..100%`, Ratio/Hz | Audio-rate linear frequency modulation and ring modulation. |
| 11 | `.pwm(duty, rateHz)` & `.warp_wave("bend" \| "mirror", amt)` | Duty `0.05..0.95` | Pulse-width modulation and continuous phase-transfer waveform warping. |
| 12 | `.keytrack(0..100%)` | `0..100%` | Scales SVF filter cutoff frequency proportionally with note pitch relative to $\text{C4}$ ($261.63\text{ Hz}$). |
| 13 | `.comb(freqHz, feedback)` | $60\dots4000\text{ Hz}$, FB `0..0.98` | Tuned delay-line comb / flanger physical resonator. |
| 14 | `.duck(depth)` / `duck=80` | `0..100%` | Built-in quarter-note sidechain pumping envelope without requiring external drum triggers. |
| 15 | `.gate([1, 0, 1, 1, 0, 1, 0, 1])` | 8-step or 16-step binary array | Rhythmic trance-gate amplitude chopper applied across sustained notes or chords. |
| 16 | `.zap` / `.pluck(decayMs, semitones)` | $+12\dots24\text{ st}$ over $15\text{ ms}$ | Fast pitch-attack transient spike for punchy electronic leads and plucks. |
| 17 | `.haas(delayMs)` & `.width(pct \| [startPct, endPct])` | Haas $0.5\dots35\text{ ms}$, Width `0..200%` | Stereo Haas micro-delay widening and Mid/Side (M/S) stereo field expansion. |
| 18 | `.analog_slop(0..100%)` / `slop=35` | `0..100%` | Organic voice-to-voice hardware component tolerance drift in oscillator pitch and filter cutoff. |
| 19 | `.air(0..100%)` / `air=85` | `0..100%` | High-shelf harmonic exciter above $5.5\text{ kHz}$ for crystalline supersaw sheen. |
| 20 | `.pre_swell` & `.open_voice` / `.drop2` | Flag modifiers | Reverse-envelope pre-drop suction swell (`.pre_swell`) and automatic cinematic Drop-2 chord spreading (`.open_voice`). |

### Ableton Flagship Synths, Physical Models, SoundFonts and Microtonality

Beyond `ContinuousSynthEngine.ts`, Tenuto Studio 5 and 6.0 implement dedicated DSP engines (`WavetableEngine.ts`, `AbletonSynthSuite.ts`, `SamplerAndDrumRackEngine.ts`, and `SoundfontLibrary.ts`) covering the complete instrument roster. When a track declares `style=synth patch="wavetable"` (`TDB-716`), Tenuto instantiates a dual-oscillator morphing wavetable voice holding 2D wavetable matrices $W[m][k]$ of $M$ frames by $K = 2048\text{ samples}$, supporting up to 8-voice stereo unison across Classic, Shimmer, Noise, and Phase Sync topologies. Given a normalized `wave_pos` parameter $\alpha \in [0, 1]$ (modulatable via `macros=@{wave_pos: 68}`, `.cc()`, or MPE Slide), the engine interpolates adjacent band-limited frames in real time:

$$s_{\text{osc}}(t) = (1 - \beta)\,W_{\lfloor \alpha(M-1) \rfloor}(\phi(t)) + \beta\,W_{\lceil \alpha(M-1) \rceil}(\phi(t)), \quad \beta = \alpha(M-1) - \lfloor \alpha(M-1) \rfloor$$

For `patch="operator"` (`TDB-717`), Tenuto constructs a 4-operator FM and additive synthesis graph ($A, B, C, D$) supporting all 11 classic Ableton Operator routing topologies (`env=@{algorithm: "4", ratioA: "1.0", ratioB: "3.5", ratioC: "7.0", feedback: "0.25"}`) governed by coarse/fine harmonic ratios $r_k$ and time-variant envelope modulation indices $I_k(t)$:

$$y_A(t) = A_{\text{env}}(t) \sin\!\Big(2\pi f_0 r_A t + I_B(t) \sin\big(2\pi f_0 r_B t + I_C(t)\sin(2\pi f_0 r_C t)\big)\Big)$$

The synthesis suite further encompasses `patch="meld"` (`TDB-718`, pairing two scale-aware macro-oscillator engines whose Swarm, Chord, and Harmonic modes quantize partials to `meta @{ key, scale }`), `patch="drift"` (modeling analog hardware circuitry with `drift_amount` and `sub_blend`), `patch="analog"`, `patch="saw_lead"`, `patch="warm_pad"`, `patch="string_pad"`, and `patch="808_sub"`. Physical modeling engines (`patch="collision"`, `"tension"`, and `"electric"` — `TDB-720`) utilize tuned 2-pole modal resonator banks and Karplus-Strong waveguide delay lines ($L = f_s / f_0$) for mallets, membranes, and strings, while `patch="granulator"` (Granulator III — `TDB-724`) slices `src="..."` audio buffers into overlapping raised-cosine grains of length $d_g \in [2\text{ ms}, 500\text{ ms}]$ with controllable `spray`, `scan`, and pitch `jitter`.

For sample-based and percussive workflows, `style=simpler` / `style=concrete` maps named vocal or instrumental time slices (`def vox "Vocal Chop" style=simpler patch="simpler" src="vox.wav" map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s] }`), while `style=grid` (`TDB-723`) provides the 128-Pad Studio Drum Rack (`patch="tenuto_808_kit"`, `"timpani"` (`timp`), and `"taiko_drum"` (`ham` Mahler hammer)). Every drum token—`k`/`bd` (MIDI 36), `s`/`sd` (38), `cp` (39), `rim` (37), `h`/`ch` (42), `oh` (46), `lt` (45), `mt` (47), `ht` (50), `cr` (49), and `rd` (51)—hosts its own sampler, per-pad `.fx()`, and Choke Group (`1`–`16`), executing a $6\text{ ms}$ de-clicked choke fade on `oh` (Choke Group 1) whenever `h`/`ch` (Choke Group 1) triggers. Acoustic and orchestral tracks (`style=standard` — `TDB-612`, `TDB-617`) stream and cache multi-sampled recordings from the 128-instrument MusyngKite General MIDI HD SoundFont library in `caches.open('tenuto-soundfont-vault-v1')`, automatically resolving composer shorthand (`vln1` $\to$ `violin`, `vln2` $\to$ `string_ensemble_1`, `vla` $\to$ `viola`, `vc` $\to$ `cello`, `cb` $\to$ `contrabass`, `harp` $\to$ `orchestral_harp`, `hn` $\to$ `french_horn`, `tpt` $\to$ `trumpet`, `tbn` $\to$ `trombone`, `tba` $\to$ `tuba`, `fl` $\to$ `flute`, `ob` $\to$ `oboe`, `cl` $\to$ `clarinet`, `bsn` $\to$ `bassoon`, `choir` $\to$ `choir_aahs`, `vox` $\to$ `voice_oohs`, `pno` $\to$ `salamander_grand`) and looping sustained plateaus seamlessly via energy-gated crossfading (`TDB-622`).

Across all melodic engines, `PitchEngine.ts` (`TDB-703`) supports **Global Scale Lock** (`scale_lock: true`) across 22 scales (`major`, `minor`, `harmonic_minor`, `melodic_minor`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `locrian`, `major_pentatonic`, `minor_pentatonic`, `blues`, `whole_tone`, `diminished_wh`, `diminished_hw`, `hungarian_minor`, `phrygian_dominant`, `hirajoshi`, `insen`, `arabic`), 11 built-in microtonal tuning tables (`12tet`, `just_intonation`, `pythagorean`, `meantone`, `19tet`, `24tet`, `31tet`, `carlos_alpha` at $78.0\text{ c}$ steps, `bohlen_pierce` across a $1901.955\text{ c}$ tritave, `slendro`, `pelog`), and raw `.scl` file parsing. For non-12TET tunings anchored to `rootMidi` ($60 + \text{rootSemitone}$), `computeFrequencyForMidi()` evaluates:

$$f = f_{\text{root}} \cdot 2^{\frac{\text{periods} \cdot C_{\text{period}} + C_{\text{degree}} + C_{\text{extra}}}{1200}}, \quad f_{\text{root}} = f_{\text{A4}} \cdot 2^{\frac{\text{rootMidi} - 69}{12}}$$

### Klatt Vocal Tract Formant Synthesis (`PhonemeEngine.ts`) and Groove Pool (`GrooveEngine.ts`)

When `.lyric("...")` is attached to a note or chord (paired with either acoustic choir patches or the 20-band `.fx(vocoder)` filterbank), `PhonemeEngine.decomposeLyric()` strips non-alphabetic characters, classifies leading onset and trailing coda consonant clusters into fricative (sibilants at $5200\text{ Hz}$ or non-sibilants at $2800\text{ Hz}$ for $42\text{ ms}$), plosive ($1900\text{ Hz}$ for $24\text{ ms}$), nasal ($450\text{ Hz}$ for $30\text{ ms}$), or liquid ($1100\text{ Hz}$ for $28\text{ ms}$), and maps the nucleus to canonical Klatt vocal tract formant targets ($F_1, F_2, F_3$ in $\text{Hz}$):

| Klatt Vowel Code | Example English Syllables | Formant $F_1$ ($\text{Hz}$) | Formant $F_2$ ($\text{Hz}$) | Formant $F_3$ ($\text{Hz}$) | Bandwidths $(B_1, B_2, B_3)$ ($\text{Hz}$) | Diphthong Trajectory Mapping in `PhonemeEngine.ts` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `IY` | "feel", "be", "we", "me" | $310$ | $2400$ | $3000$ | $(60, 100, 140)$ | Target vowel for /aɪ/ (`AA` $\to$ `IY`) and /eɪ/ (`EH` $\to$ `IY`). |
| `IH` | "it", "in", "if" | $420$ | $1980$ | $2600$ | $(65, 100, 140)$ | Target vowel for "doin'" (`UW` $\to$ `IH`). |
| `EH` | "let", "ev-ry" | $560$ | $1820$ | $2520$ | $(75, 110, 150)$ | Primary onset vowel for /eɪ/ ("break", "day", "make"). |
| `AE` | "and", "dan-cing" | $690$ | $1720$ | $2450$ | $(80, 115, 150)$ | Default short 'a' vowel (except "all" $\to$ `AO`). |
| `AA` | "ah", "right", "light", "now" | $750$ | $1220$ | $2500$ | $(85, 110, 150)$ | Primary onset for /aɪ/ (`AA` $\to$ `IY`) and /aʊ/ (`AA` $\to$ `UW`). |
| `AO` | "on", "for", "all", "go" | $590$ | $920$ | $2450$ | $(80, 100, 140)$ | Primary onset for /oʊ/ ("go", "no", "so": `AO` $\to$ `UW`). |
| `UH` | "good", "put" | $460$ | $1120$ | $2350$ | $(70, 100, 140)$ | Mid-high back lax rounded vowel. |
| `UW` | "do", "you", "to", "doin'" | $330$ | $900$ | $2300$ | $(65, 95, 140)$ | Primary vowel for "doin'" (`UW` $\to$ `IH`); coda for /aʊ/ and /oʊ/. |
| `AH` | "up", "the" | $620$ | $1320$ | $2450$ | $(75, 105, 140)$ | Central unrounded schwa/wedge vowel. |
| `ER` | "world", "her" | $490$ | $1380$ | $1720$ | $(70, 100, 130)$ | Rhotacized vowel triggered when 'e' is followed by 'r'. |

Simultaneously, `GrooveEngine.applyGrooveToEvent()` evaluates Ableton Groove Pool definitions (`groove mpc_swing "MPC 16th Swing" @{ base: "1/16", quantize: 85%, timing: 38%, random: 8%, velocity: 45% }`) non-destructively at audio scheduling time. For a note at logical position $W_{\text{start}}$ on subdivision grid $W_{\text{step}} = 1 / D_{\text{step}}$ with nearest grid index $k = \text{round}(W_{\text{start}} / W_{\text{step}})$, `GrooveEngine` snaps toward $k \cdot W_{\text{step}}$ by `quantizeRatio`, delays odd offbeat subdivisions ($|k \bmod 2| = 1$) by $0.34 \cdot W_{\text{step}} \cdot r_{\text{timing}}$ (matching hardware MPC $66\%$ triplet swing at $100\%$ timing), adds deterministic sinusoidal pseudo-random jitter up to $\pm 12\text{ ms} \cdot r_{\text{random}}$, and scales velocity by $1 \pm 0.14 \cdot r_{\text{vel}}$.

---

## Modular Audio/MIDI FX Rack, Elastic Warping and Mix Diagnostics

Every `def` track, `group` bus, and `return` bus supports chained `.midi_fx(name, @{...})` and `.fx(name, @{...})` processors rendered interactively in `DeviceChainDock.tsx` and executed by `AbletonAudioFxEngine.ts` and `AbletonSynthSuite.ts`. Furthermore, Ableton Live 12's MIDI Transformations (Arpeggiate, Connect, Ornament, Accelerate/Decelerate, Strum, Span) and MIDI Generators (Rhythm, Seed, Shape, Stacks) in `MidiTransformAndGeneratorEngine.ts` (`TDB-736`–`TDB-740`) operate as direct AST code generators, writing scale-locked chord voicings and rhythmic patterns straight into the `.ten` measure block.

| Category | Device Name(s) in `.ten` | Key Dictionary Parameters (`@{ ... }`) & Signal Processing Topology |
| :--- | :--- | :--- |
| **MIDI FX (9 Devices)** | `arpeggiator` | `rate` (`'1/16'`), `style` (`'up'`, `'down'`, `'up_down'`, `'random'`, `'converge'`, `'diverge'`), `gate` (`80`), `steps` (`1`–`3`), `distance` (`12` st). |
| **MIDI FX** | `chord` | `shift1..shift4` (semitone intervals, e.g., `3, 7, 10, 14`), `strum` ($\text{ms}$ delay between chord voices, e.g., `25`). |
| **MIDI FX** | `scale` | `key` / `root` (`'C'`, `'D'`, `'F#'`), `scale` (`'major'`, `'minor'`, `'harmonic_minor'`, `'dorian'`, `'blues'`). |
| **MIDI FX** | `random` | `chance` (probability $\%$), `choices` (`1`–`12`), `scale` (interval multiplier in semitones). |
| **MIDI FX** | `velocity` | `drive` (curve multiplier), `random` (jitter range), `min` / `out_min` (`1`–`127`), `max` / `out_max` (`1`–`127`). |
| **MIDI FX** | `note_length` | `length` (`'1/8'`, `'100ms'`), `gate` (duration multiplier $\%$, e.g., `135` for legato barline overlap), `latch` (`true`/`false`). |
| **MIDI FX** | `pitch` | `pitch` / `st` (semitone transposition, e.g., `+12`, `-24`), `min` (lowest MIDI note), `max` (highest MIDI note). |
| **MIDI FX** | `note_echo` | `delay` / `time` (`'3/16'`, `2`), `repeats` (`1`–`8`), `feedback` (`0.45`), `pitch_decay` (st/repeat), `velocity_decay`. |
| **MIDI FX** | `expressive_chords` | `preset` (`'maj7'`, `'min9'`, `'sus4'`, `'pop_stack'`), `strum` ($\text{ms}$ voice stagger, e.g., `18`–`35`), `humanize` (`20`). |
| **EQ & Filtering (3)** | `eq_eight`, `eq_three`, `auto_filter` | `eq_eight`: 8 biquad stages, Stereo/L-R/Mid-Side ($M=(L+R)/2, S=(L-R)/2$), `low_cut`, `bell1_freq`, `bell1_db`, `high_shelf_freq`. `auto_filter`: `type` (`"morph"`), `cutoff`, `res`, `lfo_rate`, `drive`. |
| **Dynamics (6)** | `compressor`, `glue_compressor`, `multiband_dynamics` (`ott`), `drum_buss`, `limiter`, `gate` | `glue_compressor`: SSL-style bus compressor (`attack`, `release`, `ratio`, `threshold`, `makeup`, `mix`). `multiband_dynamics`: 3-band upward/downward `ott` (`amount`, `high_gain`). `drum_buss`: `drive`, `crunch`, `transients`, `boom_freq`, `boom_amount`. `limiter`: `ceiling`, `gain_db`. |
| **Drive & Color (8)** | `roar`, `saturator`, `amp`, `cabinet`, `pedal`, `vinyl_distortion`, `redux`, `erosion` | `roar`: Multi-stage (`routing: "multiband"`, `drive_low`, `drive_mid`, `drive_high`, `feedback`, `mix`). `saturator`: `curve` (`"analog_clip"`), `drive`, `bass_enhancer`. `erosion`: wideband noise/sine modulation (`freq`, `amount`). |
| **Reverb & Delay (4)** | `hybrid_reverb`, `reverb`, `echo`, `delay` | `hybrid_reverb`: Convolution + 5 algorithmic networks (`"shimmer"` with $+12\text{ st}$ pitch feedback, `"dark"`, `"quartz"`, `"tides"`, `"prism"`, `decay`, `predelay`, `mix`). `echo`: `sync` (`"3/16"`), `time`, `feedback`, `stereo_mode` (`"ping_pong"`), `wobble`, `ducking`. |
| **Modulation & Pitch (6)** | `chorus` (`chorus_ensemble`), `phaser_flanger`, `vocoder`, `auto_shift`, `shifter`, `frequency_shifter` | `vocoder`: 20-band filterbank (`bands: 20`, `range: "5000hz"`, `formant`, `depth`, `bw`, `release`, `mix`) paired with `.lyric("...")`. `auto_shift`: real-time scale-locked pitch/formant correction (`scale_lock`, `formant_shift`, `vibrato`). |
| **Spectral, Physical & Utility (6)** | `spectral_resonator`, `spectral_time`, `corpus`, `resonators`, `beat_repeat`, `looper`, `utility` | `spectral_resonator`: MIDI-tracked STFT resonance (`mode: "midi"`, `decay`, `shift`, `mix`). `corpus` / `resonators`: tuned physical modal/waveguide resonators. |

### Elastic Audio Warping, Comping and Audio-to-`.ten` Decompilation

For recorded vocals, live instruments, and sample loops (`style=concrete` and `style=simpler`), `TenutoProcessor.ts` (AudioWorklet) implements five elastic warp modes (`TDB-741`):

* `warp(beats)`: Transient-preserving percussive stretching.
* `warp(tones)` and `warp(texture)`: PSOLA and granular cloud stretching.
* `warp(repitch)`: Variable-speed tape resampling where $\text{rate} = \text{BPM}_{\text{target}} / \text{BPM}_{\text{source}}$.
* `warp(complex)` / `warp(complex_pro)`: STFT phase-vocoder stretching with spectral envelope formant preservation via `.formant(15%)` and `.transpose(-3st)`.

Additionally, multi-pass loop recording stacks takes into `take 1`, `take 2`, `take 3` lanes with $10\text{ ms}$ equal-power comp crossfades (`TDB-742`), while built-in AI processors split mixed audio into 4 isolated `.ten` stem tracks (`TDB-743`) or transcribe polyphonic audio harmony, melody, and drum onsets directly into idiomatic `.ten` code (`TDB-744`).

### Production Mix Engineering and Engine Stability Diagnostics

When authoring or debugging emotionally expressive, cinematic electronic and orchestral scores in Tenuto Studio 5 and 6.0 (such as converting a static C minor arrangement into a dynamic unison-and-orchestra production), specific acoustic and scheduling failure modes arise if aggressive modifiers are stacked indiscriminately—each governed by a deterministic architectural remedy:

| Diagnostic Anomaly | Root Cause in Score / DSP Graph | Deterministic Architectural Fix (`.ten` & `StudioAudioEngine.ts`) |
| :--- | :--- | :--- |
| **Abrupt Note Cutoffs & Rhythm Holes at Barlines** | Simultaneous global `sidechain: "drums"`, high `duck=82`, and LFO `.flutter()` carve 4 volume holes per bar even when no drum strikes; short default ADSR release tails and `.pre_swell` / `.pitch_dip(-12)` mute bar edges. | Remove quarter-note `.duck()`, `.flutter()`, and `.pre_swell`; declare long ADSR release tails (`env=@{attack: 0.22, decay: 1.2, sustain: 0.92, release: 2.6}`); attach `.midi_fx(note_length, @{gate: 135})` for $35\%$ barline overlap; chain `.legato` and `.glide()` on melody notes. |
| **Harsh Transient Clicks & Master Bus Clipping** | `.zap` injects a $+18\text{ st}$ pitch spike over $15\text{ ms}$; running `vol=108..110` at `.ff` velocity (`120`) into `roar` (`.drive([0.52, 0.96])`), `multiband_dynamics` (`ott`), and $15800\text{ Hz}$ supersaws overloads master headroom. | Remove `.zap` for bowed attacks (`attack: 0.16..0.35`); balance track levels at `vol=78..88` and `.p`..`.f` dynamics; constrain low-pass sweeps ($1800\dots6200\text{ Hz}$ saws, $160\dots410\text{ Hz}$ sub); insert `.fx(glue_compressor)` and `.fx(limiter, @{ceiling: -1.5})`. |
| **60-Bar SVG Re-Render Stall & Metallic Reverb Roar (`TDB-608`)** | $60\text{ FPS}$ `requestAnimationFrame` un-memoized SVG diffs stall the main thread by $>100\text{ ms}$, causing $30+$ overdue notes to clamp onto `ctx.currentTime + 0.006` and poison `ConvolverNode` with `NaN`. | Isolate audio lookahead onto a $25\text{ ms}$ `setInterval` clock; cap polyphony at 48 voices with de-clicked voice stealing; memoize static Piano Roll SVG separately from playhead; call `rebuildMasterChain()` on every `playScore()` and use feed-forward dry/wet reflections. |

---

## Reference Production Architecture: Seamless Hybrid Score (`.ten`)

The following self-contained Tenuto 6.0 score synthesizes the complete architectural best practices—combining return buses, group submixes, groove templates, continuous windowed synth modifiers, automatic polyphonic `.glide()`, `.open_voice` Drop-2 spreading, `.midi_fx(note_length)` barline overlap, Klatt `.lyric()` vocoding, and piecewise tempo deceleration—while strictly obeying the $4/4$ measure summation and double-dot (`..`) lexical invariants:

```tenuto
tenuto "6.0" {
  meta @{
    title: "Sub-Harmonic Sanctuary (Reference Architecture)",
    tempo: 86,
    time: "4/4",
    key: "C",
    scale: "minor",
    scale_lock: true,
    quantize_launch: "1/1"
  }

  groove pocket_16 "Subtle 16th Pocket" @{
    base: "1/16",
    quantize: 90%,
    timing: 24%,
    random: 5%,
    velocity: 30%
  }

  return hall_bus "Cathedral Shimmer Return"
    .fx(hybrid_reverb, @{mode: "parallel", algorithm: "shimmer", decay: 5.8, predelay: 32, mix: 1.0})
    .fx(glue_compressor, @{threshold: -14, ratio: 2.0, mix: 0.85})

  return tape_bus "Ribbon Ping-Pong Echo"
    .fx(echo, @{time: 0.348, feedback: 0.48, stereo_mode: "ping_pong", mix: 1.0})
    .fx(chorus, @{rate: 0.45, amount: 0.35, mix: 0.5})

  def saws "Velvet Supersaw Stack" style=synth patch="supersaw"
    group="synth_bus" vol=88 detune=78 cutoff=4800 resonance=1.1 sub=45 air=42 width=145 slop=28
    env=@{attack: 0.22, decay: 1.2, sustain: 0.92, release: 2.6}
    sends=@{hall_bus: 0.65, tape_bus: 0.3}
    .midi_fx(note_length, @{gate: 135})
    .fx(glue_compressor, @{threshold: -16, ratio: 2.5, mix: 0.8})
    .fx(limiter, @{ceiling: -1.5, gain_db: 0.0})

  def reese "Abyssal Reese Sub" style=synth patch="reese_bass"
    group="synth_bus" vol=86 detune=58 cutoff=320 resonance=1.2 sub=82 width=105 slop=20
    env=@{attack: 0.18, decay: 1.0, sustain: 0.95, release: 2.2}
    sends=@{hall_bus: 0.18}
    .midi_fx(note_length, @{gate: 135})
    .fx(glue_compressor, @{threshold: -15, ratio: 3.0, mix: 0.9})
    .fx(limiter, @{ceiling: -2.0, gain_db: 0.0})

  def lead "Weeping Analog Lead" style=synth patch="saw_lead"
    group="synth_bus" groove="pocket_16" vol=88 detune=62 cutoff=3800 resonance=1.2 sub=25 air=38 width=125 slop=30
    env=@{attack: 0.16, decay: 1.2, sustain: 0.92, release: 2.4}
    sends=@{hall_bus: 0.62, tape_bus: 0.52}
    .midi_fx(note_length, @{gate: 130})
    .fx(glue_compressor, @{threshold: -16, ratio: 2.5, mix: 0.85})

  def vox "Talking Vocoder Choir" style=synth patch="wavetable"
    group="synth_bus" vol=84 detune=64 cutoff=5200 width=150
    env=@{attack: 0.2, decay: 1.0, sustain: 0.9, release: 2.2}
    sends=@{hall_bus: 0.72}
    .midi_fx(note_length, @{gate: 130})
    .fx(vocoder, @{bands: 20, range: "5000hz", formant: 1.05, release: 180, mix: 0.92})

  def cello "Concertgebouw Solo Cello" style=standard patch="cello"
    vol=86 pan=-0.15 env=@{attack: 0.18, decay: 1.2, sustain: 0.92, release: 2.4}
    sends=@{hall_bus: 0.65}
    .midi_fx(note_length, @{gate: 135})
    .fx(compressor, @{threshold: -18, ratio: 2.5})

  def pno "Felt Nocturne Grand" style=standard patch="salamander_grand"
    vol=82 pan=0.12 sends=@{hall_bus: 0.68, tape_bus: 0.32}
    .midi_fx(note_length, @{gate: 135})
    .midi_fx(expressive_chords, @{strum: 24})

  def drums "Halftime Heartbeat Kit" style=grid patch="tenuto_808_kit"
    groove="pocket_16" vol=80 sends=@{hall_bus: 0.32}
    .fx(glue_compressor, @{threshold: -16, ratio: 3.0, mix: 0.9})
    .fx(limiter, @{ceiling: -2.5, gain_db: 0.0})

  group synth_bus "All Synths Submix" tracks=[saws, reese, lead, vox]
    .fx(glue_compressor, @{ratio: 3, threshold: -12, mix: 0.8})
    .fx(eq_eight, @{low_cut: 32})

  locator "Movement I - Unison Bloom" at measure 1
  locator "Movement II - Picardy Resolution" at measure 3

  measure 1 {
    saws:  [c3 g3 d4 eb4 g4]:1.mf.open_voice.stack("octaves").detune(78%, 0.15..0.92).filter(2000, 5200).glide(240ms) |
    reese: c1:1.mf.legato.detune(68%, 0.15..0.92).filter(180, 350).warble(18, 1.6).glide(220ms) |
    lead:  g4:2..mf.legato.vib.detune(66%, 0.2..0.9).haas(8ms).glide(180ms) f4:8.mf.legato.glide(140ms) eb4:8.mf.legato.glide(160ms) |
    vox:   [c4 eb4 g4]:1.mp.lyric("hold on to the") |
    cello: eb3:2..mf.legato.vib.glide(180ms) d3:4.mf.legato.vib.glide(180ms) |
    pno:   [c3 g3 d4 eb4 g4]:1.mp.open_voice |
    drums: <[ v1: k:4.mp r:8 k:8.p r:4 k:4.mp | v2: r:2 s:4.mp r:4 | v3: ch:8.p ch:8.p ch:8.p ch:8.p oh:8.p ch:8.p ch:8.p ch:8.p ]>
  }

  measure 2 {
    saws:  [ab2 eb3 g3 bb3 c4]:1.f.open_voice.stack("octaves").detune(82%, 0.15..0.92).filter(2200, 5600).glide(240ms) |
    reese: ab0:1.f.legato.detune(72%, 0.15..0.92).filter(190, 370).warble(20, 1.8).glide(220ms) |
    lead:  d4:2.f.legato.vib.detune(68%, 0.2..0.9).glide(180ms) c4:4.f.legato.glide(160ms) d4:4.f.legato.glide(180ms) |
    vox:   [ab3 c4 eb4 g4]:1.mp.lyric("light in the") |
    cello: c3:2.f.legato.vib.glide(180ms) eb3:2.f.legato.vib.glide(180ms) |
    pno:   [ab2 eb3 g3 bb3 c4]:1.mp.open_voice |
    drums: <[ v1: k:4.mp r:8 k:8.p r:4 k:4.mp | v2: r:2 s:4.mp r:8 rim:8.p | v3: ch:8.p ch:8.p ch:8.p ch:8.p oh:8.p ch:8.p ch:8.p oh:8.p ]>
  }

  measure 3 {
    meta @{ tempo: 74 }
    saws:  [f2 c3 eb3 g3 ab3]:1.mp.open_voice.detune(52%, 0.15..0.9).filter(2800, 1600).glide(260ms) |
    reese: f1:2.mp.legato.detune(48%, 0.15..0.9).filter(220, 160).glide(240ms) g1:2.mp.legato.detune(44%, 0.15..0.9).filter(200, 140).glide(240ms) |
    lead:  eb4:2..mp.legato.vib.detune(48%, 0.2..0.85).glide(200ms) d4:4.p.legato.vib.glide(220ms) |
    vox:   [f3 ab3 c4 eb4]:1.p.lyric("falling rain") |
    cello: f2:2.mp.legato.vib.glide(200ms) g2:2.p.legato.vib.glide(220ms) |
    pno:   [f2 c3 eb3 ab3]:2.p.open_voice [g2 d3 f3 b3]:2.p.open_voice |
    drums: <[ v1: k:2.p r:2 | v2: r:2 rim:2.p | v3: ch:2.p ch:2.p ]>
  }

  measure 4 {
    meta @{ tempo: 66 }
    saws:  [c2 g2 c3 e3 g3 b3 d4]:1.pp.open_voice.detune(34%, 0.1..0.95).filter(1500, 850) |
    reese: c1:1.pp.legato.detune(30%, 0.1..0.95).filter(160, 110) |
    lead:  c4:1.pp.legato.vib.detune(30%, 0.15..0.9).warble(10, 1.1) |
    vox:   [c4 e4 g4 b4 d5]:1.pp.lyric("stay") |
    cello: c2:1.pp.legato.vib |
    pno:   [c2 g2 e3 g3 b3 d4]:1.pp.open_voice
  }
}
```

---

## Conclusions and Architectural Recommendations

Unifying $100\%$ of Ableton Live 12 Suite's synthesis, effect, session, and audio-warping subsystems with the declarative `.ten` compiler fundamentally transforms both human studio engineering and automated AI music generation. When deploying LLMs to author, arrange, or debug `.ten` scores, system prompts and automated verification linters must enforce the four compiler invariants:

1. **Strict rational beat summation per voice** ($= 1/1$ in $4/4$).
2. **Double-dot disambiguation** (`:4..f` or `:3/8.f`) whenever attaching modifiers to dotted durations.
3. **Explicit octave integers (`0`–`8`)** at measure boundaries and across leaps larger than a third.
4. **Standard Scientific Pitch Notation** (`[a-g]` with `#`, `b`, `qs`, `qf`).

Coupling generation with a deterministic rational-sum verifier guarantees barline-accurate multi-track scores in under $40\text{ ms}$.

At the sound-design layer, composers and autonomous agents should systematically prioritize **intensional and continuous primitives** over extensional token bloat—leveraging `$macro` subtree reuse, `(pitch):hits/steps` Euclidean generators, `.roll(N)` subdivisions, `.cresc`/`.dim` phrase interpolation, and `ContinuousSynthEngine` sub-note windows (`.detune(pct, start..end)`, `.glide(180ms)`, `.open_voice`) rather than unrolling repetitive sixteenth-note tokens or multi-voice CC automation workarounds. Because every mix decision—from a $+2.5\text{ dB}$ high-shelf on `eq_eight` to a Bernoulli Follow Action probability or a Klatt vocoder lyric—is serialized as a human-readable topological delta in a $15\text{ KB}$–$60\text{ KB}$ UTF-8 text file, engineering teams can branch arrangements in Git, review remix pull requests via line-by-line semantic diffs, index complete multi-track phrases inside single LanceDB RAG vector chunks, and guarantee bit-identical browser and native desktop rendering across decades.