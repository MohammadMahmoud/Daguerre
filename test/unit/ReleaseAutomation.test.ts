import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, expect, test } from 'vitest';

const root = resolve('.');
const temporary: string[] = [];
const git = (cwd: string, ...args: string[]) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
function createRepository(version = '0.0.4') {
  const cwd = mkdtempSync(join(tmpdir(), 'daguerre-release-'));
  temporary.push(cwd);
  git(cwd, 'init', '-q');
  git(cwd, 'config', 'user.email', 'test@example.com');
  git(cwd, 'config', 'user.name', 'Release Test');
  git(cwd, 'config', 'core.hooksPath', '/dev/null');
  mkdirSync(join(cwd, 'public'));
  mkdirSync(join(cwd, 'src-tauri'));
  mkdirSync(join(cwd, 'packages/example'), { recursive: true });
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({ version, workspaces: ['packages/*'] }),
  );
  writeFileSync(
    join(cwd, 'packages/example/package.json'),
    JSON.stringify({ name: 'example', version }),
  );
  writeFileSync(
    join(cwd, 'public/manifest.json'),
    JSON.stringify({ manifest_version: 3, version }),
  );
  writeFileSync(join(cwd, 'src-tauri/tauri.conf.json'), '{}\n');
  writeFileSync(
    join(cwd, 'src-tauri/Cargo.toml'),
    `[package]\nname = "daguerre"\nversion = "${version}"\n`,
  );
  writeFileSync(
    join(cwd, 'src-tauri/Cargo.lock'),
    `[[package]]\nname = "daguerre"\nversion = "${version}"\n\n[[package]]\nname = "other"\nversion = "2.0.0"\n`,
  );
  writeFileSync(
    join(cwd, 'CHANGELOG.md'),
    '# Changelog\n\nHistorical introduction.\n\n## [Desktop 0.0.4] - 2026-11-04\n\n### Fixed\n\n- Preserved history.\n',
  );
  git(cwd, 'add', '.');
  git(cwd, 'commit', '-qm', 'Initial project');
  return cwd;
}
function runScript(cwd: string, script: string, ...args: string[]) {
  return spawnSync(process.execPath, [join(root, 'scripts', script), ...args], {
    cwd,
    encoding: 'utf8',
  });
}
afterEach(() => {
  for (const cwd of temporary.splice(0))
    rmSync(cwd, { recursive: true, force: true });
});

test('rejects unknown release flags without writing manifests', () => {
  const cwd = createRepository();
  const before = readFileSync(join(cwd, 'package.json'), 'utf8');
  for (const script of ['BumpVersion.mjs', 'PublishRelease.mjs']) {
    expect(runScript(cwd, script, '--unknown', '--dry-run').status).not.toBe(0);
    expect(readFileSync(join(cwd, 'package.json'), 'utf8')).toBe(before);
  }
});

test.each([
  ['0.0.4', '0.0.5'],
  ['0.0.8', '0.0.9'],
  ['0.0.9', '0.1.0'],
  ['0.1.9', '0.2.0'],
])('bumps %s to %s without local Git commits', (version, expected) => {
  const cwd = createRepository(version);
  git(cwd, 'tag', `v${version}`);
  const head = git(cwd, 'rev-parse', 'HEAD');
  const result = runScript(cwd, 'BumpVersion.mjs');
  expect(result.status, result.stderr).toBe(0);
  for (const file of [
    'package.json',
    'packages/example/package.json',
    'public/manifest.json',
    'src-tauri/tauri.conf.json',
  ])
    expect(JSON.parse(readFileSync(join(cwd, file), 'utf8')).version).toBe(
      expected,
    );
  expect(readFileSync(join(cwd, 'src-tauri/Cargo.toml'), 'utf8')).toContain(
    `version = "${expected}"`,
  );
  expect(readFileSync(join(cwd, 'src-tauri/Cargo.lock'), 'utf8')).toContain(
    'name = "other"\nversion = "2.0.0"',
  );
  expect(git(cwd, 'rev-parse', 'HEAD')).toBe(head);
});

test('uses unified version tags rather than legacy tags or package drift', () => {
  const cwd = createRepository('3.0.0');
  git(cwd, 'tag', 'v0.0.9');
  git(cwd, 'tag', 'desktop-v3.0.0');
  expect(runScript(cwd, 'BumpVersion.mjs').status).toBe(0);
  expect(
    JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version,
  ).toBe('0.1.0');
});

test('supports explicit versions and validates all manifests before writing', () => {
  const cwd = createRepository();
  expect(runScript(cwd, 'BumpVersion.mjs', '--version', '0.1.0').status).toBe(
    0,
  );
  expect(
    JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).version,
  ).toBe('0.1.0');
  writeFileSync(join(cwd, 'src-tauri/tauri.conf.json'), 'invalid json');
  const before = readFileSync(join(cwd, 'package.json'), 'utf8');
  expect(
    runScript(cwd, 'BumpVersion.mjs', '--version', '0.2.0').status,
  ).not.toBe(0);
  expect(readFileSync(join(cwd, 'package.json'), 'utf8')).toBe(before);
  expect(
    runScript(cwd, 'BumpVersion.mjs', '--version', '0.02.0').status,
  ).not.toBe(0);
});

test('preserves changelog history and emits the exact categorized release section', () => {
  const cwd = createRepository();
  git(cwd, 'tag', 'v0.0.4');
  for (const subject of [
    'feat(desktop): add capture delay',
    'fix: keep windows visible',
    'docs: clarify installation',
    'feat: add capture delay',
  ])
    git(cwd, 'commit', '--allow-empty', '-qm', subject);
  const before = readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8');
  expect(runScript(cwd, 'BumpVersion.mjs').status).toBe(0);
  const result = runScript(cwd, 'UpdateChangelog.mjs', '--version', '0.0.5');
  expect(result.status, result.stderr).toBe(0);
  const changelog = readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8');
  const notes = readFileSync(join(cwd, '.release-notes.md'), 'utf8');
  expect(notes).toMatch(/^## \[v0\.0\.5\] - \d{4}-\d{2}-\d{2}/);
  expect(notes).toContain('### Added\n\n- Add capture delay.');
  expect(notes).toContain('### Fixed\n\n- Keep windows visible.');
  expect(notes).toContain('### Changed\n\n- Clarify installation.');
  expect(notes.match(/Add capture delay/g)).toHaveLength(1);
  expect(changelog).toContain(notes);
  expect(changelog.endsWith(before.slice(before.indexOf('## [Desktop')))).toBe(
    true,
  );
  expect(
    runScript(cwd, 'UpdateChangelog.mjs', '--version', '0.0.5').status,
  ).toBe(0);
  expect(readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8')).toBe(changelog);
  expect(existsSync(join(cwd, 'RELEASE_NOTES.md'))).toBe(false);
  expect(runScript(cwd, 'ReleaseNotes.mjs', 'all').status).toBe(0);
  expect(readFileSync(join(cwd, '.release-notes.md'), 'utf8')).toBe(notes);
});

test('first unified changelog starts at the latest legacy tag and keeps every category heading', () => {
  const cwd = createRepository();
  git(cwd, 'commit', '--allow-empty', '-qm', 'feat: ancient feature');
  git(cwd, 'tag', 'desktop-v0.0.4');
  git(cwd, 'commit', '--allow-empty', '-qm', 'fix: keep windows visible');
  const result = runScript(cwd, 'UpdateChangelog.mjs', '--version', '0.0.5');
  expect(result.status, result.stderr).toBe(0);
  const notes = readFileSync(join(cwd, '.release-notes.md'), 'utf8');
  expect(notes).toContain('### Fixed\n\n- Keep windows visible.');
  expect(notes).not.toContain('Ancient feature');
  expect(notes).toContain('### Added');
  expect(notes).toContain('### Changed');
});

test('a curated Unreleased section becomes the release notes verbatim', () => {
  const cwd = createRepository();
  git(cwd, 'tag', 'v0.0.4');
  git(cwd, 'commit', '--allow-empty', '-qm', 'chore: vague commit');
  const curated =
    '### Added\n\n- Product tour.\n\n### Fixed\n\n- Window placement.\n\n### Changed\n\n- Shared versions.\n';
  const changelog = readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8');
  const offset = changelog.indexOf('## [Desktop');
  writeFileSync(
    join(cwd, 'CHANGELOG.md'),
    `${changelog.slice(0, offset)}## [Unreleased]\n\n${curated}\n${changelog.slice(offset)}`,
  );
  const result = runScript(cwd, 'UpdateChangelog.mjs', '--version', '0.0.5');
  expect(result.status, result.stderr).toBe(0);
  const notes = readFileSync(join(cwd, '.release-notes.md'), 'utf8');
  const updated = readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8');
  expect(notes).toMatch(/^## \[v0\.0\.5\] - \d{4}-\d{2}-\d{2}\n\n/);
  expect(notes.endsWith(curated)).toBe(true);
  expect(notes).not.toContain('Vague commit');
  expect(updated).not.toContain('[Unreleased]');
  expect(updated).toContain(`${notes}\n## [Desktop 0.0.4]`);
});

test('local publisher dispatches main without changing feature-branch files', () => {
  const cwd = createRepository();
  git(cwd, 'switch', '-qc', 'feature/test');
  writeFileSync(join(cwd, 'pending.txt'), 'do not alter');
  const before = git(cwd, 'status', '--porcelain');
  const result = runScript(
    cwd,
    'PublishRelease.mjs',
    '--version',
    '0.1.0',
    '--dry-run',
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout).toContain(
    'gh workflow run release.yml --ref main -f target_version=0.1.0',
  );
  expect(git(cwd, 'status', '--porcelain')).toBe(before);
  expect(
    runScript(cwd, 'PublishRelease.mjs', '--version', 'garbage', '--dry-run')
      .status,
  ).not.toBe(0);
});
