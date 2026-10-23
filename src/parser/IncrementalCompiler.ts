import { ASTSerializer, AtomicEvent } from './ASTSerializer';
import { DocumentParser, CompiledScore } from './DocumentParser';
import { Score } from './Parser';

export class IncrementalCompiler {
  private cachedTokens: string[] = [];
  private cachedEvents: AtomicEvent[] = [];
  private documentParser: DocumentParser;
  private lastCompiledScore: CompiledScore | null = null;
  public lastScore: Score | null = null;

  constructor(private serializer: ASTSerializer) {
    this.documentParser = new DocumentParser();
  }

  private gcd(a: number, b: number): number {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y !== 0) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  private addFractions(
    a: { numerator: number; denominator: number },
    b: { numerator: number; denominator: number }
  ): { numerator: number; denominator: number } {
    const num = a.numerator * b.denominator + b.numerator * a.denominator;
    const den = a.denominator * b.denominator;
    const div = this.gcd(num, den);
    return { numerator: num / div, denominator: den / div };
  }

  public getLastCompiledScore(): CompiledScore | null {
    return this.lastCompiledScore;
  }

  public compileDocument(sourceCode: string): CompiledScore {
    const score = this.documentParser.compile(sourceCode);
    this.lastCompiledScore = score;
    return score;
  }

  public update(newSourceCode: string): AtomicEvent[] {
    const sanitized = this.documentParser.sanitizeLLMInput(newSourceCode);

    // Route full Tenuto 5.0 documents, chords, Euclidean patterns, or multi-line scores to DocumentParser
    if (
      this.documentParser.isFullDocument(sanitized) ||
      sanitized.includes('\n') ||
      sanitized.includes('[') ||
      sanitized.includes('(')
    ) {
      const score = this.documentParser.compile(sanitized);
      this.lastCompiledScore = score;
      return score.events;
    }

    const trackMatch = sanitized.match(/^([a-zA-Z0-9_]+):\s+(.*)$/);
    const trackId = trackMatch ? trackMatch[1] : 'pno';
    const eventsSequence = (trackMatch ? trackMatch[2] : sanitized).trim();

    if (!eventsSequence) {
      this.cachedTokens = [];
      this.cachedEvents = [];
      this.lastCompiledScore = {
        version: '5.0',
        meta: {
          title: 'Sketch',
          tempo: 120,
          time: '4/4',
          sidechain: null,
          autoPadVoices: true,
        },
        defs: [
          {
            id: trackId,
            name: trackId.toUpperCase(),
            style: 'standard',
            patch: 'salamander_grand',
            volume: 100,
            pan: 0,
            fx: [],
          },
        ],
        events: [],
        diagnostics: [],
      };
      return [];
    }

    const tokens = eventsSequence
      .split(/\s+/)
      .filter((t) => Boolean(t) && t !== '<[' && t !== ']>' && t !== '|');

    // Pre-validate all tokens first so partial syntax errors (e.g. trailing "f:" or "?unknown") throw before mutating cache
    const validationSerializer = new ASTSerializer();
    for (const token of tokens) {
      validationSerializer.parseToken(token);
    }

    let cursorTime = { numerator: 0, denominator: 1 };

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      let event: AtomicEvent;

      if (this.cachedTokens[i] === token && this.cachedEvents[i]) {
        event = this.cachedEvents[i];
        event.startTime = { ...cursorTime };
      } else {
        event = this.serializer.parseToken(token);
        event.rawToken = token;
        event.trackId = trackId;
        event.startTime = { ...cursorTime };

        this.cachedTokens[i] = token;
        this.cachedEvents[i] = event;
      }

      if (!event.duration.isGrace) {
        cursorTime = this.addFractions(cursorTime, event.duration);
      }
    }

    this.cachedTokens.length = tokens.length;
    this.cachedEvents.length = tokens.length;

    const resultEvents = [...this.cachedEvents];
    this.lastCompiledScore = {
      version: '5.0',
      meta: {
        title: 'Sketch',
        tempo: 120,
        time: '4/4',
        sidechain: null,
        autoPadVoices: true,
      },
      defs: [
        {
          id: trackId,
          name: trackId.toUpperCase(),
          style: 'standard',
          patch: 'salamander_grand',
          volume: 100,
          pan: 0,
          fx: [],
        },
      ],
      events: resultEvents,
      diagnostics: [],
    };

    return resultEvents;
  }
}
