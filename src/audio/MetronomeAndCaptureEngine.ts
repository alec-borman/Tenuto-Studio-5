export interface CapturedNoteInput {
  midi: number;
  velocity: number;
  timestampMs: number;
  durationMs: number;
}

export interface MetronomeTickEvent {
  beatIndex: number;
  measureNumber: number;
  beatInMeasure: number;
  isDownbeat: boolean;
  isCountIn: boolean;
  timeSec: number;
  frequencyHz: number;
}

const NOTE_NAMES_SHARP = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];

export class MetronomeAndCaptureEngine {
  private tapTimestampsMs: number[] = [];
  private capturedNotes: CapturedNoteInput[] = [];
  private maxCaptureBufferSize: number = 128;

  /**
   * Registers a tap timestamp (in ms) and returns the computed BPM (clamped to 40..240)
   * once at least 2 taps within 2200ms of each other have been recorded.
   */
  public registerTap(nowMs: number = Date.now()): number | null {
    if (this.tapTimestampsMs.length > 0) {
      const lastTap = this.tapTimestampsMs[this.tapTimestampsMs.length - 1];
      if (nowMs - lastTap > 2200) {
        this.tapTimestampsMs = [];
      }
    }

    this.tapTimestampsMs.push(nowMs);
    if (this.tapTimestampsMs.length > 8) {
      this.tapTimestampsMs.shift();
    }

    if (this.tapTimestampsMs.length < 2) {
      return null;
    }

    let totalIntervalMs = 0;
    const count = this.tapTimestampsMs.length - 1;
    for (let i = 1; i < this.tapTimestampsMs.length; i++) {
      totalIntervalMs += this.tapTimestampsMs[i] - this.tapTimestampsMs[i - 1];
    }

    const avgIntervalMs = totalIntervalMs / count;
    if (avgIntervalMs <= 0) return null;

    const rawBpm = 60000 / avgIntervalMs;
    return Math.max(40, Math.min(240, Math.round(rawBpm)));
  }

  public resetTaps(): void {
    this.tapTimestampsMs = [];
  }

  /**
   * Records a spontaneous note event into the rolling Capture MIDI buffer.
   */
  public recordNoteInput(note: CapturedNoteInput): void {
    this.capturedNotes.push(note);
    if (this.capturedNotes.length > this.maxCaptureBufferSize) {
      this.capturedNotes.shift();
    }
  }

  public getCapturedNoteCount(): number {
    return this.capturedNotes.length;
  }

  public clearCapturedNotes(): void {
    this.capturedNotes = [];
  }

  public static midiToTenutoPitch(midi: number): string {
    const clamped = Math.max(12, Math.min(108, Math.round(midi)));
    const octave = Math.floor(clamped / 12) - 1;
    const step = NOTE_NAMES_SHARP[clamped % 12];
    return `${step}${octave}`;
  }

  public static quantizeBeatsToDurationToken(quarterBeats: number): { token: string; beats: number } {
    const candidates = [
      { token: '16', beats: 0.25 },
      { token: '8', beats: 0.5 },
      { token: '8.', beats: 0.75 },
      { token: '4', beats: 1.0 },
      { token: '4.', beats: 1.5 },
      { token: '2', beats: 2.0 },
      { token: '2.', beats: 3.0 },
      { token: '1', beats: 4.0 },
    ];

    let best = candidates[3]; // Default :4
    let minDiff = Infinity;
    for (const c of candidates) {
      const diff = Math.abs(quarterBeats - c.beats);
      if (diff < minDiff) {
        minDiff = diff;
        best = c;
      }
    }
    return best;
  }

  /**
   * Converts the rolling buffer of captured notes into a quantized 4/4 `.ten` measure token stream
   * (padded to 4.0 beats with a trailing rest if needed) so Capture MIDI never produces invalid bar math.
   */
  public flushCapturedNotesToTenutoMeasure(
    tempoBpm: number = 120,
    trackId: string = 'pno',
    measureNumber: number = 1
  ): { measureCode: string; tokens: string[] } | null {
    const notesToFlush =
      this.capturedNotes.length > 0
        ? [...this.capturedNotes]
        : [
            // Default musical motif if user clicks Capture MIDI before playing external notes
            { midi: 60, velocity: 95, timestampMs: 0, durationMs: 450 },
            { midi: 64, velocity: 95, timestampMs: 500, durationMs: 450 },
            { midi: 67, velocity: 100, timestampMs: 1000, durationMs: 450 },
            { midi: 72, velocity: 105, timestampMs: 1500, durationMs: 450 },
          ];

    this.capturedNotes = [];

    const secPerBeat = 60 / Math.max(40, tempoBpm || 120);
    const msPerBeat = secPerBeat * 1000;

    const tokens: string[] = [];
    let accumulatedBeats = 0;

    for (const item of notesToFlush) {
      if (accumulatedBeats >= 4.0 - 1e-4) break;
      const rawBeats = Math.max(0.25, item.durationMs / msPerBeat);
      const remaining = 4.0 - accumulatedBeats;
      const clampedBeats = Math.min(remaining, rawBeats);
      const quantized = MetronomeAndCaptureEngine.quantizeBeatsToDurationToken(clampedBeats);
      const pitchLit = MetronomeAndCaptureEngine.midiToTenutoPitch(item.midi);

      tokens.push(`${pitchLit}:${quantized.token}`);
      accumulatedBeats += quantized.beats;
    }

    if (accumulatedBeats < 4.0 - 1e-4) {
      const rem = 4.0 - accumulatedBeats;
      const restQuant = MetronomeAndCaptureEngine.quantizeBeatsToDurationToken(rem);
      tokens.push(`r:${restQuant.token}`);
    }

    const measureCode = `  measure ${measureNumber} {\n    ${trackId}: ${tokens.join(' ')} |\n  }`;
    return { measureCode, tokens };
  }

  /**
   * Builds a deterministic schedule of Metronome click events (including optional pre-roll count-in bars).
   */
  public static buildMetronomeSchedule(
    totalQuarterBeats: number,
    tempoBpm: number = 120,
    timeSignature: string = '4/4',
    countInBars: number = 0
  ): MetronomeTickEvent[] {
    const [beatsStr] = (timeSignature || '4/4').split('/');
    const beatsPerBar = Math.max(1, parseInt(beatsStr, 10) || 4);
    const secPerBeat = 60 / Math.max(20, tempoBpm || 120);

    const countInBeats = Math.max(0, Math.round(countInBars)) * beatsPerBar;
    const scoreBeats = Math.max(1, Math.ceil(totalQuarterBeats));
    const totalTicks = countInBeats + scoreBeats;

    const ticks: MetronomeTickEvent[] = [];
    for (let i = 0; i < totalTicks; i++) {
      const isCountIn = i < countInBeats;
      const beatInMeasure = (i % beatsPerBar) + 1;
      const isDownbeat = beatInMeasure === 1;
      const measureNumber = isCountIn
        ? -(countInBars - Math.floor(i / beatsPerBar))
        : Math.floor((i - countInBeats) / beatsPerBar) + 1;

      ticks.push({
        beatIndex: i,
        measureNumber,
        beatInMeasure,
        isDownbeat,
        isCountIn,
        timeSec: i * secPerBeat,
        frequencyHz: isDownbeat ? 1320 : 880,
      });
    }

    return ticks;
  }
}
