import { recognize, type OcrWord } from './Ocr';

/**
 * Represents a single recognized text region normalized to image dimensions.
 */
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

export interface OcrServiceResult {
  text: string;
  blocks: RecognizedTextBlock[];
  words: OcrWord[];
}

export class OcrService {
  /**
   * Normalizes pixel bounding box to percentage coordinates (0..1) relative to image dimensions.
   */
  static normalizeBbox(
    bbox: { x0: number; y0: number; x1: number; y1: number },
    imageWidth: number,
    imageHeight: number,
  ): RecognizedTextBlock['bbox'] {
    const w = Math.max(1, imageWidth);
    const h = Math.max(1, imageHeight);
    const x0 = Math.min(Math.max(bbox.x0, 0), w);
    const y0 = Math.min(Math.max(bbox.y0, 0), h);
    const x1 = Math.min(Math.max(bbox.x1, 0), w);
    const y1 = Math.min(Math.max(bbox.y1, 0), h);
    return {
      x: x0 / w,
      y: y0 / h,
      width: Math.max(0, (x1 - x0) / w),
      height: Math.max(0, (y1 - y0) / h),
    };
  }

  /**
   * Recognizes text from a canvas using on-device OCR.
   * Returns normalized bounding boxes for recognized text blocks.
   */
  static async recognize(
    canvas: HTMLCanvasElement,
    progress?: (p: number) => void,
  ): Promise<OcrServiceResult> {
    const res = await recognize(canvas, progress);
    const w = canvas.width;
    const h = canvas.height;

    if (res.blocks && res.blocks.length > 0) {
      return {
        text: res.text.normalize('NFC'),
        blocks: res.blocks.map((b) => ({
          ...b,
          text: b.text.normalize('NFC'),
        })),
        words: (res.words ?? []).map((w) => ({
          ...w,
          text: w.text.normalize('NFC'),
        })),
      };
    }

    const blocks: RecognizedTextBlock[] = (res.words ?? []).map((word) => ({
      text: word.text.normalize('NFC'),
      bbox: OcrService.normalizeBbox(word, w, h),
    }));

    return {
      text: res.text.normalize('NFC'),
      blocks,
      words: (res.words ?? []).map((w) => ({
        ...w,
        text: w.text.normalize('NFC'),
      })),
    };
  }

  async recognize(
    canvas: HTMLCanvasElement,
    progress?: (p: number) => void,
  ): Promise<OcrServiceResult> {
    return OcrService.recognize(canvas, progress);
  }
}

export const ocrService = new OcrService();
