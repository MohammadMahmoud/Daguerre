import type { KeyboardEvent } from 'react';
import { DEFAULT_SHORTCUTS, type Action } from '../platform/Desktop';
import { Icon, Logo } from '../ui';
import {
  ACTION_LABELS,
  formatShortcut,
  isDefault,
  toAccelerator,
  type Shortcuts,
} from './Shortcuts';

export type TrayIcon = 'app' | 'white';

const TRAY_ICONS: { id: TrayIcon; label: string; mono: boolean }[] = [
  { id: 'white', label: 'White', mono: true },
  { id: 'app', label: 'App icon', mono: false },
];

export function SettingsPage({
  shortcuts,
  failed,
  mac,
  wayland,
  onShortcuts,
  onRecording,
  autostart,
  onAutostart,
  trayIcon,
  onTrayIcon,
  screenAccess,
  onRequestAccess,
  version,
}: {
  shortcuts: Shortcuts;
  failed: Record<string, string>;
  mac: boolean;
  wayland: boolean;
  onShortcuts: (next: Shortcuts) => void;
  /** Global shortcuts pause while one is being recorded, so pressing the old keys doesn't capture. */
  onRecording: (recording: boolean) => void;
  autostart: boolean;
  onAutostart: (on: boolean) => void;
  trayIcon: TrayIcon;
  onTrayIcon: (icon: TrayIcon) => void;
  screenAccess: boolean;
  onRequestAccess: () => void;
  version: string;
}) {
  const tray = mac ? 'menu bar' : 'system tray';

  function record(action: Action, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab') return;
    e.preventDefault();
    const plain = !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey;
    if (plain && (e.key === 'Backspace' || e.key === 'Delete'))
      return onShortcuts({ ...shortcuts, [action]: '' });
    if (plain && e.key === 'Escape') return e.currentTarget.blur();
    const accelerator = toAccelerator(e);
    if (accelerator) onShortcuts({ ...shortcuts, [action]: accelerator });
  }

  return (
    <div className='page'>
      <header className='page-head' data-tauri-drag-region>
        <div>
          <h1>Settings</h1>
          <p>Shortcuts work in any app while Daguerre runs in the {tray}.</p>
        </div>
      </header>

      <section className='panel' aria-labelledby='shortcuts-title'>
        <div className='panel-head'>
          <div>
            <h2 id='shortcuts-title'>Keyboard shortcuts</h2>
            <p className='meta' id='shortcut-hint'>
              Click a shortcut and press the new keys. Backspace removes it.
            </p>
          </div>
          <button
            className='btn ghost'
            onClick={() => onShortcuts(DEFAULT_SHORTCUTS)}
            disabled={isDefault(shortcuts)}
          >
            <Icon name='reset' size={15} />
            Restore defaults
          </button>
        </div>
        <ul className='shortcut-table'>
          {(Object.keys(ACTION_LABELS) as Action[]).map((action) => {
            const id = `shortcut-${action}`;
            return (
              <li key={action} className='shortcut-row'>
                <label htmlFor={id}>{ACTION_LABELS[action]}</label>
                <div className='shortcut-control'>
                  <input
                    id={id}
                    className='shortcut-input'
                    readOnly
                    value={
                      shortcuts[action]
                        ? formatShortcut(shortcuts[action], mac)
                        : ''
                    }
                    placeholder='None'
                    onFocus={() => onRecording(true)}
                    onBlur={() => onRecording(false)}
                    onKeyDown={(e) => record(action, e)}
                    aria-describedby={
                      failed[action] ? `${id}-error` : 'shortcut-hint'
                    }
                    aria-invalid={!!failed[action]}
                  />
                  <button
                    className='icon-btn sm'
                    onClick={() => onShortcuts({ ...shortcuts, [action]: '' })}
                    disabled={!shortcuts[action]}
                    aria-label={`Remove the ${ACTION_LABELS[action]} shortcut`}
                    title='Remove'
                  >
                    <Icon name='close' size={14} />
                  </button>
                </div>
                {failed[action] && (
                  <p className='shortcut-error' id={`${id}-error`} role='alert'>
                    Couldn't use this shortcut. Another app may be using it.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        {wayland && (
          <p className='panel-note'>
            On Wayland, apps can't add global shortcuts. Add them in your
            desktop's keyboard settings with commands such as{' '}
            <code>daguerre --capture selection</code> (also <code>window</code>,{' '}
            <code>screen</code> and <code>copy-selection</code>).
          </p>
        )}
      </section>

      <section className='panel' aria-labelledby='general-title'>
        <h2 id='general-title'>General</h2>
        <div className='setting-row'>
          <div>
            <label htmlFor='autostart'>Open at login</label>
            <p className='meta'>Starts quietly in the {tray}.</p>
          </div>
          <input
            id='autostart'
            type='checkbox'
            role='switch'
            className='switch'
            checked={autostart}
            onChange={(e) => onAutostart(e.target.checked)}
          />
        </div>
        <div className='setting-row'>
          <div>
            <strong id='tray-icon-label'>
              {mac ? 'Menu bar icon' : 'System tray icon'}
            </strong>
            <p className='meta' id='tray-icon-hint'>
              Choose how Daguerre appears in the {tray}.
            </p>
          </div>
          <div
            className='segmented'
            role='radiogroup'
            aria-labelledby='tray-icon-label'
            aria-describedby='tray-icon-hint'
          >
            {TRAY_ICONS.map((opt) => (
              <button
                key={opt.id}
                role='radio'
                aria-checked={trayIcon === opt.id}
                onClick={() => onTrayIcon(opt.id)}
              >
                <span
                  className={
                    opt.mono ? 'tray-preview tray-preview-mono' : 'tray-preview'
                  }
                >
                  <Logo size={opt.mono ? 16 : 18} mono={opt.mono} />
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {mac && (
        <section className='panel' aria-labelledby='permissions-title'>
          <h2 id='permissions-title'>Permissions</h2>
          <div className='setting-row'>
            <div>
              <strong>Screen Recording</strong>
              <p className='meta'>
                {screenAccess
                  ? 'Allowed. Daguerre can capture other apps.'
                  : 'Needed to capture other apps. After allowing it, quit and reopen Daguerre.'}
              </p>
            </div>
            {screenAccess ? (
              <span className='status-ok'>
                <Icon name='check' size={15} />
                Allowed
              </span>
            ) : (
              <button className='btn primary' onClick={onRequestAccess}>
                Allow
              </button>
            )}
          </div>
        </section>
      )}

      <section className='panel' aria-labelledby='about-title'>
        <h2 id='about-title'>About</h2>
        <div className='about'>
          <Logo size={36} />
          <div>
            <strong>Daguerre {version}</strong>
            <p className='meta'>
              Screenshots, window titles and settings stay on this device.
              Nothing is uploaded.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
