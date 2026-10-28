// Decides which products a change touches, so CI only builds what changed.
// Usage: node scripts/changed.mjs <base-ref>   (prints extension=… desktop=…, also to $GITHUB_OUTPUT)
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DESKTOP = [
  'src-tauri/',
  'src/desktop/',
  'src/platform/Desktop.ts',
  'home.html',
  'overlay.html',
  'test/unit/desktop/',
];
const EXTENSION = [
  'public/',
  'src/background.ts',
  'src/popup.tsx',
  'src/Clipboard.ts',
  'src/platform/Chrome.ts',
  'popup.html',
  'clipboard.html',
  'test/chrome.ts',
  'test/unit/background.test.ts',
  'test/unit/popup.test.tsx',
  'test/unit/Clipboard.test.ts',
];
// Docs, the store site and dev tooling: the always-on test job covers lint and formatting.
const NEITHER = [
  /\.md$/,
  /^LICENSE$/,
  /^store\//,
  /^\.husky\//,
  /^\.prettier(rc\.json|ignore)$/,
  /^eslint\.config\.js$/,
  /^\.vscode\//,
];

const under = (file, prefixes) => prefixes.some((p) => file.startsWith(p));

/** Shared code (the editor, History, export, build config, CI) counts for both products. */
export function classify(files) {
  let extension = false;
  let desktop = false;
  for (const file of files) {
    if (NEITHER.some((re) => re.test(file))) continue;
    const isDesktop = under(file, DESKTOP);
    const isExtension = under(file, EXTENSION);
    if (isDesktop) desktop = true;
    if (isExtension) extension = true;
    if (!isDesktop && !isExtension) extension = desktop = true;
  }
  return { extension, desktop };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const base = process.argv[2];
  let result = { extension: true, desktop: true };
  try {
    const files = execFileSync(
      'git',
      ['diff', '--name-only', `${base}...HEAD`],
      { encoding: 'utf8' },
    )
      .split('\n')
      .filter(Boolean);
    result = classify(files);
  } catch {
    // An unknown base (first push, force-push): build both rather than skip something.
    console.warn(`changed: can't diff against ${base}; checking everything`);
  }
  const lines = Object.entries(result).map(([k, v]) => `${k}=${v}`);
  console.log(lines.join('\n'));
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}
