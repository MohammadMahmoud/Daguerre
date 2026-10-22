import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  clearShots,
  deleteShots,
  listShots,
  putShots,
  type CaptureMode,
  type Shot,
} from './lib/db';
import {
  copyPng,
  downloadBlob,
  fileName,
  formatBytes,
  hostOf,
} from './lib/export';
import './styles.css';
import { Icon, Logo, MODE_LABEL, Toast, useToast } from './ui';

const FILTERS: (CaptureMode | 'all')[] = [
  'all',
  'visible',
  'full',
  'selection',
  'tabs',
];

function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date().setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(ts).setHours(0, 0, 0, 0)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export function History() {
  const [shots, setShots] = useState<Shot[]>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CaptureMode | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [usage, setUsage] = useState<number>();
  const [toast, showToast] = useToast();

  const load = useCallback(async () => {
    setShots(await listShots());
    setUsage((await navigator.storage.estimate()).usage);
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () =>
      document.visibilityState === 'visible' && void load();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [load]);

  const thumbs = useMemo(
    () => new Map(shots?.map((s) => [s.id, URL.createObjectURL(s.thumb)])),
    [shots],
  );
  useEffect(
    () => () => thumbs.forEach((url) => URL.revokeObjectURL(url)),
    [thumbs],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (shots ?? []).filter(
      (s) =>
        (filter === 'all' || s.mode === filter) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.url.toLowerCase().includes(q)),
    );
  }, [shots, query, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, Shot[]>();
    for (const s of visible) {
      const label = dayLabel(s.createdAt);
      map.set(label, [...(map.get(label) ?? []), s]);
    }
    return [...map];
  }, [visible]);

  async function remove(ids: string[]) {
    const removed = shots!.filter((s) => ids.includes(s.id));
    await deleteShots(ids);
    setSelected(new Set());
    await load();
    showToast(
      <>
        Deleted{' '}
        {ids.length === 1 ? '1 screenshot' : `${ids.length} screenshots`}
        <button
          className='link'
          onClick={async () => {
            await putShots(removed);
            await load();
            showToast('Restored');
          }}
        >
          Undo
        </button>
      </>,
      6000,
    );
  }

  async function clearAll() {
    if (
      !confirm(
        `Delete all ${shots!.length} screenshots? This cannot be undone.`,
      )
    )
      return;
    await clearShots();
    setSelected(new Set());
    await load();
  }

  async function copy(shot: Shot) {
    try {
      await copyPng(shot.blob);
      showToast('Copied to clipboard');
    } catch {
      showToast('Could not copy. Click the page and try again.');
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    setSelected(next);
  }

  return (
    <div className='history'>
      <header className='history-head'>
        <div className='history-title'>
          <Logo size={34} />
          <div>
            <h1>History</h1>
            <p className='meta'>
              {shots
                ? `${shots.length} screenshot${shots.length === 1 ? '' : 's'}`
                : 'Loading…'}
              {usage !== undefined && ` · ${formatBytes(usage)} on this device`}
            </p>
          </div>
        </div>
        <label className='search'>
          <Icon name='search' size={16} />
          <input
            type='search'
            placeholder='Search by title or URL'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label='Search screenshots'
          />
        </label>
        <div
          className='segmented'
          role='radiogroup'
          aria-label='Filter by capture type'
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              role='radio'
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'tabs' ? 'Tabs' : MODE_LABEL[f]}
            </button>
          ))}
        </div>
        <div className='history-actions'>
          {selected.size > 0 ? (
            <>
              <span className='meta'>{selected.size} selected</span>
              <button
                className='btn ghost'
                onClick={() => setSelected(new Set(visible.map((s) => s.id)))}
              >
                Select all
              </button>
              <button
                className='btn ghost'
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
              <button
                className='btn danger'
                onClick={() => void remove([...selected])}
              >
                <Icon name='trash' size={16} />
                Delete
              </button>
            </>
          ) : (
            shots &&
            shots.length > 0 && (
              <button className='btn ghost' onClick={() => void clearAll()}>
                <Icon name='trash' size={16} />
                Clear all
              </button>
            )
          )}
        </div>
      </header>

      <main className='history-main'>
        {shots && shots.length === 0 && (
          <div className='empty'>
            <Logo size={56} />
            <h2>No screenshots yet</h2>
            <p>
              Click the Daguerre icon in the toolbar, or use a shortcut.
              Everything you capture is kept here, on this device only.
            </p>
            <ul className='shortcut-list'>
              <li>
                <kbd>Alt+Shift+V</kbd> Visible area
              </li>
              <li>
                <kbd>Alt+Shift+F</kbd> Entire page
              </li>
              <li>
                <kbd>Alt+Shift+S</kbd> Select area
              </li>
            </ul>
          </div>
        )}
        {shots && shots.length > 0 && visible.length === 0 && (
          <p className='empty meta'>No screenshots match your search.</p>
        )}
        {groups.map(([label, items]) => (
          <section key={label} className='day'>
            <h2>{label}</h2>
            <div className='grid'>
              {items.map((s) => (
                <article
                  key={s.id}
                  className='card'
                  data-selected={selected.has(s.id) || undefined}
                  data-selecting={selected.size > 0 || undefined}
                >
                  <a
                    className='card-thumb'
                    href={`editor.html?id=${s.id}`}
                    aria-label={`Edit ${s.title}`}
                  >
                    <img src={thumbs.get(s.id)} alt='' loading='lazy' />
                  </a>
                  <label className='card-check'>
                    <input
                      type='checkbox'
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      aria-label={`Select ${s.title}`}
                    />
                  </label>
                  <div className='card-actions'>
                    <button
                      className='icon-btn sm'
                      onClick={() => void copy(s)}
                      aria-label='Copy image'
                      title='Copy image'
                    >
                      <Icon name='copy' size={16} />
                    </button>
                    <button
                      className='icon-btn sm'
                      onClick={() => downloadBlob(s.blob, fileName(s, 'png'))}
                      aria-label='Download PNG'
                      title='Download PNG'
                    >
                      <Icon name='download' size={16} />
                    </button>
                    <button
                      className='icon-btn sm'
                      onClick={() => void remove([s.id])}
                      aria-label='Delete'
                      title='Delete'
                    >
                      <Icon name='trash' size={16} />
                    </button>
                  </div>
                  <div className='card-body'>
                    <a
                      className='card-title'
                      href={`editor.html?id=${s.id}`}
                      title={s.title}
                    >
                      {s.title}
                    </a>
                    <div className='card-meta'>
                      <span className='pill'>{MODE_LABEL[s.mode]}</span>
                      <span className='truncate'>
                        {hostOf(s.url) || 'Local page'}
                      </span>
                    </div>
                    <div className='card-meta mono'>
                      <span>
                        {s.width}×{s.height}
                      </span>
                      <span>{formatBytes(s.size)}</span>
                      <span>
                        {new Date(s.createdAt).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </main>
      <Toast message={toast} />
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<History />);
