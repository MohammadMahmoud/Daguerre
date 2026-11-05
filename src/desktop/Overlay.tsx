import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { Rect } from '../lib/db';
import '../styles.css';

interface PickableWindow {
  id: number;
  title: string;
  rect: Rect;
}

interface OverlayInfo {
  /** Monitor size in the units Rust expects back (points on macOS, pixels elsewhere). */
  width: number;
  height: number;
  windows: PickableWindow[];
}

type Point = { x: number; y: number };

const finish = (pick: { rect?: Rect; windowId?: number; error?: string }) =>
  invoke('finish_selection', pick);

const reportError = (error: unknown) =>
  finish({ error: error instanceof Error ? error.message : String(error) });

const inside = (r: Rect, p: Point) =>
  p.x >= r.x && p.y >= r.y && p.x < r.x + r.w && p.y < r.y + r.h;

/** Full-screen frozen frame of one monitor: drag a region, or click a window in window mode. */
export function Overlay() {
  const pickWindow =
    new URLSearchParams(location.search).get('kind') === 'window';
  const [src, setSrc] = useState<string>();
  const [info, setInfo] = useState<OverlayInfo>();
  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null);
  const [hover, setHover] = useState<PickableWindow>();
  const readyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Monitor units per CSS pixel.
  const k = info ? info.width / innerWidth : 1;

  useEffect(() => {
    let active = true;
    let url: string | undefined;
    readyTimer.current = setTimeout(() => {
      active = false;
      void reportError(
        'The selection overlay did not become ready. Please try again.',
      );
    }, 15_000);
    Promise.all([
      invoke<ArrayBuffer>('overlay_frame'),
      invoke<OverlayInfo>('overlay_info'),
    ])
      .then(([png, next]) => {
        if (!active) return;
        url = URL.createObjectURL(new Blob([png], { type: 'image/png' }));
        setSrc(url);
        setInfo(next);
      })
      .catch((error: unknown) => {
        clearTimeout(readyTimer.current);
        if (active) void reportError(error);
      });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && void finish({});
    addEventListener('keydown', onKey);
    return () => {
      active = false;
      clearTimeout(readyTimer.current);
      if (url) URL.revokeObjectURL(url);
      removeEventListener('keydown', onKey);
    };
  }, []);

  const point = (e: ReactPointerEvent) => ({ x: e.clientX, y: e.clientY });
  const box =
    start && end
      ? {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          w: Math.abs(end.x - start.x),
          h: Math.abs(end.y - start.y),
        }
      : null;
  const dragging = !!box && (box.w > 3 || box.h > 3);
  const scaled = (r: Rect) => ({
    x: r.x * k,
    y: r.y * k,
    w: r.w * k,
    h: r.h * k,
  });
  const highlight = dragging
    ? box
    : hover && {
        x: hover.rect.x / k,
        y: hover.rect.y / k,
        w: hover.rect.w / k,
        h: hover.rect.h / k,
      };

  function onMove(e: ReactPointerEvent) {
    if (start) return setEnd(point(e));
    if (!pickWindow || !info) return;
    const p = { x: e.clientX * k, y: e.clientY * k };
    setHover(info.windows.find((w) => inside(w.rect, p)));
  }

  function onUp() {
    if (dragging && box) void finish({ rect: scaled(box) });
    else if (hover) void finish({ windowId: hover.id });
    setStart(null);
    setEnd(null);
  }

  return (
    <div
      className='overlay'
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setStart(point(e));
        setEnd(point(e));
      }}
      onPointerMove={onMove}
      onPointerUp={onUp}
    >
      {src && (
        <img
          className='overlay-frame'
          src={src}
          alt=''
          draggable={false}
          onError={() => {
            clearTimeout(readyTimer.current);
            void reportError(
              'Could not load the screenshot. Please try again.',
            );
          }}
          onLoad={() => {
            const win = getCurrentWindow();
            void win
              .show()
              .then(() => win.setFocus())
              .catch(reportError)
              .finally(() => clearTimeout(readyTimer.current));
          }}
        />
      )}
      {highlight ? (
        <div
          className='overlay-box'
          style={{
            left: highlight.x,
            top: highlight.y,
            width: highlight.w,
            height: highlight.h,
          }}
        >
          <span className='overlay-size'>
            {dragging
              ? `${Math.round(highlight.w * k)} × ${Math.round(highlight.h * k)}`
              : hover?.title}
          </span>
        </div>
      ) : (
        <div className='overlay-shade' />
      )}
      <p className='overlay-hint' role='status'>
        {pickWindow
          ? 'Click a window or drag an area · Esc to cancel'
          : 'Drag to select an area · Esc to cancel'}
      </p>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Overlay />);
