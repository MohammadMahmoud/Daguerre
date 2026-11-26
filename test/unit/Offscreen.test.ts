import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { ChromeMock } from '../Chrome';

const playCaptureSound = vi.fn<() => Promise<void>>();

vi.mock('../../src/lib/CaptureSound', () => ({
  playCaptureSound: () => playCaptureSound(),
}));

let extension: ChromeMock;
let closeSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  extension = globalThis.chrome as unknown as ChromeMock;
  playCaptureSound.mockReset().mockResolvedValue(undefined);
  closeSpy = vi.spyOn(window, 'close').mockImplementation(() => undefined);
  vi.useFakeTimers();
  vi.resetModules();
  await import('../../src/Offscreen');
});

afterEach(() => {
  vi.useRealTimers();
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

test('plays the capture sound, acknowledges success, and closes after idle timeout', async () => {
  expect(
    await send({ target: 'offscreen', type: 'play-capture-sound' }),
  ).toEqual({ ok: true });
  expect(playCaptureSound).toHaveBeenCalledOnce();
  expect(closeSpy).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(1000);
  expect(
    await send({ target: 'offscreen', type: 'play-capture-sound' }),
  ).toEqual({ ok: true });
  expect(playCaptureSound).toHaveBeenCalledTimes(2);

  await vi.advanceTimersByTimeAsync(1500);
  expect(closeSpy).not.toHaveBeenCalled();

  await vi.advanceTimersByTimeAsync(500);
  expect(closeSpy).toHaveBeenCalledOnce();
});

test('acknowledges playback failure and still schedules idle close', async () => {
  playCaptureSound.mockRejectedValueOnce(new Error('audio failed'));
  expect(
    await send({ target: 'offscreen', type: 'play-capture-sound' }),
  ).toEqual({ ok: false });
  await vi.advanceTimersByTimeAsync(2000);
  expect(closeSpy).toHaveBeenCalledOnce();
});

test('ignores foreign senders and unrelated or invalid messages', async () => {
  const valid = { target: 'offscreen', type: 'play-capture-sound' };
  expect(await send(valid, { id: 'foreign' })).toBeUndefined();
  expect(await send(null)).toBeUndefined();
  expect(await send({ ...valid, target: 'clipboard' })).toBeUndefined();
  expect(await send({ ...valid, type: 'other' })).toBeUndefined();
  expect(playCaptureSound).not.toHaveBeenCalled();
});
