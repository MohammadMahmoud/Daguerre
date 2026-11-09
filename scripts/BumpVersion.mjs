#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { pathToFileURL } from 'node:url';

export const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8' }).trim();
export function validateVersion(version) {
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? '') ||
    version.split('.').some((part) => +part > 65535)
  )
    throw new Error(
      'Version must be X.Y.Z with numeric components between 0 and 65535',
    );
  return version;
}
export function getPreviousTag() {
  const result = spawnSync(
    'git',
    [
      'describe',
      '--tags',
      '--abbrev=0',
      '--match',
      'v[0-9]*.[0-9]*.[0-9]*',
      '--exclude',
      '*-*',
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) return undefined;
  const tag = result.stdout.trim();
  validateVersion(tag.slice(1));
  return tag;
}
export function readVersions() {
  const read = (file) => readFileSync(file, 'utf8');
  const cargo = read('src-tauri/Cargo.toml').match(
    /^version = "([^"]+)"$/m,
  )?.[1];
  return [
    JSON.parse(read('package.json')).version,
    JSON.parse(read('public/manifest.json')).version,
    cargo,
    JSON.parse(read('src-tauri/tauri.conf.json')).version ?? cargo,
  ];
}
export function bumpVersion(override) {
  const previous = getPreviousTag();
  const current = validateVersion(
    previous?.slice(1) ??
      JSON.parse(readFileSync('package.json', 'utf8')).version,
  );
  const [major, minor, patch] = current.split('.').map(Number);
  const version = validateVersion(
    override ??
      `${major}.${patch >= 9 ? minor + 1 : minor}.${patch >= 9 ? 0 : patch + 1}`,
  );
  if (
    spawnSync('git', ['rev-parse', '--verify', `refs/tags/v${version}`], {
      encoding: 'utf8',
    }).status === 0
  )
    throw new Error(`Tag v${version} already exists`);
  if (previous && override) {
    const target = version.split('.').map(Number);
    const base = current.split('.').map(Number);
    const index = target.findIndex((part, offset) => part !== base[offset]);
    if (index < 0 || target[index] < base[index])
      throw new Error('Override must be newer than the previous release tag');
  }
  const files = git(
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  )
    .split('\0')
    .filter(
      (file) =>
        /(^|\/)package\.json$/.test(file) &&
        !/(^|\/)(node_modules|target)\//.test(file),
    );
  const changes = new Map();
  for (const file of new Set([
    'package.json',
    ...files,
    'public/manifest.json',
    'src-tauri/tauri.conf.json',
  ])) {
    const text = readFileSync(file, 'utf8');
    changes.set(file, {
      before: text,
      after: JSON.stringify({ ...JSON.parse(text), version }, null, 2) + '\n',
    });
  }
  for (const [file, pattern] of [
    ['src-tauri/Cargo.toml', /^version = "[^"]+"$/m],
    ['src-tauri/Cargo.lock', /name = "daguerre"\nversion = "[^"]+"/],
  ]) {
    const text = readFileSync(file, 'utf8');
    if (!pattern.test(text))
      throw new Error(`Cannot locate package version in ${file}`);
    const replacement = file.endsWith('.lock')
      ? `name = "daguerre"\nversion = "${version}"`
      : `version = "${version}"`;
    changes.set(file, {
      before: text,
      after: text.replace(pattern, replacement),
    });
  }
  try {
    for (const [file, { after }] of changes)
      writeFileSync(`${file}.release-tmp`, after);
    for (const file of changes.keys()) renameSync(`${file}.release-tmp`, file);
  } catch (error) {
    for (const [file, { before }] of changes) writeFileSync(file, before);
    throw error;
  } finally {
    for (const file of changes.keys())
      rmSync(`${file}.release-tmp`, { force: true });
  }
  return version;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--fetch')) git('fetch', 'origin', '--tags');
    const index = args.indexOf('--version');
    if (
      args.some(
        (arg, offset) =>
          arg !== '--fetch' &&
          arg !== '--version' &&
          !(index >= 0 && offset === index + 1),
      ) ||
      (index >= 0 && !args[index + 1])
    )
      throw new Error('Usage: bump-version.mjs [--fetch] [--version X.Y.Z]');
    const version = bumpVersion(index >= 0 ? args[index + 1] : undefined);
    console.log(version);
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
  } catch (error) {
    console.error(`bump version: ${error.message}`);
    process.exitCode = 1;
  }
}
