import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CapturePage } from '../../../src/desktop/CapturePage';
import type { Shortcuts } from '../../../src/desktop/Shortcuts';
import { imageBlob } from '../../Setup';

const mockShortcuts: Shortcuts = {
  selection: '⌥⇧S',
  window: '⌥⇧W',
  screen: '⌥⇧V',
  'copy-selection': '⌥⇧C',
};

describe('CapturePage Desktop UI Specification', () => {
  it('renders capture tiles, shortcuts, and responds to click actions', () => {
    const onDelay = vi.fn();
    const onCapture = vi.fn();
    const onOpen = vi.fn();
    const onCopy = vi.fn();
    const onViewAll = vi.fn();

    const sampleShot = {
      id: 'shot-1',
      title: 'Sample Screenshot',
      url: 'https://example.com',
      mode: 'selection' as const,
      width: 800,
      height: 600,
      size: 1024,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      thumb: imageBlob(100, 100),
      blob: imageBlob(800, 600),
    };

    const { rerender } = render(
      <CapturePage
        shortcuts={mockShortcuts}
        mac={true}
        wayland={false}
        delay={3}
        onDelay={onDelay}
        onCapture={onCapture}
        shots={[sampleShot]}
        onOpen={onOpen}
        onCopy={onCopy}
        onViewAll={onViewAll}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Capture' })).toBeDefined();

    // Clicking delay segmented button
    fireEvent.click(screen.getByRole('radio', { name: '5s' }));
    expect(onDelay).toHaveBeenCalledWith(5);

    // Clicking tiles
    fireEvent.click(screen.getByRole('button', { name: /Select area/i }));
    expect(onCapture).toHaveBeenCalledWith('selection', 3);

    fireEvent.click(screen.getByRole('button', { name: /Window/i }));
    expect(onCapture).toHaveBeenCalledWith('window', 3);

    fireEvent.click(screen.getByRole('button', { name: /^Screen/ }));
    expect(onCapture).toHaveBeenCalledWith('screen', 3);

    fireEvent.click(
      screen.getByRole('button', { name: /Copy selected area/i }),
    );
    expect(onCapture).toHaveBeenCalledWith('copy-selection', 3);

    // Recent captures interaction
    fireEvent.click(screen.getByRole('button', { name: /View all/i }));
    expect(onViewAll).toHaveBeenCalledOnce();

    fireEvent.click(
      screen.getByRole('button', { name: /Copy Sample Screenshot/i }),
    );
    expect(onCopy).toHaveBeenCalledWith(sampleShot);

    fireEvent.click(
      screen.getByRole('button', { name: /Edit Sample Screenshot/i }),
    );
    expect(onOpen).toHaveBeenCalledWith('shot-1');

    // Missing shortcut branch on non-Wayland displays "No shortcut"
    rerender(
      <CapturePage
        shortcuts={{
          selection: '',
          window: '',
          screen: '',
          'copy-selection': '',
        }}
        mac={false}
        wayland={false}
        delay={0}
        onDelay={onDelay}
        onCapture={onCapture}
        shots={[]}
        onOpen={onOpen}
        onCopy={onCopy}
        onViewAll={onViewAll}
      />,
    );
    expect(screen.getAllByText('No shortcut').length).toBeGreaterThanOrEqual(1);

    // Wayland mode displays "Desktop settings"
    rerender(
      <CapturePage
        shortcuts={mockShortcuts}
        mac={false}
        wayland={true}
        delay={0}
        onDelay={onDelay}
        onCapture={onCapture}
        shots={[]}
        onOpen={onOpen}
        onCopy={onCopy}
        onViewAll={onViewAll}
        previewMode='selection'
      />,
    );
    expect(
      screen.getAllByText('Desktop settings').length,
    ).toBeGreaterThanOrEqual(1);
  });
});
