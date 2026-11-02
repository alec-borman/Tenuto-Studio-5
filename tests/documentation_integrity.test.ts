// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { purgeRepositoryBloat } from '../vite.config';

describe('TDB-607 through TDB-749: Final Release Documentation, Bloat Purge & v5.3.6 Integrity', () => {
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

  it('provides the synchronized v5.5.0 README.md, package.json, and electron-builder.json free of third-party hardware/platform trademarks', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('TENUTO STUDIO 5');
    expect(content).toContain('v5.5.0');
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
    expect(guideContent).toContain('v5.5.0');
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
    expect(pkgJson.version).toBe('5.5.0');
    expect(pkgJson.scripts['clean:bloat']).toBeDefined();
    expect(pkgJson.scripts['electron:build:mac']).toContain('--mac pkg');
    expect(pkgJson.scripts['electron:build:win']).toContain('--win nsis');

    const builderJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../electron-builder.json'), 'utf-8')
    );
    expect(builderJson.extraMetadata.version).toBe('5.5.0');
  });
});

