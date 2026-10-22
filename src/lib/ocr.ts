import type Tesseract from 'tesseract.js';

/** A recognized word; box in source-canvas pixels. */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

// ponytail: words crossing a band edge may be split or missed; overlapping bands would fix it.
const BAND = 4000;
let worker: Promise<Tesseract.Worker> | undefined;
let onProgress: ((p: number) => void) | undefined;

function getWorker() {
  worker ??= import('tesseract.js')
    .then(({ default: T }) =>
      T.createWorker('eng', T.OEM.LSTM_ONLY, {
        workerPath: chrome.runtime.getURL('ocr/worker.min.js'),
        corePath: chrome.runtime.getURL('ocr/tesseract-core-simd-lstm.wasm.js'),
        langPath: chrome.runtime.getURL('ocr'),
        // Extension CSP blocks blob: workers; the model is bundled, so skip the IndexedDB cache.
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: (m) =>
          m.status === 'recognizing text' && onProgress?.(m.progress),
      }),
    )
    .catch((e) => {
      worker = undefined;
      throw e;
    });
  return worker;
}

/** Reads English text from `canvas`, in bands so tall captures stay within memory. Runs fully on-device. */
export async function recognize(
  canvas: HTMLCanvasElement,
  progress?: (p: number) => void,
) {
  const w = await getWorker();
  const band = document.createElement('canvas');
  band.width = canvas.width;
  const total = Math.ceil(canvas.height / BAND);
  const words: OcrWord[] = [];
  const texts: string[] = [];
  try {
    for (let i = 0; i < total; i++) {
      const top = i * BAND;
      band.height = Math.min(BAND, canvas.height - top);
      band
        .getContext('2d')!
        .drawImage(
          canvas,
          0,
          top,
          band.width,
          band.height,
          0,
          0,
          band.width,
          band.height,
        );
      onProgress = (p) => progress?.((i + p) / total);
      const { data } = await w.recognize(
        band,
        {},
        { text: true, blocks: true },
      );
      texts.push(data.text.trim());
      for (const block of data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines)
            for (const word of line.words) {
              if (!word.text.trim()) continue;
              const { x0, y0, x1, y1 } = word.bbox;
              words.push({
                text: word.text,
                x0,
                y0: y0 + top,
                x1,
                y1: y1 + top,
              });
            }
    }
  } finally {
    onProgress = undefined;
  }
  return { text: texts.filter(Boolean).join('\n\n'), words };
}
