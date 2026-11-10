import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { applyEditorGlass } from '../../../src/desktop/EditorGlass';

let calls: { cmd: string; payload: unknown }[];
let blend: number | null;
let liquid: boolean;

beforeEach(() => {
  calls = [];
  blend = 100;
  liquid = true;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false })),
  );
  mockWindows('editor-1');
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload });
    if (cmd === 'theme_blend') return blend;
    if (cmd === 'set_liquid_glass') return liquid;
  });
});
afterEach(() => {
  clearMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  const root = document.documentElement;
  root.removeAttribute('style');
  delete root.dataset.appearance;
  delete root.dataset.nativeGlass;
});

const root = document.documentElement;

test('editor takes on the main window glass at the saved strength', async () => {
  blend = 60;
  await applyEditorGlass();
  expect(root.dataset.appearance).toBe('glass');
  expect(root.dataset.nativeGlass).toBe('true');
  expect(root.style.getPropertyValue('--theme-blend')).toBe('0.6');
  expect(calls).toContainEqual({
    cmd: 'set_liquid_glass',
    payload: { on: true },
  });
});

test('falls back to vibrancy before macOS 26', async () => {
  liquid = false;
  await applyEditorGlass();
  expect(calls.some((c) => c.cmd === 'plugin:window|set_effects')).toBe(true);
  expect(root.dataset.nativeGlass).toBe('true');
});

test('Current design at 0% stays solid and clears native effects', async () => {
  blend = 0;
  await applyEditorGlass();
  expect(root.dataset.appearance).toBe('mac');
  expect(root.dataset.nativeGlass).toBe('false');
  expect(calls).toContainEqual({
    cmd: 'set_liquid_glass',
    payload: { on: false },
  });
});

test('reduced transparency keeps the editor solid', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
  await applyEditorGlass();
  expect(root.dataset.appearance).toBe('mac');
  expect(root.style.getPropertyValue('--theme-blend')).toBe('0');
});

test('uses the local setting when the saved file is missing', async () => {
  blend = null;
  localStorage.setItem('themeBlend', '100');
  await applyEditorGlass();
  expect(root.dataset.appearance).toBe('glass');
});

test('glass design styles dialogs, the top bar and the overlaid title bar', async () => {
  const css = (await import('node:fs')).readFileSync('src/Styles.css', 'utf8');
  expect(css).toMatch(
    /:root\[data-appearance='glass'\] \.dialog \{[^}]*backdrop-filter: var\(--glass-filter\)/,
  );
  expect(css).toMatch(
    /:root\[data-appearance='glass'\] \.dialog-backdrop \{[^}]*calc\(0\.5 - /,
  );
  expect(css).toMatch(
    /\[data-appearance='glass'\]\) \.topbar \{\s*padding-top: 36px/,
  );
  const rust = (await import('node:fs')).readFileSync(
    'src-tauri/src/lib.rs',
    'utf8',
  );
  expect(rust).toContain('TitleBarStyle::Overlay');
});
