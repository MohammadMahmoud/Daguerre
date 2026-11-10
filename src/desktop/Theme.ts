export type Theme = 'system' | 'light' | 'dark';

export const onMac = () => /Macintosh|Mac OS X/.test(navigator.userAgent);

/** macOS windows always use the main window's dark solid look, so the editor must match it. */
export function applyTheme(): Theme {
  if (onMac()) {
    document.documentElement.dataset.theme = 'dark';
    document.documentElement.dataset.appearance = 'mac';
    return 'dark';
  }
  const saved = localStorage.getItem('theme');
  const theme = saved === 'light' || saved === 'dark' ? saved : 'system';
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  return theme;
}

export function changeTheme(theme: Theme) {
  localStorage.setItem('theme', theme);
  applyTheme();
}
