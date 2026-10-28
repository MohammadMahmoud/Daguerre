import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { CaptureMode } from '../lib/db';

export const CAPTURE_MODES: CaptureMode[] = ['selection', 'screen', 'window'];

export type Action = 'selection' | 'screen' | 'window' | 'copy-selection';
// Alt is Option on macOS.
export const DEFAULT_SHORTCUTS: Record<Action, string> = {
  selection: 'Alt+Shift+S',
  window: 'Alt+Shift+W',
  screen: 'Alt+Shift+V',
  'copy-selection': 'Alt+Shift+C',
};

export const CAPTURE_HINT =
  'Use Capture, the Daguerre icon in the menu bar or system tray, or a shortcut.';
export const SHORTCUT_HINTS: [keys: string, label: string][] = [
  [DEFAULT_SHORTCUTS.selection, 'Select area'],
  [DEFAULT_SHORTCUTS.window, 'Window'],
  [DEFAULT_SHORTCUTS.screen, 'Screen'],
];
export const NO_URL_LABEL = '';
export const SAVE_PNG_LABEL = 'Save PNG…';
export const SAVED_TOAST = 'Saved';
export const SEARCH_PLACEHOLDER = 'Search by title';

const bytes = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

/** Asks where to save, then writes the file; resolves false if the dialog is cancelled. */
export async function downloadBlob(blob: Blob, name: string) {
  return invoke<boolean>('save_file', await bytes(blob), {
    // Header values must be ASCII.
    headers: { 'x-file-name': name.replace(/[^\x20-\x7e]/g, '_') },
  });
}

export async function copyPng(png: Blob | Promise<Blob>) {
  await invoke('copy_png', await bytes(await png));
}

export async function copyText(text: Promise<string>) {
  await invoke('copy_text', { text: await text });
}

// WKWebView ignores window.print(), so the native webview prints itself.
export const printPage = () => invoke('print');

/** History lives in the main window: bring it forward and close this editor (through its close guard). */
export function leaveToHistory() {
  void invoke('show_main', { page: 'history' }).then(() =>
    getCurrentWindow().close(),
  );
  return true;
}

/** Asks before closing a window with unsaved work; returns a cleanup function. */
export function guardClose(
  isDirty: () => boolean,
  ask: () => Promise<boolean>,
) {
  const win = getCurrentWindow();
  const off = win.onCloseRequested(async (e) => {
    if (!isDirty()) return;
    e.preventDefault();
    if (await ask()) await win.destroy();
  });
  return () => void off.then((unlisten) => unlisten());
}
