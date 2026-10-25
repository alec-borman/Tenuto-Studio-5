import { quantizeMidiToScale, parseKeyRootSemitone, SCALE_INTERVALS } from '../parser/PitchEngine';

export type MidiTransformType =
  | 'arpeggiate'
  | 'strum'
  | 'connect_legato'
  | 'ornament'
  | 'humanize';

export type MidiGeneratorType = 'stacks' | 'seed_melody' | 'rhythm_groove';

const SHARP_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const FLAT_NAMES = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];

export class MidiTransformAndGeneratorEngine {
  public static midiToNoteToken(midi: number, preferFlats: boolean = false): string {
    const clamped = Math.max(12, Math.min(108, Math.round(midi)));
    const octave = Math.floor(clamped / 12) - 1;
    const step = (preferFlats ? FLAT_NAMES : SHARP_NAMES)[clamped % 12];
    return `${step}${octave}`;
  }

  /**
   * Returns an array of scale-locked MIDI pitches starting from `baseOctave` for `rootKey` and `scaleName`.
   */
  public static getScaleMidiPool(
    rootKey: string = 'C',
    scaleName: string = 'minor',
    baseOctave: number = 4
  ): number[] {
    const { rootSemitone, inferredScale } = parseKeyRootSemitone(rootKey);
    const normScale = (scaleName || inferredScale || 'minor')
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    const intervals =
      normScale === 'chromatic'
        ? [0, 2, 3, 5, 7, 8, 10]
        : SCALE_INTERVALS[normScale] || SCALE_INTERVALS.minor;

    const baseRootMidi = (baseOctave + 1) * 12 + rootSemitone;
    const pool: number[] = [];
    for (let oct = 0; oct < 2; oct++) {
      for (const semi of intervals) {
        pool.push(quantizeMidiToScale(baseRootMidi + oct * 12 + semi, rootKey, normScale));
      }
    }
    return pool;
  }

  /**
   * Generates a complete 4/4 `.ten` token line for `trackId` using Ableton Live 12's
   * Algorithmic Generators (`'stacks'`, `'seed_melody'`, or `'rhythm_groove'`).
   */
  public static generateScaleLockedPattern(
    generatorType: MidiGeneratorType,
    rootKey: string = 'C',
    scaleName: string = 'minor',
    isGridTrack: boolean = false
  ): string {
    const preferFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(rootKey);
    const scalePool = MidiTransformAndGeneratorEngine.getScaleMidiPool(rootKey, scaleName, 3);
    const n = (degIdx: number) =>
      MidiTransformAndGeneratorEngine.midiToNoteToken(
        scalePool[degIdx % scalePool.length],
        preferFlats
      );

    if (generatorType === 'rhythm_groove' || isGridTrack) {
      if (isGridTrack) {
        return `<[ v1: (k):3/8 | v2: r:4 s:4 r:4 s:4 | v3: h:16.vel_range(65, 110) * 16 ]>`;
      }
      // Syncopated octave bass rhythm in key
      return `${n(0)}:8.stacc ${n(7)}:8 ${n(0)}:8.stacc ${n(4)}:8 ${n(5)}:8.stacc ${n(12)}:8 ${n(4)}:8 ${n(6)}:8 |`;
    }

    if (generatorType === 'stacks') {
      // Lush Live 12 'Stacks' diatonic 9th/add11 chord progression (2 half-note stacks = 4 beats)
      const chord1 = `[${n(0)} ${n(2)} ${n(4)} ${n(6)} ${n(8)}]:2.arp.ped.mf`;
      const chord2 = `[${n(3)} ${n(5)} ${n(7)} ${n(9)} ${n(11)}]:2.arp.ped.f`;
      return `${chord1} ${chord2} |`;
    }

    // 'seed_melody': Expressive scale-locked melodic motif with MPE & articulation (4 beats total)
    const leadPool = MidiTransformAndGeneratorEngine.getScaleMidiPool(rootKey, scaleName, 4);
    const ln = (degIdx: number) =>
      MidiTransformAndGeneratorEngine.midiToNoteToken(
        leadPool[degIdx % leadPool.length],
        preferFlats
      );

    return `${ln(0)}:8.legato ${ln(2)}:8.legato ${ln(4)}:4.vib ${ln(6)}:8.legato ${ln(5)}:8.legato ${ln(4)}:4.mpe(@{bend: [0, 2, 0], slide: [40, 110], pressure: [70, 115]}) |`;
  }

  /**
   * Applies an Ableton Live 12 MIDI Transformation (`arpeggiate`, `strum`, `connect_legato`,
   * `ornament`, `humanize`) surgically to `.ten` source code while preserving comments.
   */
  public static applyTransformToSource(
    sourceCode: string,
    transformType: MidiTransformType,
    targetTrackId?: string | null
  ): string {
    if (!sourceCode.trim()) return sourceCode;

    if (transformType === 'strum') {
      // Append `.arp` to any chord `[...]:dur` that does not already have `.arp`
      return sourceCode.replace(
        /(\[[^\]]+\]:[0-9./]+(?:\.[a-zA-Z0-9_(),@{}\s":%-]+)*)(?!\.arp)/g,
        (match) => (match.includes('.arp') ? match : `${match}.arp`)
      );
    }

    if (transformType === 'connect_legato') {
      // Append `.legato` to melodic note tokens on the target track (or across measures)
      return sourceCode.replace(
        /\b([a-gA-G][#b]*[0-9]+:[0-9]+)(?!\.(?:legato|stacc|pizz))/g,
        '$1.legato'
      );
    }

    if (transformType === 'ornament') {
      // Add `.vib` to half/whole notes (`:2` or `:1`) and `.mordent` to quarter notes (`:4`)
      const withVib = sourceCode.replace(
        /\b([a-gA-G][#b]*[0-9]+:[12]\.?)(?!\.vib)/g,
        '$1.vib'
      );
      return withVib.replace(
        /\b([a-gA-G][#b]*[0-9]+:4)(?!\.(?:mordent|vib))/g,
        '$1.mordent'
      );
    }

    if (transformType === 'humanize') {
      // Attach `.vel_range(68, 108)` to notes lacking `.vel_range`
      return sourceCode.replace(
        /\b([a-gA-G][#b]*[0-9]+:[0-9.]+)(?!\.vel_range)/g,
        '$1.vel_range(68, 108)'
      );
    }

    if (transformType === 'arpeggiate') {
      // Expand chords `[n1 n2 n3 ...]:2` or `:1` into 16th-note arpeggio runs of equal total duration
      return sourceCode.replace(
        /\[([^\]]+)\]:(1|2|4)\b/g,
        (fullMatch, innerNotes: string, durStr: string) => {
          const notes = innerNotes.trim().split(/\s+/).filter(Boolean);
          if (notes.length < 2) return fullMatch;
          const totalSixteenths = durStr === '1' ? 16 : durStr === '2' ? 8 : 4;
          const arpTokens: string[] = [];
          for (let i = 0; i < totalSixteenths; i++) {
            const pitch = notes[i % notes.length];
            arpTokens.push(i === 0 ? `${pitch}:16` : pitch);
          }
          return arpTokens.join(' ');
        }
      );
    }

    void targetTrackId;
    return sourceCode;
  }

  /**
   * Injects a newly generated scale-locked measure pattern into `sourceCode` for `trackId`.
   */
  public static injectGeneratedPatternIntoSource(
    sourceCode: string,
    generatorType: MidiGeneratorType,
    trackId: string = 'pno',
    rootKey: string = 'C',
    scaleName: string = 'minor',
    isGridTrack: boolean = false
  ): string {
    const pattern = MidiTransformAndGeneratorEngine.generateScaleLockedPattern(
      generatorType,
      rootKey,
      scaleName,
      isGridTrack
    );

    if (/\btenuto\b/i.test(sourceCode) || /\bmeasure\s+\d+/i.test(sourceCode)) {
      const measureMatches = Array.from(sourceCode.matchAll(/\bmeasure\s+(\d+)/gi));
      const maxMeasure = measureMatches.reduce(
        (maxM, m) => Math.max(maxM, parseInt(m[1], 10) || 1),
        0
      );
      const nextMeasureNum = maxMeasure + 1;
      const newBlock = `\n  measure ${nextMeasureNum} {\n    ${trackId}: ${pattern}\n  }\n`;
      const lastBrace = sourceCode.lastIndexOf('}');
      if (lastBrace !== -1) {
        return sourceCode.slice(0, lastBrace) + newBlock + sourceCode.slice(lastBrace);
      }
      return `${sourceCode}\n${newBlock}`;
    }

    return `${trackId}: ${pattern.replace(/\|$/, '').trim()}`;
  }
}
