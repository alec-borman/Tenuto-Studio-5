import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import { GrooveEngine } from '../src/audio/GrooveEngine';
import { PhonemeEngine } from '../src/audio/PhonemeEngine';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('TDB-705: Groove Pool Engine, .lyric("...") AST Parser & Phoneme Tokenizer', () => {
  it('parses .lyric("...") on single notes and chords and decomposes English syllables into Klatt vowel formants', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Doin It Right Vocals", tempo: 89, time: "4/4" }
        def vocoder "Vocoder Choir" style=synth patch="wavetable"
        def panda "Panda Lead" style=standard patch="choir_aahs"
        measure 1 {
          vocoder: [g#3 b3 d#4 f#4]:8.lyric("Doin'") [g#3 b3 d#4 f#4]:8.lyric("it") [g#3 b3 d#4 f#4]:4.lyric("right") r:2 |
          panda: f#5:4.lyric("If") d#5:4.lyric("you") c#5:2.lyric("dance") |
        }
      }
    `);

    const vocoderEvents = score.events.filter((e) => e.trackId === 'vocoder');
    expect(vocoderEvents[0].physics?.lyric).toBe("Doin'");
    expect(vocoderEvents[4].physics?.lyric).toBe('it');
    expect(vocoderEvents[8].physics?.lyric).toBe('right');

    // Verify PhonemeEngine decomposes "right" into liquid onset 'r', diphthong AA -> IY, and plosive coda 't'
    const rightPhonemes = PhonemeEngine.decomposeLyric('right');
    expect(rightPhonemes.onsetConsonant).toBe('liquid');
    expect(rightPhonemes.primaryVowel.vowelCode).toBe('AA');
    expect(rightPhonemes.secondaryVowel?.vowelCode).toBe('IY');
    expect(rightPhonemes.codaConsonant).toBe('plosive');

    // Verify "Doin'" decomposes into plosive 'd' + diphthong UW -> IH + nasal 'n'
    const doinPhonemes = PhonemeEngine.decomposeLyric("Doin'");
    expect(doinPhonemes.onsetConsonant).toBe('plosive');
    expect(doinPhonemes.primaryVowel.vowelCode).toBe('UW');
    expect(doinPhonemes.secondaryVowel?.vowelCode).toBe('IH');
    expect(doinPhonemes.codaConsonant).toBe('nasal');
  });

  it('applies Ableton Groove Pool swing timing and velocity accents to tracks bound to a groove', () => {
    const mpcGroove = {
      id: 'mpc_swing',
      name: 'MPC 16th Swing',
      base: '1/16',
      quantizePercent: 100,
      timingPercent: 50,
      randomPercent: 0,
      velocityPercent: 50,
    };

    // On-beat 16th note (index 0, startWhole = 0) should not be delayed by swing
    const onBeat = GrooveEngine.applyGrooveToEvent(mpcGroove, 0.0, 0.0, 90, 120, 0);
    expect(onBeat.startSec).toBeCloseTo(0.0, 4);
    expect(onBeat.velocity).toBeGreaterThan(90);

    // Off-beat 16th note (index 1, startWhole = 1/16 = 0.0625, baseStartSec = 0.125s at 120 BPM)
    // must be delayed by MPC swing timing and slightly attenuated in velocity
    const offBeat = GrooveEngine.applyGrooveToEvent(mpcGroove, 0.0625, 0.125, 90, 120, 1);
    expect(offBeat.startSec).toBeGreaterThan(0.125);
    expect(offBeat.velocity).toBeLessThan(90);

    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const groovedScore = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Groove Pocket", tempo: 120, time: "4/4" }
        groove mpc_swing "MPC Swing" @{ base: "1/16", quantize: 100%, timing: 60%, random: 0%, velocity: 40% }
        def drums "Kit" style=grid patch="tenuto_808_kit" groove="mpc_swing"
        measure 1 {
          drums: h:16 h:16 r:8 r:4 r:2 |
        }
      }
    `);

    const timeline = (engine as any).buildScheduledTimeline(groovedScore);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].startSec).toBeCloseTo(0.0, 4);
    // Second 16th note (unswung = 0.125s) is pushed later into the pocket by mpc_swing
    expect(timeline[1].startSec).toBeGreaterThan(0.13);
  });
});
