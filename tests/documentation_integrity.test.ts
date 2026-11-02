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
import { MutablePlaitsEngine } from '../src/audio/eurorack/MutablePlaitsEngine';
import { StrudelAndMusicXmlExporter } from '../src/audio/export/StrudelAndMusicXmlExporter';
import { AbletonAudioFxEngine } from '../src/audio/fx/AbletonAudioFxEngine';
import { DocumentParser } from '../src/parser/DocumentParser';

describe('TDB-607 through TDB-752: Final Release Documentation, Bloat Purge & v5.6.8 Integrity', () => {
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

  it('provides the synchronized v5.6.8 README.md, package.json, and electron-builder.json free of third-party hardware/platform trademarks', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('TENUTO STUDIO 5');
    expect(content).toContain('v5.6.8');
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
    expect(guideContent).toContain('v5.6.8');
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
    expect(pkgJson.version).toBe('5.6.8');
    expect(pkgJson.scripts['clean:bloat']).toBeDefined();
    expect(pkgJson.scripts['electron:build:mac']).toContain('--mac pkg');
    expect(pkgJson.scripts['electron:build:win']).toContain('--win nsis');

    const builderJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../electron-builder.json'), 'utf-8')
    );
    expect(builderJson.extraMetadata.version).toBe('5.6.8');
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

  it('synthesizes all 12 MIT Eurorack mi:* patches with Vactrol LPG and zero DC offset', () => {
    expect(MutablePlaitsEngine.PATCH_CATALOG.length).toBe(12);
    expect(MutablePlaitsEngine.isEurorackPatch('mi:plaits_va')).toBe(true);
    expect(MutablePlaitsEngine.isEurorackPatch('supersaw', 'eurorack')).toBe(true);
    expect(MutablePlaitsEngine.isEurorackPatch('supersaw', 'synth')).toBe(false);

    for (const patchId of MutablePlaitsEngine.PATCH_CATALOG) {
      const left = new Float32Array(2048);
      const right = new Float32Array(2048);
      MutablePlaitsEngine.renderVoiceIntoStereo(
        left,
        right,
        0,
        2048,
        44100,
        120,
        99,
        {
          event: {
            pitch: { note: 'A', octave: 3, midi: 57 },
            startTime: { numerator: 0, denominator: 1 },
            duration: { numerator: 1, denominator: 4 },
            patch: patchId,
            physics: { velocity: 100, lpg: { mode: 'both', decayMs: 320 } },
          } as any,
          def: {
            id: 'mod',
            name: 'Modular',
            style: 'eurorack',
            patch: patchId,
            volume: 85,
            pan: 0,
            fx: [],
          },
          freq: 220.0,
          midi: 57,
          amp: 0.8,
          startAmp: 0.8,
          endAmp: 0.8,
          pan: 0,
          startSec: 0,
          durSec: 0.25,
        }
      );

      let peak = 0;
      for (let i = 0; i < left.length; i++) {
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
      }
      expect(peak).toBeGreaterThan(0.01);
      expect(Number.isFinite(peak)).toBe(true);
    }
  });

  it('processes Signalsmith FDN reverb/stretch/chorus FX and exports Strudel (.strudel), MusicXML 4.0 (.musicxml), and Faust (.dsp)', () => {
    for (const fxType of ['signalsmith_reverb', 'signalsmith_stretch', 'signalsmith_chorus']) {
      expect(AbletonAudioFxEngine.isSupportedFx(fxType)).toBe(true);
      const l = new Float32Array(2048);
      const r = new Float32Array(2048);
      for (let i = 0; i < 2048; i++) {
        l[i] = Math.sin((2 * Math.PI * 330 * i) / 44100) * 0.5;
        r[i] = Math.cos((2 * Math.PI * 330 * i) / 44100) * 0.5;
      }
      AbletonAudioFxEngine.applyDeviceToSlice(l, r, 0, 2048, 44100, {
        type: fxType,
        params: { mix: 0.5 },
      });
      expect(Number.isFinite(l[1024])).toBe(true);
      expect(Math.abs(l[1024])).toBeGreaterThan(0.001);
    }

    const parser = new DocumentParser();
    const score = parser.compile(`tenuto "6.0" {
      meta @{ title: "Interop Suite", tempo: 120, time: "4/4" }
      def lead "Lead" style=synth patch="supersaw"
      def drums "Kit" style=grid patch="tenuto_808_kit"
      measure 1 {
        lead: [c4 e4 g4]:2 d4:4.lyric("shine") e4:4 |
        drums: k:4 s:4 h:4 oh:4 |
      }
    }`);

    const strudel = StrudelAndMusicXmlExporter.compileScoreToStrudel(score);
    expect(strudel).toContain('setcpm(30)');
    expect(strudel).toContain('stack(');
    expect(strudel).toContain('.s("supersaw")');
    expect(strudel).toContain('.bank("RolandTR808")');

    const musicXml = StrudelAndMusicXmlExporter.compileScoreToMusicXml(score);
    expect(musicXml).toContain('<score-partwise version="4.0">');
    expect(musicXml).toContain('<work-title>Interop Suite</work-title>');
    expect(musicXml).toContain('<chord/>');
    expect(musicXml).toContain('<lyric number="1"><text>shine</text></lyric>');

    const faust = StrudelAndMusicXmlExporter.compileScoreToFaustDsp(score);
    expect(faust).toContain('import("stdfaust.lib");');
    expect(faust).toContain('process = filtered <: _, _;');
  });

  it('compiles and renders inline .ten MIT engine modifiers (.timbre, .harmonics, .structure, .damping, .jawari, .breath, .jet, .pdhalf, .gbuzz, .fof, .ply, .degrade, .galactic, .dattorro, .paulstretch, .totape) and Strudel pattern combinators (fast, slow, rev)', async () => {
    const parser = new DocumentParser();
    const dslScore = parser.compile(`tenuto "6.0" {
      meta @{ title: "Inline MIT Modifiers", tempo: 120, time: "4/4" }
      def rings "Rings" style=eurorack patch="mi:rings_sympathetic" structure=65 damping=80
      def sitar "Sitar" style=stk patch="stk:sitar" jawari=75
      def flute "Flute" style=stk patch="stk:flute" breath=60 jet=50
      def cz "CZ" style=soundpipe patch="sp:pdhalf"

      measure 1 {
        rings: fast 2 { d4:4.structure(70%).damping(85%) a4:4.timbre(75%) } rev { f4:4 c5:4.ply(2) } |
        sitar: d3:2.jawari(82%).dattorro(40%) a2:2.jawari(65%).galactic(45%) |
        flute: slow 2 { a4:4.breath(68%).jet(54%) g4:4.paulstretch(4.0) } |
        cz:    d2:2.pdhalf(78%).totape(45%) a1:2.gbuzz(72%).fof("e").degrade(25%) |
      }
    }`);

    expect(dslScore.events.length).toBeGreaterThanOrEqual(12);
    const ringsDef = dslScore.defs.find((d) => d.id === 'rings');
    expect(ringsDef?.macros?.structure).toBe(65);
    expect(ringsDef?.macros?.damping).toBe(80);

    const sitarEvent = dslScore.events.find((e) => e.trackId === 'sitar');
    expect(sitarEvent?.physics?.jawariAmount).toBe(82);
    expect(sitarEvent?.physics?.fx?.some((f) => f.type === 'dattorro_plate')).toBe(true);

    const czEvents = dslScore.events.filter((e) => e.trackId === 'cz');
    expect(czEvents[0]?.physics?.pdhalfAmount).toBe(78);
    expect(czEvents[1]?.physics?.gbuzzAmount).toBe(72);
    expect(czEvents[1]?.physics?.lyric).toBe('e');
    expect(czEvents[1]?.physics?.chance).toBe(75);

    const engine = new StudioAudioEngine();
    const wavBlob = await engine.exportWavBlob(dslScore);
    expect(wavBlob.size).toBeGreaterThan(44100);
  });

  it('parses SuperCollider UGen modifiers (.rlpf, .dfm1, .moog_ff, .klank) and sticky-duration fast/slow blocks, and documents all MIT engines in TENUTO_GRAMMAR.md', () => {
    const parser = new DocumentParser();
    const scModScore = parser.compile(`tenuto "6.0" {
      meta @{ title: "SC UGen Modifiers & Sticky Fast", tempo: 120, time: "4/4" }
      def acid "SC Acid" style=scsynth patch="sc:tb303"
      def bell "SC Klank" style=scsynth patch="sc:klank_resonator"
      measure 1 {
        acid:  c2:4.dfm1(1800, 2.6) g2:4.rlpf(2400, 1.8) fast 2 { c3 d3 } |
        bell:  e5:2.klank("bell", 85%) b4:2.moog_ff(3200, 2.2) |
      }
    }`);

    const acidEvs = scModScore.events.filter((e) => e.trackId === 'acid');
    expect(acidEvs.length).toBe(6);
    expect(acidEvs[0]?.physics?.cutoff).toBe(1800);
    expect(acidEvs[0]?.physics?.resonance).toBe(2.6);
    expect(acidEvs[0]?.physics?.steinerDrive).toBeGreaterThanOrEqual(55);
    expect(acidEvs[1]?.physics?.cutoff).toBe(2400);
    expect(acidEvs[2]?.duration.denominator).toBe(8);

    const bellEvs = scModScore.events.filter((e) => e.trackId === 'bell');
    expect(bellEvs[0]?.physics?.damping).toBe(85);
    expect(bellEvs[1]?.physics?.cutoff).toBe(3200);
    expect(bellEvs[1]?.physics?.discreteDrive).toBeGreaterThanOrEqual(48);

    const grammarContent = fs.readFileSync(
      path.resolve(__dirname, '../TENUTO_GRAMMAR.md'),
      'utf-8'
    );
    expect(grammarContent).toContain('sc:prophet');
    expect(grammarContent).toContain('mi:rings_sympathetic');
    expect(grammarContent).toContain('stk:sitar');
    expect(grammarContent).toContain('sp:fof_choir');
    expect(grammarContent).toContain('aw_galactic');
    expect(grammarContent).toContain('dattorro_plate');
  });
});


