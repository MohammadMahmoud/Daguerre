import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  documentTitle,
  formatImportSummary,
  importDocuments,
  isPdfDocument,
  isSupportedDocument,
  MAX_IMPORT_BYTES,
  MAX_PDF_PAGES,
  normalizeImageToPng,
  renderPdfPages,
} from '../../../src/desktop/DocumentImport';
import { clearShots, getShot, listShots } from '../../../src/lib/Db';
import { imageBlob } from '../../Setup';

const getDocumentMock = vi.fn();

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: (...args: unknown[]) => getDocumentMock(...args),
}));

vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({
  default: 'mock-pdf-worker.mjs',
}));

function makePdfMock(numPages: number, options?: { failPage?: number }) {
  const docCleanup = vi.fn().mockResolvedValue(undefined);
  const taskDestroy = vi.fn().mockResolvedValue(undefined);
  const pageCleanups: ReturnType<typeof vi.fn>[] = [];

  const doc = {
    numPages,
    cleanup: docCleanup,
    getPage: vi.fn(async (pageNumber: number) => {
      if (options?.failPage === pageNumber) {
        throw new Error(`Failed on page ${pageNumber}`);
      }
      const cleanup = vi.fn();
      pageCleanups.push(cleanup);
      return {
        getViewport: ({ scale }: { scale: number }) => ({
          width: 600 * scale,
          height: 800 * scale,
        }),
        render: vi.fn(() => ({
          promise: Promise.resolve(),
        })),
        cleanup,
      };
    }),
  };

  return {
    doc,
    docCleanup,
    taskDestroy,
    pageCleanups,
    loadingTask: {
      promise: Promise.resolve(doc),
      destroy: taskDestroy,
    },
  };
}

beforeEach(async () => {
  await clearShots();
  getDocumentMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Document type and title helpers', () => {
  test('identifies PDFs by MIME type or extension', () => {
    expect(isPdfDocument({ name: 'report.pdf', type: '' })).toBe(true);
    expect(
      isPdfDocument({ name: 'REPORT.PDF', type: 'application/octet-stream' }),
    ).toBe(true);
    expect(isPdfDocument({ name: 'doc', type: 'application/pdf' })).toBe(true);
    expect(isPdfDocument({ name: 'photo.png', type: 'image/png' })).toBe(false);
  });

  test('identifies supported images and rejects non-document files', () => {
    for (const name of [
      'a.png',
      'b.jpg',
      'c.jpeg',
      'd.webp',
      'e.gif',
      'f.bmp',
      'g.tif',
      'h.tiff',
      'i.avif',
      'j.svg',
      'k.ico',
      'l.heic',
      'm.heif',
      'n.pdf',
    ]) {
      expect(isSupportedDocument({ name, type: '' }), name).toBe(true);
    }
    expect(isSupportedDocument({ name: 'blob', type: 'image/custom' })).toBe(
      true,
    );
    expect(isSupportedDocument({ name: 'notes.txt', type: 'text/plain' })).toBe(
      false,
    );
    expect(
      isSupportedDocument({ name: 'archive.zip', type: 'application/zip' }),
    ).toBe(false);
  });

  test('derives clean titles from filenames', () => {
    expect(documentTitle('Quarterly Report.v2.pdf')).toBe(
      'Quarterly Report.v2',
    );
    expect(documentTitle('  screenshot.png  ')).toBe('screenshot');
    expect(documentTitle('README')).toBe('README');
    expect(documentTitle('.hidden')).toBe('.hidden');
    expect(documentTitle('   ')).toBe('Uploaded document');
  });
});

describe('Image normalization', () => {
  test('preserves valid PNG blobs without re-encoding', async () => {
    const png = imageBlob(640, 480, 'image/png');
    const out = await normalizeImageToPng(png);
    expect(out).toBe(png);
  });

  test('converts non-PNG images to PNG via canvas', async () => {
    const jpg = imageBlob(800, 600, 'image/jpeg');
    const out = await normalizeImageToPng(jpg);
    expect(out).not.toBe(jpg);
    expect(out.type).toBe('image/png');
    const bmp = await createImageBitmap(out);
    expect([bmp.width, bmp.height]).toEqual([800, 600]);
    bmp.close();
  });

  test('falls back to Image element when createImageBitmap rejects (e.g. SVG)', async () => {
    vi.spyOn(globalThis, 'createImageBitmap').mockRejectedValueOnce(
      new Error('SVG unsupported by createImageBitmap'),
    );
    const originalImage = globalThis.Image;
    function MockImage() {
      const img = document.createElement('img');
      Object.defineProperties(img, {
        naturalWidth: { value: 320, configurable: true },
        naturalHeight: { value: 180, configurable: true },
        width: { value: 320, configurable: true },
        height: { value: 180, configurable: true },
      });
      Object.defineProperty(img, 'src', {
        configurable: true,
        set() {
          setTimeout(() => img.onload?.(new Event('load') as any), 0);
        },
      });
      return img;
    }
    vi.stubGlobal('Image', MockImage as unknown as typeof Image);
    try {
      const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], {
        type: 'image/svg+xml',
      });
      const out = await normalizeImageToPng(svg);
      expect(out.type).toBe('image/png');
    } finally {
      vi.stubGlobal('Image', originalImage);
    }
  });

  test('rejects when both createImageBitmap and Image element fail to decode', async () => {
    vi.spyOn(globalThis, 'createImageBitmap').mockRejectedValueOnce(
      new Error('Bad bitmap'),
    );
    const originalImage = globalThis.Image;
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal('Image', FailingImage as unknown as typeof Image);
    try {
      await expect(
        normalizeImageToPng(new Blob(['corrupt'], { type: 'image/jpeg' })),
      ).rejects.toThrow('Could not decode image.');
    } finally {
      vi.stubGlobal('Image', originalImage);
    }
  });

  test('rejects zero-dimension images', async () => {
    const empty = imageBlob(0, 0, 'image/png');
    const originalImage = globalThis.Image;
    class ZeroImage {
      naturalWidth = 0;
      naturalHeight = 0;
      width = 0;
      height = 0;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    vi.stubGlobal('Image', ZeroImage as unknown as typeof Image);
    try {
      await expect(normalizeImageToPng(empty)).rejects.toThrow(
        'Invalid image dimensions.',
      );
    } finally {
      vi.stubGlobal('Image', originalImage);
    }
  });
});

describe('PDF rendering', () => {
  test('renders a single-page PDF keeping the base title and cleans up', async () => {
    const mock = makePdfMock(1);
    getDocumentMock.mockReturnValueOnce(mock.loadingTask);
    const pdf = new File(['%PDF-1.4'], 'Invoice.pdf', {
      type: 'application/pdf',
    });

    const rendered = await renderPdfPages(pdf, 'Invoice');
    expect(rendered.totalPages).toBe(1);
    expect(rendered.truncated).toBe(false);
    expect(rendered.pages).toHaveLength(1);
    expect(rendered.pages[0].title).toBe('Invoice');
    expect(rendered.pages[0].blob.type).toBe('image/png');
    expect(mock.pageCleanups[0]).toHaveBeenCalledOnce();
    expect(mock.docCleanup).toHaveBeenCalledOnce();
    expect(mock.taskDestroy).toHaveBeenCalledOnce();
  });

  test('caps rendered PDF pages at MAX_PDF_PAGES and marks truncation', async () => {
    const mock = makePdfMock(MAX_PDF_PAGES + 4);
    getDocumentMock.mockReturnValueOnce(mock.loadingTask);
    const pdf = new File(['%PDF-1.4'], 'Manual.pdf', {
      type: 'application/pdf',
    });

    const rendered = await renderPdfPages(pdf, 'Manual');
    expect(rendered.totalPages).toBe(MAX_PDF_PAGES + 4);
    expect(rendered.truncated).toBe(true);
    expect(rendered.pages).toHaveLength(MAX_PDF_PAGES);
    expect(rendered.pages[0].title).toBe('Manual (Page 1)');
    expect(rendered.pages[MAX_PDF_PAGES - 1].title).toBe(
      `Manual (Page ${MAX_PDF_PAGES})`,
    );
    expect(mock.taskDestroy).toHaveBeenCalledOnce();
  });

  test('destroys loading task when rendering a page fails', async () => {
    const mock = makePdfMock(2, { failPage: 2 });
    getDocumentMock.mockReturnValueOnce(mock.loadingTask);
    const pdf = new File(['%PDF-1.4'], 'Broken.pdf', {
      type: 'application/pdf',
    });

    await expect(renderPdfPages(pdf, 'Broken')).rejects.toThrow(
      'Failed on page 2',
    );
    expect(mock.docCleanup).toHaveBeenCalledOnce();
    expect(mock.taskDestroy).toHaveBeenCalledOnce();
  });
});

describe('importDocuments and summary formatting', () => {
  test('imports images and multi-page PDFs into History with Page 1 first', async () => {
    const mock = makePdfMock(3);
    getDocumentMock.mockReturnValueOnce(mock.loadingTask);

    const imageFile = new File(['img'], 'Architecture.webp', {
      type: 'image/webp',
    });
    const pdfFile = new File(['%PDF-1.4'], 'Spec.pdf', {
      type: 'application/pdf',
    });

    const result = await importDocuments([imageFile, pdfFile]);
    expect(result.ids).toHaveLength(4);
    expect(result.titles).toEqual([
      'Architecture',
      'Spec (Page 1)',
      'Spec (Page 2)',
      'Spec (Page 3)',
    ]);
    expect(result).toMatchObject({
      skippedUnsupported: 0,
      skippedTooLarge: 0,
      failed: 0,
      truncatedPdfPages: 0,
    });

    const p1 = await getShot(result.ids[1]);
    const p2 = await getShot(result.ids[2]);
    const p3 = await getShot(result.ids[3]);
    expect(p1?.mode).toBe('upload');
    expect(p1!.createdAt).toBeGreaterThan(p2!.createdAt);
    expect(p2!.createdAt).toBeGreaterThan(p3!.createdAt);

    const all = await listShots();
    expect(
      all.filter((s) => s.title.startsWith('Spec')).map((s) => s.title),
    ).toEqual(['Spec (Page 1)', 'Spec (Page 2)', 'Spec (Page 3)']);
  });

  test('skips unsupported files, oversized files, and failed decodes cleanly', async () => {
    const valid = new File(['png'], 'Diagram.png', { type: 'image/png' });
    const unsupported = new File(['hello'], 'readme.txt', {
      type: 'text/plain',
    });
    const oversized = new File(['big'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: MAX_IMPORT_BYTES + 1 });

    const brokenPdf = new File(['bad'], 'Corrupt.pdf', {
      type: 'application/pdf',
    });
    getDocumentMock.mockImplementationOnce(() => ({
      promise: Promise.reject(new Error('Invalid PDF')),
      destroy: vi.fn().mockResolvedValue(undefined),
    }));

    const result = await importDocuments([
      valid,
      unsupported,
      oversized,
      brokenPdf,
    ]);
    expect(result.ids).toHaveLength(1);
    expect(result.titles).toEqual(['Diagram']);
    expect(result.skippedUnsupported).toBe(1);
    expect(result.skippedTooLarge).toBe(1);
    expect(result.failed).toBe(1);
    expect(formatImportSummary(result)).toBe(
      'Added "Diagram" (1 unsupported skipped, 1 over 50 MB skipped, 1 couldn\'t be opened)',
    );
  });

  test('formats concise summaries for every outcome', () => {
    expect(
      formatImportSummary({
        ids: ['1'],
        titles: ['Deck'],
        skippedUnsupported: 0,
        skippedTooLarge: 0,
        failed: 0,
        truncatedPdfPages: 0,
      }),
    ).toBe('Added "Deck"');

    expect(
      formatImportSummary({
        ids: ['1', '2'],
        titles: ['A', 'B'],
        skippedUnsupported: 0,
        skippedTooLarge: 0,
        failed: 0,
        truncatedPdfPages: 3,
      }),
    ).toBe('Added 2 items (3 PDF pages beyond 25 skipped)');

    expect(
      formatImportSummary({
        ids: [],
        titles: [],
        skippedUnsupported: 2,
        skippedTooLarge: 0,
        failed: 0,
        truncatedPdfPages: 0,
      }),
    ).toBe('Unsupported file type. Drop or choose images or PDFs.');

    expect(
      formatImportSummary({
        ids: [],
        titles: [],
        skippedUnsupported: 0,
        skippedTooLarge: 1,
        failed: 0,
        truncatedPdfPages: 0,
      }),
    ).toBe('File exceeds the 50 MB limit.');

    expect(
      formatImportSummary({
        ids: [],
        titles: [],
        skippedUnsupported: 0,
        skippedTooLarge: 0,
        failed: 1,
        truncatedPdfPages: 0,
      }),
    ).toBe("Could not import document (1 couldn't be opened).");

    expect(
      formatImportSummary({
        ids: [],
        titles: [],
        skippedUnsupported: 0,
        skippedTooLarge: 0,
        failed: 0,
        truncatedPdfPages: 0,
      }),
    ).toBe('No documents selected.');
  });
});
