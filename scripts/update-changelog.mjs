#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getPreviousTag, git, validateVersion } from './bump-version.mjs';

export function getReleaseSection(changelog, version) {
  validateVersion(version);
  const section = changelog.match(
    new RegExp(
      `^## \\[v${version.replaceAll('.', '\\.')}\\][^\\n]*\\n[\\s\\S]*?(?=^## |$(?![\\s\\S]))`,
      'm',
    ),
  )?.[0];
  return section ? section.trimEnd() + '\n' : undefined;
}

function summarize(subject) {
  const title = subject
    .replace(/^[a-z]+(?:\([^)]*\))?!?:\s*/i, '')
    .replace(/\s*\(#\d+\)$/, '')
    .trim();
  if (/[/\\]|\.(?:tsx?|mjs|json|rs)\b/i.test(title))
    return 'Improve screenshot capture, editing and app reliability.';
  return (
    title.charAt(0).toUpperCase() + title.slice(1).replace(/[.!]+$/, '') + '.'
  );
}

export function updateChangelog(version) {
  validateVersion(version);
  const changelog = readFileSync('CHANGELOG.md', 'utf8');
  const existing = getReleaseSection(changelog, version);
  if (existing) {
    writeFileSync('.release-notes.md', existing);
    return;
  }
  const heading = `## [v${version}] - ${new Date().toISOString().slice(0, 10)}`;
  const unreleased = changelog.match(
    /^## \[Unreleased\][^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m,
  );
  if (unreleased && /^- \S/m.test(unreleased[1])) {
    const section = `${heading}\n\n${unreleased[1].trim()}\n`;
    writeFileSync(
      'CHANGELOG.md',
      changelog.replace(unreleased[0], `${section}\n`),
    );
    writeFileSync('.release-notes.md', section);
    return;
  }
  // Before the first unified tag, start after the newest legacy product release.
  const previous =
    getPreviousTag() ??
    spawnSync('git', ['describe', '--tags', '--abbrev=0'], {
      encoding: 'utf8',
    }).stdout.trim();
  const subjects = git(
    'log',
    '--reverse',
    '--format=%s',
    previous ? `${previous}..HEAD` : 'HEAD',
  )
    .split('\n')
    .filter(
      (subject) =>
        subject &&
        !/^chore\(release\):/.test(subject) &&
        !/^Merge /.test(subject),
    );
  if (!subjects.length)
    throw new Error('No changes since the previous release');
  const groups = { Added: new Set(), Fixed: new Set(), Changed: new Set() };
  for (const subject of subjects) {
    const category = /^(feat|feature)(\(|:|!)/i.test(subject)
      ? 'Added'
      : /^(fix|bugfix)(\(|:|!)/i.test(subject)
        ? 'Fixed'
        : 'Changed';
    groups[category].add(summarize(subject));
  }
  const section =
    `${heading}\n\n` +
    Object.entries(groups)
      .map(
        ([category, entries]) =>
          `### ${category}\n\n${[...entries].map((entry) => `- ${entry}`).join('\n')}`,
      )
      .join('\n\n')
      .trimEnd() +
    '\n';
  const offset = changelog.search(/^## /m);
  const head =
    offset < 0 ? changelog.trimEnd() + '\n\n' : changelog.slice(0, offset);
  const history = offset < 0 ? '' : changelog.slice(offset);
  writeFileSync('CHANGELOG.md', head + section + '\n' + history);
  writeFileSync('.release-notes.md', section);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args[0] !== '--version' || args.length !== 2))
      throw new Error('Usage: update-changelog.mjs [--version X.Y.Z]');
    updateChangelog(
      args[1] ?? JSON.parse(readFileSync('package.json', 'utf8')).version,
    );
  } catch (error) {
    console.error(`changelog: ${error.message}`);
    process.exitCode = 1;
  }
}
