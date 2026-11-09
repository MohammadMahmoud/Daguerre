// Writes finalized unified notes or a legacy CHANGELOG section to .release-notes.md (or argv[3]).
// Usage: node scripts/release-notes.mjs <all|extension|desktop> [out]
// Fails if a pushed tag doesn't match the release version.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { readVersions } from './BumpVersion.mjs';
import { getReleaseSection } from './UpdateChangelog.mjs';

export const PRODUCTS = {
  extension: { label: 'Extension', tag: 'ext-v', title: 'Daguerre extension' },
  desktop: { label: 'Desktop', tag: 'desktop-v', title: 'Daguerre desktop' },
};

const readText = (path) => readFileSync(path, 'utf8');

/** Each product has one source of truth: the manifest, or the Rust crate. */
export function readVersion(product, read = readText) {
  if (product === 'extension')
    return JSON.parse(read('public/manifest.json')).version;
  const tauriVersion = JSON.parse(read('src-tauri/tauri.conf.json')).version;
  const cargoVersion = read('src-tauri/Cargo.toml').match(
    /^version = "(.+)"$/m,
  )?.[1];
  if (tauriVersion && tauriVersion !== cargoVersion)
    throw new Error('Tauri config version must match src-tauri/Cargo.toml');
  return cargoVersion;
}

export function releaseNotes(product, version, changelog, tag) {
  const { label, tag: prefix, title } = PRODUCTS[product];
  if (tag && tag !== `${prefix}${version}`)
    throw new Error(
      `tag ${tag} does not match the ${product} version (${prefix}${version})`,
    );
  const section = changelog
    .split(/^## /m)
    .find((s) => s.startsWith(`[${label} ${version}]`));
  if (!section)
    throw new Error(`CHANGELOG.md has no "## [${label} ${version}]" section`);
  const [heading, ...body] = section.trim().split('\n');
  const dated = heading.replace(/[[\]]/g, '').slice(label.length + 1);
  return `# ${title} ${dated}\n\n${body.join('\n').trim()}\n`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [product, out = '.release-notes.md'] = process.argv.slice(2);
  try {
    if (product === 'all') {
      const versions = readVersions();
      const version = versions[0];
      if (!version || versions.some((value) => value !== version))
        throw new Error('Release versions are not synchronized');
      if (
        process.env.GITHUB_REF_TYPE === 'tag' &&
        process.env.GITHUB_REF_NAME !== `v${version}`
      )
        throw new Error('Tag does not match the synchronized release version');
      const section = getReleaseSection(readText('CHANGELOG.md'), version);
      if (!section || !/^- \S/m.test(section))
        throw new Error(
          `Missing nonempty CHANGELOG.md section for v${version}`,
        );
      writeFileSync(out, section);
      process.exit(0);
    }
    if (!PRODUCTS[product])
      throw new Error('usage: release-notes.mjs <all|extension|desktop> [out]');
    const version = readVersion(product);
    const tag =
      process.env.GITHUB_REF_TYPE === 'tag'
        ? process.env.GITHUB_REF_NAME
        : undefined;
    writeFileSync(
      out,
      releaseNotes(product, version, readText('CHANGELOG.md'), tag),
    );
    console.log(`release-notes: wrote ${out} for the ${product} ${version}`);
  } catch (e) {
    console.error(`release-notes: ${e.message}`);
    process.exit(1);
  }
}
