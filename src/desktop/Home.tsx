import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { History } from '../history';
import { listShots, type Shot } from '../lib/db';
import { formatBytes } from '../lib/export';
import { copyPng, type Action } from '../platform/Desktop';
import '../styles.css';
import { Icon, Logo, Toast, useToast, type IconName } from '../ui';
import { runCapture } from './Capture';
import { CapturePage } from './CapturePage';
import { SettingsPage, type TrayIcon } from './SettingsPage';
import { loadShortcuts, type Shortcuts } from './Shortcuts';

type Page = 'capture' | 'history' | 'settings';
const PAGES: { id: Page; label: string; icon: IconName }[] = [
  { id: 'capture', label: 'Capture', icon: 'selection' },
  { id: 'history', label: 'History', icon: 'history' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const openEditor = (id: string) => void invoke('open_editor', { id });

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
  const [trayIcon, setTrayIcon] = useState<TrayIcon>(() =>
    localStorage.getItem('trayIcon') === 'app' ? 'app' : 'white',
  );
  const [version, setVersion] = useState('');
  const [shots, setShots] = useState<Shot[]>([]);
  const [usage, setUsage] = useState<number>();
  const [toast, showToast] = useToast();
  const busy = useRef(false);
  const recording = useRef(false);
  const current = useRef(shortcuts);
  const mac = platform.os === 'macos';

  const refresh = useCallback(async () => {
    setShots(await listShots());
    setUsage((await navigator.storage?.estimate?.())?.usage);
  }, []);

  const register = async (next: Shortcuts) =>
    setFailed(await invoke('set_shortcuts', { shortcuts: next }));

  const capture = useCallback(
    async (action: Action, wait = 0) => {
      if (busy.current) return;
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
    void register(current.current);
    void invoke('set_tray_icon', {
      icon: localStorage.getItem('trayIcon') === 'app' ? 'app' : 'white',
    });
    void refresh();
    void invoke<typeof platform>('platform').then((p) => {
      setPlatform(p);
      document.documentElement.dataset.platform = p.os;
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
      if (PAGES.some((p) => p.id === e.payload)) setPage(e.payload);
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

  return (
    <div className='app'>
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
        </ul>
        <div className='nav-foot'>
          <span>
            <Icon name='lock' size={13} />
            Stored only on this device
          </span>
          {usage !== undefined && <span>{formatBytes(usage)} used</span>}
        </div>
      </nav>

      <main className='app-main'>
        {(error || !screenAccess) && (
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
                  Daguerre needs Screen Recording access to capture other apps.
                  After allowing it, quit and reopen Daguerre.
                </p>
                <button className='btn primary' onClick={requestAccess}>
                  Allow
                </button>
              </div>
            )}
          </div>
        )}
        {page === 'capture' && (
          <CapturePage
            shortcuts={shortcuts}
            mac={mac}
            delay={delay}
            onDelay={changeDelay}
            onCapture={(action, wait) => void capture(action, wait)}
            shots={shots}
            onOpen={openEditor}
            onCopy={(s) => void copy(s)}
            onViewAll={() => setPage('history')}
          />
        )}
        {page === 'history' && <History embedded onOpen={openEditor} />}
        {page === 'settings' && (
          <SettingsPage
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
            screenAccess={screenAccess}
            onRequestAccess={requestAccess}
            version={version}
          />
        )}
      </main>
      <Toast message={toast} />
    </div>
  );
}

// `app`, not `root`: History's module mounts itself into #root on its own page.
const root = document.getElementById('app');
if (root) createRoot(root).render(<Home />);
