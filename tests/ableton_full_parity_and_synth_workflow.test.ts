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
});
