/// <reference types="vitest" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

const BLOAT_PATHS = [
  'public/assets/aistudio',
  'Case Study.md',
  'Nocturene and Protocol of the Glass Leviathan.txt',
  'proposal_delta.json',
  'session_state.tela',
  'tenuto_daw_architecture_specification.md',
  'tenuto_studio_5_6_0_architecture.md',
];

export function purgeRepositoryBloat(rootDir: string = __dirname): void {
  for (const relPath of BLOAT_PATHS) {
    const fullPath = path.resolve(rootDir, relPath);
    try {
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    } catch {
      // Ignore permission or locked file errors
    }
  }
}

purgeRepositoryBloat();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    base: './',
    plugins: [
      {
        name: 'tenuto-purge-aistudio-bloat',
        buildStart() {
          purgeRepositoryBloat();
        },
      },
      react(),
      tailwindcss(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@lancedb/lancedb': path.resolve(__dirname, './src/ai/lancedb-stub.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
