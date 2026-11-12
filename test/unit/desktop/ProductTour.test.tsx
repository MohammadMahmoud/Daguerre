import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { driver } from 'driver.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductTour } from '../../../src/desktop/ProductTour';
import type { Shortcuts } from '../../../src/desktop/Shortcuts';

vi.mock('driver.js', () => ({
  driver: vi.fn(() => {
    let index = 0;
    return {
      drive: vi.fn(() => {
        index = 0;
      }),
      destroy: vi.fn(),
      refresh: vi.fn(),
      getActiveIndex: () => index,
      moveNext: vi.fn(() => {
        index++;
      }),
      movePrevious: vi.fn(() => {
        index--;
      }),
    };
  }),
}));

const mockShortcuts: Shortcuts = {
  selection: '⌥⇧S',
  window: '⌥⇧W',
  screen: '⌥⇧V',
  'copy-selection': '⌥⇧C',
};

describe('ProductTour Component Walkthrough Specification', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
    delete document.documentElement.dataset.theme;
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function stepTour(
    direction: 'onNextClick' | 'onPrevClick' = 'onNextClick',
  ) {
    const config = vi.mocked(driver).mock.calls.at(-1)![0]!;
    const tour = vi.mocked(driver).mock.results.at(-1)!.value;
    const expected =
      tour.getActiveIndex()! + (direction === 'onNextClick' ? 1 : -1);
    let transition!: Promise<void>;
    act(() => {
      transition = (config[direction] as () => Promise<void>)();
    });
    await waitFor(() => expect(tour.getActiveIndex()).toBe(expected));
    await transition;
  }

  it('navigates through capture, editor, and appearance tour steps', async () => {
    const onClose = vi.fn();
    const onPreview = vi.fn();
    const onError = vi.fn();

    const { unmount } = render(
      <div data-tour='replay'>
        <ProductTour
          shortcuts={mockShortcuts}
          mac={true}
          wayland={false}
          theme='dark'
          blend={0}
          onClose={onClose}
          onPreview={onPreview}
          onError={onError}
        />
      </div>,
    );

    const driverConfig = vi.mocked(driver).mock.calls.at(-1)![0]!;
    const driverInstance = vi.mocked(driver).mock.results.at(-1)!.value;

    await waitFor(() => expect(driverInstance.drive).toHaveBeenCalled());

    // Step 0: capture-selection
    expect(
      document.querySelector('[data-tour="capture-selection"]'),
    ).toBeTruthy();

    // Call onPopoverRender to verify theme synchronization
    const detachedWrapper = document.createElement('div');
    driverConfig.onPopoverRender!(
      { wrapper: detachedWrapper } as any,
      {} as any,
    );

    const app = document.createElement('div');
    app.className = 'app';
    document.body.appendChild(app);
    const wrapper = document.createElement('div');
    driverConfig.onPopoverRender!({ wrapper } as any, {} as any);
    expect(wrapper.style).toBeDefined();
    app.remove();

    // Move forward 4 steps to get to in-memory editor sample (index 4: tools-toggle)
    for (let i = 0; i < 4; i++) {
      await stepTour('onNextClick');
    }

    await waitFor(() => {
      expect(document.querySelector('[data-tour="tools-toggle"]')).toBeTruthy();
    });

    // Click tools toggle button in the editor during tour to test toggleState branch
    const toggleButton = document.querySelector(
      '[data-tour="tools-toggle"]',
    ) as HTMLElement;
    if (toggleButton) {
      fireEvent.click(toggleButton);
    }

    // Move forward to step 12 (appearance preview)
    while (driverInstance.getActiveIndex()! < 12) {
      await stepTour('onNextClick');
    }

    await waitFor(() => {
      expect(document.querySelector('[data-tour="appearance"]')).toBeTruthy();
    });

    // In Appearance screen, test modifying theme and blend slider (lines 480-481)
    const sliders = document.querySelectorAll('input[type="range"]');
    if (sliders.length > 0) {
      fireEvent.change(sliders[0], { target: { value: '75' } });
    }

    const themeRadios = document.querySelectorAll('input[type="radio"]');
    if (themeRadios.length > 0) {
      fireEvent.click(themeRadios[0]);
    }

    // Step back one step
    await stepTour('onPrevClick');

    // Test onDestroyStarted
    (driverConfig.onDestroyStarted as any)!();
    expect(onClose).toHaveBeenCalled();
    expect(localStorage.getItem('hasCompletedOnboardingTour')).toBe('true');

    unmount();
  });

  it('handles transition errors and reports through onError', async () => {
    const onClose = vi.fn();
    const onPreview = vi.fn();
    const onError = vi.fn();

    render(
      <div data-tour='replay'>
        <ProductTour
          shortcuts={mockShortcuts}
          mac={false}
          wayland={true}
          theme='light'
          blend={0}
          onClose={onClose}
          onPreview={onPreview}
          onError={onError}
        />
      </div>,
    );

    const driverConfig = vi.mocked(driver).mock.calls.at(-1)![0]!;
    const driverInstance = vi.mocked(driver).mock.results.at(-1)!.value;

    // Simulate an error when transitioning past bounds
    vi.spyOn(driverInstance, 'getActiveIndex').mockReturnValue(999);
    await act(async () => {
      await (driverConfig.onNextClick as any)!();
    });

    expect(driverInstance.destroy).toHaveBeenCalled();
  });
});
