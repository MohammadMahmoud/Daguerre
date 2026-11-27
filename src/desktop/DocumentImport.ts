import { addShot, getShot, putShots } from '../lib/Db';
import { canvasToBlob } from '../lib/Export';

export const MAX_IMPORT_BYTES = 50 * 1024 * 1024;
export const MAX_PDF_PAGES = 25;
const MAX_PDF_DIMENSION = 3200;

const IMAGE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tif',
  'tiff',
  'avif',
  'svg',
  'ico',
  'heic',
  'heif',
]);

const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/avif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  'image/heic',
  'image/heif',
]);

export const DOCUMENT_ACCEPT = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.svg',
  '.ico',
  '.heic',
  '.heif',
  '.pdf',
  'image/*',
  'application/pdf',
].join(',');

export interface ImportResult {
  ids: string[];
  titles: string[];
  skippedUnsupported: number;
  skippedTooLarge: number;
  failed: number;
  truncatedPdfPages: number;
}

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfjsModule> | undefined;

function extensionOf(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Returns true for PDF documents based on MIME type or file extension. */
export function isPdfDocument(file: Pick<File, 'name' | 'type'>) {
  return (
    file.type.toLowerCase() === 'application/pdf' ||
    extensionOf(file.name) === 'pdf'
  );
}

/** Returns true for supported image formats and PDF documents. */
export function isSupportedDocument(file: Pick<File, 'name' | 'type'>) {
  if (isPdfDocument(file)) return true;
  const type = file.type.toLowerCase();
  if (IMAGE_MIME_TYPES.has(type) || type.startsWith('image/')) return true;
  return IMAGE_EXTENSIONS.has(extensionOf(file.name));
}

/** Derives a clean screenshot title from an uploaded filename. */
export function documentTitle(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return 'Uploaded document';
  const dot = trimmed.lastIndexOf('.');
  const stem = (dot > 0 ? trimmed.slice(0, dot) : trimmed).trim();
  return stem || 'Uploaded document';
}

async function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

function drawToPng(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Blob> {
  if (width <= 0 || height <= 0) {
    return Promise.reject(new Error('Invalid image dimensions.'));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas context unavailable.'));
  ctx.drawImage(source, 0, 0, width, height);
  return canvasToBlob(canvas, 'image/png');
}

function decodeViaImageElement(file: Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      URL.revokeObjectURL(url);
      drawToPng(img, width, height).then(resolve, reject);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image.'));
    };
    img.src = url;
  });
}

/** Validates an image blob and converts non-PNG images to PNG for editor and clipboard compatibility. */
export async function normalizeImageToPng(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    try {
      if (bmp.width <= 0 || bmp.height <= 0) {
        throw new Error('Invalid image dimensions.');
      }
      if (file.type.toLowerCase() === 'image/png') return file;
      return await drawToPng(bmp, bmp.width, bmp.height);
    } finally {
      bmp.close();
    }
  } catch {
    return decodeViaImageElement(file);
  }
}

async function readBlobBytes(file: Blob): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsArrayBuffer(file);
  });
  return new Uint8Array(buffer);
}

/** Renders up to `MAX_PDF_PAGES` pages of a PDF document to PNG blobs on a white background. */
export async function renderPdfPages(
  file: Blob,
  baseTitle: string,
): Promise<{
  pages: { blob: Blob; title: string }[];
  totalPages: number;
  truncated: boolean;
}> {
  const pdfjs = await loadPdfjs();
  const data = await readBlobBytes(file);
  const loadingTask = pdfjs.getDocument({ data });
  let doc: Awaited<typeof loadingTask.promise> | undefined;
  try {
    doc = await loadingTask.promise;
    const totalPages = doc.numPages;
    if (totalPages < 1) throw new Error('PDF contains no pages.');
    const count = Math.min(totalPages, MAX_PDF_PAGES);
    const pages: { blob: Blob; title: string }[] = [];

    for (let pageNumber = 1; pageNumber <= count; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      try {
        const baseViewport = page.getViewport({ scale: 1 });
        const maxSide = Math.max(baseViewport.width, baseViewport.height, 1);
        const scale = Math.min(2, MAX_PDF_DIMENSION / maxSide);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable.');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const blob = await canvasToBlob(canvas, 'image/png');
        const title =
          totalPages === 1 ? baseTitle : `${baseTitle} (Page ${pageNumber})`;
        pages.push({ blob, title });
      } finally {
        page.cleanup();
      }
    }

    return {
      pages,
      totalPages,
      truncated: totalPages > MAX_PDF_PAGES,
    };
  } finally {
    await doc?.cleanup?.();
    await loadingTask.destroy?.();
  }
}

async function orderMultiPagePdfShots(pageIds: string[]) {
  if (pageIds.length < 2) return;
  const stored = await Promise.all(pageIds.map((id) => getShot(id)));
  const shots = stored.filter((s): s is NonNullable<typeof s> => Boolean(s));
  if (shots.length < 2) return;
  const newest = Math.max(...shots.map((s) => s.createdAt));
  await putShots(
    shots.map((shot, index) => ({
      ...shot,
      createdAt: newest - index,
    })),
  );
}

/** Validates, converts, and persists uploaded image and PDF documents into local History. */
export async function importDocuments(
  files: Iterable<File>,
): Promise<ImportResult> {
  const result: ImportResult = {
    ids: [],
    titles: [],
    skippedUnsupported: 0,
    skippedTooLarge: 0,
    failed: 0,
    truncatedPdfPages: 0,
  };

  for (const file of files) {
    if (!isSupportedDocument(file)) {
      result.skippedUnsupported += 1;
      continue;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      result.skippedTooLarge += 1;
      continue;
    }

    const baseTitle = documentTitle(file.name);
    try {
      if (isPdfDocument(file)) {
        const { pages, totalPages, truncated } = await renderPdfPages(
          file,
          baseTitle,
        );
        if (truncated) {
          result.truncatedPdfPages += totalPages - pages.length;
        }
        const pageIds: string[] = [];
        for (const page of pages) {
          const id = await addShot(page.blob, {
            title: page.title,
            url: '',
            mode: 'upload',
          });
          pageIds.push(id);
          result.ids.push(id);
          result.titles.push(page.title);
        }
        await orderMultiPagePdfShots(pageIds);
      } else {
        const png = await normalizeImageToPng(file);
        const id = await addShot(png, {
          title: baseTitle,
          url: '',
          mode: 'upload',
        });
        result.ids.push(id);
        result.titles.push(baseTitle);
      }
    } catch {
      result.failed += 1;
    }
  }

  return result;
}

/** Formats an `ImportResult` into a concise status message for History toasts. */
export function formatImportSummary(result: ImportResult) {
  const notes: string[] = [];
  if (result.truncatedPdfPages > 0) {
    notes.push(
      `${result.truncatedPdfPages} PDF page${result.truncatedPdfPages === 1 ? '' : 's'} beyond ${MAX_PDF_PAGES} skipped`,
    );
  }
  if (result.skippedUnsupported > 0) {
    notes.push(`${result.skippedUnsupported} unsupported skipped`);
  }
  if (result.skippedTooLarge > 0) {
    notes.push(`${result.skippedTooLarge} over 50 MB skipped`);
  }
  if (result.failed > 0) {
    notes.push(`${result.failed} couldn't be opened`);
  }

  if (result.ids.length > 0) {
    const base =
      result.ids.length === 1
        ? `Added "${result.titles[0]}"`
        : `Added ${result.ids.length} items`;
    return notes.length > 0 ? `${base} (${notes.join(', ')})` : base;
  }

  if (
    result.skippedUnsupported > 0 &&
    result.skippedTooLarge === 0 &&
    result.failed === 0
  ) {
    return 'Unsupported file type. Drop or choose images or PDFs.';
  }
  if (
    result.skippedTooLarge > 0 &&
    result.skippedUnsupported === 0 &&
    result.failed === 0
  ) {
    return 'File exceeds the 50 MB limit.';
  }
  if (notes.length > 0) {
    return `Could not import document (${notes.join(', ')}).`;
  }
  return 'No documents selected.';
}
