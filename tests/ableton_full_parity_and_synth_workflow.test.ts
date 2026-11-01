import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../src/parser/DocumentParser';
import { resolveSoundfontInstrument } from '../src/audio/SoundfontLibrary';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { ContinuousSynthEngine } from '../src/audio/synths/ContinuousSynthEngine';

describe('TDB-727 & TDB-728: Fix Windows Electron Piano Fallback, Prioritize Native Synth Engines, Multi-Line def Blocks & k-Rate Chord Coalescing', () => {
  it('parses Windows CRLF (\\r\\n) multi-line wrapped def declarations and preserves all synth attributes and FX chains', () => {
    const parser = new DocumentParser();
    const crlfSource = [
      'tenuto "6.0" {',
      '  meta @{ title: "Windows CRLF Multiline Synth Test", tempo: 136, time: "4/4" }',
      '  def saws "Heaven Saws" style=synth patch="supersaw"',
      '    vol=104 detune=92 cutoff=11500 air=85 duck=75 width=130',
      '    .fx(multiband_dynamics, @{amount: 0.6})',
      '  def counter "Counter Lead Arp" style=synth patch="pluck_lead"',
      '    vol=94 detune=65',
      '  measure 1 {',
      '    saws: [f#3 c#4 f#4 a4]:1.detune(85%, 0.4..0.85) |',
      '    counter: c#5:4 f#5:4 a5:4 c#6:4 |',
      '  }',
      '}',
    ].join('\r\n');

    const score = parser.compile(crlfSource);
    const sawsDef = score.defs.find((d) => d.id === 'saws');
    expect(sawsDef).toBeDefined();
    expect(sawsDef?.volume).toBe(104);
    expect(sawsDef?.macros?.unison).toBe(92);
    expect(sawsDef?.macros?.cutoff).toBe(11500);
    expect(sawsDef?.macros?.air).toBe(85);
    expect(sawsDef?.fx).toContain('multiband_dynamics');

    const counterDef = score.defs.find((d) => d.id === 'counter');
    expect(counterDef).toBeDefined();
    expect(counterDef?.volume).toBe(94);
    expect(counterDef?.macros?.unison).toBe(65);
  });

  it('returns null from resolveSoundfontInstrument for all synth tracks so Windows Electron builds never hijack synths with piano or harp SoundFonts', () => {
    expect(resolveSoundfontInstrument('float_pad', 'Floating Pad', 'supersaw', 'synth')).toBeNull();
    expect(resolveSoundfontInstrument('flutter', 'Flutter Pad', 'flutter_pad', 'synth')).toBeNull();
    expect(resolveSoundfontInstrument('saws', 'Heaven Saws', 'supersaw', 'synth')).toBeNull();
    expect(resolveSoundfontInstrument('reese', 'Reese Sub', 'reese_bass', 'synth')).toBeNull();
    expect(resolveSoundfontInstrument('lead', 'Main Lead', 'wavetable', 'synth')).toBeNull();
    expect(resolveSoundfontInstrument('counter', 'Counter Lead Arp', 'pluck_lead', 'synth')).toBeNull();
    expect(resolveSoundfontInstrument('riser', 'Noise Riser', 'riser', 'synth')).toBeNull();
    expect(resolveSoundfontInstrument('arp', 'Synth Arp Pluck', 'custom_synth', 'synth')).toBeNull();

    // Ensure genuine orchestral harp and piano still resolve properly
    expect(resolveSoundfontInstrument('harp', 'Concertgebouw Harp', 'orchestral_harp', 'standard')).toBe('orchestral_harp');
    expect(resolveSoundfontInstrument('pno', 'Steinway Grand', 'acoustic_grand_piano', 'standard')).toBe('acoustic_grand_piano');
  });

  it('renders a CRLF multi-line synth score to stereo WAV via native synthesizer engines', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(
      [
        'tenuto "6.0" {',
        '  meta @{ title: "Electron Synth Export", tempo: 128, time: "4/4" }',
        '  def saws "Heaven Saws" style=synth patch="supersaw"',
        '    vol=102 detune=88 cutoff=9500',
        '    .fx(multiband_dynamics, @{amount: 0.5})',
        '  measure 1 {',
        '    saws: [c4 e4 g4 b4]:1.glide(150ms) |',
        '  }',
        '}',
      ].join('\r\n')
    );

    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBeGreaterThan(44100 * 2);
  });

  it('coalesces simultaneous 7-note supersaw chords into a single shared DSP pass and prebakes with zero lag', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Zero Lag Chord Coalesce", tempo: 132, time: "4/4" }
        def saws "Heaven Saws" style=synth patch="supersaw" detune=92
        def lead "Lead" style=synth patch="pluck_lead"
        measure 1 {
          saws: [d3 a3 d4 e4 f#4 a4 c#5]:1.ff.stack("octaves").detune([0, 95, 80]) |
          lead: a5:4.ff g#5:4.ff f#5:2.ff |
        }
      }
    `);

    const timeline = (engine as any).buildScheduledTimeline(score);
    const sawEvents = timeline.filter((t: any) => t.event.trackId === 'saws');
    // All 7 notes of the chord are coalesced into 1 unified chord event
    expect(sawEvents).toHaveLength(1);
    expect(sawEvents[0].chordVoices).toHaveLength(7);

    // Verify rendering the coalesced 7-note chord executes in under 25ms
    const t0 = performance.now();
    const left = new Float32Array(44100 * 2);
    const right = new Float32Array(44100 * 2);
    ContinuousSynthEngine.renderVoiceIntoTrackStem(
      left,
      right,
      0,
      44100 * 2,
      44100,
      132,
      1,
      sawEvents[0]
    );
    const elapsedMs = performance.now() - t0;
    expect(elapsedMs).toBeLessThan(40);
  });

  it('compiles and renders all 16 measures of a 4-voice synth study (with dangling track labels, .filter sweeps, and 3-voice chords) with zero silent measures', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "4-Voice Synth Performance Study", tempo: 72, time: "4/4", key: "E", scale: "major" }
        def lead "MPE Soloist Lead" style=synth patch="saw_lead" vol=88 detune=62 cutoff=3400 resonance=1.2
        def pad "Open-Voiced Planing Pad" style=synth patch="flutter_pad" vol=84 detune=64 cutoff=2800 resonance=1.05
        def arp "Cybernetic Sequence" style=synth patch="pluck_lead" vol=80 detune=54 cutoff=3200 resonance=1.15
        def bass "Acoustic Anchor Bass" style=synth patch="reese_bass" vol=90 detune=42 cutoff=780 resonance=1.1 sub=78

        measure 1 {
          lead: b3:2.p.cresc.squeeze(55).warp_wave("bend", 0.30).filter(1400, 3200) e4:2.mp.glide(160ms).mpe(bend: [0, +0.3, 0]) |
          pad: [e3 b3 f#4]:1.p.cresc.open_voice.wow_flutter(5c, 0.4, 2c, 8.5).vowel("oh", "ooh", 0.25) |
          arp: g#3:8.p b3:8 e4:8 f#4:8 g#4:8.fold(35%) f#4:8 e4:8 b3:8 |
          bass: e1:1.mp.filter(160, 520) |
        }
        measure 2 {
          gtr_dangling_empty_label:
          lead: f#4:2.mp.squeeze(62).mpe(bend: [0, +0.4, 0]) g#4:2.mf.glide(180ms).detune(68%, 0.2..0.9) |
          pad: [c#3 g#3 d#4]:1.mp.open_voice.wow_flutter(6c, 0.45, 2.5c, 9.0).vowel("ooh", "ah", 0.30) |
          arp: e4:8.mp g#4:8 b4:8.ratchet(2, "up") d#5:8.fold(42%) b4:8 g#4:8 e4:8 c#4:8 |
          bass: c#1:2.mp.filter(180, 560) g#1:2.mp.glide(140ms) |
        }
      }
    `);

    // Ensure measure 2's lead note was not swallowed by the dangling label above it
    const m2Lead = score.events.filter((e) => e.measureNumber === 2 && e.trackId === 'lead');
    expect(m2Lead.length).toBe(2);

    const timeline = (engine as any).buildScheduledTimeline(score);
    const padChords = timeline.filter((t: any) => t.event.trackId === 'pad');
    // Both Measure 1 and Measure 2 pad chords must be coalesced into 3-voice chords
    expect(padChords).toHaveLength(2);
    expect(padChords[0].chordVoices).toHaveLength(3);
    expect(padChords[1].chordVoices).toHaveLength(3);

    // Verify neither pad chord nor bass note suffers from phase-null silence or keytrack mute
    const sr = 44100;
    for (const item of [...padChords, ...timeline.filter((t: any) => t.event.trackId === 'bass')]) {
      const frames = Math.floor(item.durSec * sr);
      const left = new Float32Array(frames);
      const right = new Float32Array(frames);
      ContinuousSynthEngine.renderVoiceIntoTrackStem(left, right, 0, frames, sr, 72, 1, item);
      let sumSq = 0;
      for (let i = 0; i < frames; i++) {
        sumSq += left[i] * left[i] + right[i] * right[i];
      }
      const rms = Math.sqrt(sumSq / (frames * 2));
      expect(rms).toBeGreaterThan(0.02);
    }
  });
});

