export interface TemporalResult {
  numerator: number;
  denominator: number;
  isGrace?: boolean;
}

export class TemporalEngine {
  private lastDuration: TemporalResult = { numerator: 1, denominator: 4 };

  private gcd(a: number, b: number): number {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x || 1;
  }

  public reset(): void {
    this.lastDuration = { numerator: 1, denominator: 4 };
  }

  public getLastDuration(): TemporalResult {
    return { ...this.lastDuration };
  }

  public setLastDuration(duration: TemporalResult): void {
    if (!duration.isGrace && duration.numerator > 0 && duration.denominator > 0) {
      this.lastDuration = {
        numerator: duration.numerator,
        denominator: duration.denominator,
      };
    }
  }

  public parseDuration(token: string): TemporalResult {
    if (token === ':grace') {
      return { numerator: 0, denominator: 1, isGrace: true };
    }

    // Rational fraction format e.g. :3/8
    const rationalMatch = token.match(/^:([0-9]+)\/([0-9]+)$/);
    if (rationalMatch) {
      const num = parseInt(rationalMatch[1], 10);
      const den = parseInt(rationalMatch[2], 10);
      if (num <= 0 || den <= 0) {
        throw new Error(`Invalid duration token: ${token}`);
      }
      const div = this.gcd(num, den);
      const result = { numerator: num / div, denominator: den / div };
      this.setLastDuration(result);
      return result;
    }

    // Standard or dotted duration with optional multiplier e.g. :4, :8., :16*3
    const match = token.match(/^:([0-9]+)(\.+)?(?:\*([0-9]+))?$/);
    if (!match) {
      throw new Error(`Invalid duration token: ${token}`);
    }

    const baseDenominator = parseInt(match[1], 10);
    if (baseDenominator <= 0) {
      throw new Error(`Invalid duration token: ${token}`);
    }

    const dots = match[2] ? match[2].length : 0;
    const multiplier = match[3] ? parseInt(match[3], 10) : 1;

    let numerator = 1;
    let denominator = baseDenominator;

    if (dots === 1) {
      numerator = 3;
      denominator = baseDenominator * 2;
    } else if (dots >= 2) {
      const factor = Math.pow(2, dots);
      numerator = factor * 2 - 1;
      denominator = baseDenominator * factor;
    }

    numerator *= multiplier;
    const divisor = this.gcd(numerator, denominator);
    const result: TemporalResult = {
      numerator: numerator / divisor,
      denominator: denominator / divisor,
    };

    this.setLastDuration(result);
    return result;
  }
}
