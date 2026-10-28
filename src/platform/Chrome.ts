import type { CaptureMode } from '../lib/db';

export const CAPTURE_MODES: CaptureMode[] = [
  'visible',
  'full',
  'selection',
  'tabs',
];

export const CAPTURE_HINT =
  'Click the Daguerre icon in the toolbar, or use a shortcut.';
export const SHORTCUT_HINTS: [keys: string, label: string][] = [
  ['Alt+Shift+V', 'Visible area'],
  ['Alt+Shift+F', 'Entire page'],
  ['Alt+Shift+S', 'Select area'],
];
/** Shown in History for pages without a host, such as local files. */
export const NO_URL_LABEL = 'Local page';
export const SAVE_PNG_LABEL = 'Download PNG';
export const SAVED_TOAST = 'Download started';
export const SEARCH_PLACEHOLDER = 'Search by title or URL';

/** Return true to handle "back to History" instead of following the link. */
export const leaveToHistory = () => false;

/** Tabs rely on `beforeunload` instead. */
export const guardClose =
  (_isDirty: () => boolean, _ask: () => Promise<boolean>) => () =>
    undefined;

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Accepts a promise so the clipboard write keeps the user gesture while encoding. */
export function copyPng(png: Blob | Promise<Blob>) {
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export function copyText(text: Promise<string>) {
  return navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })),
    }),
  ]);
}

export const printPage = () => window.print();
