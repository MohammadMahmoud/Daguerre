import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { addShot, clearShots } from '../../src/lib/db';
import { Popup } from '../../src/popup';
import type { ChromeMock } from '../chrome';
import { imageBlob } from '../setup';

let chrome: ChromeMock;
let close: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  chrome = (globalThis as any).chrome;
  await clearShots();
  close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
  chrome.tabs.query.mockResolvedValue([{ id: 5 } as chrome.tabs.Tab]);
});

const tile = (name: RegExp) => screen.getByRole('button', { name });
const session = () => chrome.storage.session;

test('copies a selected area with a dedicated button instead of a toggle', async () => {
  render(<Popup />);
  expect(
    screen.queryByRole('switch', { name: 'Copy after capture' }),
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Copy selected area/ }));
  await waitFor(() =>
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: 'copy-selection',
      tabId: 5,
    }),
  );
  expect(close).toHaveBeenCalled();
});

test('shows the copy shortcut and explains that the selection stays in History', async () => {
  render(<Popup />);
  expect(await screen.findByText('⌥⇧C')).toBeTruthy();
  expect(
    screen.getByText(/Copies your selection without opening/).textContent,
  ).toMatch(/History/);
});

test('only a trusted prepare-copy message closes the popup', async () => {
  render(<Popup />);
  expect(screen.queryByRole('switch')).toBeNull();
  act(() => {
    chrome.runtime.onMessage.emit(
      { type: 'prepare-copy', target: 'popup' },
      { id: 'foreign' },
    );
    chrome.runtime.onMessage.emit(
      { type: 'other', target: 'popup' },
      { id: chrome.runtime.id },
    );
  });
  expect(close).not.toHaveBeenCalled();
  act(() => {
    chrome.runtime.onMessage.emit(
      { type: 'prepare-copy', target: 'popup' },
      { id: chrome.runtime.id },
    );
  });
  expect(close).toHaveBeenCalledOnce();
});

test('shows the capture modes with real shortcuts, falling back to hints', async () => {
  render(<Popup />);
  expect(await screen.findByText('⌥⇧V')).toBeTruthy();
  expect(tile(/Entire page/).textContent).toContain('Scrolls and stitches');
  expect(tile(/All tabs/).textContent).toContain('Asks for access once');
  expect(screen.queryByLabelText('Recent screenshots')).toBeNull();
});

test('quick captures send the active tab and close the popup', async () => {
  render(<Popup />);
  fireEvent.click(tile(/Visible area/));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'capture',
    mode: 'visible',
    tabId: 5,
    delay: 0,
  });
});

test('remembers the delay, and delayed full-page captures close the popup', async () => {
  await chrome.storage.local.set({ delay: 5 });
  render(<Popup />);
  await waitFor(() =>
    expect(
      screen.getByRole('radio', { name: '5s' }).getAttribute('aria-checked'),
    ).toBe('true'),
  );
  fireEvent.click(screen.getByRole('radio', { name: '3s' }));
  expect(chrome.storage.local.data.delay).toBe(3);
  fireEvent.click(tile(/Entire page/));
  await waitFor(() => expect(close).toHaveBeenCalled());
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'full', delay: 3 }),
  );
});

test('full-page capture turns the popup into a progress dialog with cancel', async () => {
  render(<Popup />);
  fireEvent.click(tile(/Entire page/));
  expect(await screen.findByText('Capturing entire page')).toBeTruthy();
  expect(screen.getByText('Starting…')).toBeTruthy();

  await act(() =>
    session().set({
      progress: {
        mode: 'full',
        value: 0.5,
        detail: 'Capturing section 1 of 2',
      },
    }),
  );
  expect(screen.getByText('50%')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    '50',
  );
  await act(() => chrome.storage.local.set({ unrelated: 1 }));
  await act(() => session().set({ other: 1 }));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
    type: 'cancel',
  });
  await act(() => session().remove('progress'));
  expect(close).toHaveBeenCalled();
});

test.each([
  ['tabs', 'Capturing all tabs', /switches through your tabs/],
  ['selection', 'Capturing selected area', /scrolls on its own/],
])('labels %s progress', async (mode, title, foot) => {
  await session().set({ progress: { mode, value: 0, detail: 'x' } });
  render(<Popup />);
  expect(await screen.findByText(title)).toBeTruthy();
  expect(screen.getByText(foot)).toBeTruthy();
});

test('All tabs asks for site access first', async () => {
  render(<Popup />);
  fireEvent.click(tile(/All tabs/));
  expect(chrome.permissions.request).toHaveBeenCalledWith({
    origins: ['<all_urls>'],
  });
  expect(await screen.findByText('Capturing all tabs')).toBeTruthy();
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'tabs' }),
  );
  expect(session().data.pendingAllTabs).toBeUndefined();
});

test('explains when site access is declined', async () => {
  chrome.permissions.request.mockResolvedValue(false);
  render(<Popup />);
  fireEvent.click(tile(/All tabs/));
  expect((await screen.findByRole('alert')).textContent).toMatch(
    /needs access to all sites/,
  );
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
});

test('shows a stored error once and clears the badge', async () => {
  await session().set({ lastError: 'Chrome does not allow this' });
  render(<Popup />);
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Chrome does not allow this',
  );
  await waitFor(() => expect(session().data.lastError).toBeUndefined());
  expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
});

test('an error during capture replaces the dialog and keeps the popup open', async () => {
  render(<Popup />);
  fireEvent.click(tile(/Entire page/));
  await screen.findByText('Capturing entire page');
  await act(() => session().set({ lastError: 'Page closed' }));
  expect(screen.getByRole('alert').textContent).toBe('Page closed');
  await act(async () => {
    await session().set({
      progress: { mode: 'full', value: 0.1, detail: 'x' },
    });
    await session().remove('progress');
  });
  expect(close).not.toHaveBeenCalled();
});

test('does nothing without an active tab', async () => {
  chrome.tabs.query.mockResolvedValue([]);
  render(<Popup />);
  fireEvent.click(tile(/Select area/));
  await waitFor(() => expect(chrome.tabs.query).toHaveBeenCalled());
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
});

test('lists recent screenshots and opens pages', async () => {
  for (const title of ['One', 'Two', 'Three', 'Four']) {
    await addShot(imageBlob(10, 10), { title, url: '', mode: 'visible' });
  }
  render(<Popup />);
  expect(await screen.findByText('View all 4')).toBeTruthy();
  expect(screen.getAllByRole('img')).toHaveLength(3);
  fireEvent.click(screen.getAllByRole('img')[0].closest('button')!);
  expect(chrome.tabs.create).toHaveBeenLastCalledWith({
    url: expect.stringMatching(/^editor\.html\?id=/),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Open history' }));
  expect(chrome.tabs.create).toHaveBeenLastCalledWith({ url: 'history.html' });
  fireEvent.click(screen.getByText('View all 4'));
  fireEvent.click(screen.getByRole('button', { name: 'Shortcuts' }));
  expect(chrome.tabs.create).toHaveBeenLastCalledWith({
    url: 'chrome://extensions/shortcuts',
  });
  expect(close).toHaveBeenCalledTimes(4);
});
