import { beforeEach, expect, test, vi } from 'vitest';

const worker = {
  recognize: vi.fn(),
  setParameters: vi.fn(),
};
const createWorker = vi.fn();

vi.mock('tesseract.js', () => ({
  default: {
    createWorker: (...args: unknown[]) => createWorker(...args),
    OEM: { LSTM_ONLY: 1 },
    PSM: { AUTO: '3' },
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
  canvas.width = 2000;
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
  expect(worker.setParameters).toHaveBeenCalledWith({
    tessedit_pageseg_mode: '3',
    preserve_interword_spaces: '1',
  });
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
  canvas.width = 2000;
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

test('upscales small captures and maps boxes back to source pixels', async () => {
  createWorker.mockResolvedValue(worker);
  worker.recognize.mockResolvedValueOnce(
    page('Hi there', [
      { text: 'Hi', bbox: { x0: 20, y0: 40, x1: 60, y1: 80 } },
      { text: 'there', bbox: { x0: 80, y0: 44, x1: 180, y1: 84 } },
    ]),
  );
  const { recognize } = await import('../../../src/lib/Ocr');
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 100;
  const result = await recognize(canvas);
  const [band] = worker.recognize.mock.calls[0] as [HTMLCanvasElement];
  expect(band.width).toBe(400);
  expect(band.height).toBe(200);
  expect(result.words[0]).toEqual({
    text: 'Hi',
    x0: 10,
    y0: 20,
    x1: 30,
    y1: 40,
  });
  /** Line box hugs its words; word boxes share the line's vertical extent. */
  expect(result.blocks?.[0]).toMatchObject({
    text: 'Hi there',
    bbox: { x: 0.05, y: 0.2, width: 0.4, height: 0.22 },
    words: [
      { text: 'Hi', bbox: { x: 0.05, y: 0.2, width: 0.1, height: 0.22 } },
      { text: 'there', bbox: { x: 0.2, y: 0.2, width: 0.25, height: 0.22 } },
    ],
  });
});

test('splits words separated by wide column gaps into separate tight blocks', async () => {
  createWorker.mockResolvedValue(worker);
  worker.recognize.mockResolvedValueOnce(
    page('Left Right', [
      { text: 'Left', bbox: { x0: 20, y0: 20, x1: 60, y1: 36 } },
      { text: 'Right', bbox: { x0: 400, y0: 20, x1: 460, y1: 36 } },
    ]),
  );
  const { recognize } = await import('../../../src/lib/Ocr');
  const canvas = document.createElement('canvas');
  canvas.width = 2000;
  canvas.height = 100;
  const result = await recognize(canvas);
  expect(result.blocks).toHaveLength(2);
  expect(result.blocks?.[0]).toMatchObject({
    text: 'Left',
    bbox: { x: 20 / 2000, y: 20 / 100, width: 40 / 2000, height: 16 / 100 },
  });
  expect(result.blocks?.[1]).toMatchObject({
    text: 'Right',
    bbox: { x: 400 / 2000, y: 20 / 100, width: 60 / 2000, height: 16 / 100 },
  });
});

test('drops wide border artifacts and noise while keeping moderate-confidence multi-letter words', async () => {
  createWorker.mockResolvedValue(worker);
  const box = { x0: 0, y0: 0, x1: 10, y1: 10 };
  worker.recognize.mockResolvedValueOnce({
    data: {
      text: 'Save',
      blocks: [
        {
          paragraphs: [
            {
              lines: [
                {
                  words: [
                    { text: '|', confidence: 40, bbox: box },
                    {
                      text: 'Save',
                      confidence: 90,
                      bbox: { x0: 20, y0: 0, x1: 50, y1: 12 },
                    },
                    {
                      text: 'temporary',
                      confidence: 35,
                      bbox: { x0: 60, y0: 0, x1: 140, y1: 12 },
                    },
                    {
                      text: 'ETE',
                      confidence: 95,
                      bbox: { x0: 150, y0: 0, x1: 450, y1: 10 },
                    },
                    {
                      text: '→',
                      confidence: 80,
                      bbox: { x0: 145, y0: 0, x1: 155, y1: 12 },
                    },
                  ],
                },
                { words: [{ text: 'qx', confidence: 30, bbox: box }] },
                { words: [{ text: '→', confidence: 85, bbox: box }] },
              ],
            },
          ],
        },
      ],
    },
  });
  const { recognize } = await import('../../../src/lib/Ocr');
  const canvas = document.createElement('canvas');
  canvas.width = 2000;
  canvas.height = 100;
  const result = await recognize(canvas);
  expect(result.words.map((w) => w.text)).toEqual(['Save', 'temporary', '→']);
  expect(result.blocks).toHaveLength(1);
  expect(result.blocks?.[0].text).toBe('Save temporary →');
});

test('normalizes dark-background image data into dark-on-light contrast', async () => {
  createWorker.mockResolvedValue(worker);
  worker.recognize.mockResolvedValueOnce(page('Dark', []));

  const pixels = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    const px = i / 4;
    const isTextPx = px % 7 === 0;
    const val = isTextPx ? 180 : 16;
    pixels[i] = val;
    pixels[i + 1] = val;
    pixels[i + 2] = val;
    pixels[i + 3] = 255;
  }

  let written: Uint8ClampedArray | undefined;
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  const origPutImageData = CanvasRenderingContext2D.prototype.putImageData;
  const getSpy = vi
    .spyOn(CanvasRenderingContext2D.prototype, 'getImageData')
    .mockImplementation(function (
      this: CanvasRenderingContext2D,
      sx,
      sy,
      sw,
      sh,
    ) {
      const imgData = origGetImageData.call(this, sx, sy, sw, sh);
      if (sw === 64 && sh === 64) {
        imgData.data.set(pixels);
      }
      return imgData;
    });
  const putSpy = vi
    .spyOn(CanvasRenderingContext2D.prototype, 'putImageData')
    .mockImplementation(function (
      this: CanvasRenderingContext2D,
      imgData,
      ...rest
    ) {
      written = new Uint8ClampedArray(imgData.data);
      return origPutImageData.call(this, imgData, ...rest);
    });

  try {
    const { recognize } = await import('../../../src/lib/Ocr');
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    await recognize(canvas);
    expect(written).toBeDefined();
    /** Dark background pixel (16) becomes bright white (255), text pixel (180) becomes dark ink (0). */
    expect(written![4]).toBe(255);
    expect(written![0]).toBe(0);
  } finally {
    getSpy.mockRestore();
    putSpy.mockRestore();
  }
});
