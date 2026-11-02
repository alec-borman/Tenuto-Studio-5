// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { purgeRepositoryBloat } from '../vite.config';
import {
  snapToStandardRefreshRate,
  estimateRefreshRateFromDeltas,
} from '../src/utils/useDisplayRefreshRate';
import { ASTSerializer } from '../src/parser/ASTSerializer';
import { IncrementalCompiler } from '../src/parser/IncrementalCompiler';
import { StudioAudioEngine } from '../src/audio/StudioAudioEngine';
import { SuperColliderEngine } from '../src/audio/scsynth/SuperColliderEngine';

describe('TDB-607 through TDB-749: Final Release Documentation, Bloat Purge & v5.5.6 Integrity', () => {
  it('accurately detects 60Hz, 120Hz, 144Hz, 165Hz, and 240Hz monitor refresh rates from VSync frame deltas', () => {
    expect(snapToStandardRefreshRate(59.94)).toBe(60);
    expect(snapToStandardRefreshRate(119.88)).toBe(120);
    expect(snapToStandardRefreshRate(143.9)).toBe(144);
    expect(snapToStandardRefreshRate(164.8)).toBe(165);
    expect(snapToStandardRefreshRate(239.76)).toBe(240);

    // 144Hz monitor with two GC/compositor outlier spikes that should be trimmed out
    const deltas144 = [
      33.3,
      ...Array.from({ length: 20 }, () => 1000 / 144),
      28.0,
    ];
    const est144 = estimateRefreshRateFromDeltas(deltas144);
    expect(est144.snappedHz).toBe(144);
    expect(est144.isHighRefresh).toBe(true);
    expect(est144.isCalibrated).toBe(true);

    // 240Hz monitor (~4.166ms per frame)
    const deltas240 = Array.from({ length: 24 }, () => 1000 / 240);
    const est240 = estimateRefreshRateFromDeltas(deltas240);
    expect(est240.snappedHz).toBe(240);
    expect(est240.isHighRefresh).toBe(true);
    expect(est240.frameBudgetMs).toBeCloseTo(1000 / 240, 3);
  });

  it('purges unreferenced AI Studio paste dumps and root bloat artifacts while keeping all needed docs and code', () => {
    const rootDir = path.resolve(__dirname, '..');
    purgeRepositoryBloat(rootDir);

    const bloatTargets = [
      'public/assets/aistudio',
      'Case Study.md',
      'Nocturene and Protocol of the Glass Leviathan.txt',
      'proposal_delta.json',
      'session_state.tela',
      'tenuto_daw_architecture_specification.md',
      'tenuto_studio_5_6_0_architecture.md',
    ];

    for (const rel of bloatTargets) {
      expect(fs.existsSync(path.resolve(rootDir, rel))).toBe(false);
    }

    const repomixConfigPath = path.resolve(rootDir, 'repomix.config.json');
    expect(fs.existsSync(repomixConfigPath)).toBe(true);
    const repomixConfig = JSON.parse(fs.readFileSync(repomixConfigPath, 'utf-8'));
    expect(repomixConfig.ignore.customPatterns).toContain('public/assets/aistudio/**');
  });

  it('provides TENUTO_GRAMMAR.md with complete songwriting rules and LLM prompt template', () => {
    const grammarPath = path.resolve(__dirname, '../TENUTO_GRAMMAR.md');
    expect(fs.existsSync(grammarPath)).toBe(true);

    const content = fs.readFileSync(grammarPath, 'utf-8');
    expect(content).toContain('tenuto "5.0"');
    expect(content).toContain('salamander_grand');
    expect(content).toContain('tenuto_808_kit');
    expect(content).toContain('Copy-Paste Prompt for Gemini');
  });

  it('provides the synchronized v5.5.6 README.md, package.json, and electron-builder.json free of third-party hardware/platform trademarks', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('TENUTO STUDIO 5');
    expect(content).toContain('v5.5.6');
    expect(content).toContain('TENUTO_GRAMMAR.md');
    expect(content).toContain('repomix.config.json');
    expect(content).toContain('npm run electron:build:mac');
    expect(content).toContain('npm run electron:build:win');
    expect(content).not.toContain('Do not expect to compose music today');

    const guidePath = path.resolve(
      __dirname,
      '../Definitive Guide to Tenuto Composition.md'
    );
    expect(fs.existsSync(guidePath)).toBe(true);
    const guideContent = fs.readFileSync(guidePath, 'utf-8');
    expect(guideContent).toContain('v5.5.6');
    expect(guideContent).toContain('Blueprint 1:');
    expect(guideContent).toContain('Blueprint 6:');

    const grammarContent = fs.readFileSync(
      path.resolve(__dirname, '../TENUTO_GRAMMAR.md'),
      'utf-8'
    );
    const forbiddenTrademarks = [
      'PolyBrute',
      'Burl',
      'Bettermaker',
      'Bricasti',
      'Eventide',
      'WesAudio',
      'Swarmatron',
      'TikTok',
    ];
    for (const brand of forbiddenTrademarks) {
      expect(content).not.toContain(brand);
      expect(grammarContent).not.toContain(brand);
      expect(guideContent).not.toContain(brand);
    }

    const pkgJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
    );
    expect(pkgJson.version).toBe('5.5.6');
    expect(pkgJson.scripts['clean:bloat']).toBeDefined();
    expect(pkgJson.scripts['electron:build:mac']).toContain('--mac pkg');
    expect(pkgJson.scripts['electron:build:win']).toContain('--win nsis');

    const builderJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../electron-builder.json'), 'utf-8')
    );
    expect(builderJson.extraMetadata.version).toBe('5.5.6');
  });

  it('synthesizes all 12 SuperCollider (sc:*) UGen-Graph patches, encodes RFC-compliant OSC 1.1 /s_new bundles, and exports valid sclang .scd scores', async () => {
    expect(SuperColliderEngine.SC_PATCH_CATALOG).toHaveLength(12);

    const scScore = `tenuto "6.0" {
  meta @{ title: "SuperCollider UGen Verification", tempo: 124 }
  def lead "SC Prophet" style=scsynth patch="sc:prophet"
  def acid "SC 303" style=synth patch="sc:tb303"
  def bell "SC Modal Bell" style=synth patch="sc:modal_bell"
  def pluck "SC Karplus" style=synth patch="sc:karplus_pluck"

  measure 1 {
    lead: [c4 e4 g4 b4]:2.mf.filter(900, 3800) [d4 f#4 a4 c5]:2.f.glide(120ms) |
    acid: c2:4.f.cutoff(1200) g2:4.f c2:4.mf eb2:4.f |
    bell: e5:2.mp b5:2.mp |
    pluck: g3:4.mf d4:4.mf b3:4.mf g4:4.mf |
  }
}`;

    const compiler = new IncrementalCompiler(new ASTSerializer());
    const compiled = compiler.compileDocument(scScore);
    expect(compiled.events.length).toBeGreaterThanOrEqual(8);

    // Verify Binary OSC 1.1 /s_new message & #bundle encoding
    const bundles = SuperColliderEngine.buildScoreOscBundles(compiled);
    expect(bundles.length).toBeGreaterThanOrEqual(8);
    const firstBundle = bundles[0];
    const headerStr = String.fromCharCode(...firstBundle.slice(0, 7));
    expect(headerStr).toBe('#bundle');
    expect(firstBundle.byteLength % 4).toBe(0);

    // Verify standalone .scd (SynthDef + Pbind) script export
    const scdScript = SuperColliderEngine.exportSuperColliderScd(compiled);
    expect(scdScript).toContain('s.waitForBoot({');
    expect(scdScript).toContain('SynthDef(\\tenuto_sc_prophet');
    expect(scdScript).toContain('SynthDef(\\tenuto_sc_tb303');
    expect(scdScript).toContain('SynthDef(\\tenuto_sc_modal_bell');
    expect(scdScript).toContain('SynthDef(\\tenuto_sc_karplus_pluck');
    expect(scdScript).toContain('Ppar([');
    expect(scdScript).toContain('Pbind(');

    // Verify non-silent stereo PCM rendering across all 12 sc:* patches
    for (const patchId of SuperColliderEngine.SC_PATCH_CATALOG) {
      const left = new Float32Array(4096);
      const right = new Float32Array(4096);
      SuperColliderEngine.renderUGenVoiceIntoStereo(
        left,
        right,
        0,
        4096,
        44100,
        120,
        1337,
        {
          event: {
            type: 'note',
            measureNumber: 1,
            trackId: 'sc',
            voiceId: 'v1',
            patch: patchId,
            pitch: { step: 'A', octave: 4, midi: 69, frequency: 440 },
            duration: { numerator: 1, denominator: 4 },
            velocity: 100,
          } as any,
          def: { id: 'sc', name: 'SC', patch: patchId, style: 'scsynth' } as any,
          startSec: 0,
          durSec: 0.1,
          freq: 440,
          midi: 69,
          amp: 0.8,
          startAmp: 0.8,
          endAmp: 0.8,
          pan: 0,
        }
      );
      let peak = 0;
      for (let i = 0; i < left.length; i++) {
        const m = Math.max(Math.abs(left[i]), Math.abs(right[i]));
        if (m > peak) peak = m;
      }
      expect(peak).toBeGreaterThan(0.01);
    }

    // Verify full StudioAudioEngine WAV export with SuperCollider tracks
    const audioEngine = new StudioAudioEngine();
    const wavBlob = await audioEngine.exportWavBlob(compiled);
    const wavBuffer = await wavBlob.arrayBuffer();
    const view = new DataView(wavBuffer);
    let maxSample = 0;
    for (let offset = 44; offset + 2 <= wavBuffer.byteLength; offset += 2) {
      const sample = Math.abs(view.getInt16(offset, true));
      if (sample > maxSample) maxSample = sample;
    }
    expect(maxSample).toBeGreaterThan(2000);
  });
});


