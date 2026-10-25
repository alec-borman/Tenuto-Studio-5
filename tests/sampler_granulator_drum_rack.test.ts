import { describe, it, expect } from 'vitest';
import { DocumentParser, TrackDefinition } from '../src/parser/DocumentParser';
import { PitchEngine } from '../src/parser/PitchEngine';
import { SamplerAndDrumRackEngine } from '../src/audio/synths/SamplerAndDrumRackEngine';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';

describe('Simpler Vocal Slice Maps, Granulator III & Drum Rack Choke Groups (TDB-721)', () => {
  it('parses map=@{...} slice dictionaries on Simpler/Concrete tracks and resolves named slice PitchLit tokens', () => {
    const parser = new DocumentParser();
    const score = parser.compile(`tenuto "3.0" {
  meta @{ tempo: 124, time: "4/4" }
  def vox "Vocal Chop" style=simpler patch="simpler" src="vox.wav" map=@{ doin: [0.0s, 0.38s], right: [0.38s, 0.85s], harder: [0.85s, 1.25s] }
  measure 1 {
    vox: doin:8 right:8.transpose(5) harder:4.reverse |
  }
}`);

    expect(score.diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    const voxDef = score.defs.find((d) => d.id === 'vox');
    expect(voxDef).toBeDefined();
    expect(voxDef?.style).toBe('simpler');
    expect(voxDef?.map).toEqual({
      doin: [0.0, 0.38],
      right: [0.38, 0.85],
      harder: [0.85, 1.25],
    });

    const voxEvents = score.events.filter((e) => e.trackId === 'vox' && !e.pitch.isRest);
    expect(voxEvents).toHaveLength(3);
    expect(voxEvents[0].pitch.sliceKey).toBe('doin');
    expect(voxEvents[1].pitch.sliceKey).toBe('right');
    expect(voxEvents[1].physics?.pitchShiftSt).toBe(5);
    expect(voxEvents[2].pitch.sliceKey).toBe('harder');
    expect(voxEvents[2].physics?.reverse).toBe(true);
  });

  it('resolves Simpler slices by named key and 1-based .slice(N) index with transpose and reverse', () => {
    const mockDef: TrackDefinition = {
      id: 'vox',
      name: 'Vox',
      style: 'simpler',
      patch: 'simpler',
      volume: 100,
      pan: 0,
      fx: [],
      map: {
        doin: [0.0, 0.4],
        right: [0.4, 0.9],
      },
    };

    const byKey = SamplerAndDrumRackEngine.resolveSimplerSlice(mockDef, 'right', undefined, 12, false, 3);
    expect(byKey.sliceKey).toBe('right');
    expect(byKey.startSec).toBeCloseTo(0.4, 3);
    expect(byKey.endSec).toBeCloseTo(0.9, 3);
    expect(byKey.playbackRate).toBeCloseTo(2.0, 4);
    expect(byKey.durationSec).toBeCloseTo(0.25, 3);
    expect(byKey.formantShiftSt).toBe(3);

    const byIdx = SamplerAndDrumRackEngine.resolveSimplerSlice(mockDef, undefined, 1, 0, true, 0);
    expect(byIdx.sliceKey).toBe('doin');
    expect(byIdx.startSec).toBeCloseTo(0.0, 3);
    expect(byIdx.endSec).toBeCloseTo(0.4, 3);
    expect(byIdx.reverse).toBe(true);
  });

  it('synthesizes Granulator III raised-cosine grain clouds and Simpler vocal chops with non-zero RMS and zero NaNs', () => {
    const sampleRate = 44100;
    const frames = Math.floor(0.35 * sampleRate);

    const granLeft = new Float32Array(frames);
    const granRight = new Float32Array(frames);
    SamplerAndDrumRackEngine.renderGranularOrSimplerNoteToStereo(
      granLeft,
      granRight,
      0,
      frames,
      sampleRate,
      261.63,
      0.28,
      0.85,
      0.0,
      {
        id: 'gran',
        name: 'Granulator Cloud',
        style: 'synth',
        patch: 'granulator',
        volume: 100,
        pan: 0,
        fx: [],
        macros: { grain_size: 55, density: 28, spray: 22 },
      }
    );

    let granEnergy = 0;
    for (let i = 0; i < frames; i++) {
      expect(Number.isFinite(granLeft[i])).toBe(true);
      expect(Number.isFinite(granRight[i])).toBe(true);
      granEnergy += granLeft[i] * granLeft[i] + granRight[i] * granRight[i];
    }
    expect(Math.sqrt(granEnergy / (frames * 2))).toBeGreaterThan(0.02);

    const simpLeft = new Float32Array(frames);
    const simpRight = new Float32Array(frames);
    SamplerAndDrumRackEngine.renderGranularOrSimplerNoteToStereo(
      simpLeft,
      simpRight,
      0,
      frames,
      sampleRate,
      329.63,
      0.25,
      0.85,
      -0.2,
      {
        id: 'vox',
        name: 'Vocal Chop',
        style: 'simpler',
        patch: 'simpler',
        volume: 100,
        pan: 0,
        fx: [],
        map: { doin: [0.0, 0.35] },
      },
      {
        trackId: 'vox',
        voiceId: 'v1',
        measureNumber: 1,
        startTime: { numerator: 0, denominator: 1 },
        duration: { numerator: 1, denominator: 4 },
        pitch: { midi: 64, frequency: 329.63, sliceKey: 'doin' },
        physics: { reverse: true, formant: 2 },
        line: 1,
        col: 1,
      }
    );

    let simpEnergy = 0;
    for (let i = 0; i < frames; i++) {
      expect(Number.isFinite(simpLeft[i])).toBe(true);
      expect(Number.isFinite(simpRight[i])).toBe(true);
      simpEnergy += simpLeft[i] * simpLeft[i] + simpRight[i] * simpRight[i];
    }
    expect(Math.sqrt(simpEnergy / (frames * 2))).toBeGreaterThan(0.02);
  });

  it('enforces 128-Pad Drum Rack Choke Group 1 so closed hi-hats (h/ch) truncate ringing open hi-hats (oh)', () => {
    const pitchEngine = new PitchEngine();
    const chPitch = pitchEngine.parsePitch('ch', 'grid');
    expect(chPitch.midi).toBe(42);
    expect(SamplerAndDrumRackEngine.getChokeGroupForDrumKey('oh', 46)).toBe(1);
    expect(SamplerAndDrumRackEngine.getChokeGroupForDrumKey('ch', 42)).toBe(1);
    expect(SamplerAndDrumRackEngine.getChokeGroupForDrumKey('k', 36)).toBe(0);

    const mockTimeline = [
      {
        startSec: 0.0,
        durSec: 0.25, // Open hi-hat at t = 0.0s
        style: 'grid',
        gridKey: 'oh',
        midi: 46,
        event: { trackId: 'drums' } as any,
      },
      {
        startSec: 0.12, // Closed hi-hat strikes 120ms later on the same Drum Rack track
        durSec: 0.125,
        style: 'grid',
        gridKey: 'ch',
        midi: 42,
        event: { trackId: 'drums' } as any,
      },
    ];

    SamplerAndDrumRackEngine.applyDrumRackChokeGroups(mockTimeline);
    expect(mockTimeline[0].durSec).toBeCloseTo(0.12, 4);
  });

  it('renders a complete score with Simpler slice maps, Granulator III, and Drum Rack Choke Groups via exportWavBlob', async () => {
    const parser = new DocumentParser();
    const score = parser.compile(`tenuto "3.0" {
  meta @{ tempo: 128, time: "4/4" }
  def vox "Vocal Chop" style=simpler patch="simpler" map=@{ work: [0.0s, 0.35s], it: [0.35s, 0.70s] }
  def cloud "Grain Pad" style=synth patch="granulator" macros=@{ grain_size: 64, density: 24, spray: 18 }
  def drums "808 Kit" style=grid patch="tenuto_808_kit"
  measure 1 {
    vox: work:8 it:8.transpose(7).formant(3) work:4.reverse |
    cloud: [c4 e4 g4]:2 r:2 |
    drums: oh:16 ch:16 k:8 s:4 |
  }
}`);

    const engine = new StudioAudioEngine();
    const wavBlob = await engine.exportWavBlob(score);
    expect(wavBlob.size).toBeGreaterThan(44100);
  });
});
