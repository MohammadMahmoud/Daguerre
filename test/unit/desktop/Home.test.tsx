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
import * as updater from '../../../src/desktop/Updater';
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
let latest: string | null;
let effectsFail: boolean;
let liquid: boolean;
let savedBlend: number | null;

beforeEach(async () => {
  await clearShots();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  calls = [];
  failed = {};
  pending = null;
  os = { os: 'windows', wayland: false };
  access = true;
  autostart = false;
  latest = null;
  effectsFail = false;
  liquid = false;
  savedBlend = null;
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
        case 'theme_blend':
          return savedBlend;
        case 'set_theme_blend':
          savedBlend = payload.value;
          return;
        case 'set_liquid_glass':
          return liquid;
        case 'plugin:window|set_effects':
          if (effectsFail) throw 'Native effects unavailable';
          return;
        case 'plugin:updater|check':
          if (latest === 'unsigned')
            throw 'Could not fetch a valid release JSON from the remote';
          if (latest === 'offline') throw 'error sending request';
          return (
            latest && {
              rid: 1,
              currentVersion: '1.2.3',
              version: latest,
              rawJson: {},
            }
          );
        case 'plugin:updater|download_and_install':
          if (latest === 'broken') throw 'bad signature';
          payload.onEvent.onmessage({
            event: 'Started',
            data: { contentLength: 4 },
          });
          payload.onEvent.onmessage({
            event: 'Progress',
            data: { chunkLength: 1 },
          });
          return;
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
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.platform;
  document.documentElement.style.removeProperty('--theme-blend');
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
const rootBlend = () =>
  document.documentElement.style.getPropertyValue('--theme-blend');

async function renderHome() {
  render(<Home />);
  await waitFor(() => expect(cmds()).toContain('platform'));
}

async function openSettings() {
  await renderHome();
  fireEvent.click(nav('Settings'));
  return screen.findByRole('heading', { name: 'Settings', level: 1 });
}

test('the appearance slider switches designs and remembers the selection', async () => {
  await openSettings();
  const slider = screen.getByRole('slider', { name: 'Window design' });
  const app = screen.getByRole('navigation', {
    name: 'Sections',
  }).parentElement!;
  expect(app.getAttribute('data-appearance')).toBe('current');
  expect(slider.getAttribute('min')).toBe('0');
  expect(slider.getAttribute('max')).toBe('100');
  expect(slider.getAttribute('step')).toBe('1');
  expect(slider.getAttribute('aria-valuetext')).toBe('0% Liquid Glass');
  fireEvent.change(slider, { target: { value: '35' } });
  expect(rootBlend()).toBe('0.35');
  expect(slider.getAttribute('aria-valuetext')).toBe('35% Liquid Glass');
  expect(localStorage.getItem('themeBlend')).toBe('35');
  expect(savedBlend).toBe(35);
  fireEvent.change(slider, { target: { value: '100' } });
  expect(app.getAttribute('data-appearance')).toBe('glass');
  expect(slider.getAttribute('aria-valuetext')).toBe('100% Liquid Glass');
  expect(localStorage.getItem('appearance')).toBe('glass');
  fireEvent.click(nav('Capture'));
  expect(app.getAttribute('data-appearance')).toBe('glass');
  fireEvent.click(nav('Settings'));
  fireEvent.change(screen.getByRole('slider', { name: 'Window design' }), {
    target: { value: '0' },
  });
  expect(app.getAttribute('data-appearance')).toBe('current');
  expect(rootBlend()).toBe('0');
  expect(localStorage.getItem('themeBlend')).toBe('0');
  expect(localStorage.getItem('appearance')).toBe('current');
  expect(savedBlend).toBe(0);
});

test('applies the saved strength to the document during the first render', () => {
  localStorage.setItem('themeBlend', '100');
  render(<Home />);
  expect(rootBlend()).toBe('1');
  expect(
    screen
      .getByRole('navigation', { name: 'Sections' })
      .parentElement!.getAttribute('data-appearance'),
  ).toBe('glass');
});

test('a fresh install starts at 0% and saves it durably', async () => {
  render(<Home />);
  expect(rootBlend()).toBe('0');
  await waitFor(() => expect(savedBlend).toBe(0));
});

test('the durable saved strength wins over a stale local copy at launch', async () => {
  localStorage.setItem('themeBlend', '50');
  savedBlend = 100;
  await openSettings();
  await waitFor(() =>
    expect(
      (
        screen.getByRole('slider', {
          name: 'Window design',
        }) as HTMLInputElement
      ).value,
    ).toBe('100'),
  );
  expect(rootBlend()).toBe('1');
  expect(localStorage.getItem('themeBlend')).toBe('100');
  expect(cmds()).not.toContain('set_theme_blend');
});

test.each(['glass', 'unknown'])(
  'restores a saved appearance safely: %s',
  async (saved) => {
    localStorage.setItem('appearance', saved);
    await openSettings();
    const slider = screen.getByRole('slider', { name: 'Window design' });
    expect((slider as HTMLInputElement).value).toBe(
      saved === 'glass' ? '100' : '0',
    );
    expect(slider.getAttribute('aria-valuetext')).toBe(
      saved === 'glass' ? '100% Liquid Glass' : '0% Liquid Glass',
    );
  },
);

test.each([
  ['0', '0'],
  ['25', '25'],
  ['50', '50'],
  ['75', '75'],
  ['100', '100'],
  ['125', '100'],
  ['-20', '0'],
  ['broken', '0'],
])('restores and clamps the saved blend %s', async (saved, expected) => {
  localStorage.setItem('themeBlend', saved);
  await openSettings();
  const slider = screen.getByRole('slider', { name: 'Window design' });
  expect((slider as HTMLInputElement).value).toBe(expected);
  expect(rootBlend()).toBe(String(Number(expected) / 100));
});

test('changing glass strength does not reapply native effects or replace the layout', async () => {
  const renderUpdater = vi.spyOn(updater, 'useUpdater');
  os.os = 'macos';
  localStorage.setItem('themeBlend', '25');
  await openSettings();
  await waitFor(() => expect(cmds()).toContain('plugin:window|set_effects'));
  const count = calls.filter(
    (call) => call.cmd === 'plugin:window|set_effects',
  ).length;
  const renderCount = renderUpdater.mock.calls.length;
  const slider = screen.getByRole('slider', { name: 'Window design' });
  for (const value of ['26', '50', '75', '100']) {
    fireEvent.change(slider, { target: { value } });
    expect(screen.getByRole('slider', { name: 'Window design' })).toBe(slider);
  }
  expect(
    calls.filter((call) => call.cmd === 'plugin:window|set_effects'),
  ).toHaveLength(count);
  expect(renderUpdater).toHaveBeenCalledTimes(renderCount);
  fireEvent.click(nav('Capture'));
  fireEvent.click(nav('Settings'));
  expect(
    (screen.getByRole('slider', { name: 'Window design' }) as HTMLInputElement)
      .value,
  ).toBe('100');
});

test('uses native Liquid Glass when available, blurred at every strength', async () => {
  os.os = 'macos';
  liquid = true;
  localStorage.setItem('themeBlend', '25');
  await openSettings();
  const app = screen.getByRole('navigation', {
    name: 'Sections',
  }).parentElement!;
  await waitFor(() =>
    expect(app.getAttribute('data-native-glass')).toBe('true'),
  );
  expect(cmds()).not.toContain('plugin:window|set_effects');
  const glass = () =>
    calls
      .filter((call) => call.cmd === 'set_liquid_glass')
      .map((call) => call.payload.on);
  expect(glass()).toEqual([true]);
  const slider = screen.getByRole('slider', { name: 'Window design' });
  for (const value of ['40', '50', '100', '30'])
    fireEvent.change(slider, { target: { value } });
  expect(glass()).toEqual([true]);
  fireEvent.change(slider, { target: { value: '0' } });
  await waitFor(() => expect(glass()).toEqual([true, false]));
});

test('macOS uses native glass and returns to an opaque current design', async () => {
  os.os = 'macos';
  localStorage.setItem('appearance', 'glass');
  await openSettings();
  const app = screen.getByRole('navigation', {
    name: 'Sections',
  }).parentElement!;
  await waitFor(() =>
    expect(app.getAttribute('data-native-glass')).toBe('true'),
  );
  expect(
    calls.find((call) => call.cmd === 'plugin:window|set_effects')?.payload,
  ).toEqual({
    label: 'home',
    value: {
      effects: ['underWindowBackground'],
      state: 'active',
    },
  });
  fireEvent.change(screen.getByRole('slider', { name: 'Window design' }), {
    target: { value: '0' },
  });
  await waitFor(() =>
    expect(app.getAttribute('data-native-glass')).toBe('false'),
  );
  await waitFor(() =>
    expect(
      calls.filter((call) => call.cmd === 'plugin:window|set_effects').at(-1)
        ?.payload.value,
    ).toBeNull(),
  );
});

test('keeps the window opaque when reduced transparency is requested', async () => {
  os.os = 'macos';
  localStorage.setItem('appearance', 'glass');
  const preference = window.matchMedia('');
  Object.defineProperty(preference, 'matches', { value: true });
  vi.mocked(window.matchMedia).mockReturnValue(preference);
  await openSettings();
  await waitFor(() => expect(cmds()).toContain('plugin:window|set_effects'));
  expect(
    screen
      .getByRole('navigation', { name: 'Sections' })
      .parentElement!.getAttribute('data-native-glass'),
  ).toBe('false');
  expect(
    calls.find((call) => call.cmd === 'plugin:window|set_effects')?.payload
      .value,
  ).toBeNull();
});

test('keeps the in-app glass fallback if native effects are unavailable', async () => {
  os.os = 'macos';
  effectsFail = true;
  localStorage.setItem('appearance', 'glass');
  await openSettings();
  await waitFor(() => expect(cmds()).toContain('plugin:window|set_effects'));
  const app = screen.getByRole('navigation', {
    name: 'Sections',
  }).parentElement!;
  expect(app.getAttribute('data-appearance')).toBe('glass');
  expect(app.getAttribute('data-native-glass')).toBe('false');
});

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

test('shows storage used and the app version in the sidebar', async () => {
  await renderHome();
  expect(await screen.findByText('2 KB used')).toBeTruthy();
  expect(await screen.findByText('v1.2.3')).toBeTruthy();
});

test('labels the mono tray icon White outside macOS', async () => {
  await openSettings();
  const group = screen.getByRole('radiogroup', { name: 'System tray icon' });
  expect(within(group).getByRole('radio', { name: 'White' })).toBeTruthy();
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
    /HotKey already registered/,
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

const updateStatus = () =>
  within(screen.getByRole('region', { name: 'Updates' })).getByRole('status');

test('checks for updates on request, installs one and restarts', async () => {
  await openSettings();
  expect(cmds()).not.toContain('plugin:updater|check');
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
  await waitFor(() =>
    expect(updateStatus().textContent).toBe("You're up to date."),
  );
  latest = '1.3.0';
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Install 1.3.0' }));
  await waitFor(() =>
    expect(updateStatus().textContent).toBe(
      'Daguerre 1.3.0 is installed. Restart to use it.',
    ),
  );
  // The banner and the Settings row both offer the restart.
  fireEvent.click(screen.getAllByRole('button', { name: 'Restart' })[0]);
  await waitFor(() => expect(cmds()).toContain('plugin:process|restart'));
});

test('explains a release without an updater manifest, but reports other errors', async () => {
  latest = 'unsigned';
  await openSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
  await waitFor(() =>
    expect(updateStatus().textContent).toBe(
      'No installable update is published on GitHub yet.',
    ),
  );
  latest = 'offline';
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
  await waitFor(() =>
    expect(updateStatus().textContent).toBe(
      "Couldn't update: error sending request",
    ),
  );
});

test('reports a failed update', async () => {
  latest = 'broken';
  await openSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Check now' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Install broken' }),
  );
  await waitFor(() =>
    expect(updateStatus().textContent).toBe("Couldn't update: bad signature"),
  );
});

test('automatic updates install at launch and once a day', async () => {
  localStorage.setItem('autoUpdate', 'true');
  const intervals = vi.spyOn(globalThis, 'setInterval');
  const clock = vi.spyOn(Date, 'now');
  try {
    await openSettings();
    await waitFor(() =>
      expect(updateStatus().textContent).toBe("You're up to date."),
    );
    const hourly = intervals.mock.calls.find(
      ([, ms]) => ms === 60 * 60 * 1000,
    )![0] as () => void;
    const checks = () =>
      cmds().filter((c) => c === 'plugin:updater|check').length;
    const hoursLater = (hours: number) => {
      clock.mockReturnValue(
        Number(localStorage.getItem('lastUpdateCheck')) +
          hours * 60 * 60 * 1000,
      );
      act(hourly);
    };
    expect(checks()).toBe(1);
    latest = '1.3.0';
    hoursLater(23);
    expect(checks()).toBe(1);
    hoursLater(24);
    await waitFor(() =>
      expect(
        screen.getAllByText('Daguerre 1.3.0 is installed. Restart to use it.'),
      ).toHaveLength(2),
    );
    // Installed updates wait for the restart instead of downloading again.
    hoursLater(24);
    expect(checks()).toBe(2);
    const toggle = screen.getByRole('switch', { name: 'Update automatically' });
    fireEvent.click(toggle);
    expect(localStorage.getItem('autoUpdate')).toBe('false');
  } finally {
    intervals.mockRestore();
    clock.mockRestore();
  }
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
  expect(shortcutsSent()).toEqual([]);
  expect((screen.getByLabelText('Screen') as HTMLInputElement).disabled).toBe(
    true,
  );
  expect((screen.getByLabelText('Screen') as HTMLInputElement).value).toBe('');
  expect(screen.getAllByPlaceholderText('Desktop settings')).toHaveLength(4);
  expect(screen.queryByRole('alert')).toBeNull();
});

test('does not offer the custom window picker or app shortcuts on Wayland', async () => {
  os = { os: 'linux', wayland: true };
  await renderHome();
  await waitFor(() =>
    expect(document.documentElement.dataset.platform).toBe('linux'),
  );
  const windowCapture = screen.getByRole('button', { name: /^Window/ });
  expect((windowCapture as HTMLButtonElement).disabled).toBe(true);
  expect(windowCapture.textContent).toContain(
    'Not available in Wayland sessions.',
  );
  fireEvent.click(windowCapture);
  expect(runCapture).not.toHaveBeenCalled();
  expect(screen.queryByText('Alt+Shift+S')).toBeNull();
});

test('accepts another command after a failed capture', async () => {
  runCapture.mockRejectedValueOnce('Screenshot permission denied.');
  await renderHome();
  fireEvent.click(screen.getByRole('button', { name: /^Screen/ }));
  await screen.findByRole('alert');
  await act(() => emit('command', 'selection'));
  expect(runCapture).toHaveBeenCalledTimes(2);
});

test('switches between the adaptive and app tray icons and remembers the choice', async () => {
  os = { os: 'macos', wayland: false };
  await openSettings();
  const group = screen.getByRole('radiogroup', { name: 'Menu bar icon' });
  const white = within(group).getByRole('radio', { name: 'Adaptive' });
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
