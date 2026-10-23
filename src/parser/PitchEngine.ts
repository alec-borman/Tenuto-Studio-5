export interface PitchResult {
  midi: number;
  frequency: number;
  noteName?: string;
  isRest?: boolean;
  isSpacer?: boolean;
  gridKey?: string;
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

export class PitchEngine {
  private currentOctave: number = 4;

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

  public getCurrentOctave(): number {
    return this.currentOctave;
  }

  public setCurrentOctave(octave: number): void {
    this.currentOctave = octave;
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

    const match = clean.match(/^([a-g])([#b]*)([0-9]*)$/);

    if (!match) {
      if (DRUM_GRID_MIDI[clean] !== undefined) {
        const mappedMidi = DRUM_GRID_MIDI[clean];
        const frequency = 440.0 * Math.pow(2, (mappedMidi - 69) / 12);
        return { midi: mappedMidi, frequency, noteName: clean, gridKey: clean };
      }
      throw new Error(`E1001: Invalid PitchLit token: ${token}`);
    }

    const note = match[1];
    const accidentals = match[2];
    const octaveStr = match[3];

    if (octaveStr !== '') {
      this.currentOctave = parseInt(octaveStr, 10);
    }

    let offset = this.noteOffsets[note];

    for (const char of accidentals) {
      if (char === '#') offset += 1;
      if (char === 'b') offset -= 1;
    }

    const midi = (this.currentOctave + 1) * 12 + offset;
    const frequency = 440.0 * Math.pow(2, (midi - 69) / 12);

    return {
      midi,
      frequency,
      noteName: `${note}${accidentals}${this.currentOctave}`,
    };
  }
}
