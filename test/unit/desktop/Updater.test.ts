import { invoke } from '@tauri-apps/api/core';
import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdater } from '../../../src/desktop/Updater';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

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
    vi.mocked(invoke).mockResolvedValue(undefined);
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

  it('prompts without auto-installing when auto-update is enabled', async () => {
    localStorage.setItem('autoUpdate', 'true');
    const downloadAndInstall = vi.fn();
    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      date: '2026-11-26T22:11:51.472Z',
      body: '### Added\n\n- Shutter sound.',
      downloadAndInstall,
    } as unknown as Update;
    vi.mocked(check).mockResolvedValueOnce(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.state).toEqual({
      status: 'available',
      version: '2.0.0',
      date: '2026-11-26T22:11:51.472Z',
      notes: '### Added\n\n- Shutter sound.',
    });
    expect(result.current.promptOpen).toBe(true);
    expect(result.current.bannerDismissed).toBe(false);
    expect(downloadAndInstall).not.toHaveBeenCalled();

    act(() => {
      result.current.dismissPrompt();
    });
    expect(result.current.promptOpen).toBe(false);
    expect(result.current.state).toEqual({
      status: 'available',
      version: '2.0.0',
      date: '2026-11-26T22:11:51.472Z',
      notes: '### Added\n\n- Shutter sound.',
    });

    act(() => {
      result.current.dismissBanner();
    });
    expect(result.current.bannerDismissed).toBe(true);
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
    expect(result.current.promptOpen).toBe(true);

    await act(async () => {
      result.current.install();
    });

    expect(invoke).toHaveBeenCalledWith('set_updating', { updating: true });
    expect(invoke).not.toHaveBeenCalledWith('set_updating', {
      updating: false,
    });
    expect(result.current.promptOpen).toBe(false);
    expect(result.current.state.status).toBe('ready');
    expect(relaunch).not.toHaveBeenCalled();
  });

  it('resets binary-exit suppression and exposes dismissible install error when download fails', async () => {
    const mockUpdate = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      downloadAndInstall: vi.fn().mockRejectedValueOnce(new Error('network')),
    } as unknown as Update;
    vi.mocked(check).mockResolvedValueOnce(mockUpdate);

    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      result.current.check();
    });

    await act(async () => {
      result.current.install();
    });

    expect(invoke).toHaveBeenNthCalledWith(1, 'set_updating', {
      updating: true,
    });
    expect(invoke).toHaveBeenNthCalledWith(2, 'set_updating', {
      updating: false,
    });
    expect(result.current.state).toEqual({
      status: 'error',
      message: 'Error: network',
      during: 'install',
    });

    act(() => {
      result.current.dismissError();
    });
    expect(result.current.state).toEqual({ status: 'idle' });
  });
});
