import { beforeEach, expect, test, vi } from 'vitest';
import { addShot, clearShots } from '../../src/lib/db';
import type { ChromeMock } from '../chrome';
import { imageBlob } from '../setup';

let extension: ChromeMock;

beforeEach(async () => {
  extension = globalThis.chrome as unknown as ChromeMock;
  await clearShots();
  vi.resetModules();
  await import('../../src/Clipboard');
});

function send(message: unknown, sender = { id: 'ext-id' }) {
  return new Promise((resolve) => {
    const [pending] = extension.runtime.onMessage.emit(
      message,
      sender,
      resolve,
    );
    if (pending !== true) resolve(pending);
  });
}

test('copies the saved PNG and acknowledges success', async () => {
  const id = await addShot(imageBlob(40, 30), {
    title: 'Capture',
    url: '',
    mode: 'visible',
  });
  const write = vi.spyOn(navigator.clipboard, 'write');
  expect(await send({ target: 'clipboard', type: 'copy-capture', id })).toEqual(
    { ok: true },
  );
  expect(write).toHaveBeenCalledOnce();
  const item = write.mock.calls[0][0][0] as unknown as {
    items: Record<string, Blob>;
  };
  expect(item.items['image/png'].type).toBe('image/png');
});

test('reports a missing screenshot or clipboard rejection', async () => {
  expect(
    await send({ target: 'clipboard', type: 'copy-capture', id: 'missing' }),
  ).toMatchObject({ ok: false });
  const id = await addShot(imageBlob(40, 30), {
    title: 'Capture',
    url: '',
    mode: 'visible',
  });
  vi.spyOn(navigator.clipboard, 'write').mockRejectedValue(new Error('denied'));
  expect(
    await send({ target: 'clipboard', type: 'copy-capture', id }),
  ).toMatchObject({ ok: false });
});

test('ignores foreign senders and unrelated or invalid messages', async () => {
  const valid = { target: 'clipboard', type: 'copy-capture', id: 'id' };
  expect(await send(valid, { id: 'foreign' })).toBeUndefined();
  expect(await send(null)).toBeUndefined();
  expect(await send({ ...valid, type: 'capture' })).toBeUndefined();
  expect(await send({ ...valid, id: 5 })).toBeUndefined();
});
