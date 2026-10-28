import { cleanup } from '@testing-library/react';
import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, beforeEach } from 'vitest';
import 'vitest-canvas-mock';
import { installChrome } from './chrome';

// jsdom's Blob has no text()/arrayBuffer() and can't be structured-cloned into IndexedDB.
globalThis.Blob = NodeBlob as unknown as typeof Blob;

// Decoded image sizes, so createImageBitmap mirrors what was encoded.
const sizes = new WeakMap<object, { width: number; height: number }>();
export const defaultBitmap = { width: 1024, height: 768 };

export function imageBlob(width: number, height: number, type = 'image/png') {
  const blob = new Blob(['img'], { type });
  sizes.set(blob, { width, height });
  return blob;
}

function bitmap(width: number, height: number): ImageBitmap {
  const bmp = Object.create(ImageBitmap.prototype);
  Object.defineProperties(bmp, {
    width: { value: width },
    height: { value: height },
  });
  bmp.close = () => (bmp._closed = true);
  return bmp;
}

globalThis.createImageBitmap = (async (src: any) => {
  const size = sizes.get(src) ?? (src?.width ? src : defaultBitmap);
  return bitmap(size.width, size.height);
}) as typeof createImageBitmap;

// A real <canvas> so the canvas mock accepts it as a drawImage source.
globalThis.OffscreenCanvas = function (width: number, height: number) {
  const canvas = document.createElement('canvas') as any;
  canvas.width = width;
  canvas.height = height;
  canvas.convertToBlob = async ({ type = 'image/png' } = {}) =>
    imageBlob(canvas.width, canvas.height, type);
  return canvas;
} as any;

HTMLCanvasElement.prototype.toBlob = function (
  cb: BlobCallback,
  type = 'image/png',
) {
  const blob = imageBlob(this.width, this.height, type);
  setTimeout(() => cb(blob));
};

class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}
globalThis.PointerEvent ??= FakePointerEvent as any;
Element.prototype.setPointerCapture = () => undefined;
Element.prototype.scrollBy = function (
  this: Element,
  x: number | ScrollToOptions = 0,
  y: number = 0,
) {
  const [dx, dy]: [number, number] =
    typeof x === 'object' ? [x.left ?? 0, x.top ?? 0] : [x, y];
  this.scrollLeft += dx;
  this.scrollTop += dy;
};

// jsdom has no layout: give elements their inline size and the stage a fixed viewport.
Element.prototype.getBoundingClientRect = function (this: HTMLElement) {
  const width = parseFloat(this.style?.width) || 1000;
  const height = parseFloat(this.style?.height) || 700;
  const left = -(this.parentElement?.scrollLeft ?? 0);
  const top = -(this.parentElement?.scrollTop ?? 0);
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
};
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get: () => 1000,
});
Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get: () => 700,
});

globalThis.ResizeObserver = class {
  constructor(private cb: ResizeObserverCallback) {}
  observe() {
    this.cb(
      [{ contentRect: { width: 1000, height: 700 } } as ResizeObserverEntry],
      this as any,
    );
  }
  disconnect() {}
  unobserve() {}
};

globalThis.ClipboardItem = class {
  constructor(public items: Record<string, unknown>) {}
} as any;

let objectUrls = 0;
URL.createObjectURL = () => `blob:mock/${++objectUrls}`;
URL.revokeObjectURL = () => undefined;

// Pages scroll in tests; jsdom only logs "not implemented".
window.scrollTo = ((x: number | ScrollToOptions, y?: number) => {
  const [left, top] =
    typeof x === 'object' ? [x.left ?? scrollX, x.top ?? scrollY] : [x, y ?? 0];
  Object.assign(window, { scrollX: left, scrollY: top });
}) as typeof window.scrollTo;
window.scrollBy = ((x: number | ScrollToOptions, y?: number) => {
  const [dx, dy] =
    typeof x === 'object' ? [x.left ?? 0, x.top ?? 0] : [x, y ?? 0];
  window.scrollTo(scrollX + dx, Math.max(0, scrollY + dy));
}) as typeof window.scrollBy;
window.print = () => undefined;

beforeEach(() => {
  installChrome();
  localStorage.clear();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      write: async (
        items: { items: Record<string, Promise<Blob> | Blob> }[],
      ) => {
        for (const item of items)
          for (const v of Object.values(item.items)) await v;
      },
    },
  });
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: { estimate: async () => ({ usage: 2048, quota: 1e9 }) },
  });
  window.scrollTo(0, 0);
});

afterEach(() => cleanup());
