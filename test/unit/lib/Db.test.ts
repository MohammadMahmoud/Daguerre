import { beforeEach, expect, test, vi } from 'vitest';
import {
  addShot,
  clearShots,
  deleteShots,
  getShot,
  listShots,
  makeThumb,
  putShots,
} from '../../../src/lib/Db';
import { imageBlob } from '../../Setup';

beforeEach(() => clearShots());

test('makeThumb keeps the top of tall captures and never upscales', async () => {
  const tall = await makeThumb(imageBlob(1000, 5000));
  expect([tall.width, tall.height]).toEqual([1000, 5000]);
  expect(await createImageBitmap(tall.thumb)).toMatchObject({
    width: 480,
    height: 300,
  });
  const small = await makeThumb(imageBlob(200, 50));
  expect(await createImageBitmap(small.thumb)).toMatchObject({
    width: 200,
    height: 50,
  });
});

test('addShot stores the capture with metadata and a thumbnail', async () => {
  const blob = imageBlob(640, 480);
  const id = await addShot(blob, {
    title: 'Docs',
    url: 'https://a.dev',
    mode: 'visible',
  });
  const shot = await getShot(id);
  expect(shot).toMatchObject({
    id,
    title: 'Docs',
    url: 'https://a.dev',
    mode: 'visible',
    width: 640,
    height: 480,
    size: blob.size,
  });
  expect(shot?.thumb).toBeInstanceOf(Blob);
  expect(await getShot('missing')).toBeUndefined();
});

test('list, update, delete and clear', async () => {
  const a = await addShot(imageBlob(10, 10), {
    title: 'A',
    url: '',
    mode: 'full',
  });
  const b = await addShot(imageBlob(10, 10), {
    title: 'B',
    url: '',
    mode: 'tabs',
  });
  const shotA = (await getShot(a))!;
  await putShots([
    { ...shotA, createdAt: shotA.createdAt + 10_000, title: 'A2' },
  ]);
  expect((await listShots()).map((s) => s.title)).toEqual(['A2', 'B']);
  await deleteShots([a]);
  expect((await listShots()).map((s) => s.id)).toEqual([b]);
  await clearShots();
  expect(await listShots()).toEqual([]);
});

test('handles openDb error', async () => {
  vi.resetModules();
  const openSpy = vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
    const req = {} as any;
    setTimeout(() => {
      req.error = new Error('IndexedDB open failure');
      req.onerror?.();
    }, 0);
    return req;
  });
  const { getShot: freshGetShot } = await import('../../../src/lib/Db');
  await expect(freshGetShot('id')).rejects.toThrow('IndexedDB open failure');
  openSpy.mockRestore();
});

test('handles transaction onabort and onerror in run', async () => {
  vi.resetModules();
  const mockTx = {
    objectStore: vi.fn(() => ({
      get: vi.fn(),
    })),
    oncomplete: null as any,
    onerror: null as any,
    onabort: null as any,
    error: new Error('Transaction aborted by user'),
  };
  const mockDb = {
    transaction: vi.fn(() => {
      setTimeout(() => mockTx.onabort?.(), 0);
      return mockTx;
    }),
  };
  vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
    const req = {} as any;
    setTimeout(() => {
      req.result = mockDb;
      req.onsuccess?.();
    }, 0);
    return req;
  });
  const { getShot: abortGetShot } = await import('../../../src/lib/Db');
  await expect(abortGetShot('id')).rejects.toThrow(
    'Transaction aborted by user',
  );

  vi.resetModules();
  const mockTxError = {
    objectStore: vi.fn(() => ({
      get: vi.fn(),
    })),
    oncomplete: null as any,
    onerror: null as any,
    onabort: null as any,
    error: new Error('Database transaction failed'),
  };
  const mockDbError = {
    transaction: vi.fn(() => {
      setTimeout(() => mockTxError.onerror?.(), 0);
      return mockTxError;
    }),
  };
  vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
    const req = {} as any;
    setTimeout(() => {
      req.result = mockDbError;
      req.onsuccess?.();
    }, 0);
    return req;
  });
  const { getShot: errorGetShot } = await import('../../../src/lib/Db');
  await expect(errorGetShot('id')).rejects.toThrow(
    'Database transaction failed',
  );
});
