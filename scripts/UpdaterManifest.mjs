// Writes latest.json, the Tauri updater manifest, for the signed installers in a release folder.
// Usage: node scripts/updater-manifest.mjs <dir> <version> <download-url> [notes-file]
// Skips (exit 0) when nothing is signed, i.e. TAURI_SIGNING_PRIVATE_KEY wasn't set for the build.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// The updater looks up `{os}-{arch}-{installer}`, then `{os}-{arch}`; the universal app serves both Macs.
const TARGETS = [
  [
    '.app.tar.gz',
    [
      'darwin-aarch64-app',
      'darwin-x86_64-app',
      'darwin-aarch64',
      'darwin-x86_64',
    ],
  ],
  ['-setup.exe', ['windows-x86_64-nsis', 'windows-x86_64']],
  ['.msi', ['windows-x86_64-msi']],
  ['.AppImage', ['linux-x86_64-appimage', 'linux-x86_64']],
  ['.deb', ['linux-x86_64-deb']],
  ['.rpm', ['linux-x86_64-rpm']],
];

export function updaterManifest({ version, files, readSig, url, notes, date }) {
  const platforms = {};
  for (const file of files) {
    const targets = TARGETS.find(([suffix]) => file.endsWith(suffix))?.[1];
    if (!targets || !files.includes(`${file}.sig`)) continue;
    const entry = {
      signature: readSig(`${file}.sig`).trim(),
      url: `${url}/${encodeURIComponent(file)}`,
    };
    for (const target of targets) platforms[target] = entry;
  }
  return { version, notes, pub_date: date.toISOString(), platforms };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [dir, version, url, notesFile] = process.argv.slice(2);
  if (!dir || !version || !url) {
    console.error(
      'usage: updater-manifest.mjs <dir> <version> <download-url> [notes-file]',
    );
    process.exit(1);
  }
  const manifest = updaterManifest({
    version,
    files: readdirSync(dir),
    readSig: (file) => readFileSync(join(dir, file), 'utf8'),
    url,
    notes: notesFile ? readFileSync(notesFile, 'utf8') : '',
    date: new Date(),
  });
  const targets = Object.keys(manifest.platforms);
  if (!targets.length) {
    console.log('updater-manifest: no signed installers, skipped latest.json');
  } else {
    writeFileSync(join(dir, 'latest.json'), JSON.stringify(manifest, null, 2));
    console.log(`updater-manifest: latest.json for ${targets.join(', ')}`);
  }
}
