export interface PitchResult {
  midi: number;
  frequency: number;
  noteName?: string;
  isRest?: boolean;
  isSpacer?: boolean;
  gridKey?: string;
  sliceKey?: string;
  microtoneCents?: number;
}

export interface TuningConfiguration {
  system?: string;
  rootKey?: string;
  scaleName?: string;
  scaleLock?: boolean;
  a4Hz?: number;
  scalaCents?: number[];
}

const DRUM_GRID_MIDI: Record<string, number> = {
  k: 36,
  bd: 36,
  kick: 36,
  s: 38,
  sd: 38,
  snare: 38,
  rim: 37,
  cp: 39,
  clap: 39,
  h: 42,
  hh: 42,
  ch: 42,
  oh: 46,
  lt: 45,
  mt: 47,
  ht: 50,
  cr: 49,
  rd: 51,
};

export const ROOT_KEY_SEMITONES: Record<string, number> = {
  c: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  f: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'a#': 10,
  bb: 10,
  b: 11,
};

export const SCALE_INTERVALS: Record<string, number[]> = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  natural_minor: [0, 2, 3, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  major_pentatonic: [0, 2, 4, 7, 9],
  minor_pentatonic: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  whole_tone: [0, 2, 4, 6, 8, 10],
  diminished_wh: [0, 2, 3, 5, 6, 8, 9, 11],
  diminished_hw: [0, 1, 3, 4, 6, 7, 9, 10],
  hungarian_minor: [0, 2, 3, 6, 7, 8, 11],
  phrygian_dominant: [0, 1, 4, 5, 7, 8, 10],
  hirajoshi: [0, 2, 3, 7, 8],
  insen: [0, 1, 5, 7, 10],
  arabic: [0, 1, 4, 5, 7, 8, 11],
};

/**
 * Built-in microtonal tuning cent tables (relative to root 0c).
 * The final element represents the period (typically 1200c octave, or 1901.955c tritave for Bohlen-Pierce).
 */
export const BUILTIN_TUNING_CENTS: Record<string, number[]> = {
  '12tet': [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200],
  just_intonation: [
    111.731, // 16/15
    203.91,  // 9/8
    315.641, // 6/5
    386.314, // 5/4
    498.045, // 4/3
    590.224, // 45/32
    701.955, // 3/2
    813.686, // 8/5
    884.359, // 5/3
    1017.596,// 9/5
    1088.269,// 15/8
    1200.0,  // 2/1
  ],
  pythagorean: [
    90.225,
    203.91,
    294.135,
    407.82,
    498.045,
    611.73,
    701.955,
    792.18,
    905.865,
    996.09,
    1109.775,
    1200.0,
  ],
  meantone: [
    76.049,
    193.157,
    310.265,
    386.314,
    503.422,
    579.471,
    696.578,
    772.627,
    889.735,
    1006.843,
    1082.892,
    1200.0,
  ],
  '19tet': Array.from({ length: 19 }, (_, i) => ((i + 1) * 1200) / 19),
  '24tet': Array.from({ length: 24 }, (_, i) => ((i + 1) * 1200) / 24),
  '31tet': Array.from({ length: 31 }, (_, i) => ((i + 1) * 1200) / 31),
  carlos_alpha: Array.from({ length: 9 }, (_, i) => (i + 1) * 78.0),
  bohlen_pierce: Array.from({ length: 13 }, (_, i) => ((i + 1) * 1901.955) / 13),
  slendro: [240, 480, 720, 960, 1200],
  pelog: [120, 270, 540, 670, 785, 950, 1200],
};

export function parseKeyRootSemitone(keyStr?: string): { rootSemitone: number; inferredScale?: string } {
  if (!keyStr) return { rootSemitone: 0 };
  const clean = keyStr.trim().toLowerCase();
  const m = clean.match(/^([a-g][#b]?)(m|min|minor|maj|major)?$/);
  if (!m) return { rootSemitone: 0 };
  const rootSemitone = ROOT_KEY_SEMITONES[m[1]] ?? 0;
  const suffix = m[2];
  const inferredScale = suffix === 'm' || suffix === 'min' || suffix === 'minor' ? 'minor' : undefined;
  return { rootSemitone, inferredScale };
}

export function isMidiInScale(midi: number, rootKey: string = 'C', scaleName: string = 'chromatic'): boolean {
  const { rootSemitone, inferredScale } = parseKeyRootSemitone(rootKey);
  const normScale = (scaleName || inferredScale || 'chromatic').toLowerCase().replace(/[\s-]+/g, '_');
  const intervals = SCALE_INTERVALS[normScale] || SCALE_INTERVALS.chromatic;
  const rel = (((Math.round(midi) - rootSemitone) % 12) + 12) % 12;
  return intervals.includes(rel);
}

export function quantizeMidiToScale(midi: number, rootKey: string = 'C', scaleName: string = 'chromatic'): number {
  const rounded = Math.round(midi);
  if (isMidiInScale(rounded, rootKey, scaleName)) return rounded;

  const { rootSemitone, inferredScale } = parseKeyRootSemitone(rootKey);
  const normScale = (scaleName || inferredScale || 'chromatic').toLowerCase().replace(/[\s-]+/g, '_');
  const intervals = SCALE_INTERVALS[normScale] || SCALE_INTERVALS.chromatic;

  let bestMidi = rounded;
  let minDist = Infinity;
  for (let offset = -2; offset <= 2; offset++) {
    const candidate = rounded + offset;
    const rel = (((candidate - rootSemitone) % 12) + 12) % 12;
    if (intervals.includes(rel) && Math.abs(offset) < minDist) {
      minDist = Math.abs(offset);
      bestMidi = candidate;
    }
  }
  return bestMidi;
}

/**
 * Parses a standard Scala (.scl) file format string into an array of cent values.
 */
export function parseScalaScl(sclText: string): number[] {
  const lines = sclText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('!') && l.length > 0);

  if (lines.length < 2) return BUILTIN_TUNING_CENTS['12tet'];

  // Line 0 is description, Line 1 is note count, Line 2+ are pitch values
  const noteCount = parseInt(lines[1], 10);
  if (isNaN(noteCount) || noteCount <= 0) return BUILTIN_TUNING_CENTS['12tet'];

  const cents: number[] = [];
  for (let i = 2; i < lines.length && cents.length < noteCount; i++) {
    const token = lines[i].split(/\s+/)[0];
    if (!token) continue;

    if (token.includes('.')) {
      const cVal = parseFloat(token);
      if (!isNaN(cVal)) cents.push(cVal);
    } else if (token.includes('/')) {
      const [numStr, denStr] = token.split('/');
      const num = parseFloat(numStr);
      const den = parseFloat(denStr);
      if (num > 0 && den > 0) {
        cents.push(1200 * Math.log2(num / den));
      }
    } else {
      const ratio = parseFloat(token);
      if (ratio > 0) {
        cents.push(1200 * Math.log2(ratio));
      }
    }
  }

  return cents.length > 0 ? cents : BUILTIN_TUNING_CENTS['12tet'];
}

export class PitchEngine {
  private currentOctave: number = 4;
  private tuningConfig: TuningConfiguration = {
    system: '12tet',
    rootKey: 'C',
    scaleName: 'chromatic',
    scaleLock: false,
    a4Hz: 440.0,
  };

  private noteOffsets: Record<string, number> = {
    c: 0,
    d: 2,
    e: 4,
    f: 5,
    g: 7,
    a: 9,
    b: 11,
  };

  public reset(defaultOctave: number = 4): void {
    this.currentOctave = defaultOctave;
  }

  public setTuningConfiguration(config: TuningConfiguration): void {
    this.tuningConfig = {
      ...this.tuningConfig,
      ...config,
    };
  }

  public getTuningConfiguration(): TuningConfiguration {
    return { ...this.tuningConfig };
  }

  public getCurrentOctave(): number {
    return this.currentOctave;
  }

  public setCurrentOctave(octave: number): void {
    this.currentOctave = octave;
  }

  public computeFrequencyForMidi(
    midi: number,
    extraCents: number = 0
  ): number {
    const a4Hz = this.tuningConfig.a4Hz || 440.0;
    const systemKey = (this.tuningConfig.system || '12tet').toLowerCase().replace(/\.scl$/i, '');

    let centsTable: number[] | undefined = this.tuningConfig.scalaCents;
    if (!centsTable && systemKey !== '12tet') {
      if (systemKey.includes('!') || systemKey.includes('\n')) {
        centsTable = parseScalaScl(this.tuningConfig.system!);
      } else if (BUILTIN_TUNING_CENTS[systemKey]) {
        centsTable = BUILTIN_TUNING_CENTS[systemKey];
      }
    }

    if (!centsTable || systemKey === '12tet') {
      return a4Hz * Math.pow(2, (midi - 69 + extraCents / 100) / 12);
    }

    const { rootSemitone } = parseKeyRootSemitone(this.tuningConfig.rootKey || 'C');
    const rootMidi = 60 + rootSemitone; // Anchor tuning root in Octave 4
    const rootFreq = a4Hz * Math.pow(2, (rootMidi - 69) / 12);

    const degreeCount = centsTable.length;
    const periodCents = centsTable[degreeCount - 1] || 1200.0;
    const stepsFromRoot = midi - rootMidi;

    const periods = Math.floor(stepsFromRoot / degreeCount);
    const degreeIdx = ((stepsFromRoot % degreeCount) + degreeCount) % degreeCount;
    const degreeCents = degreeIdx === 0 ? 0 : centsTable[degreeIdx - 1];
    const totalCents = periods * periodCents + degreeCents + extraCents;

    return rootFreq * Math.pow(2, totalCents / 1200.0);
  }

  public parsePitch(token: string, style: string = 'standard'): PitchResult {
    const clean = token.trim().toLowerCase();

    if (clean === 'r') {
      return { midi: 0, frequency: 0, noteName: 'r', isRest: true };
    }

    if (clean === 's' && style !== 'grid') {
      return { midi: 0, frequency: 0, noteName: 's', isSpacer: true };
    }

    if (style === 'grid') {
      const mappedMidi = DRUM_GRID_MIDI[clean] ?? 36;
      const frequency = 440.0 * Math.pow(2, (mappedMidi - 69) / 12);
      return { midi: mappedMidi, frequency, noteName: clean, gridKey: clean };
    }

    if (style === 'simpler' || style === 'concrete') {
      const stdCheck = clean.match(/^([a-g])((?:tqs|tqf|qs|qf|x|#|b|n)*)([0-9]+)(?:([+-]\d+(?:\.\d+)?)c?)?$/);
      if (!stdCheck && /^[a-z0-9_]+$/.test(clean)) {
        let hash = 0;
        for (let i = 0; i < clean.length; i++) {
          hash = (hash * 31 + clean.charCodeAt(i)) % 24;
        }
        const mappedMidi = 60 + hash;
        const frequency = this.computeFrequencyForMidi(mappedMidi, 0);
        return { midi: mappedMidi, frequency, noteName: clean, sliceKey: clean };
      }
    }

    // Support SPEC.md 2.2 PitchLit: [a-g](tqs|tqf|qs|qf|x|#|b|n)*[0-9]*([+-][0-9]+c?)?
    const match = clean.match(/^([a-g])((?:tqs|tqf|qs|qf|x|#|b|n)*)([0-9]*)(?:([+-]\d+(?:\.\d+)?)c?)?$/);

    if (!match) {
      if (DRUM_GRID_MIDI[clean] !== undefined) {
        const mappedMidi = DRUM_GRID_MIDI[clean];
        const frequency = 440.0 * Math.pow(2, (mappedMidi - 69) / 12);
        return { midi: mappedMidi, frequency, noteName: clean, gridKey: clean };
      }
      throw new Error(`E1001: Invalid PitchLit token: ${token}`);
    }

    const note = match[1];
    const accidentalsStr = match[2] || '';
    const octaveStr = match[3] || '';
    const centDeviationStr = match[4];

    if (octaveStr !== '') {
      this.currentOctave = parseInt(octaveStr, 10);
    }

    let semitoneOffset = this.noteOffsets[note];
    let microtoneCents = centDeviationStr ? parseFloat(centDeviationStr) : 0;

    // Parse compound microtonal & standard accidentals left-to-right
    let accCursor = 0;
    while (accCursor < accidentalsStr.length) {
      if (accidentalsStr.startsWith('tqs', accCursor)) {
        semitoneOffset += 1;
        microtoneCents += 50;
        accCursor += 3;
      } else if (accidentalsStr.startsWith('tqf', accCursor)) {
        semitoneOffset -= 1;
        microtoneCents -= 50;
        accCursor += 3;
      } else if (accidentalsStr.startsWith('qs', accCursor)) {
        microtoneCents += 50;
        accCursor += 2;
      } else if (accidentalsStr.startsWith('qf', accCursor)) {
        microtoneCents -= 50;
        accCursor += 2;
      } else if (accidentalsStr[accCursor] === 'x') {
        semitoneOffset += 2;
        accCursor += 1;
      } else if (accidentalsStr[accCursor] === '#') {
        semitoneOffset += 1;
        accCursor += 1;
      } else if (accidentalsStr[accCursor] === 'b') {
        semitoneOffset -= 1;
        accCursor += 1;
      } else if (accidentalsStr[accCursor] === 'n') {
        accCursor += 1;
      } else {
        accCursor += 1;
      }
    }

    let midi = (this.currentOctave + 1) * 12 + semitoneOffset;

    if (this.tuningConfig.scaleLock && this.tuningConfig.scaleName && this.tuningConfig.scaleName !== 'chromatic') {
      midi = quantizeMidiToScale(
        midi,
        this.tuningConfig.rootKey || 'C',
        this.tuningConfig.scaleName
      );
    }

    const frequency = this.computeFrequencyForMidi(midi, microtoneCents);

    const result: PitchResult = {
      midi,
      frequency,
      noteName: `${note}${accidentalsStr}${this.currentOctave}`,
    };
    if (microtoneCents !== 0) {
      result.microtoneCents = microtoneCents;
    }
    return result;
  }
}
