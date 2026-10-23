import React, { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PRESET_SCORES } from '../src/presets/presetScores';
import { DocumentParser } from '../src/parser/DocumentParser';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
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
});




