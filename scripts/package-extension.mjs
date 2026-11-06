#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function verifyExtension(directory = 'dist') {
  if (!existsSync(`${directory}/manifest.json`))
    throw new Error(`${directory}/manifest.json is missing; run pnpm build`);
  const manifest = JSON.parse(
    readFileSync(`${directory}/manifest.json`, 'utf8'),
  );
  if (
    manifest.manifest_version !== 3 ||
    !/^\d+\.\d+\.\d+$/.test(manifest.version)
  )
    throw new Error('Invalid extension manifest version');
  for (const file of [
    manifest.background?.service_worker,
    manifest.action?.default_popup,
    'editor.html',
    'history.html',
    'clipboard.html',
    'ocr/worker.min.js',
    'ocr/eng.traineddata.gz',
  ]) {
    if (
      !file ||
      !resolve(directory, file).startsWith(resolve(directory) + sep) ||
      !existsSync(`${directory}/${file}`) ||
      !statSync(`${directory}/${file}`).size
    )
      throw new Error(
        `Extension manifest references missing or empty output: ${file}`,
      );
  }
  const source = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
  if (manifest.version !== source.version)
    throw new Error('Built extension manifest is stale');
  if (!readdirSync(`${directory}/assets`).length)
    throw new Error('Extension assets are empty');
  return manifest;
}

export function packageExtension(out = 'daguerre.zip') {
  verifyExtension();
  const archive = resolve(out);
  rmSync(archive, { force: true });
  execFileSync('zip', ['-qrX', archive, '.', '-x', '.*'], {
    cwd: 'dist',
    stdio: 'inherit',
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    if (process.argv.includes('--verify')) verifyExtension();
    else packageExtension(process.argv[2]);
  } catch (error) {
    console.error(`extension package: ${error.message}`);
    process.exitCode = 1;
  }
}
