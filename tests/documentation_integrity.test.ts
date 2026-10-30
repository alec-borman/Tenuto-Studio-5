import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TDB-607, TDB-726 & TDB-734: Final Release Documentation, Live Railway Link & Installer Integrity', () => {
  it('provides TENUTO_GRAMMAR.md with complete songwriting rules and LLM prompt template', () => {
    const grammarPath = path.resolve(__dirname, '../TENUTO_GRAMMAR.md');
    expect(fs.existsSync(grammarPath)).toBe(true);

    const content = fs.readFileSync(grammarPath, 'utf-8');
    expect(content).toContain('tenuto "5.0"');
    expect(content).toContain('salamander_grand');
    expect(content).toContain('tenuto_808_kit');
    expect(content).toContain('Copy-Paste Prompt for Gemini');
  });

  it('provides the synchronized v5.0.6 README.md with the live Railway URL and macOS/Windows installer scripts', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('TENUTO STUDIO 5');
    expect(content).toContain('https://tenuto-studio-5-production.up.railway.app/');
    expect(content).toContain('v5.0.6');
    expect(content).toContain('TENUTO_GRAMMAR.md');
    expect(content).toContain('npm run electron:build:mac');
    expect(content).toContain('npm run electron:build:win');
    expect(content).not.toContain('Do not expect to compose music today');

    const pkgJson = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8')
    );
    expect(pkgJson.version).toBe('5.0.6');
    expect(pkgJson.scripts['electron:build:mac']).toContain('--mac pkg');
    expect(pkgJson.scripts['electron:build:win']).toContain('--win nsis');
  });
});
