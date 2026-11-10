import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Editor } from '../../../src/Editor';
import { addShot, clearShots } from '../../../src/lib/Db';
import { defaultBitmap, imageBlob } from '../../Setup';

// The editor as built for the desktop app: native save dialog, editor windows and a close guard.
const platform = vi.hoisted(() => ({
  saved: true,
  guard: undefined as
    { isDirty: () => boolean; ask: () => Promise<boolean> } | undefined,
  leave: vi.fn(() => true),
}));
vi.mock('@platform', async () => ({
  ...(await vi.importActual<object>('../../../src/platform/Chrome')),
  SAVED_TOAST: 'Saved',
  downloadBlob: async () => platform.saved,
  leaveToHistory: platform.leave,
  guardClose: (isDirty: () => boolean, ask: () => Promise<boolean>) => {
    platform.guard = { isDirty, ask };
    return () => undefined;
  },
}));
vi.mock('../../../src/lib/Ocr', () => ({ recognize: vi.fn() }));

beforeEach(async () => {
  await clearShots();
  platform.saved = true;
  platform.leave.mockClear();
  Object.assign(defaultBitmap, { width: 900, height: 600 });
});
afterEach(() => Object.assign(defaultBitmap, { width: 1024, height: 768 }));

async function open() {
  const id = await addShot(imageBlob(900, 600), {
    title: 'Notes',
    url: '',
    mode: 'window',
  });
  history.replaceState(null, '', `/editor.html?id=${id}`);
  render(<Editor />);
  await screen.findByRole('img', { name: 'Screenshot canvas' });
}

const status = () => screen.getByRole('status').textContent;

function exportAs(name: RegExp) {
  if (!screen.queryByRole('dialog', { name: 'Export' }))
    fireEvent.click(screen.getByRole('button', { name: /Export/ }));
  fireEvent.click(screen.getByRole('button', { name }));
}

test('says Saved after the save dialog, and nothing if it was cancelled', async () => {
  await open();
  exportAs(/^PNG/);
  await waitFor(() => expect(status()).toBe('Saved'));
  platform.saved = false;
  exportAs(/^JPEG/);
  await waitFor(() => expect(status()).toBe(''));
  exportAs(/^PDF/);
  await waitFor(() => expect(status()).toBe(''));
});

test('back goes to History in the main window instead of following the link', async () => {
  await open();
  const back = screen.getByRole('link', { name: 'Back to history' });
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  back.dispatchEvent(click);
  expect(platform.leave).toHaveBeenCalledOnce();
  expect(click.defaultPrevented).toBe(true);
});

test('closing with unsaved edits asks to discard them', async () => {
  await open();
  expect(platform.guard!.isDirty()).toBe(false);
  fireEvent.keyDown(document.body, { key: 'r' });
  const canvas = screen.getByRole('img', { name: 'Screenshot canvas' });
  fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, button: 0 });
  fireEvent.pointerMove(canvas, { clientX: 300, clientY: 250 });
  fireEvent.pointerUp(canvas, { clientX: 300, clientY: 250 });
  expect(platform.guard!.isDirty()).toBe(true);

  let answer = platform.guard!.ask();
  const dialog = await screen.findByRole('alertdialog', {
    name: 'Discard unsaved changes?',
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(await answer).toBe(false);
  expect(screen.queryByRole('alertdialog')).toBeNull();

  answer = platform.guard!.ask();
  fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));
  expect(await answer).toBe(true);
});

test('the not-found page also goes back through the main window', async () => {
  history.replaceState(null, '', '/editor.html?id=missing');
  render(<Editor />);
  fireEvent.click(await screen.findByRole('link', { name: 'Open history' }));
  expect(platform.leave).toHaveBeenCalledOnce();
});

test('toolbar buttons render readable Apple tooltips and suppress native single-letter titles on hover', async () => {
  await open();
  const cropBtn = screen.getByRole('button', { name: 'Crop' });
  expect(cropBtn.title).toBe('C');
  expect(cropBtn.getAttribute('data-tooltip')).toBe('Crop (C)');

  // Mouse enter suppresses native title to prevent single-letter browser tooltips and mounts rich pill
  fireEvent.mouseEnter(cropBtn);
  expect(cropBtn.title).toBe('');
  expect(cropBtn.getAttribute('data-title')).toBe('C');

  fireEvent.mouseEnter(cropBtn.parentElement!);
  const tooltipPill = await screen.findByRole('tooltip');
  expect(tooltipPill.textContent).toBe('Crop (C)');
  expect(tooltipPill.className).toContain('tooltip-pill');

  // Mouse leave restores title for keyboard / DOM accessibility
  fireEvent.mouseLeave(cropBtn.parentElement!);
  fireEvent.mouseLeave(cropBtn);
  expect(cropBtn.title).toBe('C');
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
});

test('export dropdown menu is portaled to body with top stacking context to escape toolbar clipping', async () => {
  await open();
  const exportBtn = screen.getByRole('button', { name: /Export/ });
  fireEvent.click(exportBtn);

  const menu = screen.getByRole('dialog', { name: 'Export' });
  expect(menu.parentElement).toBe(document.body);
  expect(menu.style.zIndex).toBe('1000');
  expect(menu.style.pointerEvents).toBe('auto');

  // Clicking inside portaled menu keeps it open
  fireEvent.pointerDown(menu);
  expect(screen.queryByRole('dialog', { name: 'Export' })).toBeTruthy();

  // Outside click closes it
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('dialog', { name: 'Export' })).toBeNull();
});

test('canvas stage workspace has dynamic OS dark attribute and solid background tokens in Styles.css', async () => {
  await open();
  const stage = document.querySelector('.stage');
  expect(stage).toBeTruthy();
  expect(stage?.hasAttribute('data-os-dark')).toBe(true);

  const { readFileSync } = await import('node:fs');
  const css = readFileSync('src/Styles.css', 'utf8');
  expect(css).toContain('--canvas-bg-dark: #161618');
  expect(css).toContain('--canvas-bg-light: #f0f0f3');
  expect(css).toMatch(
    /:root\[data-appearance='glass'\] \.stage[^}]*background-color:\s*var\(--canvas-bg-dark\)\s*!important/,
  );
});
