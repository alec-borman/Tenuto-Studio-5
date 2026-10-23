import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TDB-607: Final Release Documentation & Grammar Guide Integrity', () => {
  it('provides TENUTO_GRAMMAR.md with complete songwriting rules and LLM prompt template', () => {
    const grammarPath = path.resolve(__dirname, '../TENUTO_GRAMMAR.md');
    expect(fs.existsSync(grammarPath)).toBe(true);

    const content = fs.readFileSync(grammarPath, 'utf-8');
    expect(content).toContain('tenuto "5.0"');
    expect(content).toContain('salamander_grand');
    expect(content).toContain('tenuto_808_kit');
    expect(content).toContain('Copy-Paste Prompt for Gemini');
  });

  it('provides the final release README.md without legacy alpha disclaimers', () => {
    const readmePath = path.resolve(__dirname, '../README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const content = fs.readFileSync(readmePath, 'utf-8');
    expect(content).toContain('TENUTO STUDIO 5');
    expect(content).toContain('TENUTO_GRAMMAR.md');
    expect(content).toContain('npm run electron:build:mac');
    expect(content).not.toContain('Do not expect to compose music today');
    expect(content).not.toContain('~28% completion');
  });
});
