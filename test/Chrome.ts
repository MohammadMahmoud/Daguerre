import { vi } from 'vitest';

type Listener = (...args: any[]) => any;

/** A chrome.events.Event stand-in that tests can fire with `emit`. */
function event() {
  const listeners: Listener[] = [];
  return {
    listeners,
    addListener: vi.fn((l: Listener) => void listeners.push(l)),
    removeListener: vi.fn((l: Listener) => {
      const i = listeners.indexOf(l);
      if (i >= 0) listeners.splice(i, 1);
    }),
    emit: (...args: any[]) => listeners.map((l) => l(...args)),
  };
}

function storageArea(name: string, onChanged: ReturnType<typeof event>) {
  const data: Record<string, unknown> = {};
  const pick = (keys?: string | string[] | null) =>
    keys == null
      ? { ...data }
      : Object.fromEntries(
          [keys]
            .flat()
            .filter((k) => k in data)
            .map((k) => [k, data[k]]),
        );
  return {
    data,
    get: vi.fn(async (keys?: string | string[] | null) => pick(keys)),
    set: vi.fn(async (items: Record<string, unknown>) => {
      const changes = Object.fromEntries(
        Object.entries(items).map(([k, v]) => [
          k,
          { oldValue: data[k], newValue: v },
        ]),
      );
      Object.assign(data, items);
      onChanged.emit(changes, name);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      const changes: Record<string, { oldValue: unknown }> = {};
      for (const k of [keys].flat()) {
        if (!(k in data)) continue;
        changes[k] = { oldValue: data[k] };
        delete data[k];
      }
      if (Object.keys(changes).length) onChanged.emit(changes, name);
    }),
  };
}

export const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';

export function createChrome() {
  const onChanged = event();
  return {
    runtime: {
      id: 'ext-id',
      getURL: (p: string) => `chrome-extension://ext-id/${p}`,
      sendMessage: vi.fn(async () => true),
      onMessage: event(),
      onInstalled: event(),
      getContexts: vi.fn(async () => [] as unknown[]),
      ContextType: { POPUP: 'POPUP' },
    },
    storage: {
      onChanged,
      local: storageArea('local', onChanged),
      session: storageArea('session', onChanged),
    },
    action: {
      setBadgeText: vi.fn(async (_details: { text: string }) => undefined),
      setBadgeBackgroundColor: vi.fn(
        async (_details: { color: string }) => undefined,
      ),
      setBadgeTextColor: vi.fn(
        async (_details: { color: string }) => undefined,
      ),
      openPopup: vi.fn(async (_options?: { windowId: number }) => undefined),
    },
    tabs: {
      query: vi.fn(
        async (_query: chrome.tabs.QueryInfo) => [] as chrome.tabs.Tab[],
      ),
      get: vi.fn(
        async (id: number) =>
          ({
            id,
            windowId: 1,
            index: 0,
            status: 'complete',
          }) as chrome.tabs.Tab,
      ),
      create: vi.fn(async (p: object) => p),
      update: vi.fn(async (id: number) => ({ id })),
      captureVisibleTab: vi.fn(async () => PNG_DATA_URL),
    },
    scripting: {
      // Runs injected functions directly in the jsdom page.
      executeScript: vi.fn(
        async ({
          func,
          args,
        }: {
          func: (...a: any[]) => any;
          args?: any[];
        }) => [{ result: await func(...(args ?? [])) }],
      ),
    },
    contextMenus: {
      removeAll: vi.fn((cb?: () => void) => cb?.()),
      create: vi.fn(),
      onClicked: event(),
    },
    commands: {
      onCommand: event(),
      getAll: vi.fn(async () => [
        { name: 'capture-visible', shortcut: '⌥⇧V' },
        { name: 'capture-full', shortcut: '' },
        { name: 'copy-selection', shortcut: '⌥⇧C' },
      ]),
    },
    permissions: {
      request: vi.fn(async () => true),
      contains: vi.fn(async () => true),
      onAdded: event(),
    },
  };
}

export type ChromeMock = ReturnType<typeof createChrome>;

export function installChrome() {
  const mock = createChrome();
  (globalThis as any).chrome = mock;
  return mock;
}
