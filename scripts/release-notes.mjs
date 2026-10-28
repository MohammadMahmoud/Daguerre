// Writes the CHANGELOG section for one product's current version to release-notes.md (or argv[3]).
// Usage: node scripts/release-notes.mjs <extension|desktop> [out]
// Fails if a pushed tag (ext-v* / desktop-v*) doesn't match that product's version.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PRODUCTS = {
  extension: { label: 'Extension', tag: 'ext-v', title: 'Daguerre extension' },
  desktop: { label: 'Desktop', tag: 'desktop-v', title: 'Daguerre desktop' },
};

const readText = (path) => readFileSync(path, 'utf8');

/** Each product has one source of truth: the manifest, or the Rust crate. */
export function readVersion(product, read = readText) {
  if (product === 'extension')
    return JSON.parse(read('public/manifest.json')).version;
  if ('version' in JSON.parse(read('src-tauri/tauri.conf.json')))
    throw new Error(
      'src-tauri/tauri.conf.json must not set "version"; the desktop version lives in src-tauri/Cargo.toml',
    );
  return read('src-tauri/Cargo.toml').match(/^version = "(.+)"$/m)?.[1];
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
  const [product, out = 'release-notes.md'] = process.argv.slice(2);
  try {
    if (!PRODUCTS[product])
      throw new Error('usage: release-notes.mjs <extension|desktop> [out]');
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
