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

  const { recognize } = await import('../../../src/lib/Ocr');
  const canvas = document.createElement('canvas');
  canvas.width = 50;
  canvas.height = 9000;
  const progress = vi.fn();
  const result = await recognize(canvas, progress);

  expect(createWorker).toHaveBeenCalledWith(
    ['eng', 'deu'],
    1,
    expect.objectContaining({
      workerPath: new URL('ocr/worker.min.js', location.href).href,
      corePath: new URL('ocr/tesseract-core-simd-lstm.wasm.js', location.href)
        .href,
      langPath: new URL('ocr', location.href).href,
      workerBlobURL: false,
      cacheMethod: 'none',
      gzip: true,
    }),
  );
  expect(worker.recognize).toHaveBeenCalledTimes(3);
  expect(progress).toHaveBeenCalledWith(0.5 / 3);
  expect(result.text).toBe('Hello world\n\nEnd');
  expect(result.words).toEqual([{ text: 'Hello', x0: 1, y0: 2, x1: 3, y1: 4 }]);

  /** Second call reuses the worker; words in later bands are offset by the band top. */
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
  const { recognize } = await import('../../../src/lib/Ocr');
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
  const { recognize } = await import('../../../src/lib/Ocr');
  const canvas = document.createElement('canvas');
  await expect(recognize(canvas)).rejects.toThrow('wasm blocked');
  await expect(recognize(canvas)).resolves.toMatchObject({ text: 'ok' });
  expect(createWorker).toHaveBeenCalledTimes(2);
});

test('recognizes mixed English and German text preserving umlauts in NFC', async () => {
  createWorker.mockResolvedValue(worker);
  const germanText = 'Grüße aus Köln: Über 100 Äpfel!';
  const decomposed = 'Gru\u0308ße aus Ko\u0308ln: U\u0308ber 100 A\u0308pfel!';
  worker.recognize.mockResolvedValueOnce(
    page(decomposed, [
      { text: 'Gru\u0308ße', bbox: { x0: 0, y0: 0, x1: 50, y1: 20 } },
      { text: 'aus', bbox: { x0: 60, y0: 0, x1: 90, y1: 20 } },
      { text: 'Ko\u0308ln:', bbox: { x0: 100, y0: 0, x1: 150, y1: 20 } },
      { text: 'U\u0308ber', bbox: { x0: 160, y0: 0, x1: 210, y1: 20 } },
      { text: '100', bbox: { x0: 220, y0: 0, x1: 250, y1: 20 } },
      { text: 'A\u0308pfel!', bbox: { x0: 260, y0: 0, x1: 320, y1: 20 } },
    ]),
  );
  const { recognize } = await import('../../../src/lib/Ocr');
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 100;
  const result = await recognize(canvas);

  expect(result.text).toBe(germanText);
  expect(result.text).toBe(result.text.normalize('NFC'));
  expect(result.words[0].text).toBe('Grüße');
  expect(result.words[2].text).toBe('Köln:');
  expect(result.words[3].text).toBe('Über');
  expect(result.words[5].text).toBe('Äpfel!');
  expect(result.blocks?.[0].text).toBe(germanText);
});
