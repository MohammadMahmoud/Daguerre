import { emit } from '@tauri-apps/api/event';
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  copyPng,
  copyText,
  downloadBlob,
  guardClose,
  leaveToHistory,
  printPage,
} from '../../../src/platform/Desktop';

let calls: { cmd: string; payload: unknown }[];
let saved: boolean;

beforeEach(() => {
  calls = [];
  saved = true;
  mockWindows('editor-1');
  mockIPC(
    (cmd, payload) => {
      calls.push({ cmd, payload });
      if (cmd === 'save_file') return saved;
    },
    { shouldMockEvents: true },
  );
});
afterEach(() => clearMocks());

const cmds = () => calls.map((c) => c.cmd);

test('copies PNG bytes and text through Rust', async () => {
  await copyPng(Promise.resolve(new Blob(['png'])));
  await copyText(Promise.resolve('hello'));
  expect(calls[0].cmd).toBe('copy_png');
  expect(new TextDecoder().decode(calls[0].payload as Uint8Array)).toBe('png');
  expect(calls[1]).toEqual({ cmd: 'copy_text', payload: { text: 'hello' } });
});

test('saves through the native dialog with an ASCII file name header', async () => {
  const invoke = vi.spyOn((window as any).__TAURI_INTERNALS__, 'invoke');
  expect(await downloadBlob(new Blob(['x']), 'Daguerre café.png')).toBe(true);
  expect(invoke).toHaveBeenCalledWith('save_file', expect.any(Uint8Array), {
    headers: { 'x-file-name': 'Daguerre caf_.png' },
  });
  saved = false;
  expect(await downloadBlob(new Blob(['x']), 'a.png')).toBe(false);
});

test('prints with the native webview', async () => {
  await printPage();
  expect(calls).toEqual([{ cmd: 'print', payload: {} }]);
});

test('going back to History shows the main window, then closes the editor', async () => {
  expect(leaveToHistory()).toBe(true);
  await waitFor(() => expect(cmds()).toContain('plugin:window|close'));
  expect(calls[0]).toEqual({
    cmd: 'show_main',
    payload: { page: 'history' },
  });
});

test('closing asks first only when there are unsaved changes', async () => {
  let dirty = false;
  let answer = false;
  const ask = vi.fn(async () => answer);
  const stop = guardClose(() => dirty, ask);
  // Let the listener register.
  await new Promise((r) => setTimeout(r));
  const destroyed = () =>
    cmds().filter((c) => c === 'plugin:window|destroy').length;

  await emit('tauri://close-requested');
  await waitFor(() => expect(destroyed()).toBe(1));
  expect(ask).not.toHaveBeenCalled();

  dirty = true;
  await emit('tauri://close-requested');
  await waitFor(() => expect(ask).toHaveBeenCalledOnce());
  expect(destroyed()).toBe(1);

  answer = true;
  await emit('tauri://close-requested');
  await waitFor(() => expect(destroyed()).toBe(2));
  stop();
});
