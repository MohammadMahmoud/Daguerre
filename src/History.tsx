import {
  CAPTURE_HINT,
  CAPTURE_MODES,
  NO_URL_LABEL,
  SAVE_PNG_LABEL,
  SEARCH_PLACEHOLDER,
  SHORTCUT_HINTS,
} from '@platform';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import type { ImportResult } from './desktop/DocumentImport';
import {
  clearShots,
  deleteShots,
  listShots,
  putShots,
  type CaptureMode,
  type Shot,
} from './lib/Db';
import {
  copyPng,
  downloadBlob,
  fileName,
  formatBytes,
  hostOf,
} from './lib/Export';
import './Styles.css';
import { ConfirmDialog, Icon, Logo, MODE_LABEL, Toast, useToast } from './Ui';

function hasDraggedFiles(dt: DataTransfer | null) {
  if (!dt) return false;
  if (Array.from(dt.types ?? []).includes('Files')) return true;
  return (dt.files?.length ?? 0) > 0;
}

function summarizeImport(result: ImportResult) {
  const notes: string[] = [];
  if (result.truncatedPdfPages > 0) {
    notes.push(
      `${result.truncatedPdfPages} PDF page${result.truncatedPdfPages === 1 ? '' : 's'} beyond 25 skipped`,
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

/** `embedded` drops the page logo; `onOpen` opens screenshots instead of following editor links. */
export function History({
  embedded = false,
  onOpen,
  onChange,
  modes = CAPTURE_MODES,
  onUpload,
  uploadAccept,
  handleDrop = true,
  refreshKey = 0,
}: {
  embedded?: boolean;
  onOpen?: (id: string) => void;
  onChange?: () => void;
  modes?: CaptureMode[];
  onUpload?: (files: File[]) => Promise<ImportResult>;
  uploadAccept?: string;
  handleDrop?: boolean;
  refreshKey?: number;
} = {}) {
  const canUpload = Boolean(onUpload);
  const canDrop = canUpload && handleDrop;
  const filters = useMemo<(CaptureMode | 'all')[]>(
    () => ['all', ...modes],
    [modes],
  );
  const root = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const uploadingRef = useRef(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [shots, setShots] = useState<Shot[]>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CaptureMode | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [usage, setUsage] = useState<number>();
  const [confirmClear, setConfirmClear] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [toast, showToast] = useToast();

  useEffect(() => {
    const pane = embedded
      ? root.current?.closest<HTMLElement>('.app-main')
      : (document.scrollingElement ?? document.documentElement);
    if (!pane) return;
    const target = embedded ? pane : window;
    const onScroll = () => setIsScrolled(pane.scrollTop > 12);
    onScroll();
    target.addEventListener('scroll', onScroll, { passive: true });
    return () => target.removeEventListener('scroll', onScroll);
  }, [embedded]);

  const load = useCallback(async () => {
    setShots(await listShots());
    setUsage((await navigator.storage.estimate()).usage);
  }, []);

  useEffect(() => {
    void load();
    const onVisible = () =>
      document.visibilityState === 'visible' && void load();
    const onFocus = () => void load();
    document.addEventListener('visibilitychange', onVisible);
    // Desktop: the window stays visible while the editor (another window) changes shots.
    addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      removeEventListener('focus', onFocus);
    };
  }, [load]);

  useEffect(() => {
    if (refreshKey === 0) return;
    setFilter((f) => (f !== 'all' && f !== 'upload' ? 'all' : f));
    void load();
  }, [refreshKey, load]);

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
    onChange?.();
    showToast(
      <>
        Deleted{' '}
        {ids.length === 1 ? '1 screenshot' : `${ids.length} screenshots`}
        <button
          className='link'
          onClick={async () => {
            await putShots(removed);
            await load();
            onChange?.();
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
    setConfirmClear(false);
    await clearShots();
    setSelected(new Set());
    await load();
    onChange?.();
  }

  const openProps = (id: string) =>
    onOpen && {
      onClick: (e: { preventDefault(): void }) => {
        e.preventDefault();
        onOpen(id);
      },
    };

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

  useEffect(() => {
    if (!dragActive) return;
    const dismiss = () => {
      dragDepthRef.current = 0;
      setDragActive(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    addEventListener('blur', dismiss);
    addEventListener('dragend', dismiss);
    addEventListener('keydown', onKeyDown);
    return () => {
      removeEventListener('blur', dismiss);
      removeEventListener('dragend', dismiss);
      removeEventListener('keydown', onKeyDown);
    };
  }, [dragActive]);

  const openPicker = () => {
    if (!canUpload || uploadingRef.current) return;
    fileInputRef.current?.click();
  };

  const handleUpload = async (files: File[]) => {
    if (!onUpload || files.length === 0 || uploadingRef.current) return;
    uploadingRef.current = true;
    setUploading(true);
    try {
      const result = await onUpload(files);
      const summary = summarizeImport(result);
      if (result.ids.length > 0) {
        if (filter !== 'all' && filter !== 'upload') setFilter('all');
        await load();
        onChange?.();
        const firstId = result.ids[0];
        showToast(
          <>
            <span>{summary}</span>
            {onOpen && (
              <button
                type='button'
                className='link'
                onClick={() => onOpen(firstId)}
              >
                {result.ids.length === 1 ? 'Open' : 'Open first'}
              </button>
            )}
          </>,
          4500,
        );
      } else {
        showToast(summary, 4000);
      }
    } catch {
      showToast('Could not import the selected document.', 4000);
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop || !hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop || !hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = () => {
    if (!canDrop) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!canDrop) return;
    dragDepthRef.current = 0;
    setDragActive(false);
    if (!hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) void handleUpload(files);
  };

  return (
    <div
      ref={root}
      className={embedded ? 'history embedded' : 'history'}
      data-dragging={canDrop && dragActive ? 'true' : undefined}
      onDragEnter={canDrop ? onDragEnter : undefined}
      onDragOver={canDrop ? onDragOver : undefined}
      onDragLeave={canDrop ? onDragLeave : undefined}
      onDrop={canDrop ? onDrop : undefined}
    >
      {canUpload && (
        <input
          ref={fileInputRef}
          type='file'
          multiple
          accept={uploadAccept}
          tabIndex={-1}
          aria-hidden='true'
          className='visually-hidden'
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) void handleUpload(files);
          }}
        />
      )}
      <header className='history-head' data-scrolled={isScrolled}>
        <div className='history-title'>
          {!embedded && <Logo size={34} />}
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
            placeholder={SEARCH_PLACEHOLDER}
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
          {filters.map((f) => (
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
            <>
              {canUpload && (
                <button
                  type='button'
                  className='btn primary upload-btn'
                  onClick={openPicker}
                  disabled={uploading}
                  aria-busy={uploading || undefined}
                >
                  {uploading ? (
                    <>
                      <span className='spinner sm' aria-hidden='true' />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Icon name='upload' size={16} />
                      Upload
                    </>
                  )}
                </button>
              )}
              {shots && shots.length > 0 && (
                <button
                  type='button'
                  className='btn ghost'
                  onClick={() => setConfirmClear(true)}
                >
                  <Icon name='trash' size={16} />
                  Clear all
                </button>
              )}
            </>
          )}
        </div>
      </header>

      <main className='history-main'>
        {shots && shots.length === 0 && (
          <div className='empty'>
            <Logo size={56} />
            <h2>No screenshots yet</h2>
            <p>
              {CAPTURE_HINT} Everything you capture is kept here, on this device
              only.
            </p>
            <ul className='shortcut-list'>
              {SHORTCUT_HINTS.map(([keys, label]) => (
                <li key={keys}>
                  <kbd>{keys}</kbd> {label}
                </li>
              ))}
            </ul>
            {canUpload && (
              <button
                type='button'
                className='upload-empty-drop'
                onClick={openPicker}
                disabled={uploading}
              >
                <span className='upload-empty-icon'>
                  <Icon name='upload' size={20} />
                </span>
                <strong>Drop images or PDFs here</strong>
                <span className='meta'>
                  or click to upload · PNG, JPEG, WebP, GIF, SVG, or PDF
                </span>
              </button>
            )}
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
                    {...openProps(s.id)}
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
                      onClick={() =>
                        void downloadBlob(s.blob, fileName(s, 'png'))
                      }
                      aria-label={SAVE_PNG_LABEL}
                      title={SAVE_PNG_LABEL}
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
                      {...openProps(s.id)}
                    >
                      {s.title}
                    </a>
                    <div className='card-meta'>
                      <span className='pill'>{MODE_LABEL[s.mode]}</span>
                      <span className='truncate'>
                        {hostOf(s.url) || NO_URL_LABEL}
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
      {confirmClear && (
        <ConfirmDialog
          title={`Delete all ${shots!.length} screenshots?`}
          confirmLabel='Delete all'
          onConfirm={() => void clearAll()}
          onCancel={() => setConfirmClear(false)}
        >
          This can't be undone.
        </ConfirmDialog>
      )}
      {canDrop && dragActive && (
        <div
          className='drop-overlay'
          role='region'
          aria-label='Drop documents to upload'
        >
          <div className='drop-overlay-card'>
            <span className='drop-overlay-icon'>
              <Icon name='upload' size={28} />
            </span>
            <strong>Drop to add to History</strong>
            <span className='meta'>
              PNG, JPEG, WebP, GIF, SVG, or PDF · Stored locally on this device
            </span>
          </div>
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<History />);
