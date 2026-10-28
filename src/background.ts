import { addShot, type CaptureMode, type Progress } from './lib/db';

const MODES = ['visible', 'full', 'selection', 'tabs'] as const;
const MENU: Record<(typeof MODES)[number], string> = {
  visible: 'Capture visible area',
  full: 'Capture entire page',
  selection: 'Capture selected area',
  tabs: 'Capture all tabs in this window',
};
const COMMANDS: Record<string, CaptureMode> = {
  'capture-visible': 'visible',
  'capture-full': 'full',
  'capture-selection': 'selection',
};
const RESTRICTED =
  /^(chrome|edge|brave|about|devtools|view-source|chrome-extension|chrome-search|chrome-untrusted):|^https:\/\/(chromewebstore\.google\.com|chrome\.google\.com\/webstore)/;
const ALL_SITES = '<all_urls>';
// Chrome canvas limits (max side 32767 px, ~268M px area).
const MAX_SIDE = 32_000;
const MAX_AREA = 250_000_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function setBadge(text: string, error = false) {
  await chrome.action.setBadgeBackgroundColor({
    color: error ? '#e5484d' : '#18181b',
  });
  await chrome.action.setBadgeTextColor({
    color: error ? '#ffffff' : '#eceef1',
  });
  await chrome.action.setBadgeText({ text });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    for (const mode of MODES)
      chrome.contextMenus.create({
        id: mode,
        title: MENU[mode],
        contexts: ['all'],
      });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (tab) void capture(info.menuItemId as CaptureMode, tab, 0);
});

// The popup may close while Chrome shows the permission prompt, so finish "All tabs" from here.
chrome.permissions.onAdded.addListener(async ({ origins }) => {
  if (!origins?.includes(ALL_SITES)) return;
  const { pendingAllTabs } = await chrome.storage.session.get('pendingAllTabs');
  if (!pendingAllTabs) return;
  await chrome.storage.session.remove('pendingAllTabs');
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (tab) void capture('tabs', tab, 0);
});

chrome.commands.onCommand.addListener(async (command, tab) => {
  const copySelection = command === 'copy-selection';
  const mode = copySelection ? 'selection' : COMMANDS[command];
  const target =
    tab ??
    (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (mode && target) void capture(mode, target, 0, copySelection);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (msg?.type === 'cancel') {
    cancelled = busy;
    return;
  }
  const copySelection = msg?.type === 'copy-selection';
  const mode = copySelection ? 'selection' : msg?.mode;
  if (
    (!copySelection && msg?.type !== 'capture') ||
    !MODES.includes(mode) ||
    !Number.isInteger(msg.tabId)
  ) {
    return;
  }
  const delay = Math.min(Math.max(Math.floor(Number(msg.delay)) || 0, 0), 10);
  chrome.tabs.get(msg.tabId).then(
    (tab) => {
      sendResponse(true);
      void capture(mode, tab, delay, copySelection);
    },
    () => sendResponse(false),
  );
  return true;
});

let busy = false;
let cancelled = false;

/** Publishes progress for the popup dialog and the badge; aborts the capture when cancelled. */
async function report(mode: CaptureMode, value: number, detail: string) {
  if (cancelled) throw new Error('cancelled');
  const progress: Progress = { mode, value, detail };
  await chrome.storage.session.set({ progress });
  await setBadge(`${Math.min(99, Math.round(value * 100))}%`);
}

async function showDialog(windowId: number) {
  const open = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.POPUP],
  });
  // Not available on older Chrome or unfocused windows; the badge still shows progress.
  if (!open.length)
    await chrome.action.openPopup({ windowId }).catch(() => undefined);
}

async function capture(
  mode: CaptureMode,
  tab: chrome.tabs.Tab,
  delay: number,
  copySelection = false,
) {
  if (busy || tab.id === undefined) return;
  busy = true;
  cancelled = false;
  try {
    await chrome.storage.session.remove('lastError');
    await setBadge('');
    if (mode === 'tabs') {
      if (!(await chrome.permissions.contains({ origins: [ALL_SITES] }))) {
        throw new Error(
          'To capture all tabs, open Daguerre and choose “All tabs” once to allow access.',
        );
      }
      await report(mode, 0, 'Starting…');
      await showDialog(tab.windowId);
      await captureAllTabs(tab.windowId);
      await chrome.tabs.create({
        url: 'history.html',
        windowId: tab.windowId,
        index: tab.index + 1,
      });
    } else {
      // Without the tabs permission, url is only exposed for pages we may capture.
      if (!tab.url || RESTRICTED.test(tab.url)) {
        throw new Error(
          'Chrome does not allow extensions to capture this page (browser pages and the Web Store).',
        );
      }
      if (mode !== 'selection') {
        for (let s = delay; s > 0; s--) {
          await setBadge(String(s));
          await sleep(1000);
        }
      }
      if (mode === 'full') {
        await report(mode, 0, 'Measuring the page…');
        await showDialog(tab.windowId);
      }
      const blob =
        mode === 'visible'
          ? await grab(tab.windowId)
          : mode === 'full'
            ? await captureFullPage(tab)
            : await captureSelection(tab);
      if (blob) {
        if (mode === 'full') await report(mode, 1, 'Saving to history…');
        const id = await addShot(blob, {
          title: tab.title || 'Untitled',
          url: tab.url ?? '',
          mode,
        });
        if (copySelection) {
          await copyCapture(id, tab.id);
        } else {
          await chrome.tabs.create({
            url: `editor.html?id=${id}`,
            windowId: tab.windowId,
            index: tab.index + 1,
            openerTabId: tab.id,
          });
        }
      }
    }
    await setBadge('');
  } catch (e) {
    if (cancelled) {
      await setBadge('');
      return;
    }
    await chrome.storage.session.set({
      lastError: e instanceof Error ? e.message : String(e),
    });
    await setBadge('!', true);
  } finally {
    await chrome.storage.session.remove('progress');
    busy = false;
  }
}

let lastGrab = 0;

async function copyCapture(id: string, tabId: number) {
  const target = { tabId };
  try {
    await chrome.runtime
      .sendMessage({ type: 'prepare-copy', target: 'popup' })
      .catch(() => undefined);
    await chrome.tabs.update(tabId, { active: true });
    await chrome.scripting.executeScript({
      target,
      func: mountClipboardFrame,
      args: [chrome.runtime.getURL('clipboard.html')],
    });
    const result = await chrome.runtime.sendMessage({
      type: 'copy-capture',
      target: 'clipboard',
      id,
    });
    if (result?.ok !== true) throw new Error('Clipboard write failed.');
  } catch {
    throw new Error(
      'Screenshot saved in History, but could not copy to the clipboard. Open History to copy it manually.',
    );
  } finally {
    await chrome.scripting
      .executeScript({ target, func: removeClipboardFrame })
      .catch(() => undefined);
  }
}

async function grab(windowId: number) {
  // captureVisibleTab is rate limited to 2 calls per second.
  const wait = lastGrab + 600 - Date.now();
  if (wait > 0) await sleep(wait);
  lastGrab = Date.now();
  const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
    format: 'png',
  });
  return (await fetch(dataUrl)).blob();
}

async function captureFullPage(tab: chrome.tabs.Tab, area?: Area) {
  const mode = area ? 'selection' : 'full';
  const target = { tabId: tab.id! };
  if (area) {
    await report(mode, 0, 'Starting…');
    await showDialog(tab.windowId);
  }
  const [{ result: page }] = await chrome.scripting.executeScript({
    target,
    func: preparePage,
    // Hiding the scrollbar would shift the layout under a selection made with it visible.
    args: [!area],
  });
  if (!page) throw new Error('Could not measure the page.');
  let canvas: OffscreenCanvas | undefined;
  let ctx: OffscreenCanvasRenderingContext2D | undefined;
  let scale = 1;
  let step = page.viewHeight;
  const from = area?.y ?? 0;
  let to = area ? area.y + area.h : page.height;
  try {
    for (let y = from; y < to; y += step) {
      const [{ result: top }] = await chrome.scripting.executeScript({
        target,
        func: scrollPage,
        args: [y, y > from, area?.scrollX ?? 0],
      });
      const total = Math.max(1, Math.ceil((to - from) / step));
      await report(
        mode,
        (y - from) / (to - from),
        `Capturing section ${Math.min(total, Math.floor((y - from) / step) + 1)} of ${total}`,
      );
      const bmp = await createImageBitmap(await grab(tab.windowId));
      if (!canvas || !ctx) {
        scale = bmp.width / page.viewWidth;
        // The captured frame can be shorter than innerHeight (e.g. emulated viewports).
        step = Math.min(step, Math.floor(bmp.height / scale));
        const width = Math.max(1, Math.round((area?.w ?? page.width) * scale));
        // ponytail: very long pages are cut at the canvas limit; tiling into several images would lift it.
        to = Math.min(
          to,
          from + Math.floor(Math.min(MAX_SIDE, MAX_AREA / width) / scale),
        );
        canvas = new OffscreenCanvas(
          width,
          Math.max(1, Math.round((to - from) * scale)),
        );
        ctx = canvas.getContext('2d')!;
      }
      ctx.drawImage(
        bmp,
        -Math.round((area?.x ?? 0) * scale),
        Math.round(((top ?? y) - from) * scale),
      );
      bmp.close();
    }
  } finally {
    await chrome.scripting
      .executeScript({ target, func: restorePage })
      .catch(() => undefined);
  }
  return canvas!.convertToBlob({ type: 'image/png' });
}

/** Selection in viewport x and document y (CSS px), plus the scroll position when it ended. */
type Area = { x: number; y: number; w: number; h: number; scrollX: number };

async function captureSelection(tab: chrome.tabs.Tab) {
  const [{ result: area }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id! },
    func: selectRegion,
  });
  if (!area) return null;
  const top = area.y - area.scrollY;
  // Taller than what's on screen: scroll and stitch just that region.
  if (top < 0 || top + area.h > area.viewHeight)
    return captureFullPage(tab, area);
  const bmp = await createImageBitmap(await grab(tab.windowId));
  const s = bmp.width / area.viewWidth;
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(area.w * s)),
    Math.max(1, Math.round(area.h * s)),
  );
  canvas
    .getContext('2d')!
    .drawImage(
      bmp,
      Math.round(area.x * s),
      Math.round(top * s),
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  bmp.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

async function captureAllTabs(windowId: number) {
  const tabs = (await chrome.tabs.query({ windowId })).filter(
    (t) => t.id !== undefined && !!t.url && !RESTRICTED.test(t.url),
  );
  if (!tabs.length)
    throw new Error('None of the tabs in this window can be captured.');
  const [active] = await chrome.tabs.query({ windowId, active: true });
  try {
    for (const [i, t] of tabs.entries()) {
      await report(
        'tabs',
        i / tabs.length,
        `Tab ${i + 1} of ${tabs.length} · ${t.title || 'Untitled'}`,
      );
      await chrome.tabs.update(t.id!, { active: true });
      const loaded = await waitForTab(t.id!);
      await addShot(await grab(windowId), {
        title: loaded.title || 'Untitled',
        url: loaded.url ?? '',
        mode: 'tabs',
      });
    }
  } finally {
    if (active?.id !== undefined)
      await chrome.tabs.update(active.id, { active: true });
  }
}

async function waitForTab(tabId: number) {
  let tab = await chrome.tabs.get(tabId);
  for (let i = 0; i < 50 && tab.status !== 'complete'; i++) {
    await sleep(100);
    tab = await chrome.tabs.get(tabId);
  }
  // Give a freshly activated (or un-discarded) tab time to paint.
  await sleep(350);
  return tab;
}

/* ---------- Functions below are serialized and run inside the page. They must not reference outer scope. ---------- */

async function mountClipboardFrame(url: string) {
  const frame = document.createElement('iframe');
  frame.id = 'daguerre-clipboard';
  frame.src = url;
  frame.allow = 'clipboard-write';
  frame.title = 'Copy screenshot';
  frame.style.cssText =
    'position:fixed!important;top:0!important;left:0!important;width:1px!important;height:1px!important;opacity:0!important;border:0!important;pointer-events:none!important';
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Clipboard frame did not load.')),
      5000,
    );
    frame.onload = () => {
      clearTimeout(timer);
      frame.contentWindow?.focus();
      resolve();
    };
    document.documentElement.append(frame);
  });
}

function removeClipboardFrame() {
  document.getElementById('daguerre-clipboard')?.remove();
}

declare global {
  interface Window {
    __daguerre?: {
      scroll: [number, number];
      hidden: [HTMLElement, string, string][];
      hid: boolean;
      style: HTMLStyleElement;
    };
  }
}

function preparePage(hideScrollbar: boolean) {
  const style = document.createElement('style');
  style.textContent = `html{scroll-behavior:auto!important${hideScrollbar ? ';scrollbar-width:none!important' : ''}}`;
  document.documentElement.append(style);
  window.__daguerre = {
    scroll: [scrollX, scrollY],
    hidden: [],
    hid: false,
    style,
  };
  const root = document.scrollingElement ?? document.documentElement;
  return {
    width: document.documentElement.clientWidth,
    height: Math.max(root.scrollHeight, document.body?.scrollHeight ?? 0),
    viewWidth: innerWidth,
    viewHeight: innerHeight,
  };
}

async function scrollPage(y: number, hideFixed: boolean, x: number) {
  const state = window.__daguerre!;
  if (hideFixed && !state.hid) {
    // ponytail: hides every fixed/sticky element after the first frame so headers don't repeat;
    // sticky elements inside content are hidden too.
    state.hid = true;
    for (const el of document.querySelectorAll<HTMLElement>('body *')) {
      const pos = getComputedStyle(el).position;
      if (pos !== 'fixed' && pos !== 'sticky') continue;
      state.hidden.push([
        el,
        el.style.getPropertyValue('visibility'),
        el.style.getPropertyPriority('visibility'),
      ]);
      el.style.setProperty('visibility', 'hidden', 'important');
    }
  }
  window.scrollTo(x, y);
  await new Promise((r) => setTimeout(r, 150));
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  return scrollY;
}

function restorePage() {
  const state = window.__daguerre;
  if (!state) return;
  for (const [el, value, priority] of state.hidden)
    el.style.setProperty('visibility', value, priority);
  window.scrollTo(...state.scroll);
  state.style.remove();
  delete window.__daguerre;
}

function selectRegion() {
  return new Promise<{
    x: number;
    y: number;
    w: number;
    h: number;
    viewWidth: number;
    viewHeight: number;
    scrollX: number;
    scrollY: number;
  } | null>((resolve) => {
    document.getElementById('daguerre-select')?.remove();
    const host = document.createElement('div');
    host.id = 'daguerre-select';
    host.style.cssText =
      'all:initial;position:fixed;inset:0;z-index:2147483647;cursor:crosshair;touch-action:none';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      .shade{position:fixed;inset:0;background:rgba(8,9,12,.45)}
      .box{position:fixed;display:none;outline:1.5px solid #eceef1;box-shadow:0 0 0 1px rgba(0,0,0,.5),0 0 0 100vmax rgba(8,9,12,.45)}
      .size{position:absolute;left:0;top:-30px;font:600 12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0b0b0c;background:linear-gradient(180deg,#f7f8fa,#c4c7cd);padding:6px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)}
      .hint{position:fixed;left:50%;top:20px;transform:translateX(-50%);font:500 13px/1 system-ui,sans-serif;color:#eeece7;background:rgba(21,23,26,.94);padding:11px 16px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.35)}
      kbd{font:600 11px/1 ui-monospace,Menlo,monospace;background:rgba(255,255,255,.12);padding:3px 6px;border-radius:4px;margin:0 2px}
    </style><div class="shade"></div><div class="box"><span class="size"></span></div><div class="hint">Drag to capture an area &middot; drag to the edge or scroll for more &middot; <kbd>Esc</kbd> to cancel</div>`;
    const shade = root.querySelector<HTMLElement>('.shade')!;
    const box = root.querySelector<HTMLElement>('.box')!;
    const size = root.querySelector<HTMLElement>('.size')!;
    const hint = root.querySelector<HTMLElement>('.hint')!;
    // x is viewport-relative, y is document-relative so the area can grow while the page scrolls.
    let start: { x: number; y: number } | null = null;
    let pointer = { x: 0, y: 0 };
    let rect = { x: 0, y: 0, w: 0, h: 0 };
    let raf = 0;

    const draw = () => {
      if (!start) return;
      const y = pointer.y + scrollY;
      rect = {
        x: Math.min(start.x, pointer.x),
        y: Math.min(start.y, y),
        w: Math.abs(pointer.x - start.x),
        h: Math.abs(y - start.y),
      };
      const top = rect.y - scrollY;
      shade.style.display = 'none';
      hint.style.display = 'none';
      box.style.display = 'block';
      Object.assign(box.style, {
        left: `${rect.x}px`,
        top: `${top}px`,
        width: `${rect.w}px`,
        height: `${rect.h}px`,
      });
      size.textContent = `${Math.round(rect.w)} × ${Math.round(rect.h)}`;
      size.style.top = top < 36 ? `${6 - Math.min(0, top)}px` : '-30px';
      size.style.left = top < 36 ? '6px' : '0';
    };
    const autoScroll = () => {
      raf = 0;
      if (!start) return;
      const edge = 48;
      const over =
        pointer.y < edge
          ? pointer.y - edge
          : pointer.y > innerHeight - edge
            ? pointer.y - (innerHeight - edge)
            : 0;
      if (!over) return;
      scrollBy({
        top: Math.max(-40, Math.min(40, over * 0.8)),
        behavior: 'instant',
      });
      draw();
      raf = requestAnimationFrame(autoScroll);
    };
    const onScroll = () => draw();

    const finish = (result: typeof rect | null) => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', onKey, true);
      removeEventListener('scroll', onScroll);
      host.remove();
      // Wait for the overlay to disappear from the next painted frame before capturing.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          resolve(
            result && {
              ...result,
              viewWidth: innerWidth,
              viewHeight: innerHeight,
              scrollX,
              scrollY,
            },
          ),
        ),
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      finish(null);
    };
    host.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      host.setPointerCapture(e.pointerId);
      pointer = { x: e.clientX, y: e.clientY };
      start = { x: e.clientX, y: e.clientY + scrollY };
    });
    host.addEventListener('pointermove', (e) => {
      if (!start) return;
      pointer = {
        x: Math.min(Math.max(e.clientX, 0), innerWidth),
        y: Math.min(Math.max(e.clientY, 0), innerHeight),
      };
      draw();
      if (!raf) raf = requestAnimationFrame(autoScroll);
    });
    host.addEventListener('pointerup', () => {
      if (!start) return;
      start = null;
      if (rect.w >= 4 && rect.h >= 4) return finish(rect);
      shade.style.display = '';
      hint.style.display = '';
      box.style.display = 'none';
    });
    addEventListener('keydown', onKey, true);
    addEventListener('scroll', onScroll, { passive: true });
    document.documentElement.append(host);
  });
}
