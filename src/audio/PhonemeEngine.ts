export interface VowelFormantTarget {
  vowelCode: string;
  f1: number;
  f2: number;
  f3: number;
  bandwidth1: number;
  bandwidth2: number;
  bandwidth3: number;
}

export interface DecomposedLyricPhonemes {
  rawLyric: string;
  onsetConsonant: 'plosive' | 'fricative' | 'nasal' | 'liquid' | 'none';
  onsetNoiseHz: number;
  onsetDurationSec: number;
  primaryVowel: VowelFormantTarget;
  secondaryVowel?: VowelFormantTarget; // For diphthongs like "right" (AH -> IY) or "doin'" (UW -> IH)
  codaConsonant: 'plosive' | 'fricative' | 'nasal' | 'liquid' | 'none';
  codaNoiseHz: number;
  codaDurationSec: number;
}

/**
 * Canonical Klatt vocal tract formant frequencies (F1, F2, F3 in Hz) for sung vowels.
 */
export const VOWEL_FORMANT_TABLE: Record<string, VowelFormantTarget> = {
  IY: { vowelCode: 'IY', f1: 310, f2: 2400, f3: 3000, bandwidth1: 60, bandwidth2: 100, bandwidth3: 140 }, // "feel", "be"
  IH: { vowelCode: 'IH', f1: 420, f2: 1980, f3: 2600, bandwidth1: 65, bandwidth2: 100, bandwidth3: 140 }, // "it", "in"
  EH: { vowelCode: 'EH', f1: 560, f2: 1820, f3: 2520, bandwidth1: 75, bandwidth2: 110, bandwidth3: 150 }, // "ev-ry", "let"
  AE: { vowelCode: 'AE', f1: 690, f2: 1720, f3: 2450, bandwidth1: 80, bandwidth2: 115, bandwidth3: 150 }, // "dan-cing", "and"
  AA: { vowelCode: 'AA', f1: 750, f2: 1220, f3: 2500, bandwidth1: 85, bandwidth2: 110, bandwidth3: 150 }, // "ah", "all"
  AO: { vowelCode: 'AO', f1: 590, f2: 920,  f3: 2450, bandwidth1: 80, bandwidth2: 100, bandwidth3: 140 }, // "on", "for"
  UH: { vowelCode: 'UH', f1: 460, f2: 1120, f3: 2350, bandwidth1: 70, bandwidth2: 100, bandwidth3: 140 }, // "good", "put"
  UW: { vowelCode: 'UW', f1: 330, f2: 900,  f3: 2300, bandwidth1: 65, bandwidth2: 95,  bandwidth3: 140 }, // "do", "you"
  AH: { vowelCode: 'AH', f1: 620, f2: 1320, f3: 2450, bandwidth1: 75, bandwidth2: 105, bandwidth3: 140 }, // "up", "the"
  ER: { vowelCode: 'ER', f1: 490, f2: 1380, f3: 1720, bandwidth1: 70, bandwidth2: 100, bandwidth3: 130 }, // "world", "her"
};

export class PhonemeEngine {
  public static decomposeLyric(lyric: string): DecomposedLyricPhonemes {
    const clean = (lyric || '').trim().toLowerCase().replace(/[^a-z']/g, '');
    if (!clean) {
      return {
        rawLyric: lyric,
        onsetConsonant: 'none',
        onsetNoiseHz: 0,
        onsetDurationSec: 0,
        primaryVowel: VOWEL_FORMANT_TABLE.AA,
        codaConsonant: 'none',
        codaNoiseHz: 0,
        codaDurationSec: 0,
      };
    }

    // 1. Extract leading consonant cluster
    const match = clean.match(/^([^aeiouy]*?)([aeiouy]+)(.*)$/);
    const onsetStr = match ? match[1] : '';
    const vowelGraphemes = match ? match[2] : 'a';
    const codaStr = match ? match[3].replace(/'/g, '') : '';

    const classifyConsonant = (cluster: string): {
      type: 'plosive' | 'fricative' | 'nasal' | 'liquid' | 'none';
      noiseHz: number;
      durSec: number;
    } => {
      if (!cluster) return { type: 'none', noiseHz: 0, durSec: 0 };
      if (/^(sh|ch|s|z|f|v|th|h)/.test(cluster)) {
        const isSibilant = /^(s|z|sh|ch)/.test(cluster);
        return { type: 'fricative', noiseHz: isSibilant ? 5200 : 2800, durSec: 0.042 };
      }
      if (/^(p|b|t|d|k|g)/.test(cluster)) {
        return { type: 'plosive', noiseHz: 1900, durSec: 0.024 };
      }
      if (/^(m|n|ng)/.test(cluster)) {
        return { type: 'nasal', noiseHz: 450, durSec: 0.03 };
      }
      return { type: 'liquid', noiseHz: 1100, durSec: 0.028 };
    };

    const onset = classifyConsonant(onsetStr);
    const coda = classifyConsonant(codaStr);

    // 2. Map English vowel/diphthong spelling + common words to primary & secondary Klatt formants
    let primaryVowel = VOWEL_FORMANT_TABLE.AA;
    let secondaryVowel: VowelFormantTarget | undefined;

    if (clean === 'doin' || clean === "doin'") {
      primaryVowel = VOWEL_FORMANT_TABLE.UW;
      secondaryVowel = VOWEL_FORMANT_TABLE.IH;
    } else if (
      clean.includes('igh') ||
      clean === 'right' ||
      clean === 'night' ||
      clean === 'light' ||
      clean === 'my' ||
      clean === 'i' ||
      (vowelGraphemes === 'i' && codaStr.endsWith('e'))
    ) {
      // Diphthong /aɪ/ ("right", "night", "light"): AA -> IY
      primaryVowel = VOWEL_FORMANT_TABLE.AA;
      secondaryVowel = VOWEL_FORMANT_TABLE.IY;
    } else if (
      clean === 'now' ||
      clean === 'out' ||
      clean.includes('ow') ||
      clean.includes('ou')
    ) {
      // Diphthong /aʊ/ ("out", "now"): AA -> UW
      primaryVowel = VOWEL_FORMANT_TABLE.AA;
      secondaryVowel = VOWEL_FORMANT_TABLE.UW;
    } else if (
      clean === 'go' ||
      clean === 'no' ||
      clean === 'so' ||
      vowelGraphemes === 'oa' ||
      (vowelGraphemes === 'o' && codaStr.endsWith('e'))
    ) {
      // Diphthong /oʊ/ ("go"): AO -> UW
      primaryVowel = VOWEL_FORMANT_TABLE.AO;
      secondaryVowel = VOWEL_FORMANT_TABLE.UW;
    } else if (
      clean === 'break' ||
      clean === 'make' ||
      clean === 'day' ||
      vowelGraphemes === 'ay' ||
      vowelGraphemes === 'ai' ||
      (vowelGraphemes === 'a' && codaStr.endsWith('e'))
    ) {
      // Diphthong /eɪ/ ("break"): EH -> IY
      primaryVowel = VOWEL_FORMANT_TABLE.EH;
      secondaryVowel = VOWEL_FORMANT_TABLE.IY;
    } else if (
      clean === 'do' ||
      clean === 'you' ||
      clean === 'to' ||
      vowelGraphemes === 'oo' ||
      vowelGraphemes === 'ou' ||
      vowelGraphemes === 'u'
    ) {
      primaryVowel = VOWEL_FORMANT_TABLE.UW;
    } else if (
      clean === 'be' ||
      clean === 'we' ||
      clean === 'me' ||
      vowelGraphemes === 'ee' ||
      vowelGraphemes === 'ea'
    ) {
      primaryVowel = VOWEL_FORMANT_TABLE.IY;
    } else if (vowelGraphemes === 'i' || vowelGraphemes === 'y') {
      primaryVowel = VOWEL_FORMANT_TABLE.IH;
    } else if (vowelGraphemes === 'e') {
      primaryVowel = codaStr.startsWith('r') ? VOWEL_FORMANT_TABLE.ER : VOWEL_FORMANT_TABLE.EH;
    } else if (vowelGraphemes === 'o') {
      primaryVowel = VOWEL_FORMANT_TABLE.AO;
    } else if (vowelGraphemes === 'a') {
      primaryVowel = clean === 'all' ? VOWEL_FORMANT_TABLE.AO : VOWEL_FORMANT_TABLE.AE;
    }

    return {
      rawLyric: lyric,
      onsetConsonant: onset.type,
      onsetNoiseHz: onset.noiseHz,
      onsetDurationSec: onset.durSec,
      primaryVowel,
      secondaryVowel,
      codaConsonant: coda.type,
      codaNoiseHz: coda.noiseHz,
      codaDurationSec: coda.durSec,
    };
  }
}
