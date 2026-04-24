/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import path from 'node:path';
import electron from 'vite-plugin-electron';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

function getElectronDevArgs(): string[] {
  const args = ['.', '--no-sandbox'];

  if (process.platform !== 'linux') {
    return args;
  }

  const hasOzoneOverride = process.argv.some((argument) => argument === '--ozone-platform' || argument.startsWith('--ozone-platform='));
  const hasOzoneHintOverride = process.argv.some((argument) => argument === '--ozone-platform-hint' || argument.startsWith('--ozone-platform-hint='));

  if (hasOzoneOverride || hasOzoneHintOverride || process.env.ELECTRON_OZONE_PLATFORM_HINT) {
    return args;
  }

  return [...args, '--ozone-platform=x11'];
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart({ startup }) {
          return startup(getElectronDevArgs());
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/__tests__/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
