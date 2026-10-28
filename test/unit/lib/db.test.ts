import { beforeEach, expect, test } from 'vitest';
import {
  addShot,
  clearShots,
  deleteShots,
  getShot,
  listShots,
  makeThumb,
  putShots,
} from '../../../src/lib/db';
import { imageBlob } from '../../setup';

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
