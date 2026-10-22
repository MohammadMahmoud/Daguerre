import { afterEach, describe, expect, test, vi } from 'vitest';
import {
    buildPdf,
    canvasToBlob,
    canvasToPdf,
    copyPng,
    copyText,
    downloadBlob,
    fileName,
    formatBytes,
    hostOf,
} from '../../../src/lib/export';
import { imageBlob } from '../../setup';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

afterEach(() => vi.useRealTimers());

describe('naming and formatting', () => {
  test('hostOf strips www and tolerates bad URLs', () => {
    expect(hostOf('https://www.example.com/a?b')).toBe('example.com');
    expect(hostOf('https://docs.example.com')).toBe('docs.example.com');
    expect(hostOf('not a url')).toBe('');
  });

  test('formatBytes picks a unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 ** 2)).toBe('5.0 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.00 GB');
  });

  test('fileName includes host and local timestamp', () => {
    const createdAt = new Date(2026, 0, 2, 3, 4, 5).getTime();
    expect(fileName({ url: 'https://www.acme.com', createdAt }, 'png')).toBe(
      'Daguerre acme.com 2026-01-02 at 03.04.05.png',
    );
    expect(fileName({ url: '', createdAt }, 'pdf')).toBe(
      'Daguerre 2026-01-02 at 03.04.05.pdf',
    );
  });
});

describe('browser helpers', () => {
  test('downloadBlob clicks a download link and revokes the URL later', () => {
    vi.useFakeTimers();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('shot.png');
        expect(this.href).toMatch(/^blob:/);
      });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    downloadBlob(new Blob(['x']), 'shot.png');
    expect(click).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10_000);
    expect(revoke).toHaveBeenCalledOnce();
  });

  test('canvasToBlob resolves the encoded blob and rejects when encoding fails', async () => {
    const canvas = document.createElement('canvas');
    await expect(
      canvasToBlob(canvas, 'image/jpeg', 0.5),
    ).resolves.toMatchObject({ type: 'image/jpeg' });
    vi.spyOn(canvas, 'toBlob').mockImplementation((cb) => cb(null));
    await expect(canvasToBlob(canvas)).rejects.toThrow('too large');
  });

  test('copyPng and copyText write clipboard items of the right type', async () => {
    const write = vi.spyOn(navigator.clipboard, 'write');
    await copyPng(new Blob(['png'], { type: 'image/png' }));
    expect(Object.keys((write.mock.calls[0][0][0] as any).items)).toEqual([
      'image/png',
    ]);
    await copyText(Promise.resolve('hello'));
    const text = await (write.mock.calls[1][0][0] as any).items['text/plain'];
    expect(text.type).toBe('text/plain');
    expect(await text.text()).toBe('hello');
  });
});

describe('buildPdf', () => {
  test('writes one page per image with a correct xref table', () => {
    const text = latin1(
      buildPdf(
        [
          { jpeg, width: 10, height: 20 },
          { jpeg, width: 10, height: 5 },
        ],
        595.28,
        841.89,
      ),
    );
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toMatch(/\/Count 2 /);
    expect(text).not.toMatch(/ Tj/);
    const xref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(
      (m) => Number(m[1]),
    );
    expect(offsets).toHaveLength(9);
    offsets.forEach((offset, i) =>
      expect(text.startsWith(`${i + 1} 0 obj`, offset)).toBe(true),
    );
  });

  test('writes OCR words as an invisible, escaped WinAnsi text layer', () => {
    const text = latin1(
      buildPdf(
        [
          {
            jpeg,
            width: 100,
            height: 100,
            words: [
              {
                text: '\u201cTotal\u201d (\u20ac5)',
                x0: 10,
                y0: 20,
                x1: 60,
                y1: 30,
              },
              { text: '\u6f22', x0: 0, y0: 40, x1: 10, y1: 50 },
              { text: 'flat', x0: 0, y0: 60, x1: 10, y1: 60 },
            ],
          },
        ],
        100,
        200,
      ),
    );
    expect(text).toMatch(/BT 3 Tr \/F1 1 Tf/);
    // 10 px tall word at scale 1, bottom edge at y=30 -> PDF y = 200 - 30.
    expect(text).toMatch(
      /10 0 0 10 10 170 Tm [\d.]+ Tz \(\x93Total\x94 \\\(\x805\\\)\) Tj/,
    );
    expect(text).toContain('(?) Tj');
    expect(text).not.toContain('(flat)');
    expect(text).toMatch(/\/Font << \/F1 3 0 R >>/);
  });
});

describe('canvasToPdf', () => {
  test('slices tall images into A4 pages and places words on their page', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 300; // A4 slice height for width 100 is 141 px -> 3 pages
    const words = [
      { text: 'first', x0: 0, y0: 10, x1: 20, y1: 20 },
      { text: 'third', x0: 0, y0: 290, x1: 20, y1: 298 },
    ];
    const pdf = await canvasToPdf(canvas, words);
    expect(pdf.type).toBe('application/pdf');
    const text = latin1(new Uint8Array(await pdf.arrayBuffer()));
    expect(text).toMatch(/\/Count 3 /);
    expect(text).toContain('(first) Tj');
    expect(text).toContain('(third) Tj');
  });

  test('uses a landscape page for wide images', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const text = latin1(
      new Uint8Array(await (await canvasToPdf(canvas)).arrayBuffer()),
    );
    expect(text).toContain('/MediaBox [0 0 841.89 595.28]');
    expect(text).toMatch(/\/Count 1 /);
  });
});

test('imageBlob helper keeps sizes for decoding', async () => {
  const bmp = await createImageBitmap(imageBlob(12, 34));
  expect([bmp.width, bmp.height]).toEqual([12, 34]);
});
