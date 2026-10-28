import { useEffect, useMemo } from 'react';
import type { Shot } from '../lib/db';
import type { Action } from '../platform/Desktop';
import { Icon, MODE_LABEL, type IconName } from '../ui';
import { formatShortcut, type Shortcuts } from './Shortcuts';

const MODES: {
  action: Action;
  label: string;
  description: string;
  icon: IconName;
}[] = [
  {
    action: 'selection',
    label: 'Select area',
    description: 'Drag across any part of the screen.',
    icon: 'selection',
  },
  {
    action: 'window',
    label: 'Window',
    description: 'Click a window to capture just that window.',
    icon: 'window',
  },
  {
    action: 'screen',
    label: 'Screen',
    description: 'The whole display under the pointer.',
    icon: 'visible',
  },
];
const DELAYS = [0, 3, 5, 10];
const RECENT = 8;

const when = (ts: number) =>
  new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function CapturePage({
  shortcuts,
  mac,
  delay,
  onDelay,
  onCapture,
  shots,
  onOpen,
  onCopy,
  onViewAll,
}: {
  shortcuts: Shortcuts;
  mac: boolean;
  delay: number;
  onDelay: (seconds: number) => void;
  onCapture: (action: Action, delay: number) => void;
  shots: Shot[];
  onOpen: (id: string) => void;
  onCopy: (shot: Shot) => void;
  onViewAll: () => void;
}) {
  const recent = useMemo(() => shots.slice(0, RECENT), [shots]);
  const thumbs = useMemo(
    () => new Map(recent.map((s) => [s.id, URL.createObjectURL(s.thumb)])),
    [recent],
  );
  useEffect(
    () => () => thumbs.forEach((url) => URL.revokeObjectURL(url)),
    [thumbs],
  );

  const kbd = (action: Action) =>
    shortcuts[action] ? (
      <kbd>{formatShortcut(shortcuts[action], mac)}</kbd>
    ) : (
      <span className='meta'>No shortcut</span>
    );

  return (
    <div className='page'>
      <header className='page-head' data-tauri-drag-region>
        <div>
          <h1>Capture</h1>
          <p>Screenshots open in the editor and are kept in History.</p>
        </div>
        <div className='delay-field'>
          <span className='field-label' id='delay-label'>
            <Icon name='timer' size={15} />
            Delay
          </span>
          <div
            className='segmented'
            role='radiogroup'
            aria-labelledby='delay-label'
            aria-describedby='delay-hint'
          >
            {DELAYS.map((d) => (
              <button
                key={d}
                role='radio'
                aria-checked={delay === d}
                onClick={() => onDelay(d)}
              >
                {d ? `${d}s` : 'Off'}
              </button>
            ))}
          </div>
          <p className='field-hint' id='delay-hint'>
            For these buttons, so you can open menus first.
          </p>
        </div>
      </header>

      <div className='mode-grid'>
        {MODES.map((m) => (
          <button
            key={m.action}
            className='mode-card'
            onClick={() => onCapture(m.action, delay)}
          >
            <span className='mode-icon'>
              <Icon name={m.icon} size={22} />
            </span>
            <span className='mode-label'>{m.label}</span>
            <span className='mode-desc'>{m.description}</span>
            <span className='mode-key'>{kbd(m.action)}</span>
          </button>
        ))}
      </div>

      <button
        className='quick-action'
        onClick={() => onCapture('copy-selection', delay)}
      >
        <span className='mode-icon'>
          <Icon name='copy' size={20} />
        </span>
        <span className='quick-text'>
          <span className='mode-label'>Copy selected area</span>
          <span className='mode-desc'>
            Straight to the clipboard, without the editor. Also kept in History.
          </span>
        </span>
        {kbd('copy-selection')}
      </button>

      <section aria-labelledby='recent-title'>
        <div className='section-head'>
          <h2 id='recent-title'>Recent</h2>
          {shots.length > 0 && (
            <button className='link' onClick={onViewAll}>
              View all {shots.length}
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className='recent-empty'>
            <Icon name='image' size={22} />
            <p>Your screenshots will appear here.</p>
          </div>
        ) : (
          <ul className='recent-shots'>
            {recent.map((s) => (
              <li key={s.id} className='shot'>
                <button
                  className='shot-open'
                  onClick={() => onOpen(s.id)}
                  aria-label={`Edit ${s.title}`}
                >
                  <img src={thumbs.get(s.id)} alt='' />
                </button>
                <div className='shot-meta'>
                  <span className='shot-title truncate' title={s.title}>
                    {s.title}
                  </span>
                  <span className='meta'>
                    {MODE_LABEL[s.mode]} · {when(s.createdAt)}
                  </span>
                </div>
                <button
                  className='icon-btn sm shot-copy'
                  onClick={() => onCopy(s)}
                  aria-label={`Copy ${s.title}`}
                  title='Copy image'
                >
                  <Icon name='copy' size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
