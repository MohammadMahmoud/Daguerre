import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { addShot } from '../lib/db';
import { copyPng, type Action } from '../platform/Desktop';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Captures, saves to History, then opens the editor (or copies). Resolves false if cancelled. */
export async function runCapture(action: Action, delay = 0) {
  const wasVisible = await getCurrentWindow().isVisible();
  // Through Rust, so macOS also drops the Dock icon (otherwise it quits the windowless app).
  if (wasVisible) await invoke('hide_main');
  // Give the window time to fade out so it isn't in the shot.
  if (wasVisible || delay) await sleep(Math.max(delay * 1000, 250));
  const mode = action === 'copy-selection' ? 'selection' : action;
  const info =
    mode === 'screen'
      ? await invoke<{ title: string }>('capture_screen')
      : await invoke<{ title: string } | null>('select', {
          kind: mode === 'window' ? 'window' : 'region',
        });
  if (!info) return false;
  const png = await invoke<ArrayBuffer>('take_capture');
  const blob = new Blob([png], { type: 'image/png' });
  const id = await addShot(blob, { title: info.title, url: '', mode });
  if (action === 'copy-selection') await copyPng(blob);
  else await invoke('open_editor', { id });
  return true;
}
