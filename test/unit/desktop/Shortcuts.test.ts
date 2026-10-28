import { expect, test } from 'vitest';
import {
  formatShortcut,
  isDefault,
  loadShortcuts,
  toAccelerator,
} from '../../../src/desktop/Shortcuts';
import { DEFAULT_SHORTCUTS } from '../../../src/platform/Desktop';

const key = (code: string, mods: Partial<KeyboardEvent> = {}) =>
  toAccelerator({
    key: code,
    code,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    ...mods,
  });

test('accelerators need a modifier unless they are function or print keys', () => {
  expect(key('KeyS', { altKey: true, metaKey: true })).toBe('Alt+Super+S');
  expect(key('Digit4', { ctrlKey: true, shiftKey: true })).toBe(
    'Control+Shift+4',
  );
  expect(key('KeyS')).toBeUndefined();
  expect(key('F5')).toBe('F5');
  expect(key('PrintScreen')).toBe('PrintScreen');
  expect(
    toAccelerator({
      key: 'Shift',
      code: 'ShiftLeft',
      ctrlKey: false,
      altKey: false,
      shiftKey: true,
      metaKey: false,
    }),
  ).toBeUndefined();
});

test('formats shortcuts with symbols on macOS', () => {
  expect(formatShortcut('Control+Alt+Shift+Super+K', true)).toBe('⌃⌥⇧⌘K');
  expect(formatShortcut('Alt+Shift+K', false)).toBe('Alt+Shift+K');
});

test('loads saved shortcuts over the defaults and survives bad data', () => {
  expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS);
  expect(isDefault(loadShortcuts())).toBe(true);
  localStorage.setItem('shortcuts', JSON.stringify({ window: 'F6' }));
  expect(loadShortcuts()).toEqual({ ...DEFAULT_SHORTCUTS, window: 'F6' });
  expect(isDefault(loadShortcuts())).toBe(false);
  localStorage.setItem('shortcuts', '{oops');
  expect(loadShortcuts()).toEqual(DEFAULT_SHORTCUTS);
});
