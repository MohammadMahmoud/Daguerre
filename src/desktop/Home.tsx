import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Effect, EffectState, getCurrentWindow } from '@tauri-apps/api/window';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type ReactNode,
} from 'react';
import { createRoot } from 'react-dom/client';
import { History } from '../History';
import { listShots, type Shot } from '../lib/Db';
import { formatBytes } from '../lib/Export';
import { copyPng, CAPTURE_MODES, type Action } from '../platform/Desktop';
import '../Styles.css';
import {
  ConfirmDialog,
  Icon,
  Logo,
  SUPPORT_LABEL,
  SUPPORT_TEXT,
  SUPPORT_URL,
  Toast,
  useToast,
  type IconName,
} from '../Ui';
import { runCapture } from './Capture';
import { CapturePage } from './CapturePage';
import {
  DOCUMENT_ACCEPT,
  formatImportSummary,
  importDocuments,
} from './DocumentImport';
import { ProductTour } from './ProductTour';
import { SettingsPage, updateMessage, type TrayIcon } from './SettingsPage';
import { loadShortcuts, type Shortcuts } from './Shortcuts';
import { applyTheme, changeTheme, type Theme } from './Theme';
import { useUpdater } from './Updater';

type Page = 'capture' | 'history' | 'settings';
const PAGES: { id: Page; label: string; icon: IconName }[] = [
  { id: 'capture', label: 'Capture', icon: 'selection' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const openEditor = (id: string) => void invoke('open_editor', { id });
const openExternal = (url: string) => void invoke('open_external', { url });
const UPDATE_COUNTDOWN_SECONDS = 60;

function formatReleaseDate(date?: string) {
  if (!date) return undefined;
  const parsed = Date.parse(date);
  if (Number.isNaN(parsed)) return date;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    parsed,
  );
}

const INLINE_MD =
  /\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|~~(.+?)~~|\*([^*]+)\*|_([^_]+)_|\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g;

/** Converts inline Markdown tokens (bold, italic, code, strikethrough, https links) to React nodes. */
function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of text.matchAll(INLINE_MD)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(text.slice(lastIndex, index));
    if (match[1] !== undefined || match[2] !== undefined) {
      nodes.push(
        <strong key={key++}>
          {renderInlineMarkdown(match[1] ?? match[2])}
        </strong>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(<code key={key++}>{match[3]}</code>);
    } else if (match[4] !== undefined) {
      nodes.push(<del key={key++}>{renderInlineMarkdown(match[4])}</del>);
    } else if (match[5] !== undefined || match[6] !== undefined) {
      nodes.push(
        <em key={key++}>{renderInlineMarkdown(match[5] ?? match[6])}</em>,
      );
    } else if (match[7] !== undefined && match[8] !== undefined) {
      const url = match[8];
      nodes.push(
        <button
          key={key++}
          type='button'
          className='link'
          onClick={() => openExternal(url)}
        >
          {match[7]}
        </button>,
      );
    }
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

/** Renders release notes markdown into safe headings, lists, paragraphs, and inline formatting. */
function UpdateChangelog({ notes }: { notes: string }) {
  const blocks: {
    kind: 'heading' | 'list' | 'ordered' | 'paragraph';
    items: string[];
  }[] = [];
  for (const raw of notes.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^##\s+\[?v?\d/.test(line)) continue;
    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      blocks.push({ kind: 'heading', items: [heading[1].trim()] });
    } else if (/^[-*]\s+/.test(line)) {
      const text = line.slice(2).trim();
      const prev = blocks.at(-1);
      if (prev?.kind === 'list') prev.items.push(text);
      else blocks.push({ kind: 'list', items: [text] });
    } else if (/^\d+\.\s+/.test(line)) {
      const text = line.replace(/^\d+\.\s+/, '').trim();
      const prev = blocks.at(-1);
      if (prev?.kind === 'ordered') prev.items.push(text);
      else blocks.push({ kind: 'ordered', items: [text] });
    } else {
      blocks.push({ kind: 'paragraph', items: [line] });
    }
  }
  if (!blocks.length) return null;
  return (
    <div className='update-changelog' aria-label='Release notes'>
      {blocks.map((block, index) => {
        if (block.kind === 'heading')
          return <h4 key={index}>{renderInlineMarkdown(block.items[0])}</h4>;
        if (block.kind === 'list')
          return (
            <ul key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        if (block.kind === 'ordered')
          return (
            <ol key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        return <p key={index}>{renderInlineMarkdown(block.items[0])}</p>;
      })}
    </div>
  );
}

function UpdatePrompt({
  version,
  date,
  notes,
  auto,
  onInstall,
  onSkip,
}: {
  version: string;
  date?: string;
  notes?: string;
  auto: boolean;
  onInstall: () => void;
  onSkip: () => void;
}) {
  const [seconds, setSeconds] = useState(UPDATE_COUNTDOWN_SECONDS);
  const installRef = useRef(onInstall);
  installRef.current = onInstall;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          installRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const releaseDate = formatReleaseDate(date);

  return (
    <ConfirmDialog
      title='Update available'
      confirmLabel={auto ? 'Install' : 'Download & install'}
      cancelLabel='Skip'
      tone='primary'
      onConfirm={onInstall}
      onCancel={onSkip}
    >
      <div className='update-meta'>
        {releaseDate && <span className='update-date'>{releaseDate}</span>}
        <span>Daguerre v{version} is available.</span>
      </div>
      {notes && <UpdateChangelog notes={notes} />}
      <div className='update-countdown' role='timer' aria-live='polite'>
        Please save your work. Installing automatically in{' '}
        <strong>{seconds}s</strong>.
      </div>
    </ConfirmDialog>
  );
}

function loadThemeBlend() {
  const saved = localStorage.getItem('themeBlend');
  if (saved === null)
    return localStorage.getItem('appearance') === 'glass' ? 100 : 0;
  const value = Number(saved);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Applies a Window design strength to the whole document and remembers it locally. */
function showThemeBlend(value: number) {
  document.documentElement.style.setProperty(
    '--theme-blend',
    String(value / 100),
  );
  localStorage.setItem('themeBlend', String(value));
  localStorage.setItem('appearance', value > 0 ? 'glass' : 'current');
}

/** The main window: capture, History and Settings. It hides on close and keeps handling shortcuts. */
export function Home() {
  const [page, setPage] = useState<Page>('capture');
  const [delay, setDelay] = useState(
    () => Number(localStorage.getItem('delay')) || 0,
  );
  const [shortcuts, setShortcuts] = useState(loadShortcuts);
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [platform, setPlatform] = useState({ os: '', wayland: false });
  const [screenAccess, setScreenAccess] = useState(true);
  const [autostart, setAutostart] = useState(false);
  const [theme, setTheme] = useState(applyTheme);
  const [themeReady, setThemeReady] = useState(false);
  const [tourPreview, setTourPreview] = useState<{
    theme: Theme;
    blend: number;
  }>();
  const [tourOpen, setTourOpen] = useState(
    () => localStorage.getItem('hasCompletedOnboardingTour') !== 'true',
  );
  const tourActive = useRef(tourOpen);
  tourActive.current = tourOpen;
  const previousPage = useRef<Page>('capture');
  const [initialBlend] = useState(loadThemeBlend);
  const blend = useRef(initialBlend);
  // Remounts Settings when the saved value corrects the local one at launch.
  const [blendSource, setBlendSource] = useState(0);
  const [glass, setGlass] = useState(initialBlend > 0);
  const [nativeGlass, setNativeGlass] = useState(false);
  const [trayIcon, setTrayIcon] = useState<TrayIcon>(() =>
    localStorage.getItem('trayIcon') === 'app' ? 'app' : 'white',
  );
  const [version, setVersion] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [usage, setUsage] = useState<number>();
  const [dragActive, setDragActive] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [toast, showToast] = useToast();
  const updater = useUpdater();
  const availableBanner =
    updater.state.status === 'available' &&
    !updater.promptOpen &&
    !updater.bannerDismissed;
  const downloading = updater.state.status === 'downloading';
  const updated = updater.state.status === 'ready';
  const installError =
    updater.state.status === 'error' &&
    updater.state.during === 'install' &&
    page !== 'settings';
  const busy = useRef(false);
  const dragDepthRef = useRef(0);
  const uploadingRef = useRef(false);
  const recording = useRef(false);
  const current = useRef(shortcuts);
  const platformInfo = useRef<typeof platform | null>(null);
  const mac = platform.os === 'macos';
  const visibleGlass = tourPreview ? tourPreview.blend > 0 : glass;
  const finishTour = useCallback(() => {
    setTourPreview(undefined);
    setTourOpen(false);
    setPage(previousPage.current);
  }, []);

  useEffect(() => {
    if (!mac) return;
    let active = true;
    const preference = window.matchMedia(
      '(prefers-reduced-transparency: reduce), (prefers-contrast: more)',
    );
    const apply = async () => {
      const transparent = visibleGlass && !preference.matches;
      try {
        const currentWindow = getCurrentWindow();
        if (transparent) {
          // Liquid Glass needs macOS 26; older versions get the vibrancy material.
          const liquid = await invoke<boolean>('set_liquid_glass', {
            on: true,
          });
          if (!liquid)
            await currentWindow.setEffects({
              effects: [Effect.UnderWindowBackground],
              state: EffectState.Active,
            });
        } else {
          await invoke('set_liquid_glass', { on: false });
          await currentWindow.clearEffects();
        }
        if (active) setNativeGlass(transparent);
      } catch {
        if (active) setNativeGlass(false);
      }
    };
    void apply();
    preference.addEventListener('change', apply);
    return () => {
      active = false;
      preference.removeEventListener('change', apply);
    };
  }, [visibleGlass, mac]);

  useEffect(() => {
    if (!platform.os) return;
    let active = true;
    void invoke<number | null>('theme_blend')
      .then((saved) => {
        if (!active) return;
        if (!mac) {
          const legacyGlass = ['theme', 'appearance'].some((key) =>
            ['liquid-glass', 'glass'].includes(localStorage.getItem(key) ?? ''),
          );
          if (blend.current > 0 || (saved ?? 0) > 0 || legacyGlass) {
            changeTheme('dark');
            setTheme('dark');
          }
          blend.current = 0;
          showThemeBlend(0);
          setGlass(false);
          if (saved !== 0) void invoke('set_theme_blend', { value: 0 });
          return;
        }
        showThemeBlend(blend.current);
        if (saved == null)
          return void invoke('set_theme_blend', { value: blend.current });
        if (saved === blend.current) return;
        blend.current = saved;
        showThemeBlend(saved);
        setGlass(saved > 0);
        setBlendSource((n) => n + 1);
      })
      .catch((error: unknown) => setError(String(error)))
      .finally(() => {
        if (active) setThemeReady(true);
      });
    return () => {
      active = false;
    };
  }, [mac, platform.os]);

  const refresh = useCallback(async () => {
    setShots(await listShots());
    setUsage((await navigator.storage?.estimate?.())?.usage);
  }, []);

  useEffect(() => {
    if (page === 'capture') void refresh();
  }, [page, refresh]);

  /** Prevents file drops outside active drag targets from navigating the Tauri webview away. */
  useEffect(() => {
    const preventFileDrop = (e: DragEvent) => {
      const types = Array.from(e.dataTransfer?.types ?? []);
      if (types.includes('Files') || (e.dataTransfer?.files?.length ?? 0) > 0) {
        e.preventDefault();
      }
    };
    addEventListener('dragover', preventFileDrop);
    addEventListener('drop', preventFileDrop);
    return () => {
      removeEventListener('dragover', preventFileDrop);
      removeEventListener('drop', preventFileDrop);
    };
  }, []);

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

  const register = async (next: Shortcuts) => {
    if (!platformInfo.current || platformInfo.current.wayland) return;
    setFailed(await invoke('set_shortcuts', { shortcuts: next }));
  };

  const capture = useCallback(
    async (action: Action, wait = 0) => {
      if (busy.current || tourActive.current) return;
      busy.current = true;
      setError(undefined);
      try {
        if (await runCapture(action, wait)) await refresh();
      } catch (e) {
        setError(String(e));
        await invoke('show_main', { page: 'capture' });
      } finally {
        busy.current = false;
      }
    },
    [refresh],
  );

  useEffect(() => {
    void invoke('set_tray_icon', {
      icon: localStorage.getItem('trayIcon') === 'app' ? 'app' : 'white',
    });
    void refresh();
    void invoke<typeof platform>('platform').then((p) => {
      platformInfo.current = p;
      setPlatform(p);
      document.documentElement.dataset.platform = p.os;
      void register(current.current);
    });
    const checkAccess = () =>
      void invoke<boolean>('screen_access', { request: false }).then(
        setScreenAccess,
      );
    checkAccess();
    void isEnabled().then(setAutostart);
    void getVersion().then(setVersion);
    const onFocus = () => {
      void refresh();
      checkAccess();
    };
    addEventListener('focus', onFocus);
    // Shortcuts, the tray menu and `--capture` arguments run without delay.
    const offCommand = listen<Action>(
      'command',
      (e) => void capture(e.payload),
    );
    const offNavigate = listen<Page>('navigate', (e) => {
      if (!tourActive.current && PAGES.some((p) => p.id === e.payload))
        setPage(e.payload);
    });
    void invoke<Action | null>('take_pending').then(
      (action) => action && void capture(action),
    );
    return () => {
      removeEventListener('focus', onFocus);
      for (const off of [offCommand, offNavigate])
        void off.then((unlisten) => unlisten());
    };
  }, [capture, refresh]);

  function changeShortcuts(next: Shortcuts) {
    current.current = next;
    setShortcuts(next);
    localStorage.setItem('shortcuts', JSON.stringify(next));
    if (!recording.current) void register(next);
  }

  function setRecording(on: boolean) {
    if (platformInfo.current?.wayland) return;
    recording.current = on;
    if (on) void invoke('set_shortcuts', { shortcuts: {} });
    else void register(current.current);
  }

  function changeDelay(value: number) {
    setDelay(value);
    localStorage.setItem('delay', String(value));
  }

  async function changeAutostart(on: boolean) {
    await (on ? enable() : disable());
    setAutostart(await isEnabled());
  }

  function changeTrayIcon(next: TrayIcon) {
    setTrayIcon(next);
    localStorage.setItem('trayIcon', next);
    void invoke('set_tray_icon', { icon: next });
  }

  function changeBlend(value: number) {
    if (!mac) return;
    const wasGlass = blend.current > 0;
    blend.current = value;
    showThemeBlend(value);
    void invoke('set_theme_blend', { value });
    if (wasGlass !== value > 0) setGlass(value > 0);
  }

  async function copy(shot: Shot) {
    try {
      await copyPng(shot.blob);
      showToast('Copied to clipboard');
    } catch (e) {
      showToast(`Couldn't copy: ${String(e)}`, 4000);
    }
  }

  const requestAccess = () =>
    void invoke<boolean>('screen_access', { request: true }).then(
      setScreenAccess,
    );

  const hasDraggedFiles = (dt: DataTransfer | null) => {
    if (!dt) return false;
    if (Array.from(dt.types ?? []).includes('Files')) return true;
    return (dt.files?.length ?? 0) > 0;
  };

  const handleDroppedFiles = async (files: File[]) => {
    if (files.length === 0 || uploadingRef.current) return;
    uploadingRef.current = true;
    try {
      const result = await importDocuments(files);
      const summary = formatImportSummary(result);
      if (result.ids.length > 0) {
        await refresh();
        setHistoryVersion((v) => v + 1);
        const firstId = result.ids[0];
        showToast(
          <>
            <span>{summary}</span>
            <button
              type='button'
              className='link'
              onClick={() => openEditor(firstId)}
            >
              {result.ids.length === 1 ? 'Open' : 'Open first'}
            </button>
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
    }
  };

  const onDragEnter = (e: ReactDragEvent<HTMLDivElement>) => {
    if (tourOpen || !hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    dragDepthRef.current += 1;
    setDragActive(true);
  };

  const onDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (tourOpen || !hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const onDragLeave = () => {
    if (tourOpen) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setDragActive(false);
  };

  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    dragDepthRef.current = 0;
    setDragActive(false);
    if (tourOpen || !hasDraggedFiles(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length > 0) void handleDroppedFiles(files);
  };

  return (
    <div
      className='app'
      data-appearance={mac ? (visibleGlass ? 'glass' : 'current') : undefined}
      data-native-glass={mac && visibleGlass && nativeGlass}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <nav className='app-nav' aria-label='Sections' data-tauri-drag-region>
        <div className='app-brand' data-tauri-drag-region>
          <Logo size={30} />
          <div>
            <strong>Daguerre</strong>
            <span>Screenshot studio</span>
          </div>
        </div>
        <ul className='nav-list'>
          {PAGES.map((p) => (
            <li key={p.id}>
              <button
                className='nav-item'
                aria-current={page === p.id ? 'page' : undefined}
                onClick={() => setPage(p.id)}
              >
                <Icon name={p.icon} size={17} />
                {p.label}
              </button>
            </li>
          ))}
          <li>
            <button
              className='nav-item'
              data-tour='replay'
              onClick={() => {
                previousPage.current = page;
                setTourOpen(true);
              }}
            >
              <Icon name='visible' size={17} />
              Product Tour
            </button>
          </li>
          <li className='nav-support'>
            <button
              className='nav-item'
              aria-label={SUPPORT_LABEL}
              aria-describedby='nav-support-hint'
              onClick={() => openExternal(SUPPORT_URL)}
            >
              <Icon name='coffee' size={17} />
              Support
            </button>
            <p className='nav-support-hint' id='nav-support-hint'>
              {SUPPORT_TEXT}
            </p>
          </li>
        </ul>
        <div className='nav-foot'>
          <span>
            <Icon name='lock' size={13} />
            Stored only on this device
          </span>
          {(usage !== undefined || version) && (
            <span className='nav-foot-row'>
              {usage !== undefined && <span>{formatBytes(usage)} used</span>}
              {version && <span>v{version}</span>}
            </span>
          )}
        </div>
      </nav>

      <main className='app-main' data-tour='workspace'>
        {tourOpen && themeReady && (
          <ProductTour
            mac={mac}
            wayland={platform.wayland}
            shortcuts={shortcuts}
            theme={theme}
            blend={blend.current}
            onPreview={setTourPreview}
            onClose={finishTour}
            onError={setError}
          />
        )}
        <div className='home-content' hidden={tourOpen}>
          {(error ||
            !screenAccess ||
            availableBanner ||
            downloading ||
            updated ||
            installError) && (
            <div className='banners'>
              {error && (
                <div className='banner danger' role='alert'>
                  <Icon name='alert' size={17} />
                  <p>{error}</p>
                  <button
                    className='icon-btn sm'
                    onClick={() => setError(undefined)}
                    aria-label='Dismiss'
                  >
                    <Icon name='close' size={14} />
                  </button>
                </div>
              )}
              {!screenAccess && (
                <div className='banner' role='alert'>
                  <Icon name='lock' size={17} />
                  <p>
                    Daguerre needs Screen Recording access to capture other
                    apps. After allowing it, quit and reopen Daguerre.
                  </p>
                  <button className='btn primary' onClick={requestAccess}>
                    Allow
                  </button>
                </div>
              )}
              {availableBanner && updater.state.status === 'available' && (
                <div className='banner'>
                  <Icon name='download' size={17} />
                  <p>{updateMessage(updater.state)}</p>
                  <button className='btn primary' onClick={updater.install}>
                    Install {updater.state.version}
                  </button>
                  <button
                    className='icon-btn sm'
                    onClick={updater.dismissBanner}
                    aria-label='Dismiss update notice'
                  >
                    <Icon name='close' size={14} />
                  </button>
                </div>
              )}
              {downloading && (
                <div className='banner'>
                  <Icon name='download' size={17} />
                  <p>{updateMessage(updater.state)}</p>
                </div>
              )}
              {installError && (
                <div className='banner danger' role='alert'>
                  <Icon name='alert' size={17} />
                  <p>{updateMessage(updater.state)}</p>
                  <button
                    className='icon-btn sm'
                    onClick={updater.dismissError}
                    aria-label='Dismiss update error'
                  >
                    <Icon name='close' size={14} />
                  </button>
                </div>
              )}
              {updated && (
                <div className='banner'>
                  <Icon name='check' size={17} />
                  <p>{updateMessage(updater.state)}</p>
                  <button className='btn primary' onClick={updater.restart}>
                    Restart
                  </button>
                </div>
              )}
            </div>
          )}
          {page === 'capture' && (
            <CapturePage
              key='capture'
              shortcuts={shortcuts}
              mac={mac}
              wayland={platform.wayland}
              delay={delay}
              onDelay={changeDelay}
              onCapture={(action, wait) => void capture(action, wait)}
              shots={shots}
              onOpen={openEditor}
              onCopy={(s) => void copy(s)}
              onViewAll={() => setPage('history')}
            />
          )}
          {page === 'history' && (
            <History
              key='history'
              embedded
              onOpen={openEditor}
              onChange={refresh}
              modes={CAPTURE_MODES}
              onUpload={importDocuments}
              uploadAccept={DOCUMENT_ACCEPT}
              handleDrop={false}
              refreshKey={historyVersion}
            />
          )}
          {page === 'settings' && (
            <SettingsPage
              key={blendSource}
              shortcuts={shortcuts}
              failed={failed}
              mac={mac}
              wayland={platform.wayland}
              onShortcuts={changeShortcuts}
              onRecording={setRecording}
              autostart={autostart}
              onAutostart={(on) => void changeAutostart(on)}
              trayIcon={trayIcon}
              onTrayIcon={changeTrayIcon}
              blend={blend.current}
              onBlend={changeBlend}
              theme={theme}
              onTheme={(next: Theme) => {
                changeTheme(next);
                setTheme(next);
              }}
              screenAccess={screenAccess}
              onRequestAccess={requestAccess}
              version={version}
              updater={updater}
            />
          )}
        </div>
      </main>
      {updater.promptOpen &&
        updater.state.status === 'available' &&
        !tourOpen && (
          <UpdatePrompt
            version={updater.state.version}
            date={updater.state.date}
            notes={updater.state.notes}
            auto={updater.auto}
            onInstall={updater.install}
            onSkip={updater.dismissPrompt}
          />
        )}
      {dragActive && !tourOpen && (
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

// `app`, not `root`: History's module mounts itself into #root on its own page.
const root = document.getElementById('app');
if (root) createRoot(root).render(<Home />);
