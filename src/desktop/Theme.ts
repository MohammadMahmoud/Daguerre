export type Theme = 'system' | 'light' | 'dark';

export function applyTheme(): Theme {
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
