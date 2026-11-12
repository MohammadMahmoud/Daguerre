import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAPTURE_HINT,
  CAPTURE_MODES,
  copyPng,
  copyText,
  downloadBlob,
  guardClose,
  leaveToHistory,
  NO_URL_LABEL,
  printPage,
  SAVE_PNG_LABEL,
  SAVED_TOAST,
  SEARCH_PLACEHOLDER,
  SHORTCUT_HINTS,
} from '../../../src/platform/Chrome';

describe('Chrome Platform Implementation Specification', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('exposes platform configuration constants', () => {
    expect(CAPTURE_MODES).toEqual(['visible', 'full', 'selection', 'tabs']);
    expect(CAPTURE_HINT).toContain('toolbar');
    expect(SHORTCUT_HINTS.length).toBe(3);
    expect(NO_URL_LABEL).toBe('Local page');
    expect(SAVE_PNG_LABEL).toBe('Download PNG');
    expect(SAVED_TOAST).toBe('Download started');
    expect(SEARCH_PLACEHOLDER).toContain('title or URL');
  });

  it('delegates leaveToHistory and guardClose as no-ops for Chrome tabs', () => {
    expect(leaveToHistory()).toBe(false);
    const stop = guardClose(
      () => true,
      async () => true,
    );
    expect(typeof stop).toBe('function');
    expect(stop()).toBeUndefined();
  });

  it('downloadBlob creates and triggers an anchor tag download, revoking after timer', () => {
    vi.useFakeTimers();
    const createUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    const revokeUrlSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const blob = new Blob(['test-data'], { type: 'image/png' });
    downloadBlob(blob, 'capture.png');

    expect(createUrlSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);
    expect(revokeUrlSpy).toHaveBeenCalledWith('blob:mock-url');

    vi.useRealTimers();
  });

  it('copies png blob and text promises to navigator.clipboard', async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { write: writeMock },
      configurable: true,
      writable: true,
    });

    const blob = new Blob(['png-data'], { type: 'image/png' });
    await copyPng(blob);
    expect(writeMock).toHaveBeenCalledOnce();

    writeMock.mockClear();
    await copyText(Promise.resolve('Extracted text'));
    expect(writeMock).toHaveBeenCalledOnce();
  });

  it('triggers window.print when calling printPage', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    printPage();
    expect(printSpy).toHaveBeenCalledOnce();
  });
});
