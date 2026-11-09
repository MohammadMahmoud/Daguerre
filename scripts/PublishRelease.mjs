#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { validateVersion } from './BumpVersion.mjs';

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
  const command = ['workflow', 'run', 'release.yml', '--ref', 'main'];
  if (index >= 0)
    command.push('-f', `target_version=${validateVersion(args[index + 1])}`);
  if (args.includes('--dry-run')) console.log(`gh ${command.join(' ')}`);
  else {
    execFileSync('gh', command, { stdio: 'inherit' });
    console.log(
      'Release requested from remote main. Local files, commits and tags were not changed. Follow gh run list --workflow release.yml.',
    );
  }
} catch (error) {
  console.error(
    `publish: ${error.message}\nInstall GitHub CLI and authenticate with gh auth login, or dispatch Release from GitHub Actions on main.`,
  );
  process.exitCode = 1;
}
