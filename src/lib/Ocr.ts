import type Tesseract from 'tesseract.js';

/** A recognized word; box in source-canvas pixels. */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Represents a single recognized text region normalized to image dimensions. */
export interface RecognizedTextBlock {
  text: string;
  /** Normalized coordinates (0 to 1) relative to the source image dimensions */
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  blocks?: RecognizedTextBlock[];
}

/** Words crossing a band edge may be split or missed; overlapping bands would fix it. */
const BAND = 4000;
let worker: Promise<Tesseract.Worker> | undefined;
let onProgress: ((p: number) => void) | undefined;
/** Pages sit at the root of the extension and the desktop app, next to ocr/. */
const asset = (path: string) => new URL(path, location.href).href;

/**
 * Initializes a 100% offline bilingual (English + German) OCR worker
 * using locally bundled WASM core and traineddata models.
 */
function getWorker() {
  worker ??= import('tesseract.js')
    .then(({ default: T }) =>
      T.createWorker(['eng', 'deu'], T.OEM.LSTM_ONLY, {
        workerPath: asset('ocr/worker.min.js'),
        corePath: asset('ocr/tesseract-core-simd-lstm.wasm.js'),
        langPath: asset('ocr'),
        gzip: true,
        /** Extension CSP blocks blob: workers; the model is bundled, so skip the IndexedDB cache. */
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

/** Reads mixed English and German text from `canvas`, in bands so tall captures stay within memory. Runs fully on-device. */
export async function recognize(
  canvas: HTMLCanvasElement,
  progress?: (p: number) => void,
): Promise<OcrResult> {
  const w = await getWorker();
  const band = document.createElement('canvas');
  band.width = canvas.width;
  const total = Math.ceil(canvas.height / BAND);
  const words: OcrWord[] = [];
  const blocks: RecognizedTextBlock[] = [];
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
      texts.push(data.text.trim().normalize('NFC'));
      for (const block of data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines) {
            const lineWords: OcrWord[] = [];
            for (const word of line.words) {
              const wordTrimmed = word.text.trim().normalize('NFC');
              if (!wordTrimmed) continue;
              const { x0, y0, x1, y1 } = word.bbox;
              const wObj: OcrWord = {
                text: wordTrimmed,
                x0,
                y0: y0 + top,
                x1,
                y1: y1 + top,
              };
              words.push(wObj);
              lineWords.push(wObj);
            }
            const lineText = (
              line.text?.trim() ||
              lineWords
                .map((w) => w.text)
                .join(' ')
                .trim()
            ).normalize('NFC');
            if (lineText && (line.bbox || lineWords.length > 0)) {
              const lx0 =
                line.bbox?.x0 ?? Math.min(...lineWords.map((w) => w.x0));
              const ly0 =
                (line.bbox
                  ? line.bbox.y0
                  : Math.min(...lineWords.map((w) => w.y0 - top))) + top;
              const lx1 =
                line.bbox?.x1 ?? Math.max(...lineWords.map((w) => w.x1));
              const ly1 =
                (line.bbox
                  ? line.bbox.y1
                  : Math.max(...lineWords.map((w) => w.y1 - top))) + top;
              const imgW = Math.max(1, canvas.width);
              const imgH = Math.max(1, canvas.height);
              const x0 = Math.min(Math.max(lx0, 0), imgW);
              const y0 = Math.min(Math.max(ly0, 0), imgH);
              const x1 = Math.min(Math.max(lx1, 0), imgW);
              const y1 = Math.min(Math.max(ly1, 0), imgH);
              blocks.push({
                text: lineText,
                bbox: {
                  x: x0 / imgW,
                  y: y0 / imgH,
                  width: Math.max(0, (x1 - x0) / imgW),
                  height: Math.max(0, (y1 - y0) / imgH),
                },
                confidence: line.confidence,
              });
            }
          }
    }
  } finally {
    onProgress = undefined;
  }
  return {
    text: texts.filter(Boolean).join('\n\n').normalize('NFC'),
    words,
    blocks,
  };
}
