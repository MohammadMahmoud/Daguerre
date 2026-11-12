import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Effect, EffectState, getCurrentWindow } from '@tauri-apps/api/window';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { History } from '../History';
import { listShots, type Shot } from '../lib/Db';
import { formatBytes } from '../lib/Export';
import { copyPng, type Action } from '../platform/Desktop';
import '../Styles.css';
import {
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
  const [toast, showToast] = useToast();
  const updater = useUpdater();
  const updated = updater.state.status === 'ready';
  const busy = useRef(false);
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

  return (
    <div
      className='app'
      data-appearance={mac ? (visibleGlass ? 'glass' : 'current') : undefined}
      data-native-glass={mac && visibleGlass && nativeGlass}
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
          {(error || !screenAccess || updated) && (
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
      <Toast message={toast} />
    </div>
  );
}

// `app`, not `root`: History's module mounts itself into #root on its own page.
const root = document.getElementById('app');
if (root) createRoot(root).render(<Home />);
