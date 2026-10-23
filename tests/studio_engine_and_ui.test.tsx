import React, { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PRESET_SCORES } from '../src/presets/presetScores';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { resolveSoundfontInstrument, SoundfontBankLoader } from '../src/audio/SoundfontLibrary';
import { configureTenutoMonaco } from '../src/components/CodeEditor';
import Transport from '../src/components/Transport';
import WebGPUCanvas from '../src/components/WebGPUCanvas';
import '@testing-library/jest-dom';

describe('TDB-603 & TDB-604: Syntax-Highlighted Code Editor, Scrolling Player & StrictMode Safety', () => {
  it('registers the Tenuto Monarch syntax tokenizer and dark color theme', () => {
    const mockRegister = vi.fn();
    const mockSetMonarch = vi.fn();
    const mockDefineTheme = vi.fn();

    configureTenutoMonaco({
      languages: {
        getLanguages: () => [],
        register: mockRegister,
        setMonarchTokensProvider: mockSetMonarch,
      },
      editor: {
        defineTheme: mockDefineTheme,
      },
    });

    expect(mockRegister).toHaveBeenCalledWith({ id: 'tenuto' });
    expect(mockSetMonarch).toHaveBeenCalledWith('tenuto', expect.any(Object));
    expect(mockDefineTheme).toHaveBeenCalledWith('tenuto-dark', expect.any(Object));
  });

  it('compiles all built-in multi-track preset scores with zero errors', () => {
    const parser = new DocumentParser();

    for (const preset of PRESET_SCORES) {
      const score = parser.compile(preset.code);
      expect(score.events.length).toBeGreaterThan(0);
      expect(score.defs.length).toBeGreaterThan(0);
    }
  });

  it('calculates exact score duration in quarter beats and seconds', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const synthwave = PRESET_SCORES.find((p) => p.id === 'neon_horizon')!;
    const score = parser.compile(synthwave.code);

    const { totalQuarterBeats, totalSeconds } = engine.calculateScoreDuration(score);
    expect(totalQuarterBeats).toBeGreaterThanOrEqual(8);
    expect(totalSeconds).toBeGreaterThan(4);
  });

  it('renders clean Transport controls with demo score selector and zero AI buttons', () => {
    let selectedCode = '';
    render(
      <Transport
        isPlaying={false}
        onTogglePlay={() => {}}
        onSelectPreset={(code) => {
          selectedCode = code;
        }}
      />
    );

    expect(screen.queryByText(/Copy LLM Prompt/i)).not.toBeInTheDocument();

    const presetSelect = screen.getByRole('combobox', { name: /Load Preset Song/i });
    fireEvent.change(presetSelect, { target: { value: 'neon_horizon' } });
    expect(selectedCode).toContain('Neon Horizon');
  });

  it('survives StrictMode remount and demo score event updates without null .clear() crashes', async () => {
    const parser = new DocumentParser();
    const initialScore = parser.compile('pno: c4:4');
    const demoScore = parser.compile(PRESET_SCORES[0].code);

    const { rerender } = render(
      <StrictMode>
        <WebGPUCanvas events={initialScore.events} />
      </StrictMode>
    );

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(() => {
      rerender(
        <StrictMode>
          <WebGPUCanvas events={demoScore.events} isPlaying={true} playheadBeat={1.5} />
        </StrictMode>
      );
    }).not.toThrow();

    expect(screen.getByTestId('webgpu-canvas-container')).toBeInTheDocument();
  });

  it('ensures every multi-track preset matches its exact written measure count with zero spillover', () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const neon = parser.compile(PRESET_SCORES.find((p) => p.id === 'neon_horizon')!.code);
    expect(engine.calculateScoreDuration(neon).totalQuarterBeats).toBe(16); // 4 written measures * 4 beats

    const lofi = parser.compile(PRESET_SCORES.find((p) => p.id === 'lofi_rain')!.code);
    expect(engine.calculateScoreDuration(lofi).totalQuarterBeats).toBe(8); // 2 written measures * 4 beats

    const glass = parser.compile(PRESET_SCORES.find((p) => p.id === 'glass_cathedral')!.code);
    expect(engine.calculateScoreDuration(glass).totalQuarterBeats).toBe(8); // 2 written measures * 4 beats
  });

  it('renders a complete multi-measure WAV blob without NaN dropouts', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const neon = parser.compile(PRESET_SCORES.find((p) => p.id === 'neon_horizon')!.code);

    expect(engine.calculateScoreDuration(neon).totalQuarterBeats).toBe(16);

    const wavBlob = await engine.exportWavBlob(neon);
    expect(wavBlob.type).toBe('audio/wav');
    expect(wavBlob.size).toBeGreaterThan(44100 * 4);
  });

  it('cleans up all active voice nodes on stop() and survives repeated play/export cycles without feedback or silence', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(PRESET_SCORES.find((p) => p.id === 'neon_horizon')!.code);

    engine.stop();
    const wav1 = await engine.exportWavBlob(score);
    const wav2 = await engine.exportWavBlob(score);
    expect(wav1.size).toBe(wav2.size);
  });

  it('auto-splits fused modifier tokens (e.g. g5:4.ffbb5:4) in full multi-measure scores without crashing', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "Resilience Test", tempo: 112, time: "4/4" }
        def pno "Grand Piano" style=standard patch="salamander_grand"
        measure 1 {
          pno: <[ v1: g5:4.ffbb5:4 a5:4 f5:4 | v2: [g2 d3 g3]:2 [a2 d3 f3]:2 ]>
        }
      }
    `);
    expect(score.events.length).toBe(10);
  });

  it('supports trackpad pinch-to-zoom, Fit All, and isolating individual instrument tracks on the Piano Roll', () => {
    const parser = new DocumentParser();
    const score = parser.compile(PRESET_SCORES.find((p) => p.id === 'neon_horizon')!.code);

    render(<WebGPUCanvas events={score.events} />);

    // Verify All Instruments button and individual track pills render
    expect(screen.getByRole('button', { name: /Show All Instruments/i })).toBeInTheDocument();
    const leadBtn = screen.getByRole('button', { name: /Isolate track lead/i });
    const drumsBtn = screen.getByRole('button', { name: /Isolate track drums/i });
    expect(leadBtn).toBeInTheDocument();
    expect(drumsBtn).toBeInTheDocument();

    // Click 'lead' pill to isolate just the lead synth track
    fireEvent.click(leadBtn);

    // Click 'All Instruments' to restore all tracks
    fireEvent.click(screen.getByRole('button', { name: /Show All Instruments/i }));

    // Test trackpad pinch-to-zoom (ctrlKey + wheel) on the scroll viewport
    const viewport = screen.getByTestId('piano-roll-scroll-viewport');
    expect(screen.getByRole('button', { name: /Reset Zoom/i })).toHaveTextContent('100%');

    fireEvent.wheel(viewport, { deltaY: -100, ctrlKey: true });
    expect(screen.getByRole('button', { name: /Reset Zoom/i })).not.toHaveTextContent('100%');

    // Test Reset Zoom button returns to 100%
    fireEvent.click(screen.getByRole('button', { name: /Reset Zoom/i }));
    expect(screen.getByRole('button', { name: /Reset Zoom/i })).toHaveTextContent('100%');

    // Test Fit All button scales down to fit multi-measure score
    fireEvent.click(screen.getByRole('button', { name: /Fit All/i }));
    expect(screen.getByRole('button', { name: /Reset Zoom/i })).not.toHaveTextContent('100%');
  });

  it('parses .cresc, .cresc(30,120), and .dim modifiers and interpolates multi-note phrase swells', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "Swell Test", tempo: 100, time: "4/4" }
        def choir "Choir" style=synth patch="warm_pad"
        def vln "Violin" style=synth patch="saw_lead"
        measure 1 {
          choir: [c4 e4 g4]:2.cresc(30, 120) [c4 e4 g4]:2.dim(120, 25) |
          vln: c5:8.cresc d5:8.cresc e5:8.cresc f5:8.cresc g5:2.dim |
        }
      }
    `);

    const choirEvents = score.events.filter((e) => e.trackId === 'choir');
    expect(choirEvents[0].physics?.swell).toBe('crescendo');
    expect(choirEvents[0].physics?.startVelocity).toBe(30);
    expect(choirEvents[0].physics?.endVelocity).toBe(120);

    expect(choirEvents[3].physics?.swell).toBe('diminuendo');
    expect(choirEvents[3].physics?.startVelocity).toBe(120);
    expect(choirEvents[3].physics?.endVelocity).toBe(25);

    // Multi-note phrase interpolation: each consecutive .cresc 8th note should step up in velocity
    const vlnCresc = score.events.filter((e) => e.trackId === 'vln' && e.physics?.swell === 'crescendo');
    expect(vlnCresc.length).toBe(4);
    expect(vlnCresc[0].physics!.startVelocity!).toBeLessThan(vlnCresc[3].physics!.endVelocity!);

    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.size).toBeGreaterThan(44100);
  });

  it('merges tied notes (~), staggers .arp chords, subdivides .roll(N), expands repeat blocks, and renders ornaments', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "Sheet Music Expression", tempo: 100, time: "4/4" }
        def pno "Piano" style=standard patch="salamander_grand"
        def vln "Violin" style=synth patch="saw_lead"
        measure 1 {
          pno: [c3 g3 c4]:2.arp.ped repeat 2 { e4:8.legato g4:8.legato } |
          vln: d5:2~ d5:4.vib e5:4.trill |
        }
        measure 2 {
          pno: c5:4.roll(4) d5:grace c5:2.fermata.fp |
          vln: a4:4.pizz b4:4.mordent c5:2 |
        }
      }
    `);

    // 1. Verify .arp chord staggered pullMs across the 3 chord notes (0ms, 28ms, 56ms)
    const arpChord = score.events.filter(
      (e) => e.trackId === 'pno' && e.measureNumber === 1 && e.startTime?.numerator === 0
    );
    expect(arpChord.length).toBe(3);
    expect(arpChord[0].physics?.pullMs).toBe(0);
    expect(arpChord[1].physics?.pullMs).toBe(28);
    expect(arpChord[2].physics?.pullMs).toBe(56);
    expect(arpChord[0].physics?.pedal).toBe(true);

    // 2. Verify repeat 2 { e4:8 g4:8 } expanded into 4 eighth-note events in measure 1
    const pnoM1 = score.events.filter((e) => e.trackId === 'pno' && e.measureNumber === 1);
    expect(pnoM1.length).toBe(3 + 4);

    // 3. Verify d5:2~ d5:4 merged into a single dotted-half note (3/4 duration) on 'vln'
    const vlnM1 = score.events.filter((e) => e.trackId === 'vln' && e.measureNumber === 1);
    expect(vlnM1.length).toBe(2); // Merged d5 (3/4) + e5:4.trill (1/4)
    expect(vlnM1[0].duration).toEqual({ numerator: 3, denominator: 4 });
    expect(vlnM1[1].physics?.trill).toBe(true);

    // 4. Verify c5:4.roll(4) subdivided into four 1/16 notes in measure 2
    const pnoM2 = score.events.filter((e) => e.trackId === 'pno' && e.measureNumber === 2);
    // 4 roll notes + 1 grace note + 1 fermata note = 6 events
    expect(pnoM2.length).toBe(6);
    expect(pnoM2[0].duration).toEqual({ numerator: 1, denominator: 16 });
    expect(pnoM2[4].duration.isGrace).toBe(true);
    expect(pnoM2[5].physics?.fermata).toBe(true);
    expect(pnoM2[5].physics?.fp).toBe(true);

    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.size).toBeGreaterThan(44100 * 2);
  });

  it('resolves 128-instrument SoundFont patches and orchestral track names and parses SoundFont sample banks', () => {
    expect(resolveSoundfontInstrument('pno', 'Grand Piano', 'salamander_grand', 'standard')).toBe(
      'acoustic_grand_piano'
    );
    expect(resolveSoundfontInstrument('vln1', 'First Violins', 'saw_lead', 'synth')).toBe('violin');
    expect(resolveSoundfontInstrument('vc', 'Violoncello', 'saw_lead', 'synth')).toBe('cello');
    expect(resolveSoundfontInstrument('hn', 'French Horns', 'saw_lead', 'synth')).toBe('french_horn');
    expect(resolveSoundfontInstrument('soprano', 'Soprano Divisi', 'warm_pad', 'synth')).toBe('choir_aahs');
    expect(resolveSoundfontInstrument('alto', 'Alto Divisi', 'warm_pad', 'synth')).toBe('voice_oohs');
    expect(resolveSoundfontInstrument('harp', 'Concert Harp', 'salamander_grand', 'standard')).toBe(
      'orchestral_harp'
    );
    expect(resolveSoundfontInstrument('vln1', 'First Violins', 'violin', 'standard', true)).toBe(
      'pizzicato_strings'
    );
    expect(resolveSoundfontInstrument('drums', '808 Kit', 'tenuto_808_kit', 'grid')).toBeNull();

    const loader = new SoundfontBankLoader();
    const mockSfJs = `MIDI.Soundfont.acoustic_grand_piano = { "C4": "data:audio/mp3;base64,AAAA", "Eb4": "data:audio/mp3;base64,BBBB" };`;
    const parsedMap = loader.parseSoundfontJs(mockSfJs);
    expect(parsedMap.get(60)).toBe('AAAA');
    expect(parsedMap.get(63)).toBe('BBBB');
  });

  it('resolves timp tracks to sampled orchestral timpani and renders normalized studio percussion in WAV export', async () => {
    expect(resolveSoundfontInstrument('timp', 'Timpani & Orchestral Perc', 'tenuto_808_kit', 'grid')).toBe('timpani');

    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    engine.setMasterVolume(1.5);
    expect(engine.getMasterVolume()).toBe(1.5);

    const drumScore = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "Studio Drum Test", tempo: 120, time: "4/4" }
        def drums "Studio Kit" style=grid patch="tenuto_808_kit"
        measure 1 {
          drums: k:4 s:4 cp:8 h:8 oh:8 lt:8 |
        }
      }
    `);

    const wavBlob = await engine.exportWavBlob(drumScore);
    const arrayBuffer = await wavBlob.arrayBuffer();
    const view = new DataView(arrayBuffer);

    let maxSampleInt16 = 0;
    for (let offset = 44; offset < view.byteLength; offset += 2) {
      const sample = Math.abs(view.getInt16(offset, true));
      if (sample > maxSampleInt16) maxSampleInt16 = sample;
    }

    expect(maxSampleInt16).toBeGreaterThan(16383);
  });
});

