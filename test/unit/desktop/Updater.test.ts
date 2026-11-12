import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdater } from '../../../src/desktop/Updater';

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

describe('Updater Hook Unit Specification', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('handles calling install when no update is currently available', async () => {
    const { result } = renderHook(() => useUpdater());
    expect(result.current.state.status).toBe('idle');

    // Calling install with update.current === null
    await act(async () => {
      result.current.install();
    });

    expect(result.current.state.status).toBe('idle');
  });

  it('triggers relaunch on restart and changes auto-update preference', () => {
    const { result } = renderHook(() => useUpdater());
    act(() => {
      result.current.changeAuto(true);
    });
    expect(result.current.auto).toBe(true);
    expect(localStorage.getItem('autoUpdate')).toBe('true');

    act(() => {
      result.current.changeAuto(false);
    });
    expect(result.current.auto).toBe(false);
    expect(localStorage.getItem('autoUpdate')).toBe('false');

    act(() => {
      result.current.restart();
    });
    expect(relaunch).toHaveBeenCalledOnce();
  });

  it('handles download events with missing contentLength or non-progress events', async () => {
    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      date: '2026-11-12',
      body: 'Release notes',
      downloadAndInstall: vi.fn(async (cb) => {
        // Event Started without contentLength
        cb({ event: 'Started', data: { contentLength: undefined } });
        // Progress event without total
        cb({ event: 'Progress', data: { chunkLength: 100 } });
        // Non-progress event (e.g. Finished)
        cb({ event: 'Finished' });
      }),
    } as unknown as Update;

    vi.mocked(check).mockResolvedValueOnce(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      result.current.check();
    });

    expect(result.current.state.status).toBe('available');

    await act(async () => {
      result.current.install();
    });

    expect(result.current.state.status).toBe('ready');
  });
});
