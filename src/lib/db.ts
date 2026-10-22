export type CaptureMode = 'visible' | 'full' | 'selection' | 'tabs';

/** Live capture state shared via chrome.storage.session. `value` is 0..1. */
export interface Progress {
  mode: CaptureMode;
  value: number;
  detail: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Shape {
  id: string;
  kind:
    | 'arrow'
    | 'rect'
    | 'ellipse'
    | 'line'
    | 'pen'
    | 'highlight'
    | 'text'
    | 'step'
    | 'blur';
  color: string;
  size: number;
  /** Flat [x, y, x, y, ...] list in original image pixels. */
  pts: number[];
  text?: string;
}

export interface Edits {
  shapes: Shape[];
  crop: Rect | null;
}

export interface Shot {
  id: string;
  createdAt: number;
  updatedAt: number;
  title: string;
  url: string;
  mode: CaptureMode;
  width: number;
  height: number;
  size: number;
  /** Rendered PNG (edits applied). */
  blob: Blob;
  thumb: Blob;
  /** Unedited capture, kept so edits stay re-editable. */
  original?: Blob;
  edits?: Edits;
}

const STORE = 'shots';
let dbPromise: Promise<IDBDatabase> | undefined;

function openDb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('daguerre', 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req?.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error('Storage transaction aborted'));
  });
}

export async function makeThumb(source: Blob) {
  const bmp = await createImageBitmap(source);
  const w = Math.min(480, bmp.width);
  // Tall full-page shots get a top crop instead of a sliver.
  const h = Math.max(
    1,
    Math.min(Math.round(w * 0.625), Math.round((bmp.height * w) / bmp.width)),
  );
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, bmp.width, (h * bmp.width) / w, 0, 0, w, h);
  const result = {
    thumb: await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.82 }),
    width: bmp.width,
    height: bmp.height,
  };
  bmp.close();
  return result;
}

export async function addShot(
  blob: Blob,
  meta: Pick<Shot, 'title' | 'url' | 'mode'>,
) {
  const { thumb, width, height } = await makeThumb(blob);
  const now = Date.now();
  const shot: Shot = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    ...meta,
    width,
    height,
    size: blob.size,
    blob,
    thumb,
  };
  await run('readwrite', (s) => s.put(shot));
  return shot.id;
}

export const getShot = (id: string) =>
  run<Shot | undefined>('readonly', (s) => s.get(id));

export const listShots = async () =>
  (await run<Shot[]>('readonly', (s) => s.getAll())).sort(
    (a, b) => b.createdAt - a.createdAt,
  );

export const putShots = (shots: Shot[]) =>
  run('readwrite', (s) => {
    for (const shot of shots) s.put(shot);
  });

export const deleteShots = (ids: string[]) =>
  run('readwrite', (s) => {
    for (const id of ids) s.delete(id);
  });

export const clearShots = () => run('readwrite', (s) => s.clear());
