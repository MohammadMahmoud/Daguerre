import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { classify } from '../../scripts/changed.mjs';
import { readVersion, releaseNotes } from '../../scripts/release-notes.mjs';

const CHANGELOG = `# Changelog

## [Desktop Unreleased]

- Not yet.

## [Desktop 1.1.0] - 2026-11-02

### Fixed

- Captures no longer stall.

## [Extension 1.2.0] - 2026-11-01

### Added

- A thing.

## [Extension 1.1.0] - 2026-10-30

- Older.
`;

describe('release notes', () => {
  test('pick the product section and title it', () => {
    expect(releaseNotes('extension', '1.2.0', CHANGELOG)).toBe(
      '# Daguerre extension 1.2.0 - 2026-11-01\n\n### Added\n\n- A thing.\n',
    );
    expect(releaseNotes('desktop', '1.1.0', CHANGELOG)).toBe(
      '# Daguerre desktop 1.1.0 - 2026-11-02\n\n### Fixed\n\n- Captures no longer stall.\n',
    );
  });

  test('accept only the matching tag', () => {
    expect(() =>
      releaseNotes('extension', '1.2.0', CHANGELOG, 'ext-v1.2.0'),
    ).not.toThrow();
    expect(() =>
      releaseNotes('desktop', '1.1.0', CHANGELOG, 'desktop-v1.1.0'),
    ).not.toThrow();
    expect(() =>
      releaseNotes('extension', '1.2.0', CHANGELOG, 'desktop-v1.2.0'),
    ).toThrow('does not match the extension version (ext-v1.2.0)');
    expect(() =>
      releaseNotes('desktop', '1.1.0', CHANGELOG, 'desktop-v1.0.9'),
    ).toThrow('does not match');
  });

  test('need a section for the version', () => {
    expect(() => releaseNotes('desktop', '1.2.0', CHANGELOG)).toThrow(
      'CHANGELOG.md has no "## [Desktop 1.2.0]" section',
    );
  });

  test('read each version from its own source of truth', () => {
    const files: Record<string, string> = {
      'public/manifest.json': '{"version": "1.2.0"}',
      'src-tauri/tauri.conf.json': '{"productName": "Daguerre"}',
      'src-tauri/Cargo.toml':
        '[package]\nname = "daguerre"\nversion = "1.1.0"\n\n[dependencies]\nserde = { version = "1" }\n',
    };
    const read = (p: string) => files[p];
    expect(readVersion('extension', read)).toBe('1.2.0');
    expect(readVersion('desktop', read)).toBe('1.1.0');
    files['src-tauri/tauri.conf.json'] = '{"version": "../package.json"}';
    expect(() => readVersion('desktop', read)).toThrow(
      'must not set "version"',
    );
  });

  test('the real repository is consistent', () => {
    const desktop = readVersion('desktop');
    expect(desktop).toMatch(/^\d+\.\d+\.\d+$/);
    const lockVersion = readFileSync('src-tauri/Cargo.lock', 'utf8').match(
      /name = "daguerre"\nversion = "([^"]+)"/,
    )?.[1];
    expect(lockVersion).toBe(desktop);
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    if (!changelog.includes('## [Desktop Unreleased]')) {
      expect(() => releaseNotes('desktop', desktop, changelog)).not.toThrow();
    }
    const extension = readVersion('extension');
    expect(() => releaseNotes('extension', extension, changelog)).not.toThrow();
    // xcap -> libspa 0.10 requires PipeWire >= 0.3.65 (Ubuntu 24.04+) and libwayshot links -lgbm.
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(ci).not.toContain('ubuntu-22.04');
    expect(ci).toContain('libgbm-dev');
  });
});

describe('changed products', () => {
  test('desktop-only and extension-only changes', () => {
    expect(classify(['src-tauri/src/lib.rs', 'src/desktop/Home.tsx'])).toEqual({
      extension: false,
      desktop: true,
    });
    expect(classify(['src/popup.tsx', 'public/manifest.json'])).toEqual({
      extension: true,
      desktop: false,
    });
  });

  test('shared code, build config and CI count for both', () => {
    for (const file of [
      'src/editor.tsx',
      'src/lib/export.ts',
      'package.json',
      'pnpm-lock.yaml',
      'vite.config.ts',
      '.github/workflows/ci.yml',
    ])
      expect(classify([file]), file).toEqual({
        extension: true,
        desktop: true,
      });
  });

  test('docs, the store site and tooling configs count for neither', () => {
    expect(
      classify([
        'README.md',
        'CHANGELOG.md',
        'store/index.html',
        '.husky/pre-commit',
        'eslint.config.js',
      ]),
    ).toEqual({ extension: false, desktop: false });
  });
});
