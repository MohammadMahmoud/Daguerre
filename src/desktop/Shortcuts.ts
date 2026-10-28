import type { KeyboardEvent } from 'react';
import { DEFAULT_SHORTCUTS, type Action } from '../platform/Desktop';

export type Shortcuts = Record<Action, string>;

export const ACTION_LABELS: Record<Action, string> = {
  selection: 'Select area',
  window: 'Window',
  screen: 'Screen',
  'copy-selection': 'Copy selected area',
};

const MAC_KEYS: Record<string, string> = {
  Control: '⌃',
  Alt: '⌥',
  Shift: '⇧',
  Super: '⌘',
};
const MODIFIERS = ['Control', 'Alt', 'Shift', 'Meta'];

export function formatShortcut(accelerator: string, mac: boolean) {
  if (!mac) return accelerator;
  return accelerator
    .split('+')
    .map((k) => MAC_KEYS[k] ?? k)
    .join('');
}

/** A key press as an accelerator such as "Alt+Shift+S", or undefined if it can't be a global shortcut. */
export function toAccelerator(
  e: Pick<
    KeyboardEvent,
    'key' | 'code' | 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey'
  >,
) {
  if (MODIFIERS.includes(e.key)) return undefined;
  const key = e.code.replace(/^(Key|Digit)/, '');
  const mods = [
    e.ctrlKey && 'Control',
    e.altKey && 'Alt',
    e.shiftKey && 'Shift',
    e.metaKey && 'Super',
  ].filter(Boolean);
  if (!mods.length && !/^(F\d+|PrintScreen)$/.test(key)) return undefined;
  return [...mods, key].join('+');
}

export function loadShortcuts(): Shortcuts {
  try {
    return {
      ...DEFAULT_SHORTCUTS,
      ...JSON.parse(localStorage.getItem('shortcuts') ?? '{}'),
    };
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export const isDefault = (s: Shortcuts) =>
  (Object.keys(DEFAULT_SHORTCUTS) as Action[]).every(
    (a) => s[a] === DEFAULT_SHORTCUTS[a],
  );
