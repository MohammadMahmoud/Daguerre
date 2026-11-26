import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

function createMockAudioContext(
  state: AudioContextState = 'running',
  duration = 1.593,
) {
  const sources: {
    buffer: unknown;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }[] = [];

  const ctx = {
    state,
    currentTime: 1.5,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    close: vi.fn(async () => undefined),
    decodeAudioData: vi.fn(async (_buf: ArrayBuffer) => ({ duration })),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => {
      const src = {
        buffer: null as unknown,
        connect: vi.fn(),
        start: vi.fn(),
        onended: null as (() => void) | null,
      };
      sources.push(src);
      return src;
    }),
  };

  return { ctx, sources };
}

async function importCaptureSound() {
  const mod = await import('../../../src/lib/CaptureSound');
  return mod.playCaptureSound;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('playCaptureSound', () => {
  test('is a safe no-op when AudioContext is unavailable', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    const playCaptureSound = await importCaptureSound();
    await expect(playCaptureSound()).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test('loads, caches, trims leading silence, and closes once on onended', async () => {
    vi.useFakeTimers();
    const raw = new ArrayBuffer(16);
    const sliceSpy = vi.spyOn(raw, 'slice');
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => raw,
    }));
    vi.stubGlobal('fetch', fetchSpy);

    const first = createMockAudioContext('running', 1.593);
    const second = createMockAudioContext('running', 1.593);
    const factory = vi
      .fn()
      .mockImplementationOnce(function FirstAudioContext() {
        return first.ctx;
      })
      .mockImplementationOnce(function SecondAudioContext() {
        return second.ctx;
      });
    vi.stubGlobal('AudioContext', factory);

    const playCaptureSound = await importCaptureSound();
    await playCaptureSound();
    await playCaptureSound();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sliceSpy).toHaveBeenCalledTimes(2);
    expect(sliceSpy).toHaveBeenCalledWith(0);
    expect(first.ctx.resume).not.toHaveBeenCalled();
    expect(first.sources[0].start).toHaveBeenCalledWith(1.5, 0.48);
    expect(first.ctx.close).not.toHaveBeenCalled();

    first.sources[0].onended?.();
    expect(first.ctx.close).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(first.ctx.close).toHaveBeenCalledTimes(1);
    expect(second.ctx.close).toHaveBeenCalledTimes(1);
  });

  test('resumes suspended webkitAudioContext, skips trim for short clips, and uses fallback timer', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })),
    );
    const { ctx, sources } = createMockAudioContext('suspended', 0.3);
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal(
      'webkitAudioContext',
      vi.fn(function WebkitAudioContextMock() {
        return ctx;
      }),
    );

    const playCaptureSound = await importCaptureSound();
    await playCaptureSound();

    expect(ctx.resume).toHaveBeenCalledOnce();
    expect(sources[0].start).toHaveBeenCalledWith(1.5, 0);
    expect(ctx.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(450);
    expect(ctx.close).toHaveBeenCalledTimes(1);
  });

  test('retries after a failed fetch and closes context cleanly on decode/resume errors', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      });
    vi.stubGlobal('fetch', fetchSpy);

    const { ctx } = createMockAudioContext('suspended');
    ctx.resume.mockRejectedValueOnce(new Error('blocked'));
    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContextMock() {
        return ctx;
      }),
    );

    const playCaptureSound = await importCaptureSound();
    await expect(playCaptureSound()).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await expect(playCaptureSound()).resolves.toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(ctx.close).toHaveBeenCalledTimes(1);

    ctx.decodeAudioData.mockRejectedValueOnce(new Error('corrupt'));
    await expect(playCaptureSound()).resolves.toBeUndefined();
    expect(ctx.close).toHaveBeenCalledTimes(2);

    vi.stubGlobal(
      'AudioContext',
      vi.fn(function BrokenAudioContext() {
        throw new Error('unsupported');
      }),
    );
    await expect(playCaptureSound()).resolves.toBeUndefined();
  });
});
