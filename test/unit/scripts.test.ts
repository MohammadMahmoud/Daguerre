import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { readVersions } from '../../scripts/bump-version.mjs';
import { classify } from '../../scripts/changed.mjs';
import { buildCrxBuffer } from '../../scripts/package-extension.mjs';
import { readVersion, releaseNotes } from '../../scripts/release-notes.mjs';
import { getReleaseSection } from '../../scripts/update-changelog.mjs';
import { updaterManifest } from '../../scripts/updater-manifest.mjs';

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
    expect(() => readVersion('desktop', read)).toThrow('must match');
  });

  test('the real repository is consistent', () => {
    const desktop = readVersion('desktop');
    expect(desktop).toMatch(/^\d+\.\d+\.\d+$/);
    const lockVersion = readFileSync('src-tauri/Cargo.lock', 'utf8').match(
      /name = "daguerre"\r?\nversion = "([^"]+)"/,
    )?.[1];
    expect(lockVersion).toBe(desktop);
    const changelog = readFileSync('CHANGELOG.md', 'utf8');
    const unified = getReleaseSection(changelog, desktop);
    if (unified) {
      expect(readVersions().every((version) => version === desktop)).toBe(true);
      expect(unified).toMatch(/^### (Added|Fixed|Changed)$/m);
    } else if (!changelog.includes('## [Desktop Unreleased]')) {
      expect(() => releaseNotes('desktop', desktop, changelog)).not.toThrow();
    }
    const extension = readVersion('extension');
    if (!unified)
      expect(() =>
        releaseNotes('extension', extension, changelog),
      ).not.toThrow();
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

describe('updater manifest', () => {
  test('maps signed installers to updater targets and skips unsigned ones', () => {
    const manifest = updaterManifest({
      version: '1.1.0',
      files: [
        'Daguerre.app.tar.gz',
        'Daguerre.app.tar.gz.sig',
        'Daguerre_1.1.0_universal.dmg',
        'Daguerre_1.1.0_x64-setup.exe',
        'Daguerre_1.1.0_x64-setup.exe.sig',
        'Daguerre_1.1.0_amd64.AppImage',
        'Daguerre_1.1.0_amd64.deb',
      ],
      readSig: (file: string) => `sig of ${file}\n`,
      url: 'https://example.com/dl',
      notes: 'Notes',
      date: new Date('2026-11-04T00:00:00Z'),
    });
    const mac = {
      signature: 'sig of Daguerre.app.tar.gz.sig',
      url: 'https://example.com/dl/Daguerre.app.tar.gz',
    };
    const windows = {
      signature: 'sig of Daguerre_1.1.0_x64-setup.exe.sig',
      url: 'https://example.com/dl/Daguerre_1.1.0_x64-setup.exe',
    };
    expect(manifest).toEqual({
      version: '1.1.0',
      notes: 'Notes',
      pub_date: '2026-11-04T00:00:00.000Z',
      platforms: {
        'darwin-aarch64-app': mac,
        'darwin-x86_64-app': mac,
        'darwin-aarch64': mac,
        'darwin-x86_64': mac,
        'windows-x86_64-nsis': windows,
        'windows-x86_64': windows,
      },
    });
  });

  test('builds a valid CRX3 archive wrapping the extension zip payload', () => {
    const zipPayload = Buffer.from('PK\x03\x04mock-zip-data', 'binary');
    const crx = buildCrxBuffer(zipPayload);
    expect(crx.subarray(0, 4).toString('ascii')).toBe('Cr24');
    expect(crx.readUInt32LE(4)).toBe(3);
    const headerLen = crx.readUInt32LE(8);
    expect(headerLen).toBeGreaterThan(256);
    expect(crx.subarray(12 + headerLen).equals(zipPayload)).toBe(true);
  });
});
