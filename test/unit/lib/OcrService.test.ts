import { beforeEach, describe, expect, test, vi } from 'vitest';
import { OcrService, ocrService } from '../../../src/lib/OcrService';

vi.mock('../../../src/lib/Ocr', () => ({
  recognize: vi.fn(),
}));

describe('OcrService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('normalizeBbox computes coordinates relative to image dimensions', () => {
    const bbox = OcrService.normalizeBbox(
      { x0: 100, y0: 50, x1: 500, y1: 250 },
      1000,
      500,
    );
    expect(bbox).toEqual({
      x: 0.1,
      y: 0.1,
      width: 0.4,
      height: 0.4,
    });
  });

  test('normalizeBbox clamps out-of-bounds coordinates safely', () => {
    const bbox = OcrService.normalizeBbox(
      { x0: -50, y0: -20, x1: 1500, y1: 800 },
      1000,
      500,
    );
    expect(bbox.x).toBe(0);
    expect(bbox.y).toBe(0);
    expect(bbox.width).toBe(1);
    expect(bbox.height).toBe(1);
  });

  test('normalizeBbox avoids division by zero', () => {
    const bbox = OcrService.normalizeBbox(
      { x0: 0, y0: 0, x1: 10, y1: 10 },
      0,
      0,
    );
    expect(Number.isFinite(bbox.x)).toBe(true);
    expect(Number.isFinite(bbox.y)).toBe(true);
    expect(Number.isFinite(bbox.width)).toBe(true);
    expect(Number.isFinite(bbox.height)).toBe(true);
  });

  test('recognize returns normalized blocks when provided by OCR', async () => {
    const { recognize } = await import('../../../src/lib/Ocr');
    vi.mocked(recognize).mockResolvedValueOnce({
      text: 'Sample recognized text',
      words: [{ text: 'Sample', x0: 10, y0: 10, x1: 50, y1: 30 }],
      blocks: [
        {
          text: 'Sample recognized text',
          bbox: { x: 0.05, y: 0.1, width: 0.4, height: 0.08 },
          confidence: 96,
        },
      ],
    });

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;
    const progress = vi.fn();

    const result = await OcrService.recognize(canvas, progress);
    expect(result.text).toBe('Sample recognized text');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toEqual({
      text: 'Sample recognized text',
      bbox: { x: 0.05, y: 0.1, width: 0.4, height: 0.08 },
      confidence: 96,
    });
    expect(recognize).toHaveBeenCalledWith(canvas, progress);
  });

  test('recognize generates normalized fallback blocks from words if blocks are missing', async () => {
    const { recognize } = await import('../../../src/lib/Ocr');
    vi.mocked(recognize).mockResolvedValueOnce({
      text: 'Fallback text',
      words: [
        { text: 'Fallback', x0: 10, y0: 20, x1: 90, y1: 40 },
        { text: 'text', x0: 100, y0: 20, x1: 150, y1: 40 },
      ],
    });

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 100;

    const result = await ocrService.recognize(canvas);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]).toEqual({
      text: 'Fallback',
      bbox: {
        x: 10 / 200,
        y: 20 / 100,
        width: 80 / 200,
        height: 20 / 100,
      },
    });
    expect(result.blocks[1]).toEqual({
      text: 'text',
      bbox: {
        x: 100 / 200,
        y: 20 / 100,
        width: 50 / 200,
        height: 20 / 100,
      },
    });
  });

  test('propagates errors from the OCR engine', async () => {
    const { recognize } = await import('../../../src/lib/Ocr');
    vi.mocked(recognize).mockRejectedValueOnce(new Error('OCR engine failed'));

    const canvas = document.createElement('canvas');
    await expect(OcrService.recognize(canvas)).rejects.toThrow(
      'OCR engine failed',
    );
  });

  test('normalizes German umlauts and special characters into NFC form', async () => {
    const { recognize } = await import('../../../src/lib/Ocr');
    const decomposedBlock =
      'Spa\u0308ti & Scho\u0308nheit: Fu\u0308ße, A\u0308pfel, O\u0308l und U\u0308bung!';
    const expectedNfc = 'Späti & Schönheit: Füße, Äpfel, Öl und Übung!';

    vi.mocked(recognize).mockResolvedValueOnce({
      text: decomposedBlock,
      words: [{ text: 'Fu\u0308ße', x0: 10, y0: 10, x1: 50, y1: 30 }],
      blocks: [
        {
          text: decomposedBlock,
          bbox: { x: 0.1, y: 0.1, width: 0.8, height: 0.1 },
        },
      ],
    });

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;

    const result = await OcrService.recognize(canvas);
    expect(result.text).toBe(expectedNfc);
    expect(result.blocks[0].text).toBe(expectedNfc);
    expect(result.words[0].text).toBe('Füße');
    expect(result.blocks[0].text).not.toContain('\u0308');
  });

  test('normalizes universal Latin-alphabet scripts and diacritics into NFC form', async () => {
    const { recognize } = await import('../../../src/lib/Ocr');
    /** Decomposed characters across French, Spanish, Nordic, Polish, Czech, Turkish */
    const decomposedText =
      'cafe\u0301, man\u0303ana, smo\u0308rga\u030Asbord, z\u0307az\u0307o\u0301\u0142c\u0301, pr\u030Ci\u0301lis\u030C, tes\u0327ekku\u0308rler';
    const expectedNfc =
      'café, mañana, smörgåsbord, żażółć, příliš, teşekkürler';

    vi.mocked(recognize).mockResolvedValueOnce({
      text: decomposedText,
      words: [{ text: 'cafe\u0301', x0: 5, y0: 5, x1: 25, y1: 15 }],
      blocks: [
        {
          text: decomposedText,
          bbox: { x: 0.05, y: 0.1, width: 0.9, height: 0.1 },
        },
      ],
    });

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;

    const result = await OcrService.recognize(canvas);
    expect(result.text).toBe(expectedNfc);
    expect(result.blocks[0].text).toBe(expectedNfc);
    expect(result.words[0].text).toBe('café');
  });

  test('falls back to word-level blocks when blocks are empty or omitted', async () => {
    const { recognize } = await import('../../../src/lib/Ocr');
    vi.mocked(recognize).mockResolvedValueOnce({
      text: 'Fallback text',
      words: [{ text: 'Fallback', x0: 10, y0: 10, x1: 50, y1: 30 }],
      blocks: [],
    });

    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;

    const result = await OcrService.recognize(canvas);
    expect(result.text).toBe('Fallback text');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].text).toBe('Fallback');
    expect(result.words).toHaveLength(1);
  });
});
