#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  bumpVersion,
  git,
  resolveNextVersion,
  validateVersion,
} from './BumpVersion.mjs';
import { updateChangelog } from './UpdateChangelog.mjs';

/** Checks whether a git remote exists in the current repository. */
function hasRemote(name = 'origin') {
  return (
    spawnSync('git', ['remote', 'get-url', name], { encoding: 'utf8' })
      .status === 0
  );
}

/** Validates repository state, creates a local release commit + tag, and pushes atomically. */
function publishRelease({ override, dryRun }) {
  if (dryRun) {
    const version = resolveNextVersion(override);
    console.log(
      [
        `Dry run for v${version}:`,
        `  1. Bump manifests and update CHANGELOG.md for v${version}`,
        `  2. Commit "chore(release): v${version}" (with pre-commit checks & graphify sync)`,
        `  3. Tag annotated "v${version}"`,
        `  4. git push --atomic origin main refs/tags/v${version}`,
      ].join('\n'),
    );
    return;
  }

  if (git('symbolic-ref', '--short', 'HEAD') !== 'main')
    throw new Error('Releases must run from the main branch');
  if (git('status', '--porcelain'))
    throw new Error('Working tree must be clean before releasing');
  if (!hasRemote('origin'))
    throw new Error('Remote "origin" is required to publish a release');

  git('fetch', 'origin', 'main', '--tags');
  if (Number(git('rev-list', '--count', 'HEAD..origin/main')) > 0)
    throw new Error(
      'Local main is behind origin/main; pull or rebase before releasing',
    );

  const version = bumpVersion(override);
  updateChangelog(version);

  const changed = git('diff', '--name-only', '--', '*.json', '*.md')
    .split('\n')
    .filter(Boolean);
  const prettierBin = fileURLToPath(
    new URL('../node_modules/.bin/prettier', import.meta.url),
  );
  if (changed.length && existsSync(prettierBin))
    execFileSync(prettierBin, ['--write', ...changed], { stdio: 'inherit' });

  const releaseNotesScript = fileURLToPath(
    new URL('./ReleaseNotes.mjs', import.meta.url),
  );
  execFileSync(process.execPath, [releaseNotesScript, 'all'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      GITHUB_REF_TYPE: 'tag',
      GITHUB_REF_NAME: `v${version}`,
    },
  });

  git('add', '-u');
  execFileSync('git', ['commit', '-m', `chore(release): v${version}`], {
    stdio: 'inherit',
  });
  execFileSync(
    'git',
    ['tag', '-a', `v${version}`, '-m', `Daguerre v${version}`],
    {
      stdio: 'inherit',
    },
  );
  execFileSync(
    'git',
    ['push', '--atomic', 'origin', 'main', `refs/tags/v${version}`],
    { stdio: 'inherit' },
  );
  console.log(
    `Released v${version} and pushed main + tag v${version} to origin. Follow GitHub Actions → Release.`,
  );
}

try {
  const args = process.argv.slice(2);
  const index = args.indexOf('--version');
  if (
    args.some(
      (arg, offset) =>
        arg !== '--dry-run' &&
        arg !== '--version' &&
        !(index >= 0 && offset === index + 1),
    ) ||
    (index >= 0 && !args[index + 1])
  )
    throw new Error(
      'Usage: pnpm publish:release [--version X.Y.Z] [--dry-run]',
    );

  const override = index >= 0 ? validateVersion(args[index + 1]) : undefined;
  publishRelease({ override, dryRun: args.includes('--dry-run') });
} catch (error) {
  console.error(`publish: ${error.message}`);
  process.exitCode = 1;
}
