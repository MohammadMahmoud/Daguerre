import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CaptureMode } from './lib/db';

// Static, trusted SVG markup (24×24, stroked).
const ICONS = {
  visible:
    '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  full: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 6.5v9M8.5 12 12 15.5 15.5 12"/>',
  selection:
    '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M12 9v6M9 12h6"/>',
  tabs: '<rect x="7" y="3" width="14" height="12" rx="2"/><path d="M17 19H6a2 2 0 0 1-2-2V8"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5M12 7.5V12l3 2"/>',
  select: '<path d="M5 3.5 18.5 10l-6 1.8-2.2 6.2z"/>',
  crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14"/>',
  arrow: '<path d="M5 19 19 5M9 5h10v10"/>',
  rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
  line: '<path d="M5 19 19 5"/>',
  pen: '<path d="M15.5 4.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/><path d="M13.5 6.5l3 3"/>',
  highlight:
    '<path d="m9 11-5 5v4h4l5-5"/><path d="m9 11 6-6 4 4-6 6zM14 20h6"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
  step: '<circle cx="12" cy="12" r="9"/><path d="M10.5 9.5 12.5 8v8"/>',
  blur: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  pdf: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  scanText:
    '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M8 9h8M8 12h8M8 15h5"/>',
  print:
    '<path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  back: '<path d="M15 18 9 12l6-6"/>',
  minus: '<path d="M5 12h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  keyboard:
    '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  window:
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9.5 6.5h.01"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={1.75}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

export function Logo({
  size = 28,
  mono = false,
}: {
  size?: number;
  mono?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 28 28'
      aria-hidden='true'
      className={mono ? 'logo logo-mono' : 'logo'}
    >
      {!mono && (
        <>
          <defs>
            <linearGradient id='sc-onyx' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0' stopColor='#2a2a2f' />
              <stop offset='1' stopColor='#050506' />
            </linearGradient>
            <linearGradient id='sc-silver' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0' stopColor='#ffffff' />
              <stop offset='0.5' stopColor='#c9ccd2' />
              <stop offset='1' stopColor='#8e929a' />
            </linearGradient>
          </defs>
          <rect
            x='0.5'
            y='0.5'
            width='27'
            height='27'
            rx='7.5'
            fill='url(#sc-onyx)'
            stroke='rgba(255,255,255,.16)'
          />
        </>
      )}
      <path
        d={
          mono
            ? 'M5 10V5h5M18 5h5v5M23 18v5h-5M10 23H5v-5'
            : 'M8 11.5V8h3.5M16.5 8H20v3.5M20 16.5V20h-3.5M11.5 20H8v-3.5'
        }
        stroke={mono ? '#ffffff' : 'url(#sc-silver)'}
        strokeWidth={mono ? '2.5' : '2.2'}
        fill='none'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <circle
        cx='14'
        cy='14'
        r={mono ? '2.4' : '2'}
        fill={mono ? '#ffffff' : 'url(#sc-silver)'}
      />
    </svg>
  );
}

export const MODE_LABEL: Record<CaptureMode, string> = {
  visible: 'Visible area',
  full: 'Full page',
  selection: 'Selection',
  tabs: 'Tab',
  screen: 'Screen',
  window: 'Window',
};

export function useToast() {
  const [message, setMessage] = useState<ReactNode>();
  const timer = useRef<number>(undefined);
  const show = useCallback((m: ReactNode, ms = 2600) => {
    clearTimeout(timer.current);
    setMessage(m);
    timer.current = window.setTimeout(() => setMessage(undefined), ms);
  }, []);
  return [message, show] as const;
}

export function Toast({ message }: { message: ReactNode }) {
  return (
    <div
      className='toast'
      role='status'
      aria-live='polite'
      data-show={message ? '' : undefined}
    >
      {message}
    </div>
  );
}

/** Modal confirmation; keeps keyboard focus inside and cancels on Escape or a backdrop click. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector('button')?.focus();
    // Capture phase, so page shortcuts underneath don't fire while the dialog is open.
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') return cancel.current();
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const buttons = [...dialog.current!.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const step = e.shiftKey ? -1 : 1;
      buttons[(i + step + buttons.length) % buttons.length].focus();
    };
    addEventListener('keydown', onKey, true);
    return () => {
      removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className='dialog-backdrop'
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        ref={dialog}
        className='dialog'
        role='alertdialog'
        aria-modal='true'
        aria-labelledby='dialog-title'
        aria-describedby='dialog-body'
      >
        <h2 id='dialog-title'>{title}</h2>
        <p id='dialog-body'>{children}</p>
        <div className='dialog-actions'>
          <button className='btn ghost' onClick={onCancel}>
            Cancel
          </button>
          <button className='btn danger' onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
