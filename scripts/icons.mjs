// Renders the extension icon into public/icons without any image dependencies.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};

function insideRoundedRect(u, v, m, r) {
  const x = Math.max(m + r - u, 0, u - (1 - m - r));
  const y = Math.max(m + r - v, 0, v - (1 - m - r));
  return Math.hypot(x, y) <= r;
}

function isInk(u, v) {
  const a = 0.27,
    b = 0.73,
    arm = 0.17,
    t = 0.08;
  for (const [cx, sx] of [
    [a, 1],
    [b, -1],
  ]) {
    for (const [cy, sy] of [
      [a, 1],
      [b, -1],
    ]) {
      const du = (u - cx) * sx;
      const dv = (v - cy) * sy;
      if (
        du >= -t / 2 &&
        dv >= -t / 2 &&
        ((du <= arm && dv <= t / 2) || (dv <= arm && du <= t / 2))
      )
        return true;
    }
  }
  return Math.hypot(u - 0.5, v - 0.5) < 0.075;
}

function render(size) {
  const ss = 4;
  // Web Store: the 128px icon is 96px artwork plus 16px transparent padding per side.
  const pad = size === 128 ? 16 / 128 : 0;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = ((x + (sx + 0.5) / ss) / size - pad) / (1 - 2 * pad);
          const v = ((y + (sy + 0.5) / ss) / size - pad) / (1 - 2 * pad);
          if (!insideRoundedRect(u, v, 0.03, 0.22)) continue;
          // Onyx tile with a thin metallic rim (stays visible on dark toolbars) and silver brackets.
          const silver = 246 - (u + v) * 55;
          const [cr, cg, cb] = isInk(u, v)
            ? [silver, silver + 2, silver + 6]
            : !insideRoundedRect(u, v, 0.065, 0.185)
              ? [120 - v * 40, 122 - v * 40, 128 - v * 40]
              : [40 - v * 34, 40 - v * 34, 44 - v * 36];
          r += cr;
          g += cg;
          b += cb;
          a += 1;
        }
      }
      const n = ss * ss;
      row.push(a ? r / a : 0, a ? g / a : 0, a ? b / a : 0, (a / n) * 255);
    }
    rows.push(Buffer.from(row.map(Math.round)));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const dir = new URL('../public/icons/', import.meta.url);
mkdirSync(dir, { recursive: true });
for (const size of [16, 32, 48, 128])
  writeFileSync(new URL(`icon-${size}.png`, dir), render(size));
