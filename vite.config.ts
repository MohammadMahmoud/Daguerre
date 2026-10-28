/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin, type UserConfig } from 'vite';

const require = createRequire(import.meta.url);
const pkgDir = (name: string, from = require) =>
  dirname(from.resolve(`${name}/package.json`));

// MV3 bans remote code: drop Tesseract's CDN fallbacks (we always pass local paths).
const stripCdn = (code: string) =>
  code.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/[^"'`$]*/g, '');

/** Ships the OCR worker, WASM core and English model inside the extension under ocr/. */
function ocrAssets(): Plugin {
  return {
    name: 'ocr-assets',
    renderChunk: (code) => ({ code: stripCdn(code), map: null }),
    writeBundle({ dir = 'dist' }) {
      copyFileSync('LICENSE', join(dir, 'LICENSE'));
      const out = join(dir, 'ocr');
      mkdirSync(out, { recursive: true });
      const tess = pkgDir('tesseract.js');
      const core = pkgDir(
        'tesseract.js-core',
        createRequire(join(tess, 'package.json')),
      );
      const lang = pkgDir('@tesseract.js-data/eng');
      writeFileSync(
        join(out, 'worker.min.js'),
        stripCdn(readFileSync(join(tess, 'dist/worker.min.js'), 'utf8')),
      );
      const copies: [string, string][] = [
        [
          join(tess, 'dist/worker.min.js.LICENSE.txt'),
          'worker.min.js.LICENSE.txt',
        ],
        [
          join(core, 'tesseract-core-simd-lstm.wasm.js'),
          'tesseract-core-simd-lstm.wasm.js',
        ],
        [join(lang, '4.0.0_best_int/eng.traineddata.gz'), 'eng.traineddata.gz'],
        [join(tess, 'LICENSE.md'), 'LICENSE-tesseract.js.txt'],
        [join(core, 'LICENSE'), 'LICENSE-tesseract.js-core.txt'],
      ];
      for (const [from, to] of copies) copyFileSync(from, join(out, to));
    },
  };
}

export default defineConfig(({ mode }): UserConfig => {
  const desktop = mode === 'desktop';
  return {
    plugins: [react(), ocrAssets()],
    base: './',
    // The manifest and extension icons don't belong in the desktop app.
    publicDir: desktop ? false : 'public',
    resolve: {
      alias: {
        '@platform': fileURLToPath(
          new URL(
            `src/platform/${desktop ? 'Desktop' : 'Chrome'}.ts`,
            import.meta.url,
          ),
        ),
      },
    },
    build: desktop
      ? {
          outDir: 'dist-desktop',
          // WKWebView (macOS) and WebKitGTK (Linux) are the oldest engines the app runs in.
          target: ['chrome120', 'safari16'],
          rollupOptions: {
            input: {
              home: 'home.html',
              overlay: 'overlay.html',
              editor: 'editor.html',
              history: 'history.html',
            },
          },
        }
      : {
          target: 'chrome120',
          rollupOptions: {
            input: {
              popup: 'popup.html',
              editor: 'editor.html',
              history: 'history.html',
              clipboard: 'clipboard.html',
              background: 'src/background.ts',
            },
            output: {
              // The manifest points at a fixed service worker path.
              entryFileNames: (chunk: { name: string }) =>
                chunk.name === 'background'
                  ? 'background.js'
                  : 'assets/[name]-[hash].js',
            },
          },
        },
    test: {
      environment: 'jsdom',
      include: ['test/unit/**/*.test.{ts,tsx}'],
      setupFiles: ['test/setup.ts'],
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}'],
        reporter: ['text', 'html', 'json-summary'],
        thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
      },
    },
  };
});
