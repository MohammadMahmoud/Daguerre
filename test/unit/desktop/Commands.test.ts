import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  );

// Commands the Rust app declares (build.rs) and registers (generate_handler!).
const declared = [
  ...read('src-tauri/build.rs').matchAll(/^\s+"(\w+)",$/gm),
].map((m) => m[1]);
const handlerList = read('src-tauri/src/lib.rs').match(
  /generate_handler!\[([^\]]+)\]/,
)![1];
const registered = handlerList.match(/\w+(?=,|\s*$)/g)!;

test('every command the web app invokes exists in Rust', () => {
  const invoked = new Set(
    files('src')
      .filter((f) => /\.tsx?$/.test(f))
      .flatMap((f) =>
        [...read(f).matchAll(/invoke(?:<[^>]*>)?\(\s*'([\w:|]+)'/g)].map(
          (m) => m[1],
        ),
      ),
  );
  expect(invoked.size).toBeGreaterThan(10);
  for (const cmd of invoked) expect(declared, cmd).toContain(cmd);
});

test('every declared command is registered, and the other way round', () => {
  expect([...registered].sort()).toEqual([...declared].sort());
});

test('every permission in the capabilities refers to a declared command', () => {
  for (const file of files('src-tauri/capabilities')) {
    const { permissions } = JSON.parse(read(file)) as { permissions: string[] };
    for (const p of permissions.filter((p) => p.startsWith('allow-')))
      expect(declared, `${file}: ${p}`).toContain(
        p.slice('allow-'.length).replace(/-/g, '_'),
      );
  }
});

// Hiding it from JS would skip the Dock update in Rust.
test('the main window can only show or hide itself through Rust', () => {
  const { permissions } = JSON.parse(
    read('src-tauri/capabilities/home.json'),
  ) as { permissions: string[] };
  expect(permissions).toEqual(
    expect.arrayContaining(['allow-hide-main', 'allow-show-main']),
  );
  for (const raw of ['show', 'hide', 'set-focus'])
    expect(permissions).not.toContain(`core:window:allow-${raw}`);
});

// The hidden main window runs captures and shortcuts; WebKit would otherwise suspend it mid-capture.
test('the main window is never suspended while hidden', () => {
  const { app } = JSON.parse(read('src-tauri/tauri.conf.json')) as {
    app: { windows: { label: string; backgroundThrottling?: string }[] };
  };
  const home = app.windows.find((w) => w.label === 'home');
  expect(home?.backgroundThrottling).toBe('disabled');
});

// Local builds on macOS compile #[cfg(target_os = "macos")] items, hiding dead-code warnings that
// would fail `cargo clippy -- -D warnings` on Linux and Windows if a helper isn't gated too.
test('every un-gated private Rust helper is used outside macOS-only and test blocks', () => {
  for (const file of files('src-tauri/src').filter((f) => f.endsWith('.rs'))) {
    const withoutTests = read(file).split('#[cfg(test)]')[0];
    // Strip #[cfg(target_os = "macos")] items/blocks to simulate a Linux/Windows build.
    const nonMac = withoutTests.replace(
      /#\[cfg\(target_os = "macos"\)\]\s*(?:(?:#\[[^\]]*\]\s*)*(?:unsafe\s+|async\s+)?fn\s+\w+[^{]*\{[\s\S]*?\n\}|extern\s+"C"\s*\{[\s\S]*?\}|\{[\s\S]*?\}|[^;\n]+;)/g,
      '',
    );
    const fns = [
      ...nonMac.matchAll(
        /(?:^|\n)((?:\s*#\[[^\]]+\]\s*)*)\s*(?:async\s+)?fn\s+(\w+)\s*[<(]/g,
      ),
    ];
    for (const [decl, attrs, name] of fns) {
      if (name === 'main') continue;
      if (attrs.includes('#[tauri::command]') || attrs.includes('#[cfg('))
        continue;
      const body = nonMac.replace(decl, '');
      expect(
        new RegExp(`\\b${name}\\b`).test(body),
        `${file}: fn ${name} is unused on non-macOS targets (gate it with #[cfg(any(target_os = "macos", test))])`,
      ).toBe(true);
    }
  }
});
