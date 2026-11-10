import { afterEach, expect, test, vi } from 'vitest';
import { applyTheme } from '../../../src/desktop/Theme';

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  delete document.documentElement.dataset.appearance;
});

test('macOS always uses the main window dark appearance', () => {
  vi.stubGlobal('navigator', {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
  });
  localStorage.setItem('theme', 'light');
  expect(applyTheme()).toBe('dark');
  expect(document.documentElement.dataset.theme).toBe('dark');
  expect(document.documentElement.dataset.appearance).toBe('mac');
});

test('other platforms follow the saved theme', () => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0)' });
  localStorage.setItem('theme', 'light');
  expect(applyTheme()).toBe('light');
  expect(document.documentElement.dataset.theme).toBe('light');
  expect(document.documentElement.dataset.appearance).toBeUndefined();
});

test('Linux follows the saved theme like the main window', () => {
  vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' });
  localStorage.setItem('theme', 'dark');
  expect(applyTheme()).toBe('dark');
  expect(document.documentElement.dataset.appearance).toBeUndefined();
  localStorage.removeItem('theme');
  expect(applyTheme()).toBe('system');
  expect(document.documentElement.dataset.theme).toBeUndefined();
});
