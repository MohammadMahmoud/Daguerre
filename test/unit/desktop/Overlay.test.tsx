import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { Overlay } from '../../../src/desktop/Overlay';

let calls: { cmd: string; payload: any }[];
let fail: boolean;

beforeEach(() => {
  calls = [];
  fail = false;
  mockWindows('overlay-0');
  // jsdom's window is 1024 CSS px wide; the monitor is 2048 units wide.
  mockIPC((cmd, payload) => {
    calls.push({ cmd, payload });
    if (cmd === 'overlay_frame') {
      if (fail) throw new Error('No selection in progress.');
      return new Uint8Array([1]).buffer;
    }
    if (cmd === 'overlay_info')
      return {
        width: 2048,
        height: 1536,
        windows: [
          { id: 7, title: 'Notes', rect: { x: 200, y: 200, w: 400, h: 300 } },
        ],
      };
  });
});
afterEach(() => {
  clearMocks();
  history.replaceState(null, '', '/');
});

const finished = () =>
  calls.filter((c) => c.cmd === 'finish_selection').map((c) => c.payload);

async function open(kind: 'region' | 'window') {
  history.replaceState(null, '', `/overlay.html?kind=${kind}`);
  const { container } = render(<Overlay />);
  await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
  fireEvent.load(container.querySelector('img')!);
  await waitFor(() =>
    expect(calls.map((c) => c.cmd)).toContain('plugin:window|show'),
  );
  return container.querySelector('.overlay')!;
}

test('drag selects a region in monitor units', async () => {
  const overlay = await open('region');
  fireEvent.pointerDown(overlay, { clientX: 10, clientY: 20 });
  fireEvent.pointerMove(overlay, { clientX: 110, clientY: 70 });
  expect(screen.getByText('200 × 100')).toBeTruthy();
  fireEvent.pointerUp(overlay);
  expect(finished()).toEqual([{ rect: { x: 20, y: 40, w: 200, h: 100 } }]);
});

test('a click without a drag selects nothing in region mode', async () => {
  const overlay = await open('region');
  fireEvent.pointerDown(overlay, { clientX: 10, clientY: 20 });
  fireEvent.pointerUp(overlay);
  expect(finished()).toEqual([]);
});

test('window mode highlights and picks the window under the pointer', async () => {
  const overlay = await open('window');
  expect(screen.getByText(/Click a window/)).toBeTruthy();
  fireEvent.pointerMove(overlay, { clientX: 150, clientY: 150 });
  expect(screen.getByText('Notes')).toBeTruthy();
  fireEvent.pointerDown(overlay, { clientX: 150, clientY: 150 });
  fireEvent.pointerUp(overlay);
  expect(finished()).toEqual([{ windowId: 7 }]);
});

test('Escape cancels', async () => {
  await open('region');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(finished()).toEqual([{}]);
});

test('cancels if the frame is gone', async () => {
  fail = true;
  render(<Overlay />);
  await waitFor(() => expect(finished()).toEqual([{}]));
});
