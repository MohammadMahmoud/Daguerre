import { emit } from '@tauri-apps/api/event';
import { clearMocks, mockIPC, mockWindows } from '@tauri-apps/api/mocks';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Home } from '../../../src/desktop/Home';
import { addShot, clearShots } from '../../../src/lib/db';
import { imageBlob } from '../../setup';

const runCapture = vi.fn();
vi.mock('../../../src/desktop/Capture', () => ({
  runCapture: (...args: unknown[]) => runCapture(...args),
}));

let calls: { cmd: string; payload: any }[];
let failed: Record<string, string>;
let pending: string | null;
let os: { os: string; wayland: boolean };
let access: boolean;
let autostart: boolean;

beforeEach(async () => {
  await clearShots();
  calls = [];
  failed = {};
  pending = null;
  os = { os: 'windows', wayland: false };
  access = true;
  autostart = false;
  runCapture.mockReset().mockResolvedValue(true);
  mockWindows('home');
  mockIPC(
    (cmd, payload: any) => {
      calls.push({ cmd, payload });
      switch (cmd) {
        case 'set_shortcuts':
          return Object.keys(payload.shortcuts).length ? failed : {};
        case 'take_pending':
          return pending;
        case 'platform':
          return os;
        case 'screen_access':
          return payload.request ? true : access;
        case 'plugin:autostart|is_enabled':
          return autostart;
        case 'plugin:autostart|enable':
          autostart = true;
          return;
        case 'plugin:autostart|disable':
          autostart = false;
          return;
        case 'plugin:app|version':
          return '1.2.3';
      }
    },
    { shouldMockEvents: true },
  );
});
afterEach(async () => {
  cleanup();
  // Unlistening is async and needs the event mocks.
  await new Promise((r) => setTimeout(r));
  clearMocks();
  delete document.documentElement.dataset.platform;
});

const nav = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Sections' })).getByRole(
    'button',
    { name },
  );
const shortcutsSent = () =>
  calls
    .filter((c) => c.cmd === 'set_shortcuts')
    .map((c) => c.payload.shortcuts);
const lastShortcuts = () => shortcutsSent().at(-1);
const cmds = () => calls.map((c) => c.cmd);

async function renderHome() {
  render(<Home />);
  await waitFor(() => expect(cmds()).toContain('platform'));
}

async function openSettings() {
  await renderHome();
  fireEvent.click(nav('Settings'));
  return screen.findByRole('heading', { name: 'Settings', level: 1 });
}

test('registers the default shortcuts and shows them on the capture cards', async () => {
  await renderHome();
  await waitFor(() =>
    expect(lastShortcuts()).toEqual({
      selection: 'Alt+Shift+S',
      window: 'Alt+Shift+W',
      screen: 'Alt+Shift+V',
      'copy-selection': 'Alt+Shift+C',
    }),
  );
  expect(
    screen.getByRole('button', { name: /^Select area/ }).textContent,
  ).toMatch('Alt+Shift+S');
  expect(nav('Capture').getAttribute('aria-current')).toBe('page');
  expect(document.documentElement.dataset.platform).toBe('windows');
});

test('the sidebar and navigate events switch sections', async () => {
  await renderHome();
  fireEvent.click(nav('History'));
  expect(
    await screen.findByRole('heading', { name: 'History', level: 1 }),
  ).toBeTruthy();
  expect(nav('History').getAttribute('aria-current')).toBe('page');
  await act(() => emit('navigate', 'settings'));
  expect(
    await screen.findByRole('heading', { name: 'Settings', level: 1 }),
  ).toBeTruthy();
  await act(() => emit('navigate', 'nowhere'));
  expect(nav('Settings').getAttribute('aria-current')).toBe('page');
});

test('capture cards use the remembered delay; shortcuts and the tray do not', async () => {
  localStorage.setItem('delay', '5');
  pending = 'screen';
  await renderHome();
  await waitFor(() => expect(runCapture).toHaveBeenCalledWith('screen', 0));
  expect(
    screen.getByRole('radio', { name: '5s' }).getAttribute('aria-checked'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('radio', { name: '3s' }));
  expect(localStorage.getItem('delay')).toBe('3');
  // Clicks are ignored until the previous capture has refreshed Recent.
  await waitFor(() => {
    fireEvent.click(screen.getByRole('button', { name: /^Window/ }));
    expect(runCapture).toHaveBeenCalledWith('window', 3);
  });
  await waitFor(() => {
    fireEvent.click(
      screen.getByRole('button', { name: /^Copy selected area/ }),
    );
    expect(runCapture).toHaveBeenCalledWith('copy-selection', 3);
  });
  await waitFor(async () => {
    await act(() => emit('command', 'selection'));
    expect(runCapture).toHaveBeenCalledWith('selection', 0);
  });
});

test('ignores new captures while one is running', async () => {
  let finish = (_: boolean) => {};
  runCapture.mockReturnValue(new Promise((r) => (finish = r)));
  await renderHome();
  fireEvent.click(screen.getByRole('button', { name: /^Screen/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Window/ }));
  expect(runCapture).toHaveBeenCalledOnce();
  await act(async () => finish(false));
});

test('recent captures open in the editor, copy, and refresh after a capture', async () => {
  await renderHome();
  expect(
    await screen.findByText('Your screenshots will appear here.'),
  ).toBeTruthy();
  runCapture.mockImplementation(async () => {
    await addShot(imageBlob(800, 600), {
      title: 'Notes',
      url: '',
      mode: 'window',
    });
    return true;
  });
  fireEvent.click(screen.getByRole('button', { name: /^Window/ }));
  const open = await screen.findByRole('button', { name: 'Edit Notes' });
  fireEvent.click(open);
  await waitFor(() =>
    expect(calls.find((c) => c.cmd === 'open_editor')?.payload.id).toEqual(
      expect.any(String),
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Copy Notes' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Copied to clipboard'),
  );
  expect(cmds()).toContain('copy_png');
  fireEvent.click(screen.getByRole('button', { name: 'View all 1' }));
  expect(
    await screen.findByRole('heading', { name: 'History', level: 1 }),
  ).toBeTruthy();
});

test('reports a failed copy', async () => {
  await addShot(imageBlob(800, 600), {
    title: 'Notes',
    url: '',
    mode: 'window',
  });
  mockIPC((cmd) => {
    calls.push({ cmd, payload: {} });
    if (cmd === 'copy_png') throw 'Clipboard busy';
    if (cmd === 'platform') return os;
    if (cmd === 'screen_access') return true;
    if (cmd === 'set_shortcuts') return {};
  });
  await renderHome();
  fireEvent.click(await screen.findByRole('button', { name: 'Copy Notes' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      "Couldn't copy: Clipboard busy",
    ),
  );
});

test('History opens screenshots in the editor window', async () => {
  const id = await addShot(imageBlob(800, 600), {
    title: 'Notes',
    url: '',
    mode: 'window',
  });
  await renderHome();
  fireEvent.click(nav('History'));
  fireEvent.click(await screen.findByRole('link', { name: 'Edit Notes' }));
  await waitFor(() =>
    expect(calls).toContainEqual({ cmd: 'open_editor', payload: { id } }),
  );
});

test('shows capture errors in a dismissible banner and brings the window back', async () => {
  runCapture.mockRejectedValue('No display found.');
  await renderHome();
  fireEvent.click(screen.getByRole('button', { name: /^Screen/ }));
  const banner = await screen.findByRole('alert');
  expect(banner.textContent).toBe('No display found.');
  expect(calls).toContainEqual({
    cmd: 'show_main',
    payload: { page: 'capture' },
  });
  fireEvent.click(within(banner).getByRole('button', { name: 'Dismiss' }));
  expect(screen.queryByRole('alert')).toBeNull();
});

test('shows storage used in the sidebar', async () => {
  await renderHome();
  expect(await screen.findByText('2 KB used')).toBeTruthy();
});

test('records a shortcut with global shortcuts paused, then registers it', async () => {
  await openSettings();
  const input = screen.getByLabelText('Window') as HTMLInputElement;
  fireEvent.focus(input);
  await waitFor(() => expect(lastShortcuts()).toEqual({}));
  fireEvent.keyDown(input, { key: 'Shift', code: 'ShiftLeft', shiftKey: true });
  fireEvent.keyDown(input, { key: 'x', code: 'KeyX' });
  expect(input.value).toBe('Alt+Shift+W');
  fireEvent.keyDown(input, {
    key: '1',
    code: 'Digit1',
    ctrlKey: true,
    shiftKey: true,
  });
  expect(input.value).toBe('Control+Shift+1');
  // Still paused while recording.
  expect(lastShortcuts()).toEqual({});
  fireEvent.keyDown(input, { key: 'Tab', code: 'Tab' });
  fireEvent.blur(input);
  await waitFor(() => expect(lastShortcuts().window).toBe('Control+Shift+1'));
  expect(JSON.parse(localStorage.getItem('shortcuts')!).window).toBe(
    'Control+Shift+1',
  );
});

test('clears shortcuts, reports conflicts and restores defaults', async () => {
  await openSettings();
  const restore = screen.getByRole('button', { name: 'Restore defaults' });
  expect((restore as HTMLButtonElement).disabled).toBe(true);

  fireEvent.click(
    screen.getByRole('button', { name: 'Remove the Screen shortcut' }),
  );
  await waitFor(() => expect(lastShortcuts().screen).toBe(''));
  expect((screen.getByLabelText('Screen') as HTMLInputElement).value).toBe('');

  const input = screen.getByLabelText('Select area');
  fireEvent.keyDown(input, { key: 'Backspace', code: 'Backspace' });
  await waitFor(() => expect(lastShortcuts().selection).toBe(''));

  failed = { window: 'HotKey already registered' };
  fireEvent.click(restore);
  await waitFor(() => expect(lastShortcuts().selection).toBe('Alt+Shift+S'));
  expect((await screen.findByRole('alert')).textContent).toMatch(
    /Another app may be using it/,
  );
  expect(screen.getByLabelText('Window').getAttribute('aria-invalid')).toBe(
    'true',
  );
});

test('Escape stops recording without changing the shortcut', async () => {
  await openSettings();
  const input = screen.getByLabelText('Window');
  input.focus();
  fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
  expect(document.activeElement).not.toBe(input);
  expect(JSON.parse(localStorage.getItem('shortcuts') ?? '{}')).toEqual({});
});

test('toggles launch at login and shows the version', async () => {
  await openSettings();
  expect(await screen.findByText('Daguerre 1.2.3')).toBeTruthy();
  const toggle = screen.getByRole('switch', { name: 'Open at login' });
  fireEvent.click(toggle);
  await waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(true));
  fireEvent.click(toggle);
  await waitFor(() => expect((toggle as HTMLInputElement).checked).toBe(false));
  expect(screen.queryByRole('heading', { name: 'Permissions' })).toBeNull();
});

test('on macOS, uses key symbols and asks for Screen Recording access', async () => {
  os = { os: 'macos', wayland: false };
  access = false;
  await renderHome();
  const banner = await screen.findByText(/needs Screen Recording access/);
  expect(
    screen.getByRole('button', { name: /^Select area/ }).textContent,
  ).toMatch('⌥⇧S');
  fireEvent.click(nav('Settings'));
  expect(
    await screen.findByRole('heading', { name: 'Permissions' }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      'Shortcuts work in any app while Daguerre runs in the menu bar.',
    ),
  ).toBeTruthy();
  fireEvent.click(
    within(banner.closest('.banner') as HTMLElement).getByRole('button', {
      name: 'Allow',
    }),
  );
  await waitFor(() => expect(screen.getByText('Allowed')).toBeTruthy());
  expect(screen.queryByText(/needs Screen Recording access/)).toBeNull();
});

test('explains shortcuts on Wayland', async () => {
  os = { os: 'linux', wayland: true };
  await openSettings();
  expect(await screen.findByText(/On Wayland/)).toBeTruthy();
});

test('switches between the white and app tray icons and remembers the choice', async () => {
  os = { os: 'macos', wayland: false };
  await openSettings();
  const group = screen.getByRole('radiogroup', { name: 'Menu bar icon' });
  const white = within(group).getByRole('radio', { name: 'White' });
  const appIcon = within(group).getByRole('radio', { name: 'App icon' });
  expect(white.getAttribute('aria-checked')).toBe('true');
  expect(calls).toContainEqual({
    cmd: 'set_tray_icon',
    payload: { icon: 'white' },
  });

  fireEvent.click(appIcon);
  expect(appIcon.getAttribute('aria-checked')).toBe('true');
  expect(localStorage.getItem('trayIcon')).toBe('app');
  expect(calls).toContainEqual({
    cmd: 'set_tray_icon',
    payload: { icon: 'app' },
  });

  cleanup();
  calls = [];
  await renderHome();
  expect(calls).toContainEqual({
    cmd: 'set_tray_icon',
    payload: { icon: 'app' },
  });
});
