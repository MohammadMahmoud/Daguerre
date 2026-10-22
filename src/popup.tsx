import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    listShots,
    type CaptureMode,
    type Progress,
    type Shot,
} from './lib/db';
import './styles.css';
import { Icon, Logo, type IconName } from './ui';

const ACTIONS: {
  mode: CaptureMode;
  label: string;
  hint: string;
  icon: IconName;
  command?: string;
}[] = [
  {
    mode: 'visible',
    label: 'Visible area',
    hint: 'What you see now',
    icon: 'visible',
    command: 'capture-visible',
  },
  {
    mode: 'full',
    label: 'Entire page',
    hint: 'Scrolls and stitches',
    icon: 'full',
    command: 'capture-full',
  },
  {
    mode: 'selection',
    label: 'Select area',
    hint: 'Drag a region',
    icon: 'selection',
    command: 'capture-selection',
  },
  {
    mode: 'tabs',
    label: 'All tabs',
    hint: 'Asks for access once',
    icon: 'tabs',
  },
];
const DELAYS = [0, 3, 5, 10];

function openPage(url: string) {
  void chrome.tabs.create({ url });
  window.close();
}

export function Popup() {
  const [delay, setDelay] = useState(0);
  const [shots, setShots] = useState<Shot[]>([]);
  const [error, setError] = useState<string>();
  const [shortcuts, setShortcuts] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<Progress | null>(null);
  const errorRef = useRef<string>(undefined);
  const recent = shots.slice(0, 3);
  const thumbs = useMemo(
    () => new Map(recent.map((s) => [s.id, URL.createObjectURL(s.thumb)])),
    [shots],
  );

  useEffect(() => {
    const showError = (message: unknown) => {
      errorRef.current = String(message);
      setError(errorRef.current);
      void chrome.storage.session.remove('lastError');
      void chrome.action.setBadgeText({ text: '' });
    };
    void chrome.storage.local
      .get('delay')
      .then((r) => setDelay(Number(r.delay) || 0));
    void chrome.storage.session.get(['lastError', 'progress']).then((r) => {
      if (r.lastError) showError(r.lastError);
      if (r.progress) setProgress(r.progress as Progress);
    });
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'session') return;
      if (changes.lastError?.newValue) {
        showError(changes.lastError.newValue);
        setProgress(null);
      }
      if (!changes.progress) return;
      const next = (changes.progress.newValue as Progress | undefined) ?? null;
      setProgress(next);
      // Finished (or cancelled) without an error: the editor or history tab takes over.
      if (!next && !errorRef.current) window.close();
    };
    chrome.storage.onChanged.addListener(onChanged);
    const onPrepareCopy = (
      message: { type?: string; target?: string },
      sender: chrome.runtime.MessageSender,
    ) => {
      if (
        sender.id === chrome.runtime.id &&
        message?.type === 'prepare-copy' &&
        message.target === 'popup'
      )
        window.close();
    };
    chrome.runtime.onMessage.addListener(onPrepareCopy);
    void chrome.commands
      .getAll()
      .then((cmds) =>
        setShortcuts(
          Object.fromEntries(cmds.map((c) => [c.name ?? '', c.shortcut ?? ''])),
        ),
      );
    void listShots().then(setShots);
    return () => {
      chrome.storage.onChanged.removeListener(onChanged);
      chrome.runtime.onMessage.removeListener(onPrepareCopy);
    };
  }, []);

  async function capture(mode: CaptureMode, copySelection = false) {
    if (mode === 'tabs') {
      // Must run synchronously inside the click; Chrome skips the prompt when already granted.
      void chrome.storage.session.set({ pendingAllTabs: true });
      const granted = await chrome.permissions.request({
        origins: ['<all_urls>'],
      });
      void chrome.storage.session.remove('pendingAllTabs');
      if (!granted) {
        setError(
          'Capturing every tab needs access to all sites. Screenshots still never leave your device.',
        );
        return;
      }
    }
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id === undefined) return;
    errorRef.current = undefined;
    setError(undefined);
    await chrome.runtime.sendMessage(
      copySelection
        ? { type: 'copy-selection', tabId: tab.id }
        : { type: 'capture', mode, tabId: tab.id, delay },
    );
    // Long captures keep the popup open as a progress dialog; it isn't part of the screenshot.
    const longRunning = mode === 'tabs' || (mode === 'full' && !delay);
    if (!longRunning) window.close();
    else if (!errorRef.current)
      setProgress({ mode, value: 0, detail: 'Starting…' });
  }

  if (progress) {
    const pct = Math.round(progress.value * 100);
    return (
      <div
        className='popup capture-dialog'
        role='dialog'
        aria-labelledby='capture-title'
        aria-describedby='capture-detail'
      >
        <div className='capture-head'>
          <span className='spinner' aria-hidden='true' />
          <div className='capture-text'>
            <h1 id='capture-title'>
              {progress.mode === 'tabs'
                ? 'Capturing all tabs'
                : progress.mode === 'selection'
                  ? 'Capturing selected area'
                  : 'Capturing entire page'}
            </h1>
            <p id='capture-detail' className='truncate'>
              {progress.detail}
            </p>
          </div>
          <span className='capture-pct'>{pct}%</span>
        </div>
        <div
          className='progress'
          role='progressbar'
          aria-label='Capture progress'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <span style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
        <div className='capture-foot'>
          <span>
            {progress.mode === 'tabs'
              ? 'Chrome switches through your tabs, then returns here.'
              : 'The page scrolls on its own. Keep this tab open.'}
          </span>
          <button
            className='btn ghost'
            onClick={() => void chrome.runtime.sendMessage({ type: 'cancel' })}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function changeDelay(value: number) {
    setDelay(value);
    void chrome.storage.local.set({ delay: value });
  }

  return (
    <div className='popup'>
      <header className='popup-head'>
        <Logo size={32} />
        <div className='popup-brand'>
          <h1>Daguerre</h1>
          <p>Capture, annotate, export</p>
        </div>
        <button
          className='icon-btn'
          onClick={() => openPage('history.html')}
          aria-label='Open history'
          title='History'
        >
          <Icon name='history' />
        </button>
      </header>

      {error && (
        <p className='alert' role='alert'>
          {error}
        </p>
      )}

      <div className='tiles'>
        {ACTIONS.map((a) => (
          <button
            key={a.mode}
            className='tile'
            onClick={() => void capture(a.mode)}
          >
            <span className='tile-icon'>
              <Icon name={a.icon} size={20} />
            </span>
            <span className='tile-label'>{a.label}</span>
            <span className='tile-hint'>
              {a.command && shortcuts[a.command] ? (
                <kbd>{shortcuts[a.command]}</kbd>
              ) : (
                a.hint
              )}
            </span>
          </button>
        ))}
      </div>

      <div className='field'>
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
              onClick={() => changeDelay(d)}
            >
              {d ? `${d}s` : 'Off'}
            </button>
          ))}
        </div>
      </div>
      <p className='field-hint' id='delay-hint'>
        Applies to visible area and entire page, so you can open menus first.
      </p>

      <button
        className='btn'
        onClick={() => void capture('selection', true)}
        aria-describedby='copy-selection-hint'
      >
        <Icon name='copy' size={16} />
        Copy selected area
        <span className='spacer' />
        {shortcuts['copy-selection'] && (
          <kbd>{shortcuts['copy-selection']}</kbd>
        )}
      </button>
      <p className='field-hint' id='copy-selection-hint'>
        Copies your selection without opening the editor. Saved in History for
        editing later.
      </p>

      {recent.length > 0 && (
        <section className='recent' aria-label='Recent screenshots'>
          <div className='recent-head'>
            <span>Recent</span>
            <button className='link' onClick={() => openPage('history.html')}>
              View all {shots.length}
            </button>
          </div>
          <div className='recent-grid'>
            {recent.map((s) => (
              <button
                key={s.id}
                className='recent-item'
                onClick={() => openPage(`editor.html?id=${s.id}`)}
                title={s.title}
              >
                <img src={thumbs.get(s.id)} alt={`Open ${s.title}`} />
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className='popup-foot'>
        <span>
          <Icon name='lock' size={13} />
          Stored only on this device
        </span>
        <button
          className='link'
          onClick={() => openPage('chrome://extensions/shortcuts')}
        >
          Shortcuts
        </button>
      </footer>
    </div>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Popup />);
