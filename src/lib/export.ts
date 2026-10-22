import type { Shot } from './db';
import type { OcrWord } from './ocr';

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function fileName(shot: Pick<Shot, 'url' | 'createdAt'>, ext: string) {
  const d = new Date(shot.createdAt);
  const p = (n: number) => String(n).padStart(2, '0');
  const host = hostOf(shot.url);
  return `Daguerre ${host ? `${host} ` : ''}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} at ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}.${ext}`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error('The image is too large to encode.')),
      type,
      quality,
    ),
  );
}

/** Accepts a promise so the clipboard write keeps the user gesture while encoding. */
export function copyPng(png: Blob | Promise<Blob>) {
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

export function copyText(text: Promise<string>) {
  return navigator.clipboard.write([
    new ClipboardItem({
      'text/plain': text.then((t) => new Blob([t], { type: 'text/plain' })),
    }),
  ]);
}

export interface PdfImage {
  jpeg: Uint8Array<ArrayBuffer>;
  width: number;
  height: number;
  /** OCR words in this image's pixels, written as an invisible, selectable text layer. */
  words?: OcrWord[];
}

// Standard-font text must be WinAnsi; map the common non-Latin-1 punctuation, '?' for the rest.
const WIN_ANSI: Record<string, number> = {
  '€': 0x80,
  '‚': 0x82,
  '„': 0x84,
  '…': 0x85,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '•': 0x95,
  '–': 0x96,
  '—': 0x97,
  '™': 0x99,
};
const winAnsi = (s: string) =>
  Uint8Array.from(s, (c) =>
    c.charCodeAt(0) < 256 ? c.charCodeAt(0) : (WIN_ANSI[c] ?? 63),
  );

/**
 * Minimal PDF: one JPEG per page, scaled to page width and pinned to the top.
 * `measure` returns a string's width at font size 1 in Helvetica.
 */
export function buildPdf(
  images: PdfImage[],
  pageW: number,
  pageH: number,
  measure: (text: string) => number = (t) => t.length * 0.5,
) {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (p: string | Uint8Array) => {
    const bytes = typeof p === 'string' ? enc.encode(p) : p;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, dict: string, stream?: Uint8Array) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${dict}\n`);
    if (stream) {
      push('stream\n');
      push(stream);
      push('\nendstream\n');
    }
    push('endobj\n');
  };
  const num = (v: number) => String(+v.toFixed(2));

  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(
    2,
    `<< /Type /Pages /Kids [${images.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] /Count ${images.length} >>`,
  );
  obj(
    3,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );
  images.forEach((img, i) => {
    const page = 4 + i * 3;
    const s = pageW / img.width;
    const drawH = img.height * s;
    // Render mode 3 = invisible: selectable and searchable, but the image stays what you see.
    const words = (img.words ?? []).flatMap((w) => {
      const text = w.text.replace(/[\r\n]/g, ' ');
      const size = (w.y1 - w.y0) * s;
      const natural = measure(text) * size;
      if (size <= 0 || natural <= 0) return [];
      const tz = (100 * (w.x1 - w.x0) * s) / natural;
      return `${num(size)} 0 0 ${num(size)} ${num(w.x0 * s)} ${num(pageH - w.y1 * s)} Tm ${num(tz)} Tz (${text.replace(/[\\()]/g, '\\$&')}) Tj`;
    });
    const content = winAnsi(
      `q ${num(pageW)} 0 0 ${num(drawH)} 0 ${num(pageH - drawH)} cm /Im0 Do Q` +
        (words.length ? `\nBT 3 Tr /F1 1 Tf\n${words.join('\n')}\nET` : ''),
    );
    obj(
      page,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(pageW)} ${num(pageH)}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> /Font << /F1 3 0 R >> >> /Contents ${page + 1} 0 R >>`,
    );
    obj(page + 1, `<< /Length ${content.length} >>`, content);
    obj(
      page + 2,
      `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.jpeg.length} >>`,
      img.jpeg,
    );
  });
  const xref = length;
  const size = 4 + images.length * 3;
  push(
    `xref\n0 ${size}\n0000000000 65535 f \n${offsets
      .slice(1)
      .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
      .join('')}`,
  );
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Splits the image across A4 pages (landscape for wide images); `words` adds a searchable text layer. */
export async function canvasToPdf(
  canvas: HTMLCanvasElement,
  words?: OcrWord[],
) {
  const [pageW, pageH] =
    canvas.width > canvas.height ? [841.89, 595.28] : [595.28, 841.89];
  const sliceH = Math.floor((canvas.width * pageH) / pageW);
  const slice = document.createElement('canvas');
  slice.width = canvas.width;
  const images: PdfImage[] = [];
  for (let y = 0; y < canvas.height; y += sliceH) {
    slice.height = Math.min(sliceH, canvas.height - y);
    const ctx = slice.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(
      canvas,
      0,
      y,
      slice.width,
      slice.height,
      0,
      0,
      slice.width,
      slice.height,
    );
    const jpeg = new Uint8Array(
      await (await canvasToBlob(slice, 'image/jpeg', 0.92)).arrayBuffer(),
    );
    const pageWords = words
      ?.filter(
        (w) => (w.y0 + w.y1) / 2 >= y && (w.y0 + w.y1) / 2 < y + slice.height,
      )
      .map((w) => ({ ...w, y0: w.y0 - y, y1: w.y1 - y }));
    images.push({
      jpeg,
      width: slice.width,
      height: slice.height,
      words: pageWords,
    });
  }
  const ctx = slice.getContext('2d')!;
  ctx.font = '100px Helvetica, Arial, sans-serif';
  return new Blob(
    [buildPdf(images, pageW, pageH, (t) => ctx.measureText(t).width / 100)],
    { type: 'application/pdf' },
  );
}
