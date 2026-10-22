import { beforeEach, expect, test, vi } from 'vitest';

const worker = {
  recognize: vi.fn(),
};
const createWorker = vi.fn();

vi.mock('tesseract.js', () => ({
  default: {
    createWorker: (...args: unknown[]) => createWorker(...args),
    OEM: { LSTM_ONLY: 1 },
  },
}));

const page = (
  text: string,
  words: {
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }[],
) => ({
  data: { text, blocks: [{ paragraphs: [{ lines: [{ words }] }] }] },
});

beforeEach(() => {
  vi.resetModules();
  createWorker.mockReset();
  worker.recognize.mockReset();
});

test('creates one local worker and reads tall canvases in bands', async () => {
  let logger: ((m: { status: string; progress: number }) => void) | undefined;
  createWorker.mockImplementation(async (_lang, _oem, options) => {
    logger = options.logger;
    return worker;
  });
  worker.recognize
    .mockImplementationOnce(async () => {
      logger?.({ status: 'loading', progress: 1 });
      logger?.({ status: 'recognizing text', progress: 0.5 });
      return page(' Hello world ', [
        { text: 'Hello', bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } },
        { text: ' ', bbox: { x0: 0, y0: 0, x1: 0, y1: 0 } },
      ]);
    })
    .mockResolvedValueOnce(page('', []))
    .mockResolvedValueOnce({ data: { text: 'End', blocks: null } });

  const { recognize } = await import('../../../src/lib/ocr');
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 9000;
  const progress = vi.fn();
  const result = await recognize(canvas, progress);

  expect(createWorker).toHaveBeenCalledWith(
    'eng',
    1,
    expect.objectContaining({
      workerPath: 'chrome-extension://ext-id/ocr/worker.min.js',
      corePath:
        'chrome-extension://ext-id/ocr/tesseract-core-simd-lstm.wasm.js',
      langPath: 'chrome-extension://ext-id/ocr',
      workerBlobURL: false,
      cacheMethod: 'none',
    }),
  );
  expect(worker.recognize).toHaveBeenCalledTimes(3);
  expect(progress).toHaveBeenCalledWith(0.5 / 3);
  expect(result.text).toBe('Hello world\n\nEnd');
  expect(result.words).toEqual([{ text: 'Hello', x0: 1, y0: 2, x1: 3, y1: 4 }]);

  // Second call reuses the worker; words in later bands are offset by the band top.
  worker.recognize.mockResolvedValueOnce(
    page('x', [{ text: 'x', bbox: { x0: 0, y0: 5, x1: 1, y1: 6 } }]),
  );
  canvas.height = 100;
  await recognize(canvas);
  expect(createWorker).toHaveBeenCalledOnce();
});

test('offsets words from later bands', async () => {
  createWorker.mockResolvedValue(worker);
  worker.recognize
    .mockResolvedValueOnce(page('', []))
    .mockResolvedValueOnce(
      page('b', [{ text: 'b', bbox: { x0: 0, y0: 10, x1: 5, y1: 20 } }]),
    );
  const { recognize } = await import('../../../src/lib/ocr');
  const canvas = document.createElement('canvas');
  canvas.height = 4500;
  expect((await recognize(canvas)).words[0]).toMatchObject({
    y0: 4010,
    y1: 4020,
  });
});

test('retries worker creation after a failure', async () => {
  createWorker
    .mockRejectedValueOnce(new Error('wasm blocked'))
    .mockResolvedValue(worker);
  worker.recognize.mockResolvedValue(page('ok', []));
  const { recognize } = await import('../../../src/lib/ocr');
  const canvas = document.createElement('canvas');
  await expect(recognize(canvas)).rejects.toThrow('wasm blocked');
  await expect(recognize(canvas)).resolves.toMatchObject({ text: 'ok' });
  expect(createWorker).toHaveBeenCalledTimes(2);
});
