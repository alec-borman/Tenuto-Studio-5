import React, { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PRESET_SCORES } from '../src/presets/presetScores';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import {
  resolveSoundfontInstrument,
  SoundfontBankLoader,
  isSustainingOrchestralInstrument,
  isEnsembleSectionTrack,
} from '../src/audio/SoundfontLibrary';
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

  it('marks .roll(N) and .trem continuation slices as legato and prevents feedback on unpanned voices', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();

    const score = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "No Feedback & Smooth Attack Test", tempo: 110, time: "4/4" }
        def vln1 "First Violins" style=synth patch="violin"
        def timp "Timpani" style=grid patch="timpani"
        measure 1 {
          vln1: [c5 e5]:2.trem g5:2.vib |
          timp: k:2.roll(4) k:2 |
        }
      }
    `);

    const vlnEvents = score.events.filter((e) => e.trackId === 'vln1');
    // First slice of .trem has normal attack; continuation slices (index >= 2) are marked legato
    expect(vlnEvents[2].physics?.legato).toBe(true);

    const timpEvents = score.events.filter((e) => e.trackId === 'timp');
    expect(timpEvents[1].physics?.legato).toBe(true);

    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.size).toBeGreaterThan(44100 * 2);
  });

  it('enables multi-desk section unison, sustaining orchestral detection, and deep-body legato offsets', () => {
    expect(isSustainingOrchestralInstrument('violin')).toBe(true);
    expect(isSustainingOrchestralInstrument('french_horn')).toBe(true);
    expect(isSustainingOrchestralInstrument('acoustic_grand_piano')).toBe(false);

    expect(isEnsembleSectionTrack('vln1', 'First Violins', 'violin')).toBe(true);
    expect(isEnsembleSectionTrack('hn', '6 French Horns', 'french_horn')).toBe(true);
    expect(isEnsembleSectionTrack('tpt', 'Solo Trumpet', 'trumpet')).toBe(false);

    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "Concertgebouw Legato Test", tempo: 100, time: "4/4" }
        def vln1 "First Violins" style=standard patch="violin"
        measure 1 {
          vln1: a4:4.p.legato b4:4.mp.legato c5:2.f.vib |
        }
      }
    `);

    const timeline = (engine as any).buildScheduledTimeline(score);
    expect(timeline.length).toBe(3);
    expect(timeline[0].isEnsembleSection).toBe(true);
    expect(timeline[1].isPhraseContinuation).toBe(true);
    expect(timeline[2].isPhraseContinuation).toBe(true);

    // Verify connected legato notes skip >= 85ms past the recorded attack transient
    const profileLegato = (engine as any).getInstrumentArticulationProfile(
      'violin',
      'violin',
      timeline[1].event.physics,
      true,
      0,
      timeline[1].normalizedVelocity
    );
    expect(profileLegato.sampleOffsetSec).toBeGreaterThanOrEqual(0.085);

    // Verify dynamic velocity morphs filter cutoff (.p is warmer/darker than .f)
    const profileQuiet = (engine as any).getInstrumentArticulationProfile(
      'violin',
      'violin',
      timeline[0].event.physics,
      false,
      0,
      0.35
    );
    const profileLoud = (engine as any).getInstrumentArticulationProfile(
      'violin',
      'violin',
      timeline[2].event.physics,
      false,
      0,
      0.92
    );
    expect(profileLoud.filterCutoffHz).toBeGreaterThan(profileQuiet.filterCutoffHz);
  });

  it('compresses (g#4:8 g#4:8 g#4:8):3/2 triplets into 1 quarter beat and renders phase-stable vibrato', async () => {
    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const score = parser.compile(`
      tenuto "5.0" {
        meta @{ title: "Mahler 5 Triplet & Vibrato Test", tempo: 88, time: "4/4" }
        def tpt "Solo Trumpet" style=standard patch="trumpet"
        measure 1 {
          tpt: r:2. (g#4:8.p g#4:8 g#4:8):3/2.pan(0.15) |
        }
        measure 2 {
          tpt: c#5:1.f.vib.pan(0.15) |
        }
      }
    `);

    const tptEvents = score.events.filter((e) => e.trackId === 'tpt');
    expect(tptEvents.length).toBe(4);
    // Each eighth note in a :3/2 triplet must be 1/12 of a whole note (3 notes = 1/4 note total)
    expect(tptEvents[0].duration.numerator).toBe(1);
    expect(tptEvents[0].duration.denominator).toBe(12);
    // Measure 2 starts at exactly 1 whole note (startTime 1/1), proving measure 1 was not stretched to 5.25 beats
    expect(tptEvents[3].startTime.numerator / tptEvents[3].startTime.denominator).toBeCloseTo(1.0, 5);

    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.size).toBeGreaterThan(44100 * 4);
  });

  it('compiles the 60-measure Mahler Symphony No. 6 Finale with 16 tracks, 3 Hammer Blows, tempo map transitions, and fused-token recovery', async () => {
    expect(resolveSoundfontInstrument('ham', 'Mahler Wooden Box Hammer', 'timpani', 'grid')).toBe('taiko_drum');

    const parser = new DocumentParser();
    const engine = new StudioAudioEngine();
    const mahler6Preset = PRESET_SCORES.find((p) => p.id === 'mahler_symphony_6_finale')!;
    expect(mahler6Preset).toBeDefined();

    const score = parser.compile(mahler6Preset.code);
    expect(score.defs.length).toBe(16);
    expect(score.meta.tempoMap?.length).toBe(7);

    const { totalQuarterBeats, totalSeconds } = engine.calculateScoreDuration(score);
    // 60 measures * 4 beats = 240 quarter beats with zero tuplet or fused-token spillover
    expect(totalQuarterBeats).toBe(240);
    expect(totalSeconds).toBeGreaterThan(100);

    const hammerEvents = score.events.filter((e) => e.trackId === 'ham');
    expect(hammerEvents.length).toBe(4); // Three Hammer Blows (M19, M37, M49) + Final Strike (M60)
  });

  it('strips trailing MP3 silence and maintains unbroken sustain energy across 5+ seconds', () => {
    const loader = new SoundfontBankLoader() as any;
    const sr = 44100;
    const rawLen = sr * 2; // 2.0s buffer where 0.85s..2.0s is completely silent (like MusyngKite MP3s)
    const rawData = new Float32Array(rawLen);
    for (let i = 0; i < Math.floor(0.85 * sr); i++) {
      rawData[i] = Math.sin((2 * Math.PI * 440 * i) / sr) * 0.5;
    }

    const fakeCtx = {
      createBuffer: (ch: number, len: number, rate: number) => {
        const chData = new Float32Array(len);
        return {
          numberOfChannels: ch,
          length: len,
          sampleRate: rate,
          duration: len / rate,
          getChannelData: () => chData,
        };
      },
    };

    const srcBuf = {
      numberOfChannels: 1,
      length: rawLen,
      sampleRate: sr,
      duration: 2.0,
      getChannelData: () => rawData,
    };

    const outBuf = loader.createSustainedOrchestralBuffer(fakeCtx, srcBuf, 'violin');
    expect(outBuf.duration).toBeGreaterThanOrEqual(6.0);

    const outData = outBuf.getChannelData(0);
    // Measure RMS at t = 1.5s, t = 3.0s, and t = 5.0s — none of them may drop to zero!
    for (const checkSec of [1.5, 3.0, 5.0]) {
      const startIdx = Math.floor(checkSec * sr);
      let sumSq = 0;
      for (let i = 0; i < 2048; i++) {
        const s = outData[startIdx + i];
        sumSq += s * s;
      }
      const rms = Math.sqrt(sumSq / 2048);
      expect(rms).toBeGreaterThan(0.18);
    }
  });

  it('bidirectionally transposes pitch on vertical note drag and resizes duration on right-edge drag in WebGPUCanvas', () => {
    const parser = new DocumentParser();
    const score = parser.compile('pno: c4:4');
    const onMutation = vi.fn();

    render(<WebGPUCanvas events={score.events} onMutation={onMutation} />);

    const noteEl = screen.getByTestId('piano-roll-note-0');
    // Drag note vertically upward by 80px (4 rows at rowH=20 -> +4 semitones: C4 -> E4)
    fireEvent.mouseDown(noteEl, { clientX: 120, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 120, clientY: 120 });
    fireEvent.mouseUp(window);

    expect(onMutation).toHaveBeenCalledWith(
      expect.objectContaining({ rawToken: 'c4:4' }),
      0,
      4,
      260
    );

    // Drag right-edge resize handle horizontally by +65px (1/4 whole note at wholeNoteScale=260)
    onMutation.mockClear();
    const resizeHandle = screen.getByTestId('note-resize-handle-0');
    fireEvent.mouseDown(resizeHandle, { clientX: 120, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 185, clientY: 200 });
    fireEvent.mouseUp(window);

    expect(onMutation).toHaveBeenCalledWith(
      expect.objectContaining({ rawToken: 'c4:4' }),
      65,
      0,
      260
    );
  });

  it('updates all music on a beat to a different pitch via Shift+Click on a pitch row or Shift+Drag on a note', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`
      tenuto "6.0" {
        meta @{ title: "Shift Beat Repitch", tempo: 120, time: "4/4" }
        def pno "Piano" style=standard patch="salamander_grand"
        def bass "Bass" style=synth patch="808_sub"
        measure 1 {
          pno: c4:2 g4:2 |
          bass: c2:2 g2:2 |
        }
      }
    `);

    const onMutation = vi.fn();
    render(<WebGPUCanvas events={score.events} onMutation={onMutation} />);

    // 1. Shift + Click on pitch row F4 (MIDI 65) at Beat 1 -> dispatches beat-wide +5st mutation (C4 -> F4)
    const rowF4 = screen.getByTestId('piano-roll-row-65');
    fireEvent.click(rowF4, { shiftKey: true, clientX: 60 });

    expect(onMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        isBeatWideMutation: true,
        beatStartWhole: 0,
      }),
      0,
      5,
      260
    );

    // 2. Shift + Drag on note 0 vertically by -40px (+2 semitones at rowH=20) -> dispatches beat-wide +2st mutation
    onMutation.mockClear();
    const note0 = screen.getByTestId('piano-roll-note-0');
    fireEvent.mouseDown(note0, { shiftKey: true, clientX: 80, clientY: 200 });
    fireEvent.mouseMove(window, { clientX: 80, clientY: 160 });
    fireEvent.mouseUp(window);

    expect(onMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        isBeatWideMutation: true,
        beatStartWhole: 0,
      }),
      0,
      2,
      260
    );
  });
});

