// Writes the CHANGELOG section for the current version to release-notes.md (or argv[2]).
// Fails if package.json, the manifest and a pushed v* tag disagree on the version.
import { readFileSync, writeFileSync } from 'node:fs';

const fail = (message) => {
  console.error(`release-notes: ${message}`);
  process.exit(1);
};
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

const { version } = json('package.json');
const manifest = json('public/manifest.json');
if (manifest.version !== version) {
  fail(
    `package.json is ${version} but public/manifest.json is ${manifest.version}`,
  );
}
const tag =
  process.env.GITHUB_REF_TYPE === 'tag'
    ? process.env.GITHUB_REF_NAME
    : undefined;
if (tag && tag !== `v${version}`)
  fail(`tag ${tag} does not match version v${version}`);

const section = readFileSync('CHANGELOG.md', 'utf8')
  .split(/^## /m)
  .find((s) => s.startsWith(`[${version}]`));
if (!section) fail(`CHANGELOG.md has no "## [${version}]" section`);

const out = process.argv[2] ?? 'release-notes.md';
const [heading, ...body] = section.trim().split('\n');
writeFileSync(
  out,
  `# ${manifest.short_name ?? manifest.name} ${heading.replace(/[[\]]/g, '')}\n\n${body.join('\n').trim()}\n`,
);
console.log(`release-notes: wrote ${out} for ${version}`);
