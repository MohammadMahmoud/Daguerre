import { guardClose, leaveToHistory, SAVED_TOAST } from '@platform';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import {
  bounds,
  constrain,
  HANDLE_CURSOR,
  handleAt,
  handlePoint,
  HANDLES,
  hitTest,
  normRect,
  render,
  resizeRect,
  type Handle,
} from './editor/draw';
import {
  getShot,
  makeThumb,
  putShots,
  type Edits,
  type Rect,
  type Shape,
  type Shot,
} from './lib/db';
import {
  canvasToBlob,
  canvasToPdf,
  copyPng,
  copyText as copyTextToClipboard,
  downloadBlob,
  fileName,
  formatBytes,
  hostOf,
  printPage,
} from './lib/export';
import { recognize } from './lib/ocr';
import './styles.css';
import {
  ConfirmDialog,
  Icon,
  MODE_LABEL,
  Toast,
  useToast,
  type IconName,
} from './ui';

type Tool = 'select' | 'crop' | Shape['kind'];
type Drag = {
  mode: 'draw' | 'move' | 'crop-new' | 'crop-move' | 'crop-resize';
  x: number;
  y: number;
  shape?: Shape;
  crop?: Rect;
  handle?: Handle;
};
type TextEdit = {
  x: number;
  y: number;
  id?: string;
  text: string;
  color: string;
  size: number;
};
type Compressed = 'jpeg' | 'webp';

const TOOLS: { id: Tool; label: string; key: string }[] = [
  { id: 'select', label: 'Select and move', key: 'v' },
  { id: 'crop', label: 'Crop', key: 'c' },
  { id: 'arrow', label: 'Arrow', key: 'a' },
  { id: 'rect', label: 'Rectangle', key: 'r' },
  { id: 'ellipse', label: 'Ellipse', key: 'o' },
  { id: 'line', label: 'Line', key: 'l' },
  { id: 'pen', label: 'Pen', key: 'p' },
  { id: 'highlight', label: 'Highlighter', key: 'h' },
  { id: 'text', label: 'Text', key: 't' },
  { id: 'step', label: 'Numbered step', key: 'n' },
  { id: 'blur', label: 'Pixelate sensitive info', key: 'b' },
];
const COLORS = [
  '#ff4d4f',
  '#ffb547',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#111111',
  '#ffffff',
];
const SIZE_STEPS: Partial<Record<Shape['kind'], number[]>> = {
  text: [18, 28, 44],
  step: [12, 17, 24],
  highlight: [14, 24, 40],
  blur: [8, 14, 22],
};
const SIZE_NAMES = ['Small', 'Medium', 'Large'];
const EMPTY: Edits = { shapes: [], crop: null };
const DPR = devicePixelRatio || 1;

const sizeFor = (kind: Shape['kind'], index: number, unit: number) =>
  (SIZE_STEPS[kind] ?? [3, 5, 9])[index] * unit;
const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

export function Editor() {
  const id = useMemo(
    () => new URLSearchParams(location.search).get('id') ?? '',
    [],
  );
  const [shot, setShot] = useState<Shot | null>();
  const [img, setImg] = useState<ImageBitmap>();
  const [hist, setHist] = useState({ stack: [EMPTY], index: 0 });
  const [savedDoc, setSavedDoc] = useState(EMPTY);
  const [tool, setTool] = useState<Tool>('arrow');
  const [color, setColor] = useState(COLORS[0]);
  const [sizeIdx, setSizeIdx] = useState(1);
  const [draft, setDraftState] = useState<Shape | null>(null);
  const [cropDraft, setCropDraft] = useState<Rect | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditingState] = useState<TextEdit | null>(null);
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [stage, setStage] = useState({ w: 1000, h: 700 });
  const [exportOpen, setExportOpen] = useState(false);
  const [quality, setQuality] = useState(
    () => Number(localStorage.getItem('quality')) || 0.8,
  );
  const [halfSize, setHalfSize] = useState(false);
  const [estimates, setEstimates] = useState<
    Partial<Record<'png' | Compressed, number>>
  >({});
  const [busy, setBusy] = useState(false);
  const [printUrl, setPrintUrl] = useState<string>();
  const [confirmClose, setConfirmClose] =
    useState<(discard: boolean) => void>();
  const [toast, showToast] = useToast();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const pointer = useRef({ x: 0, y: 0, shift: false, raf: 0 });
  const [cropCursor, setCropCursor] = useState('crosshair');
  const draftRef = useRef<Shape | null>(null);
  const editingRef = useRef<TextEdit | null>(null);

  const doc = hist.stack[hist.index];
  const dirty = doc !== savedDoc;
  const full = useMemo<Rect>(
    () => ({ x: 0, y: 0, w: img?.width ?? 1, h: img?.height ?? 1 }),
    [img],
  );
  const view = tool === 'crop' ? full : (doc.crop ?? full);
  const unit = Math.max(1, full.w / 1400);
  const fitScale = Math.min(
    1 / DPR,
    (stage.w - 64) / view.w,
    view.h / view.w < 2.5 ? (stage.h - 64) / view.h : Infinity,
  );
  const scale = zoom === 'fit' ? fitScale : zoom;

  const setDraft = (s: Shape | null) => {
    draftRef.current = s;
    setDraftState(s);
  };
  const setEditing = (e: TextEdit | null) => {
    editingRef.current = e;
    setEditingState(e);
  };

  useEffect(() => {
    (async () => {
      const s = await getShot(id);
      if (!s) return setShot(null);
      const bmp = await createImageBitmap(s.original ?? s.blob);
      const edits = s.edits ?? EMPTY;
      setHist({ stack: [edits], index: 0 });
      setSavedDoc(edits);
      setImg(bmp);
      setShot(s);
      document.title = `${s.title} – Daguerre`;
    })().catch(() => setShot(null));
  }, [id]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setStage({ w: entry.contentRect.width, h: entry.contentRect.height }),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) =>
      dirty && e.preventDefault();
    addEventListener('beforeunload', onBeforeUnload);
    return () => removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(
    () =>
      guardClose(
        () => dirtyRef.current,
        () => new Promise<boolean>((resolve) => setConfirmClose(() => resolve)),
      ),
    [],
  );

  function answerClose(discard: boolean) {
    confirmClose?.(discard);
    setConfirmClose(undefined);
  }

  // Paint only the visible part: a full-size canvas of a tall capture exceeds GPU limits and is slow.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const stageEl = stageRef.current;
    if (!img || !canvas || !wrap || !stageEl) return;
    let raf = 0;
    const paint = () => {
      const w = wrap.getBoundingClientRect();
      const s = stageEl.getBoundingClientRect();
      const sx = s.left + stageEl.clientLeft;
      const sy = s.top + stageEl.clientTop;
      const left = Math.max(0, sx - w.left);
      const top = Math.max(0, sy - w.top);
      const right = Math.min(w.width, sx + stageEl.clientWidth - w.left);
      const bottom = Math.min(w.height, sy + stageEl.clientHeight - w.top);
      if (right <= left || bottom <= top) return;
      Object.assign(canvas.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${right - left}px`,
        height: `${bottom - top}px`,
      });
      const region = {
        x: view.x + left / scale,
        y: view.y + top / scale,
        w: (right - left) / scale,
        h: (bottom - top) / scale,
      };
      const hidden = draft?.id ?? editing?.id;
      const shapes = doc.shapes.filter((s) => s.id !== hidden);
      const ctx = render(
        canvas,
        img,
        draft ? [...shapes, draft] : shapes,
        region,
        DPR * scale,
      );
      const px = 1 / scale;
      // Dark under-stroke keeps the light outline visible on white pages.
      const outline = (
        x: number,
        y: number,
        w: number,
        h: number,
        dash: boolean,
      ) => {
        ctx.setLineDash([]);
        ctx.lineWidth = 3 * px;
        ctx.strokeStyle = 'rgba(0,0,0,.55)';
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash(dash ? [6 * px, 4 * px] : []);
        ctx.lineWidth = 1.5 * px;
        ctx.strokeStyle = '#f2f3f5';
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);
      };
      const selected = doc.shapes.find((s) => s.id === selectedId);
      if (selected && tool === 'select') {
        const b = bounds(ctx, draft?.id === selected.id ? draft : selected);
        outline(b.x - 4 * px, b.y - 4 * px, b.w + 8 * px, b.h + 8 * px, true);
      }
      if (tool === 'crop') {
        ctx.fillStyle = 'rgba(8,9,12,.62)';
        ctx.beginPath();
        ctx.rect(0, 0, full.w, full.h);
        if (cropDraft)
          ctx.rect(cropDraft.x, cropDraft.y, cropDraft.w, cropDraft.h);
        ctx.fill('evenodd');
        if (cropDraft) {
          const { x, y, w, h } = cropDraft;
          ctx.strokeStyle = 'rgba(255,255,255,.35)';
          ctx.lineWidth = px;
          ctx.beginPath();
          for (const f of [1 / 3, 2 / 3]) {
            ctx.moveTo(x + w * f, y);
            ctx.lineTo(x + w * f, y + h);
            ctx.moveTo(x, y + h * f);
            ctx.lineTo(x + w, y + h * f);
          }
          ctx.stroke();
          outline(x, y, w, h, false);
          for (const handle of HANDLES) {
            const [hx, hy] = handlePoint(cropDraft, handle);
            const corner = handle.length === 2;
            const horizontal = handle === 'n' || handle === 's';
            const hw = (corner ? 12 : horizontal ? 32 : 6) * px;
            const hh = (corner ? 12 : horizontal ? 6 : 32) * px;
            ctx.beginPath();
            ctx.roundRect(hx - hw / 2, hy - hh / 2, hw, hh, 3 * px);
            ctx.fillStyle = '#f2f3f5';
            ctx.fill();
            ctx.lineWidth = px;
            ctx.strokeStyle = 'rgba(0,0,0,.6)';
            ctx.stroke();
          }
        }
      }
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(paint);
    };
    schedule();
    stageEl.addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(raf);
      stageEl.removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
    };
  }, [
    img,
    doc,
    draft,
    view,
    selectedId,
    cropDraft,
    tool,
    editing,
    scale,
    full,
  ]);

  // Live file-size estimates for the export menu.
  useEffect(() => {
    if (!exportOpen || !img) return;
    const timer = setTimeout(async () => {
      const png = await canvasToBlob(renderFinal());
      const small = renderFinal(halfSize);
      const [jpeg, webp] = await Promise.all([
        canvasToBlob(small, 'image/jpeg', quality),
        canvasToBlob(small, 'image/webp', quality),
      ]);
      setEstimates({ png: png.size, jpeg: jpeg.size, webp: webp.size });
    }, 150);
    return () => clearTimeout(timer);
    // renderFinal is rebuilt every render; listing it would re-estimate (and re-render) forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportOpen, img, doc, quality, halfSize]);

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: PointerEvent) =>
      !exportRef.current?.contains(e.target as Node) && setExportOpen(false);
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [exportOpen]);

  useEffect(() => {
    if (!printUrl) return;
    const done = () => setPrintUrl(undefined);
    addEventListener('afterprint', done);
    return () => {
      removeEventListener('afterprint', done);
      URL.revokeObjectURL(printUrl);
    };
  }, [printUrl]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod) {
        const action = {
          z: e.shiftKey ? redo : undo,
          y: redo,
          s: save,
          c: e.shiftKey ? copyText : copy,
          p: print,
        }[key];
        if (action) {
          e.preventDefault();
          void action();
        }
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        commit({
          ...doc,
          shapes: doc.shapes.filter((s) => s.id !== selectedId),
        });
        setSelectedId(null);
      } else if (e.key === 'Escape') {
        setExportOpen(false);
        setSelectedId(null);
        if (tool === 'crop') selectTool('select');
      } else if (e.key === 'Enter' && tool === 'crop') {
        applyCrop();
      } else if (e.key === '+' || e.key === '=') {
        zoomBy(1.25);
      } else if (e.key === '-') {
        zoomBy(0.8);
      } else if (e.key === '0') {
        setZoom('fit');
      } else {
        const t = TOOLS.find((t) => t.key === key);
        if (t) selectTool(t.id);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  if (shot === null) {
    return (
      <div className='empty-page'>
        <Icon name='image' size={40} />
        <h1>Screenshot not found</h1>
        <p>It may have been deleted from your history.</p>
        <a
          className='btn primary'
          href='history.html'
          onClick={(e) => leaveToHistory() && e.preventDefault()}
        >
          Open history
        </a>
      </div>
    );
  }
  if (!shot || !img) return <div className='empty-page' aria-busy='true' />;

  function commit(next: Edits) {
    setHist((h) => ({
      stack: [...h.stack.slice(0, h.index + 1), next],
      index: h.index + 1,
    }));
  }
  function undo() {
    setHist((h) => ({ ...h, index: Math.max(0, h.index - 1) }));
    setSelectedId(null);
  }
  function redo() {
    setHist((h) => ({
      ...h,
      index: Math.min(h.stack.length - 1, h.index + 1),
    }));
  }
  function zoomBy(f: number) {
    setZoom(clamp(scale * f, 0.05, 8));
  }

  function selectTool(t: Tool) {
    commitText();
    if (t === 'crop') setCropDraft(doc.crop);
    if (t !== 'select') setSelectedId(null);
    setTool(t);
  }

  function applyCrop() {
    const c =
      cropDraft && cropDraft.w >= 8 && cropDraft.h >= 8 ? cropDraft : null;
    const crop = c && {
      x: Math.round(c.x),
      y: Math.round(c.y),
      w: Math.round(c.w),
      h: Math.round(c.h),
    };
    if (JSON.stringify(crop) !== JSON.stringify(doc.crop))
      commit({ ...doc, crop });
    setTool('select');
  }

  function updateSelected(patch: Partial<Shape>) {
    if (!selectedId || tool !== 'select') return;
    commit({
      ...doc,
      shapes: doc.shapes.map((s) =>
        s.id === selectedId ? { ...s, ...patch } : s,
      ),
    });
  }

  function commitText() {
    const e = editingRef.current;
    if (!e) return;
    setEditing(null);
    const text = e.text.replace(/\s+$/, '');
    const others = doc.shapes.filter((s) => s.id !== e.id);
    if (!text) {
      if (e.id) commit({ ...doc, shapes: others });
      return;
    }
    const shape: Shape = {
      id: e.id ?? crypto.randomUUID(),
      kind: 'text',
      color: e.color,
      size: e.size,
      pts: [e.x, e.y],
      text,
    };
    commit({
      ...doc,
      shapes: e.id
        ? doc.shapes.map((s) => (s.id === e.id ? shape : s))
        : [...doc.shapes, shape],
    });
  }

  function toImage(e: { clientX: number; clientY: number }) {
    const r = wrapRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / scale + view.x,
      y: (e.clientY - r.top) / scale + view.y,
    };
  }

  function onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    if (editingRef.current) {
      e.preventDefault();
      return commitText();
    }
    const p = toImage(e);
    if (tool === 'text') {
      // Keep focus in the new textarea instead of letting the mousedown move it.
      e.preventDefault();
      return setEditing({
        ...p,
        text: '',
        color,
        size: sizeFor('text', sizeIdx, unit),
      });
    }
    if (tool === 'step') {
      const n = doc.shapes.filter((s) => s.kind === 'step').length + 1;
      const step: Shape = {
        id: crypto.randomUUID(),
        kind: 'step',
        color,
        size: sizeFor('step', sizeIdx, unit),
        pts: [p.x, p.y],
        text: String(n),
      };
      return commit({ ...doc, shapes: [...doc.shapes, step] });
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    Object.assign(pointer.current, {
      x: e.clientX,
      y: e.clientY,
      shift: e.shiftKey,
    });
    if (tool === 'crop') {
      const c = cropDraft;
      const handle = c ? handleAt(c, p.x, p.y, 10 / scale) : undefined;
      const inside =
        c && p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
      drag.current = handle
        ? { mode: 'crop-resize', ...p, crop: c!, handle }
        : inside
          ? { mode: 'crop-move', ...p, crop: c }
          : { mode: 'crop-new', ...p };
      if (!handle && !inside) setCropDraft(null);
      return;
    }
    if (tool === 'select') {
      const hit = hitTest(
        canvasRef.current!.getContext('2d')!,
        doc.shapes,
        p.x,
        p.y,
        6 / scale,
      );
      setSelectedId(hit?.id ?? null);
      if (hit) drag.current = { mode: 'move', ...p, shape: hit };
      return;
    }
    drag.current = { mode: 'draw', ...p };
    setDraft({
      id: crypto.randomUUID(),
      kind: tool,
      color,
      size: sizeFor(tool, sizeIdx, unit),
      pts: [p.x, p.y, p.x, p.y],
    });
  }

  function onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>) {
    const pt = pointer.current;
    Object.assign(pt, { x: e.clientX, y: e.clientY, shift: e.shiftKey });
    if (!drag.current) {
      if (tool === 'crop') setCropCursor(cropCursorAt(toImage(e)));
      return;
    }
    dragTo();
    if (!pt.raf) pt.raf = requestAnimationFrame(autoScroll);
  }

  function cropCursorAt(p: { x: number; y: number }) {
    const c = cropDraft;
    if (!c) return 'crosshair';
    const handle = handleAt(c, p.x, p.y, 10 / scale);
    if (handle) return HANDLE_CURSOR[handle];
    const inside =
      p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
    return inside ? 'move' : 'crosshair';
  }

  // Dragging past the stage edge scrolls it, so crops and shapes can reach off-screen parts.
  function autoScroll() {
    const pt = pointer.current;
    pt.raf = 0;
    const stageEl = stageRef.current;
    if (!drag.current || !stageEl) return;
    const r = stageEl.getBoundingClientRect();
    const edge = 48;
    const speed = (v: number, lo: number, hi: number) =>
      v < lo + edge
        ? Math.max(-40, (v - lo - edge) * 0.6)
        : v > hi - edge
          ? Math.min(40, (v - hi + edge) * 0.6)
          : 0;
    const dx = speed(pt.x, r.left, r.right);
    const dy = speed(pt.y, r.top, r.bottom);
    if (!dx && !dy) return;
    stageEl.scrollBy(dx, dy);
    dragTo();
    pt.raf = requestAnimationFrame(autoScroll);
  }

  function dragTo() {
    const d = drag.current;
    if (!d) return;
    const { x: clientX, y: clientY, shift } = pointer.current;
    const p = toImage({ clientX, clientY });
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (d.mode === 'draw' && draftRef.current) {
      const s = draftRef.current;
      if (s.kind === 'pen' || s.kind === 'highlight')
        return setDraft({ ...s, pts: [...s.pts, p.x, p.y] });
      const [x2, y2] = shift
        ? constrain(s.kind, d.x, d.y, p.x, p.y)
        : [p.x, p.y];
      setDraft({ ...s, pts: [d.x, d.y, x2, y2] });
    } else if (d.mode === 'move' && d.shape) {
      setDraft({
        ...d.shape,
        pts: d.shape.pts.map((v, i) => v + (i % 2 ? dy : dx)),
      });
    } else if (d.mode === 'crop-new') {
      setCropDraft(
        normRect(
          clamp(d.x, 0, full.w),
          clamp(d.y, 0, full.h),
          clamp(p.x, 0, full.w),
          clamp(p.y, 0, full.h),
        ),
      );
    } else if (d.mode === 'crop-move' && d.crop) {
      setCropDraft({
        ...d.crop,
        x: clamp(d.crop.x + dx, 0, full.w - d.crop.w),
        y: clamp(d.crop.y + dy, 0, full.h - d.crop.h),
      });
    } else if (d.mode === 'crop-resize' && d.crop && d.handle) {
      setCropDraft(
        resizeRect(
          d.crop,
          d.handle,
          clamp(p.x, 0, full.w),
          clamp(p.y, 0, full.h),
        ),
      );
    }
  }

  function onPointerUp() {
    cancelAnimationFrame(pointer.current.raf);
    pointer.current.raf = 0;
    const d = drag.current;
    drag.current = null;
    const s = draftRef.current;
    setDraft(null);
    if (!d || !s) return;
    if (d.mode === 'move') {
      if (s.pts.some((v, i) => v !== d.shape!.pts[i]))
        commit({
          ...doc,
          shapes: doc.shapes.map((x) => (x.id === s.id ? s : x)),
        });
      return;
    }
    const [x1, y1, x2, y2] = s.pts;
    const freehand = s.kind === 'pen' || s.kind === 'highlight';
    if (freehand ? s.pts.length >= 4 : Math.hypot(x2 - x1, y2 - y1) > 3)
      commit({ ...doc, shapes: [...doc.shapes, s] });
  }

  function onDoubleClick(e: ReactMouseEvent<HTMLCanvasElement>) {
    if (tool !== 'select') return;
    const { x, y } = toImage(e);
    const hit = hitTest(
      canvasRef.current!.getContext('2d')!,
      doc.shapes,
      x,
      y,
      6 / scale,
    );
    if (hit?.kind === 'text')
      setEditing({
        x: hit.pts[0],
        y: hit.pts[1],
        id: hit.id,
        text: hit.text ?? '',
        color: hit.color,
        size: hit.size,
      });
  }

  function renderFinal(half = false) {
    const out = document.createElement('canvas');
    render(out, img!, doc.shapes, doc.crop ?? full);
    if (!half) return out;
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(out.width / 2));
    small.height = Math.max(1, Math.round(out.height / 2));
    const ctx = small.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(out, 0, 0, small.width, small.height);
    return small;
  }

  async function withBusy(
    label: string | (() => string),
    fn: () => Promise<unknown>,
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      showToast(typeof label === 'string' ? label : label());
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Something went wrong',
        4000,
      );
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    commitText();
    if (!dirty) return;
    await withBusy('Saved to history', async () => {
      const blob = await canvasToBlob(renderFinal());
      const { thumb, width, height } = await makeThumb(blob);
      const next: Shot = {
        ...shot!,
        blob,
        thumb,
        width,
        height,
        size: blob.size,
        updatedAt: Date.now(),
        original: shot!.original ?? shot!.blob,
        edits: doc,
      };
      await putShots([next]);
      setShot(next);
      setSavedDoc(doc);
    });
  }

  function copy() {
    return withBusy('Copied to clipboard', () =>
      copyPng(canvasToBlob(renderFinal())),
    );
  }

  const ocrProgress = (p: number) =>
    showToast(`Reading text… ${Math.round(p * 100)}%`, 60_000);

  function copyText() {
    let words = 0;
    return withBusy(
      () => `Copied ${words} word${words === 1 ? '' : 's'} to clipboard`,
      async () => {
        showToast('Reading text…', 60_000);
        const text = recognize(renderFinal(), ocrProgress).then((r) => {
          words = r.words.length;
          if (!r.text) throw new Error('No text found in this screenshot.');
          return r.text;
        });
        // Start the write now so it keeps the click's user activation; OCR errors surface via `text`.
        const write = copyTextToClipboard(text);
        write.catch(() => undefined);
        await text;
        await write;
      },
    );
  }

  function download(type: 'png' | Compressed) {
    setExportOpen(false);
    let saved: unknown;
    // A cancelled save dialog (desktop) shows no toast.
    return withBusy(
      () => (saved === false ? '' : SAVED_TOAST),
      async () => {
        const blob =
          type === 'png'
            ? await canvasToBlob(renderFinal())
            : await canvasToBlob(
                renderFinal(halfSize),
                `image/${type}`,
                quality,
              );
        saved = await downloadBlob(
          blob,
          fileName(shot!, type === 'jpeg' ? 'jpg' : type),
        );
      },
    );
  }

  function exportPdf(searchable = false) {
    setExportOpen(false);
    let saved: unknown;
    return withBusy(
      () => (saved === false ? '' : 'PDF ready'),
      async () => {
        const canvas = renderFinal();
        if (searchable) showToast('Reading text…', 60_000);
        const words = searchable
          ? (await recognize(canvas, ocrProgress)).words
          : undefined;
        saved = await downloadBlob(
          await canvasToPdf(canvas, words),
          fileName(shot!, 'pdf'),
        );
      },
    );
  }

  async function print() {
    setExportOpen(false);
    setPrintUrl(URL.createObjectURL(await canvasToBlob(renderFinal())));
  }

  async function rename(title: string) {
    const clean = title.trim() || 'Untitled';
    if (clean === shot!.title) return;
    const next = { ...shot!, title: clean };
    await putShots([next]);
    setShot(next);
    document.title = `${clean} – Daguerre`;
  }

  function changeQuality(q: number) {
    setQuality(q);
    localStorage.setItem('quality', String(q));
  }

  const cursor =
    tool === 'select'
      ? 'default'
      : tool === 'text'
        ? 'text'
        : tool === 'crop'
          ? cropCursor
          : 'crosshair';
  const out = doc.crop ?? full;

  return (
    <>
      <div className='editor'>
        <header className='topbar'>
          <a
            className='icon-btn'
            href='history.html'
            onClick={(e) => leaveToHistory() && e.preventDefault()}
            aria-label='Back to history'
            title='History'
          >
            <Icon name='back' />
          </a>
          <div className='doc-meta'>
            <input
              className='title-input'
              defaultValue={shot.title}
              aria-label='Screenshot title'
              onBlur={(e) => void rename(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
            <span className='meta'>
              {out.w} × {out.h} px · {MODE_LABEL[shot.mode]}
              {hostOf(shot.url) && ` · ${hostOf(shot.url)}`}
            </span>
          </div>

          <div className='group' role='group' aria-label='History'>
            <button
              className='icon-btn'
              onClick={undo}
              disabled={hist.index === 0}
              aria-label='Undo'
              title='Undo (⌘Z)'
            >
              <Icon name='undo' />
            </button>
            <button
              className='icon-btn'
              onClick={redo}
              disabled={hist.index === hist.stack.length - 1}
              aria-label='Redo'
              title='Redo (⇧⌘Z)'
            >
              <Icon name='redo' />
            </button>
          </div>
          <div className='group' role='group' aria-label='Zoom'>
            <button
              className='icon-btn'
              onClick={() => zoomBy(0.8)}
              aria-label='Zoom out'
              title='Zoom out (-)'
            >
              <Icon name='minus' />
            </button>
            <button
              className='zoom-value'
              onClick={() => setZoom(zoom === 'fit' ? 1 / DPR : 'fit')}
              title='Toggle fit / actual size (0)'
            >
              {zoom === 'fit' ? 'Fit' : `${Math.round(scale * DPR * 100)}%`}
            </button>
            <button
              className='icon-btn'
              onClick={() => zoomBy(1.25)}
              aria-label='Zoom in'
              title='Zoom in (+)'
            >
              <Icon name='plus' />
            </button>
          </div>

          <div className='spacer' />

          {(doc.shapes.length > 0 || doc.crop) && (
            <button
              className='btn ghost'
              onClick={() => commit(EMPTY)}
              title='Remove all annotations and crop'
            >
              <Icon name='reset' size={16} />
              Reset
            </button>
          )}
          <button
            className='btn'
            onClick={() => void copy()}
            disabled={busy}
            title='Copy to clipboard (⌘C)'
          >
            <Icon name='copy' size={16} />
            Copy to Clipboard
          </button>
          <button
            className='btn'
            onClick={() => void copyText()}
            disabled={busy}
            title='Copy the text in this screenshot, read on your device (⇧⌘C)'
          >
            <Icon name='scanText' size={16} />
            Copy Text
          </button>
          <div className='export' ref={exportRef}>
            <button
              className='btn'
              aria-expanded={exportOpen}
              aria-haspopup='dialog'
              onClick={() => setExportOpen(!exportOpen)}
              disabled={busy}
            >
              <Icon name='download' size={16} />
              Export
              <Icon name='chevron' size={14} />
            </button>
            {exportOpen && (
              <div className='menu' role='dialog' aria-label='Export'>
                <p className='menu-title'>Full quality</p>
                <MenuItem
                  icon='image'
                  label='PNG'
                  detail='Lossless'
                  size={estimates.png}
                  onClick={() => void download('png')}
                />
                <MenuItem
                  icon='pdf'
                  label='PDF'
                  detail='A4 pages'
                  onClick={() => void exportPdf()}
                />
                <MenuItem
                  icon='scanText'
                  label='Searchable PDF'
                  detail='Selectable English text (OCR, on-device)'
                  onClick={() => void exportPdf(true)}
                />
                <MenuItem
                  icon='print'
                  label='Print'
                  detail='⌘P'
                  onClick={() => void print()}
                />
                <hr />
                <p className='menu-title'>Compressed</p>
                <label className='slider'>
                  <span>Quality</span>
                  <input
                    type='range'
                    min={0.3}
                    max={0.95}
                    step={0.05}
                    value={quality}
                    onChange={(e) => changeQuality(Number(e.target.value))}
                  />
                  <output>{Math.round(quality * 100)}%</output>
                </label>
                <label className='check'>
                  <input
                    type='checkbox'
                    checked={halfSize}
                    onChange={(e) => setHalfSize(e.target.checked)}
                  />
                  Half resolution ({Math.round(out.w / 2)} ×{' '}
                  {Math.round(out.h / 2)})
                </label>
                <MenuItem
                  icon='image'
                  label='JPEG'
                  detail='Smallest, widely supported'
                  size={estimates.jpeg}
                  onClick={() => void download('jpeg')}
                />
                <MenuItem
                  icon='image'
                  label='WebP'
                  detail='Smaller, modern'
                  size={estimates.webp}
                  onClick={() => void download('webp')}
                />
              </div>
            )}
          </div>
          <button
            className='btn primary'
            onClick={() => void save()}
            disabled={!dirty || busy}
            title='Save to history (⌘S)'
          >
            <Icon name='check' size={16} />
            {dirty ? 'Save' : 'Saved'}
          </button>
        </header>

        <nav
          className='toolbar'
          role='toolbar'
          aria-orientation='vertical'
          aria-label='Tools'
        >
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className='tool'
              aria-pressed={tool === t.id}
              aria-label={t.label}
              title={`${t.label} (${t.key.toUpperCase()})`}
              onClick={() => selectTool(t.id)}
            >
              <Icon name={t.id as IconName} />
            </button>
          ))}
          <hr />
          {COLORS.map((c) => (
            <button
              key={c}
              className='swatch'
              style={{ '--c': c } as CSSProperties}
              aria-pressed={color === c}
              aria-label={`Color ${c}`}
              onClick={() => {
                setColor(c);
                updateSelected({ color: c });
              }}
            />
          ))}
          <label
            className='swatch custom'
            title='Custom color'
            style={{ '--c': color } as CSSProperties}
          >
            <input
              type='color'
              value={color}
              aria-label='Custom color'
              onChange={(e) => setColor(e.target.value)}
              onBlur={(e) => updateSelected({ color: e.target.value })}
            />
          </label>
          <hr />
          {SIZE_NAMES.map((name, i) => (
            <button
              key={name}
              className='size'
              aria-pressed={sizeIdx === i}
              aria-label={`${name} size`}
              title={`${name} size`}
              onClick={() => {
                setSizeIdx(i);
                const sel = doc.shapes.find((s) => s.id === selectedId);
                if (sel) updateSelected({ size: sizeFor(sel.kind, i, unit) });
              }}
            >
              <span style={{ width: 4 + i * 4, height: 4 + i * 4 }} />
            </button>
          ))}
        </nav>

        <main className='stage' ref={stageRef}>
          <div
            className='canvas-wrap'
            ref={wrapRef}
            style={{ width: view.w * scale, height: view.h * scale }}
          >
            <canvas
              ref={canvasRef}
              role='img'
              aria-label='Screenshot canvas'
              style={{ cursor }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onDoubleClick={onDoubleClick}
            />
            {editing && (
              <textarea
                className='text-input'
                autoFocus
                aria-label='Annotation text'
                placeholder='Type…'
                value={editing.text}
                style={{
                  left: (editing.x - view.x) * scale,
                  top: (editing.y - view.y) * scale,
                  fontSize: editing.size * scale,
                  color: editing.color,
                }}
                onChange={(e) =>
                  setEditing({ ...editing, text: e.target.value })
                }
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setEditing(null);
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    commitText();
                  }
                }}
              />
            )}
          </div>
          {tool === 'crop' && (
            <div className='floating-bar' role='group' aria-label='Crop'>
              <span className='meta'>
                {cropDraft
                  ? `${Math.round(cropDraft.w)} × ${Math.round(cropDraft.h)}`
                  : 'Drag to select an area'}
              </span>
              <button className='btn ghost' onClick={() => setCropDraft(null)}>
                Clear
              </button>
              <button
                className='btn ghost'
                onClick={() => selectTool('select')}
              >
                Cancel
              </button>
              <button className='btn primary' onClick={applyCrop}>
                Apply
              </button>
            </div>
          )}
        </main>
      </div>
      <Toast message={toast} />
      {confirmClose && (
        <ConfirmDialog
          title='Discard unsaved changes?'
          confirmLabel='Discard'
          onConfirm={() => answerClose(true)}
          onCancel={() => answerClose(false)}
        >
          Your edits since the last save will be lost.
        </ConfirmDialog>
      )}
      {printUrl && (
        <img
          className='print-only'
          src={printUrl}
          onLoad={() => void printPage()}
          alt=''
        />
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  detail,
  size,
  onClick,
}: {
  icon: IconName;
  label: string;
  detail: string;
  size?: number;
  onClick: () => void;
}) {
  return (
    <button className='menu-item' onClick={onClick}>
      <Icon name={icon} size={16} />
      <span className='menu-label'>
        {label}
        <small>{detail}</small>
      </span>
      {size !== undefined && (
        <span className='menu-size'>{formatBytes(size)}</span>
      )}
    </button>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Editor />);
