#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

export function resolveCargoEnv(
  env = process.env,
  home = homedir(),
  platform = process.platform,
) {
  const nextEnv = { ...env };
  const pathKey =
    Object.keys(nextEnv).find((k) => k.toLowerCase() === 'path') || 'PATH';
  const currentPath = nextEnv[pathKey] || '';
  const exeName = platform === 'win32' ? 'cargo.exe' : 'cargo';

  const hasCargo = currentPath
    .split(delimiter)
    .filter(Boolean)
    .some((dir) => existsSync(join(dir, exeName)));

  if (!hasCargo) {
    const cargoBin = join(home, '.cargo', 'bin');
    if (existsSync(join(cargoBin, exeName))) {
      nextEnv[pathKey] = currentPath
        ? `${cargoBin}${delimiter}${currentPath}`
        : cargoBin;
    }
  }

  return nextEnv;
}

export function resolveAppleSigningIdentity(
  env = process.env,
  platform = process.platform,
  runSecurity = () => {
    return spawnSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).stdout;
  },
) {
  if (platform !== 'darwin') {
    return env.APPLE_SIGNING_IDENTITY;
  }
  if (env.APPLE_SIGNING_IDENTITY) {
    return env.APPLE_SIGNING_IDENTITY;
  }
  try {
    const output = runSecurity();
    const match = output && output.match(/"([^"]+)"/);
    if (match && match[1]) {
      return match[1];
    }
  } catch {
    // Ignore security lookup failure and fall back to ad-hoc signing.
  }
  return '-';
}

export function buildDesktop(
  args = process.argv.slice(2),
  {
    env = process.env,
    platform = process.platform,
    home = homedir(),
    runSecurity,
    runner = spawnSync,
  } = {},
) {
  const buildEnv = resolveCargoEnv(env, home, platform);
  const appleIdentity = resolveAppleSigningIdentity(
    buildEnv,
    platform,
    runSecurity,
  );
  if (appleIdentity !== undefined) {
    buildEnv.APPLE_SIGNING_IDENTITY = appleIdentity;
  }

  const tauriCliPath = require.resolve('@tauri-apps/cli/tauri.js');
  const result = runner(process.execPath, [tauriCliPath, 'build', ...args], {
    stdio: 'inherit',
    env: buildEnv,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const code = result.status ?? 1;
    const error = new Error(`Tauri build exited with code ${code}`);
    error.exitCode = code;
    throw error;
  }
  return result;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    buildDesktop();
  } catch (error) {
    console.error(`desktop build: ${error.message}`);
    process.exit(error.exitCode || 1);
  }
}
