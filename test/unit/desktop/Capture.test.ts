import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { runCapture } from '../../../src/desktop/Capture';
import * as captureSound from '../../../src/lib/CaptureSound';
import { clearShots, getShot, listShots } from '../../../src/lib/Db';

let calls: { cmd: string; payload: any }[];
let visible: boolean;
let picked: { title: string } | null;
let screenPicked: { title: string } | null;
let soundSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  await clearShots();
  calls = [];
  visible = false;
  picked = { title: 'Notes' };
  screenPicked = { title: 'Built-in Display' };
  soundSpy = vi
    .spyOn(captureSound, 'playCaptureSound')
    .mockResolvedValue(undefined);
  mockWindows('home');
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload });
    if (cmd === 'plugin:window|is_visible') return visible;
    if (cmd === 'capture_screen') return screenPicked;
    if (cmd === 'select') return picked;
    if (cmd === 'take_capture') return new Uint8Array([1, 2, 3]).buffer;
  });
});
afterEach(() => {
  clearMocks();
  vi.useRealTimers();
});

const cmds = () => calls.map((c) => c.cmd);

test('a window pick is saved, plays shutter sound, and opens in the editor', async () => {
  expect(await runCapture('window')).toBe(true);
  expect(soundSpy).toHaveBeenCalledOnce();
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

test('screen captures skip the overlay and play shutter sound', async () => {
  await runCapture('screen');
  expect(soundSpy).toHaveBeenCalledOnce();
  expect(cmds()).toContain('capture_screen');
  expect(cmds()).not.toContain('select');
  expect((await listShots())[0]).toMatchObject({ mode: 'screen' });
});

test('copy-selection plays shutter sound, copies, and stays out of the editor', async () => {
  await runCapture('copy-selection');
  expect(soundSpy).toHaveBeenCalledOnce();
  expect(calls.find((c) => c.cmd === 'select')!.payload).toEqual({
    kind: 'region',
  });
  expect(cmds()).toContain('copy_png');
  expect(cmds()).not.toContain('open_editor');
  expect((await listShots())[0]).toMatchObject({ mode: 'selection' });
});

test('a cancelled selection saves nothing and plays no sound', async () => {
  picked = null;
  expect(await runCapture('selection')).toBe(false);
  expect(soundSpy).not.toHaveBeenCalled();
  expect(await listShots()).toEqual([]);
  expect(cmds()).not.toContain('take_capture');
});

test('a cancelled portal screen request saves nothing and plays no sound', async () => {
  screenPicked = null;
  expect(await runCapture('screen')).toBe(false);
  expect(soundSpy).not.toHaveBeenCalled();
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
