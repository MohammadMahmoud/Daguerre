import type { Rect, Shape } from '../lib/db';

export type Source = CanvasImageSource & { width: number; height: number };

export const normRect = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): Rect => ({
  x: Math.min(x1, x2),
  y: Math.min(y1, y2),
  w: Math.abs(x2 - x1),
  h: Math.abs(y2 - y1),
});

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
export const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
};

export function handlePoint(r: Rect, h: Handle): [number, number] {
  return [
    h.includes('w') ? r.x : h.includes('e') ? r.x + r.w : r.x + r.w / 2,
    h.includes('n') ? r.y : h.includes('s') ? r.y + r.h : r.y + r.h / 2,
  ];
}

/** The edge or corner of `r` under (x, y); whole edges are grabbable, not just their midpoints. */
export function handleAt(r: Rect, x: number, y: number, tol: number) {
  const inX = x >= r.x - tol && x <= r.x + r.w + tol;
  const inY = y >= r.y - tol && y <= r.y + r.h + tol;
  const v =
    inX && Math.abs(y - r.y) <= tol
      ? 'n'
      : inX && Math.abs(y - (r.y + r.h)) <= tol
        ? 's'
        : '';
  const h =
    inY && Math.abs(x - r.x) <= tol
      ? 'w'
      : inY && Math.abs(x - (r.x + r.w)) <= tol
        ? 'e'
        : '';
  return (v + h || undefined) as Handle | undefined;
}

/** Moves the edges named by `h` to (x, y); dragging past the opposite edge flips the rect. */
export function resizeRect(r: Rect, h: Handle, x: number, y: number) {
  return normRect(
    h.includes('w') ? x : r.x,
    h.includes('n') ? y : r.y,
    h.includes('e') ? x : r.x + r.w,
    h.includes('s') ? y : r.y + r.h,
  );
}

const font = (size: number) =>
  `600 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;

function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return (
    (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) /
      255 >
    0.6
  );
}

function tracePath(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (pts.length === 2) ctx.lineTo(pts[0] + 0.01, pts[1]);
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  s: Shape,
  img: Source,
) {
  const [x1, y1, x2, y2] = s.pts;
  ctx.save();
  ctx.strokeStyle = ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = ctx.lineJoin = 'round';
  switch (s.kind) {
    case 'rect': {
      const r = normRect(x1, y1, x2, y2);
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, s.size);
      ctx.stroke();
      break;
    }
    case 'ellipse': {
      const r = normRect(x1, y1, x2, y2);
      ctx.beginPath();
      ctx.ellipse(
        r.x + r.w / 2,
        r.y + r.h / 2,
        r.w / 2,
        r.h / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      break;
    }
    case 'line':
      tracePath(ctx, s.pts);
      ctx.stroke();
      break;
    case 'arrow': {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.min(
        Math.max(s.size * 4, 14),
        Math.hypot(x2 - x1, y2 - y1),
      );
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(
        x2 - Math.cos(angle) * head * 0.7,
        y2 - Math.sin(angle) * head * 0.7,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - head * Math.cos(angle - 0.42),
        y2 - head * Math.sin(angle - 0.42),
      );
      ctx.lineTo(
        x2 - head * Math.cos(angle + 0.42),
        y2 - head * Math.sin(angle + 0.42),
      );
      ctx.closePath();
      ctx.lineWidth = s.size / 2;
      ctx.fill();
      ctx.stroke();
      break;
    }
    case 'pen':
      tracePath(ctx, s.pts);
      ctx.stroke();
      break;
    case 'highlight':
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha = 0.45;
      ctx.lineCap = 'butt';
      tracePath(ctx, s.pts);
      ctx.stroke();
      break;
    case 'blur': {
      const r = normRect(x1, y1, x2, y2);
      if (r.w < 1 || r.h < 1) break;
      const tw = Math.max(1, Math.ceil(r.w / s.size));
      const th = Math.max(1, Math.ceil(r.h / s.size));
      const tmp = new OffscreenCanvas(tw, th);
      const t = tmp.getContext('2d')!;
      // High quality averages each block; the default samples a few pixels and leaves speckles.
      t.imageSmoothingQuality = 'high';
      t.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, tw, th);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, tw, th, r.x, r.y, r.w, r.h);
      break;
    }
    case 'text': {
      ctx.font = font(s.size);
      ctx.textBaseline = 'top';
      ctx.lineWidth = s.size / 6;
      ctx.strokeStyle = isLight(s.color)
        ? 'rgba(0,0,0,.55)'
        : 'rgba(255,255,255,.9)';
      (s.text ?? '').split('\n').forEach((line, i) => {
        ctx.strokeText(line, x1, y1 + i * s.size * 1.25);
        ctx.fillText(line, x1, y1 + i * s.size * 1.25);
      });
      break;
    }
    case 'step': {
      ctx.shadowColor = 'rgba(0,0,0,.3)';
      ctx.shadowBlur = s.size / 2;
      ctx.beginPath();
      ctx.arc(x1, y1, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = s.size * 0.14;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.fillStyle = isLight(s.color) ? '#111' : '#fff';
      ctx.font = `700 ${s.size * 1.05}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.text ?? '', x1, y1 + s.size * 0.06);
      break;
    }
  }
  ctx.restore();
}

/** Draws `region` (image px) of image + shapes at `k` canvas px per image px. Leaves that transform applied. */
export function render(
  canvas: HTMLCanvasElement,
  img: Source,
  shapes: Shape[],
  region: Rect,
  k = 1,
) {
  const w = Math.max(1, Math.round(region.w * k));
  const h = Math.max(1, Math.round(region.h * k));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(k, 0, 0, k, -region.x * k, -region.y * k);
  ctx.clearRect(region.x, region.y, region.w, region.h);
  ctx.drawImage(
    img,
    region.x,
    region.y,
    region.w,
    region.h,
    region.x,
    region.y,
    region.w,
    region.h,
  );
  for (const s of shapes) drawShape(ctx, s, img);
  return ctx;
}

export function bounds(ctx: CanvasRenderingContext2D, s: Shape): Rect {
  if (s.kind === 'text') {
    ctx.save();
    ctx.font = font(s.size);
    const lines = (s.text ?? '').split('\n');
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
    ctx.restore();
    return { x: s.pts[0], y: s.pts[1], w, h: lines.length * s.size * 1.25 };
  }
  if (s.kind === 'step')
    return {
      x: s.pts[0] - s.size,
      y: s.pts[1] - s.size,
      w: s.size * 2,
      h: s.size * 2,
    };
  const xs = s.pts.filter((_, i) => i % 2 === 0);
  const ys = s.pts.filter((_, i) => i % 2 === 1);
  const pad = s.kind === 'blur' ? 0 : s.size / 2;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t =
    dx || dy
      ? Math.max(
          0,
          Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)),
        )
      : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

export function hitTest(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  x: number,
  y: number,
  tolerance: number,
) {
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (
      s.kind === 'line' ||
      s.kind === 'arrow' ||
      s.kind === 'pen' ||
      s.kind === 'highlight'
    ) {
      for (let j = 0; j + 1 < s.pts.length; j += 2) {
        const [x2, y2] =
          j + 3 < s.pts.length
            ? [s.pts[j + 2], s.pts[j + 3]]
            : [s.pts[j], s.pts[j + 1]];
        if (
          distToSegment(x, y, s.pts[j], s.pts[j + 1], x2, y2) <=
          s.size / 2 + tolerance
        )
          return s;
      }
      continue;
    }
    const b = bounds(ctx, s);
    if (
      x >= b.x - tolerance &&
      x <= b.x + b.w + tolerance &&
      y >= b.y - tolerance &&
      y <= b.y + b.h + tolerance
    )
      return s;
  }
  return undefined;
}

/** Shift-drag: snap lines to 45° and boxes to squares. */
export function constrain(
  kind: Shape['kind'],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (kind === 'line' || kind === 'arrow') {
    const a = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
    const len = Math.hypot(dx, dy);
    return [x1 + Math.cos(a) * len, y1 + Math.sin(a) * len];
  }
  const m = Math.max(Math.abs(dx), Math.abs(dy));
  return [x1 + Math.sign(dx || 1) * m, y1 + Math.sign(dy || 1) * m];
}
