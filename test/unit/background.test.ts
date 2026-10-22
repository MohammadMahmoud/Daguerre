import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearShots, listShots } from '../../src/lib/db';
import type { ChromeMock } from '../chrome';
import { imageBlob } from '../setup';

let chrome: ChromeMock;
const page = (over: Partial<chrome.tabs.Tab> = {}) =>
  ({
    id: 7,
    windowId: 1,
    index: 2,
    url: 'https://example.com/a',
    title: 'Example',
    ...over,
  }) as chrome.tabs.Tab;

beforeEach(async () => {
  chrome = (globalThis as any).chrome;
  await clearShots();
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 768,
  });
  vi.resetModules();
  await import('../../src/background');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ blob: async () => imageBlob(1024, 768) })),
  );
  // setImmediate stays real so fake-indexeddb keeps working.
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'Date',
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function send(msg: unknown, sender = { id: 'ext-id' }) {
  return new Promise((resolve) => {
    const [ret] = chrome.runtime.onMessage.emit(msg, sender, resolve);
    if (ret !== true) resolve(ret);
  });
}

const finished = () =>
  chrome.storage.session.remove.mock.calls.some(([k]) => k === 'progress');

async function settle(done: () => boolean = finished) {
  for (let i = 0; i < 600; i++) {
    if (done()) return vi.advanceTimersByTimeAsync(50);
    await vi.advanceTimersByTimeAsync(50);
  }
  throw new Error('capture did not finish');
}

async function shots() {
  vi.useRealTimers();
  return listShots();
}

const lastError = () => chrome.storage.session.data.lastError;
const badgeTexts = () =>
  chrome.action.setBadgeText.mock.calls.map(([d]) => d.text);
const pointer = (
  target: EventTarget,
  type: string,
  clientX: number,
  clientY: number,
) =>
  target.dispatchEvent(
    new PointerEvent(type, { clientX, clientY, bubbles: true }),
  );

test('ordinary captures open the editor even if the removed auto-copy setting is stored', async () => {
  await chrome.storage.local.set({ copyAfterCapture: true });
  chrome.tabs.get.mockResolvedValue(page());
  await send({ type: 'capture', mode: 'visible', tabId: 7 });
  await settle();
  expect(chrome.tabs.create).toHaveBeenCalledWith(
    expect.objectContaining({
      url: expect.stringMatching(/^editor\.html\?id=/),
    }),
  );
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
});

test('the dedicated copy-selection request copies a selection and saves it without an editor', async () => {
  chrome.tabs.get.mockResolvedValue(page());
  chrome.scripting.executeScript.mockResolvedValue([
    {
      result: {
        x: 10,
        y: 20,
        w: 200,
        h: 100,
        scrollX: 0,
        scrollY: 0,
        viewWidth: 1024,
        viewHeight: 768,
      },
    },
  ]);
  chrome.runtime.sendMessage.mockResolvedValue({ ok: true } as never);
  expect(await send({ type: 'copy-selection', tabId: 7 })).toBe(true);
  await settle();
  const saved = await shots();
  expect(saved).toEqual([
    expect.objectContaining({ mode: 'selection', width: 200, height: 100 }),
  ]);
  expect(chrome.tabs.create).not.toHaveBeenCalled();
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'copy-capture',
    target: 'clipboard',
    id: saved[0].id,
  });
});

test('registers the context menu on install', () => {
  chrome.runtime.onInstalled.emit();
  expect(chrome.contextMenus.create).toHaveBeenCalledTimes(4);
  expect(chrome.contextMenus.create).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'full', contexts: ['all'] }),
  );
});

function mockSelectedArea() {
  chrome.scripting.executeScript.mockResolvedValue([
    {
      result: {
        x: 10,
        y: 20,
        w: 200,
        h: 100,
        scrollX: 0,
        scrollY: 0,
        viewWidth: 1024,
        viewHeight: 768,
      },
    },
  ]);
}

test('the copy-selection keyboard command saves to history and copies without an editor tab', async () => {
  mockSelectedArea();
  chrome.tabs.get.mockResolvedValue(page());
  chrome.runtime.sendMessage.mockResolvedValue({ ok: true } as never);
  chrome.commands.onCommand.emit('copy-selection', page());
  await settle();
  const saved = await shots();
  expect(saved).toHaveLength(1);
  expect(chrome.tabs.create).not.toHaveBeenCalled();
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
    type: 'copy-capture',
    target: 'clipboard',
    id: saved[0].id,
  });
  expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(3);
});

test('copy-selection removes the temporary clipboard frame after copying', async () => {
  mockSelectedArea();
  chrome.runtime.sendMessage.mockResolvedValue({ ok: true } as never);
  chrome.tabs.get.mockResolvedValue(page());
  await send({ type: 'copy-selection', tabId: 7 });
  await settle();
  expect(chrome.scripting.executeScript).toHaveBeenLastCalledWith({
    target: { tabId: 7 },
    func: expect.any(Function),
  });
  expect(chrome.tabs.create).not.toHaveBeenCalled();
});

test('a rejected clipboard result reports failure without opening a tab', async () => {
  mockSelectedArea();
  chrome.runtime.sendMessage.mockResolvedValue({ ok: false } as never);
  chrome.tabs.get.mockResolvedValue(page());
  await send({ type: 'copy-selection', tabId: 7 });
  await settle();
  expect(lastError()).toMatch(/saved in History/);
  expect(chrome.tabs.create).not.toHaveBeenCalled();
});

test('clipboard failure keeps the capture in history without opening a tab', async () => {
  mockSelectedArea();
  chrome.tabs.get.mockResolvedValue(page());
  chrome.runtime.sendMessage.mockRejectedValue(new Error('clipboard denied'));
  await send({ type: 'copy-selection', tabId: 7 });
  await settle();
  expect(await shots()).toHaveLength(1);
  expect(chrome.tabs.create).not.toHaveBeenCalled();
  expect(lastError()).toMatch(/saved in History.*clipboard/i);
});

test('cancelling copy-selection leaves clipboard and History unchanged', async () => {
  chrome.tabs.get.mockResolvedValue(page());
  await send({ type: 'copy-selection', tabId: 7 });
  await settle(() => !!document.getElementById('daguerre-select'));
  dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await settle();
  expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  expect(chrome.tabs.create).not.toHaveBeenCalled();
  expect(await shots()).toEqual([]);
});

describe('messages', () => {
  test('ignores foreign senders and malformed requests', async () => {
    expect(
      await send(
        { type: 'capture', mode: 'visible', tabId: 7 },
        { id: 'evil' },
      ),
    ).toBeUndefined();
    expect(
      await send({ type: 'capture', mode: 'nope', tabId: 7 }),
    ).toBeUndefined();
    expect(
      await send({ type: 'capture', mode: 'visible', tabId: 'x' }),
    ).toBeUndefined();
    expect(await send(null)).toBeUndefined();
    expect(await send({ type: 'cancel' })).toBeUndefined();
    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });

  test('answers false when the tab is gone', async () => {
    chrome.tabs.get.mockRejectedValueOnce(new Error('No tab'));
    expect(await send({ type: 'capture', mode: 'visible', tabId: 7 })).toBe(
      false,
    );
  });
});

describe('visible area', () => {
  test('saves the capture and opens the editor next to the tab', async () => {
    chrome.tabs.get.mockResolvedValue(page());
    expect(
      await send({ type: 'capture', mode: 'visible', tabId: 7, delay: 0 }),
    ).toBe(true);
    await settle();
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledWith(1, {
      format: 'png',
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringMatching(/^editor\.html\?id=/),
        index: 3,
        openerTabId: 7,
      }),
    );
    expect(await shots()).toEqual([
      expect.objectContaining({
        title: 'Example',
        mode: 'visible',
        width: 1024,
        height: 768,
      }),
    ]);
  });

  test('counts down the delay on the badge', async () => {
    chrome.tabs.get.mockResolvedValue(page({ title: '' }));
    await send({ type: 'capture', mode: 'visible', tabId: 7, delay: 2 });
    await settle();
    expect(badgeTexts()).toEqual(expect.arrayContaining(['2', '1']));
    expect((await shots())[0].title).toBe('Untitled');
  });

  test.each([['chrome://settings'], [undefined]])(
    'refuses restricted page %s',
    async (url) => {
      chrome.tabs.get.mockResolvedValue(page({ url }));
      await send({ type: 'capture', mode: 'visible', tabId: 7 });
      await settle();
      expect(lastError()).toMatch(/does not allow/);
      expect(chrome.action.setBadgeBackgroundColor).toHaveBeenLastCalledWith({
        color: '#e5484d',
      });
      expect(badgeTexts().at(-1)).toBe('!');
    },
  );

  test('stores non-Error failures as text', async () => {
    chrome.tabs.get.mockResolvedValue(page());
    chrome.tabs.captureVisibleTab.mockRejectedValueOnce('boom');
    await send({ type: 'capture', mode: 'visible', tabId: 7 });
    await settle();
    expect(lastError()).toBe('boom');
  });

  test('shortcuts and the context menu capture too', async () => {
    chrome.commands.onCommand.emit('capture-visible', page());
    await settle();
    chrome.storage.session.remove.mockClear();
    chrome.tabs.query.mockResolvedValue([page({ id: 9 })]);
    chrome.commands.onCommand.emit('capture-visible', undefined);
    await settle();
    chrome.storage.session.remove.mockClear();
    chrome.contextMenus.onClicked.emit({ menuItemId: 'visible' }, page());
    chrome.contextMenus.onClicked.emit({ menuItemId: 'visible' }, undefined);
    chrome.commands.onCommand.emit('unknown', page());
    await settle();
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(3);
  });

  test('ignores a second capture while one is running and tabs without ids', async () => {
    chrome.contextMenus.onClicked.emit(
      { menuItemId: 'visible' },
      page({ id: undefined }),
    );
    chrome.contextMenus.onClicked.emit({ menuItemId: 'visible' }, page());
    chrome.contextMenus.onClicked.emit({ menuItemId: 'visible' }, page());
    await settle();
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledOnce();
  });
});

describe('entire page', () => {
  beforeEach(() => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 2000,
    });
    document.body.innerHTML =
      '<header style="position: fixed">Nav</header><p style="position: sticky; visibility: visible">Sticky</p>';
    window.scrollTo(0, 120);
  });

  test('scrolls, hides repeated fixed elements, stitches and restores the page', async () => {
    chrome.tabs.get.mockResolvedValue(page());
    await send({ type: 'capture', mode: 'full', tabId: 7 });
    await settle();
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(3);
    expect(chrome.action.openPopup).toHaveBeenCalledWith({ windowId: 1 });
    expect(chrome.storage.session.set).toHaveBeenCalledWith({
      progress: {
        mode: 'full',
        value: expect.any(Number),
        detail: 'Capturing section 2 of 3',
      },
    });
    expect(document.querySelector('header')!.style.visibility).toBe('');
    expect(document.querySelector('p')!.style.visibility).toBe('visible');
    expect(document.head.querySelector('style')).toBeNull();
    expect(scrollY).toBe(120);
    expect(await shots()).toEqual([
      expect.objectContaining({ mode: 'full', width: 1000, height: 2000 }),
    ]);
  });

  test('does not reopen the popup when it is already showing', async () => {
    chrome.runtime.getContexts.mockResolvedValue([{}]);
    chrome.tabs.get.mockResolvedValue(page());
    await send({ type: 'capture', mode: 'full', tabId: 7 });
    await settle();
    expect(chrome.action.openPopup).not.toHaveBeenCalled();
  });

  test('cancel stops quietly and restores the page', async () => {
    chrome.tabs.get.mockResolvedValue(page());
    await send({ type: 'capture', mode: 'full', tabId: 7 });
    await settle(() => chrome.storage.session.set.mock.calls.length > 0);
    await send({ type: 'cancel' });
    await settle();
    expect(lastError()).toBeUndefined();
    expect(badgeTexts().at(-1)).toBe('');
    expect(scrollY).toBe(120);
    expect(await shots()).toEqual([]);
  });
});

describe('selection', () => {
  const overlay = () => document.getElementById('daguerre-select')!;

  test('captures a dragged area inside the viewport', async () => {
    document.body.innerHTML = '<div id="daguerre-select"></div>';
    chrome.tabs.get.mockResolvedValue(page());
    await send({ type: 'capture', mode: 'selection', tabId: 7, delay: 3 });
    await settle(() => !!overlay()?.shadowRoot);
    expect(document.querySelectorAll('#daguerre-select')).toHaveLength(1);
    pointer(overlay(), 'pointermove', 10, 10); // ignored before pressing
    pointer(overlay(), 'pointerdown', 100, 100);
    pointer(overlay(), 'pointerup', 101, 101); // too small: keep selecting
    expect(overlay()).not.toBeNull();
    pointer(overlay(), 'pointerdown', 100, 20);
    pointer(overlay(), 'pointermove', 400, 220);
    expect(overlay().shadowRoot!.querySelector('.size')!.textContent).toBe(
      '300 × 200',
    );
    pointer(overlay(), 'pointerup', 400, 220);
    pointer(document.body, 'pointerup', 0, 0);
    await settle();
    expect(badgeTexts()).not.toContain('3');
    expect(await shots()).toEqual([
      expect.objectContaining({ mode: 'selection', width: 300, height: 200 }),
    ]);
  });

  test('Escape cancels without an error', async () => {
    chrome.tabs.get.mockResolvedValue(page());
    await send({ type: 'capture', mode: 'selection', tabId: 7 });
    await settle(() => !!overlay());
    dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await settle();
    expect(overlay()).toBeNull();
    expect(lastError()).toBeUndefined();
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  test('grows past the screen by scrolling at the edge, then stitches the area', async () => {
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      configurable: true,
      value: 4000,
    });
    chrome.tabs.get.mockResolvedValue(page());
    await send({ type: 'capture', mode: 'selection', tabId: 7 });
    await settle(() => !!overlay());
    pointer(overlay(), 'pointerdown', 100, 100);
    pointer(overlay(), 'pointermove', 300, 5); // top edge: page is already at the top
    await vi.advanceTimersByTimeAsync(50);
    pointer(overlay(), 'pointermove', 300, 2000); // clamped to the bottom edge
    await vi.advanceTimersByTimeAsync(500);
    dispatchEvent(new Event('scroll'));
    const scrolled = scrollY;
    expect(scrolled).toBeGreaterThan(300);
    pointer(overlay(), 'pointerup', 300, 768);
    await settle();
    expect(chrome.action.openPopup).toHaveBeenCalled();
    expect(await shots()).toEqual([
      expect.objectContaining({
        mode: 'selection',
        width: 200,
        height: Math.round(768 + scrolled - 100),
      }),
    ]);
  });
});

describe('all tabs', () => {
  const tabs = [
    page({ id: 1, index: 0, active: true }),
    page({ id: 2, index: 1, url: 'chrome://extensions' }),
    page({ id: 3, index: 2, url: undefined }),
    page({ id: 4, index: 3, url: 'https://b.dev', title: '' }),
  ];

  beforeEach(() => {
    chrome.tabs.query.mockImplementation(async (q: chrome.tabs.QueryInfo) =>
      q.active ? [tabs[0]] : tabs,
    );
    let loading = true;
    chrome.tabs.get.mockImplementation(async (id: number) => {
      const t = {
        ...tabs.find((x) => x.id === id)!,
        status: loading ? 'loading' : 'complete',
      } as chrome.tabs.Tab;
      loading = false;
      return t;
    });
  });

  test('needs the optional all-sites permission', async () => {
    chrome.permissions.contains.mockResolvedValue(false);
    chrome.contextMenus.onClicked.emit({ menuItemId: 'tabs' }, tabs[0]);
    await settle();
    expect(lastError()).toMatch(/All tabs/);
  });

  test('all tabs ignores the removed auto-copy setting and opens History', async () => {
    await chrome.storage.local.set({ copyAfterCapture: true });
    chrome.contextMenus.onClicked.emit({ menuItemId: 'tabs' }, tabs[0]);
    await settle();
    const saved = await shots();
    expect(saved).toHaveLength(2);
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'history.html' }),
    );
    expect(chrome.tabs.update).toHaveBeenLastCalledWith(1, { active: true });
  });

  test('captures every capturable tab, restores the active one and opens history', async () => {
    chrome.contextMenus.onClicked.emit({ menuItemId: 'tabs' }, tabs[0]);
    await settle();
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.update).toHaveBeenLastCalledWith(1, { active: true });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'history.html',
      windowId: 1,
      index: 1,
    });
    expect((await shots()).map((s) => s.title).sort()).toEqual([
      'Example',
      'Untitled',
    ]);
  });

  test('reports when nothing can be captured', async () => {
    chrome.tabs.query.mockResolvedValue([tabs[1], tabs[2]]);
    chrome.contextMenus.onClicked.emit({ menuItemId: 'tabs' }, tabs[0]);
    await settle();
    expect(lastError()).toMatch(/None of the tabs/);
  });

  test('starts after the permission is granted from the popup', async () => {
    chrome.permissions.onAdded.emit({ origins: ['https://x.dev/*'] });
    chrome.permissions.onAdded.emit({});
    await chrome.permissions.onAdded.emit({ origins: ['<all_urls>'] })[0];
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
    await chrome.storage.session.set({ pendingAllTabs: true });
    await chrome.permissions.onAdded.emit({ origins: ['<all_urls>'] })[0];
    await settle();
    expect(chrome.storage.session.data.pendingAllTabs).toBeUndefined();
    expect(chrome.tabs.captureVisibleTab).toHaveBeenCalledTimes(2);
  });

  test('does nothing if no window is focused', async () => {
    chrome.tabs.query.mockResolvedValue([]);
    await chrome.storage.session.set({ pendingAllTabs: true });
    await chrome.permissions.onAdded.emit({ origins: ['<all_urls>'] })[0];
    expect(chrome.tabs.captureVisibleTab).not.toHaveBeenCalled();
  });
});
