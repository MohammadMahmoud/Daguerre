import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { runCapture } from '../../../src/desktop/Capture';
import { clearShots, getShot, listShots } from '../../../src/lib/db';

let calls: { cmd: string; payload: any }[];
let visible: boolean;
let picked: { title: string } | null;

beforeEach(async () => {
  await clearShots();
  calls = [];
  visible = false;
  picked = { title: 'Notes' };
  mockWindows('home');
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload });
    if (cmd === 'plugin:window|is_visible') return visible;
    if (cmd === 'capture_screen') return { title: 'Built-in Display' };
    if (cmd === 'select') return picked;
    if (cmd === 'take_capture') return new Uint8Array([1, 2, 3]).buffer;
  });
});
afterEach(() => {
  clearMocks();
  vi.useRealTimers();
});

const cmds = () => calls.map((c) => c.cmd);

test('a window pick is saved and opened in the editor', async () => {
  expect(await runCapture('window')).toBe(true);
  const [shot] = await listShots();
  expect(shot).toMatchObject({ title: 'Notes', mode: 'window', url: '' });
  expect(calls.find((c) => c.cmd === 'select')!.payload).toEqual({
    kind: 'window',
  });
  expect(calls.at(-1)).toEqual({
    cmd: 'open_editor',
    payload: { id: shot.id },
  });
  expect(await getShot(shot.id)).toBeTruthy();
});

test('screen captures skip the overlay', async () => {
  await runCapture('screen');
  expect(cmds()).toContain('capture_screen');
  expect(cmds()).not.toContain('select');
  expect((await listShots())[0]).toMatchObject({ mode: 'screen' });
});

test('copy-selection copies and stays out of the editor', async () => {
  await runCapture('copy-selection');
  expect(calls.find((c) => c.cmd === 'select')!.payload).toEqual({
    kind: 'region',
  });
  expect(cmds()).toContain('copy_png');
  expect(cmds()).not.toContain('open_editor');
  expect((await listShots())[0]).toMatchObject({ mode: 'selection' });
});

test('a cancelled selection saves nothing', async () => {
  picked = null;
  expect(await runCapture('selection')).toBe(false);
  expect(await listShots()).toEqual([]);
  expect(cmds()).not.toContain('take_capture');
});

test('hides a visible home window through Rust and waits out the delay first', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  visible = true;
  const done = runCapture('screen', 3);
  await vi.advanceTimersByTimeAsync(2900);
  expect(cmds()).toContain('hide_main');
  expect(cmds()).not.toContain('plugin:window|hide');
  expect(cmds()).not.toContain('capture_screen');
  await vi.advanceTimersByTimeAsync(100);
  vi.useRealTimers();
  await done;
  expect(cmds()).toContain('capture_screen');
});
