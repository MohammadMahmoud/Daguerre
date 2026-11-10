import { invoke } from '@tauri-apps/api/core';
import { Effect, EffectState, getCurrentWindow } from '@tauri-apps/api/window';

/** Window design strength (0-100) shared with the main window: the saved file wins over localStorage. */
export async function loadBlend(): Promise<number> {
  let saved: number | null;
  try {
    saved = await invoke<number | null>('theme_blend');
  } catch {
    saved = null;
  }
  const value = saved ?? Number(localStorage.getItem('themeBlend'));
  return Number.isFinite(value)
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

/**
 * Gives a macOS editor window the main window's Window design: the same blend, native
 * Liquid Glass (or vibrancy before macOS 26) and reduced-transparency handling.
 */
export async function applyEditorGlass(): Promise<void> {
  const root = document.documentElement;
  const blend = await loadBlend();
  const reduced = matchMedia(
    '(prefers-reduced-transparency: reduce), (prefers-contrast: more)',
  ).matches;
  const glass = blend > 0 && !reduced;
  let native = false;
  try {
    const win = getCurrentWindow();
    if (glass) {
      const liquid = await invoke<boolean>('set_liquid_glass', { on: true });
      if (!liquid)
        await win.setEffects({
          effects: [Effect.UnderWindowBackground],
          state: EffectState.Active,
        });
      native = true;
    } else {
      await invoke('set_liquid_glass', { on: false });
      await win.clearEffects();
    }
  } catch {
    native = false;
  }
  root.style.setProperty('--theme-blend', String(glass ? blend / 100 : 0));
  root.dataset.appearance = glass ? 'glass' : 'mac';
  root.dataset.nativeGlass = String(glass && native);
}

/** Keeps an editor window in step with the main window's design slider. */
export function watchEditorGlass() {
  void applyEditorGlass();
  addEventListener('storage', (event) => {
    if (event.key === 'themeBlend' || event.key === null)
      void applyEditorGlass();
  });
}
