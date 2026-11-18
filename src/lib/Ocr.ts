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
  /** Per-word boxes so the overlay can align selectable glyphs with the image. */
  words?: RecognizedWord[];
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  blocks?: RecognizedTextBlock[];
}

/** A word inside a recognized line; box normalized (0 to 1) to the source image. */
export interface RecognizedWord {
  text: string;
  bbox: RecognizedTextBlock['bbox'];
}

/** Words crossing a band edge may be split or missed; overlapping bands would fix it. */
const BAND = 4000;
/** Captures narrower than this are upscaled 2x: Tesseract needs ~20px x-height, 1x UI text is ~7px. */
const UPSCALE_BELOW = 1920;
/** Tile size (band pixels) for local background and dynamic-range normalization. */
const NORM_TILE = 48;
/** Minimum horizontal gap factor relative to line height that splits separate UI columns. */
const COLUMN_GAP_FACTOR = 1.5;
/** Minimum absolute source-pixel gap that splits separate UI columns on small text. */
const COLUMN_GAP_MIN_PX = 14;
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
    .then(async ({ default: T }) => {
      const w = await T.createWorker(['eng', 'deu'], T.OEM.LSTM_ONLY, {
        workerPath: asset('ocr/worker.min.js'),
        corePath: asset('ocr/tesseract-core-simd-lstm.wasm.js'),
        langPath: asset('ocr'),
        gzip: true,
        /** Extension CSP blocks blob: workers; the model is bundled, so skip the IndexedDB cache. */
        workerBlobURL: false,
        cacheMethod: 'none',
        logger: (m) =>
          m.status === 'recognizing text' && onProgress?.(m.progress),
      });
      /** Tesseract defaults to a single uniform block, which merges side-by-side columns into one line. */
      await w.setParameters({
        tessedit_pageseg_mode: T.PSM.AUTO,
        preserve_interword_spaces: '1',
      });
      return w;
    })
    .catch((e) => {
      worker = undefined;
      throw e;
    });
  return worker;
}

/** Normalizes each tile's local background and foreground contrast into dark-on-light grayscale. */
function normalizeBand(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return;
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;
  const luma = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    luma[p] = (54 * d[i] + 183 * d[i + 1] + 19 * d[i + 2]) >> 8;
  }

  const tw = Math.ceil(width / NORM_TILE);
  const th = Math.ceil(height / NORM_TILE);
  const bgGrid = new Float32Array(tw * th);
  const rangeGrid = new Float32Array(tw * th);
  const hist = new Uint32Array(256);
  let maxSpan = 0;

  for (let ty = 0; ty < th; ty++) {
    const y0 = ty * NORM_TILE;
    const y1 = Math.min(height, y0 + NORM_TILE);
    for (let tx = 0; tx < tw; tx++) {
      const x0 = tx * NORM_TILE;
      const x1 = Math.min(width, x0 + NORM_TILE);
      hist.fill(0);
      let count = 0;
      const stepY = y1 - y0 >= 4 ? 2 : 1;
      const stepX = x1 - x0 >= 4 ? 2 : 1;
      for (let y = y0; y < y1; y += stepY) {
        let row = y * width + x0;
        for (let x = x0; x < x1; x += stepX, row += stepX) {
          hist[luma[row]]++;
          count++;
        }
      }
      if (count === 0) continue;
      let acc = 0;
      let p2 = 0;
      let med = 0;
      let p98 = 255;
      let got2 = false;
      let got50 = false;
      const t2 = count * 0.02;
      const t50 = count * 0.5;
      const t98 = count * 0.98;
      for (let v = 0; v < 256; v++) {
        acc += hist[v];
        if (!got2 && acc >= t2) {
          p2 = v;
          got2 = true;
        }
        if (!got50 && acc >= t50) {
          med = v;
          got50 = true;
        }
        if (acc >= t98) {
          p98 = v;
          break;
        }
      }
      maxSpan = Math.max(maxSpan, p98 - p2);
      const idx = ty * tw + tx;
      bgGrid[idx] = med;
      const span = med < 128 ? p98 - med : med - p2;
      rangeGrid[idx] = Math.min(90, Math.max(38, span));
    }
  }

  /** Uniform or blank canvas (including unbacked test canvases): skip pixel rewrite. */
  if (maxSpan === 0) return;

  const bilerp = (grid: Float32Array, gx: number, gy: number) => {
    const tx0 = Math.floor(gx);
    const ty0 = Math.floor(gy);
    const tx1 = Math.min(tw - 1, tx0 + 1);
    const ty1 = Math.min(th - 1, ty0 + 1);
    const fx = gx - tx0;
    const fy = gy - ty0;
    const v00 = grid[ty0 * tw + tx0];
    const v10 = grid[ty0 * tw + tx1];
    const v01 = grid[ty1 * tw + tx0];
    const v11 = grid[ty1 * tw + tx1];
    return (
      (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy
    );
  };

  for (let y = 0; y < height; y++) {
    const gy = Math.min(th - 1, Math.max(0, y / NORM_TILE - 0.5));
    for (let x = 0; x < width; x++) {
      const gx = Math.min(tw - 1, Math.max(0, x / NORM_TILE - 0.5));
      const bg = bilerp(bgGrid, gx, gy);
      const range = bilerp(rangeGrid, gx, gy);
      const L = luma[y * width + x];
      const delta = bg < 128 ? Math.max(0, L - bg) : Math.max(0, bg - L);
      const norm = Math.min(1, Math.max(0, (delta - 7) / range));
      const v = Math.round(255 * (1 - norm));
      const idx = (y * width + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = v;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/** Keeps real words, dropping wide border artifacts and low-confidence noise while preserving longer words. */
function isWord(
  text: string,
  confidence: number,
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return false;
  if (width / Math.max(1, text.length) > height * 2.5) return false;
  const alnum = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (alnum >= 3) return confidence >= 20;
  if (alnum >= 1) return confidence >= 50;
  return confidence >= 65;
}

/** Filters single-token segments that are pure symbols or low-confidence single characters. */
function isSegment(seg: { text: string; confidence: number }[]) {
  if (seg.length > 1) return true;
  const { text, confidence } = seg[0];
  const alnum = (text.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (alnum === 0) return false;
  if (text.length === 1) return confidence >= 75;
  return true;
}

/** Reads mixed English and German text from `canvas`, in bands so tall captures stay within memory. Runs fully on-device. */
export async function recognize(
  canvas: HTMLCanvasElement,
  progress?: (p: number) => void,
): Promise<OcrResult> {
  const w = await getWorker();
  const factor = canvas.width < UPSCALE_BELOW ? 2 : 1;
  const rows = Math.floor(BAND / factor);
  const imgW = Math.max(1, canvas.width);
  const imgH = Math.max(1, canvas.height);
  const band = document.createElement('canvas');
  band.width = canvas.width * factor;
  const total = Math.ceil(canvas.height / rows);
  const words: OcrWord[] = [];
  const blocks: RecognizedTextBlock[] = [];
  const texts: string[] = [];
  const clampX = (v: number) => Math.min(Math.max(v, 0), imgW);
  const clampY = (v: number) => Math.min(Math.max(v, 0), imgH);
  const norm = (x0: number, y0: number, x1: number, y1: number) => ({
    x: clampX(x0) / imgW,
    y: clampY(y0) / imgH,
    width: Math.max(0, clampX(x1) - clampX(x0)) / imgW,
    height: Math.max(0, clampY(y1) - clampY(y0)) / imgH,
  });
  try {
    for (let i = 0; i < total; i++) {
      const top = i * rows;
      const height = Math.min(rows, canvas.height - top);
      band.height = height * factor;
      const ctx = band.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        canvas,
        0,
        top,
        canvas.width,
        height,
        0,
        0,
        band.width,
        band.height,
      );
      /** Normalize mixed dark/light panels locally into uniform dark-on-light grayscale. */
      normalizeBand(ctx, band.width, band.height);
      onProgress = (p) => progress?.((i + p) / total);
      const { data } = await w.recognize(
        band,
        {},
        { text: true, blocks: true },
      );
      texts.push(data.text.trim().normalize('NFC'));
      /** Maps band pixels back to source-canvas pixels. */
      const sx = (v: number) => v / factor;
      const sy = (v: number) => v / factor + top;
      for (const block of data.blocks ?? [])
        for (const para of block.paragraphs)
          for (const line of para.lines) {
            type Candidate = OcrWord & { confidence: number };
            const lineWords: Candidate[] = [];
            for (const word of line.words) {
              const text = word.text.trim().normalize('NFC');
              if (!text) continue;
              const { x0, y0, x1, y1 } = word.bbox;
              const wx0 = sx(x0);
              const wy0 = sy(y0);
              const wx1 = sx(x1);
              const wy1 = sy(y1);
              const confidence = word.confidence ?? 100;
              if (!isWord(text, confidence, wx1 - wx0, wy1 - wy0)) continue;
              lineWords.push({
                text,
                x0: wx0,
                y0: wy0,
                x1: wx1,
                y1: wy1,
                confidence,
              });
            }
            if (!lineWords.length) continue;

            /** Split words separated by wide UI column gaps or vertical offsets into separate blocks. */
            const segments: Candidate[][] = [];
            let current: Candidate[] = [lineWords[0]];
            for (let j = 1; j < lineWords.length; j++) {
              const prev = current[current.length - 1];
              const next = lineWords[j];
              const h = Math.max(prev.y1 - prev.y0, next.y1 - next.y0, 8);
              const gap = next.x0 - prev.x1;
              const dy = Math.abs(
                (next.y0 + next.y1) / 2 - (prev.y0 + prev.y1) / 2,
              );
              if (
                gap > Math.max(h * COLUMN_GAP_FACTOR, COLUMN_GAP_MIN_PX) ||
                dy > h * 0.6
              ) {
                segments.push(current);
                current = [next];
              } else {
                current.push(next);
              }
            }
            segments.push(current);

            for (const seg of segments) {
              if (!isSegment(seg)) continue;
              for (const wItem of seg) {
                words.push({
                  text: wItem.text,
                  x0: wItem.x0,
                  y0: wItem.y0,
                  x1: wItem.x1,
                  y1: wItem.y1,
                });
              }
              /** Segment box hugs the kept words in that column so gaps stay unshaded. */
              const lx0 = Math.min(...seg.map((wItem) => wItem.x0));
              const ly0 = Math.min(...seg.map((wItem) => wItem.y0));
              const lx1 = Math.max(...seg.map((wItem) => wItem.x1));
              const ly1 = Math.max(...seg.map((wItem) => wItem.y1));
              blocks.push({
                text: seg.map((wItem) => wItem.text).join(' '),
                bbox: norm(lx0, ly0, lx1, ly1),
                confidence: line.confidence,
                words: seg.map((wItem) => ({
                  text: wItem.text,
                  bbox: norm(wItem.x0, ly0, wItem.x1, ly1),
                })),
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
