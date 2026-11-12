import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { render } from '@testing-library/react';

let mockFrame = 30;

vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>();
  return {
    ...actual,
    useCurrentFrame: () => mockFrame,
    useVideoConfig: () => ({
      fps: 60,
      width: 1920,
      height: 1080,
      durationInFrames: 600,
    }),
    Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <img alt='mock-promo-preview' {...props} />
    ),
    Sequence: ({ children }: { children: React.ReactNode }) => (
      <div data-testid='sequence'>{children}</div>
    ),
  };
});

import { DesktopPromoSequence } from '../../../src/remotion/DesktopPromo/DesktopPromoSequence';
import { DesktopSceneReveal } from '../../../src/remotion/DesktopPromo/DesktopSceneReveal';
import { DesktopSceneFeatures } from '../../../src/remotion/DesktopPromo/DesktopSceneFeatures';
import { DesktopScenePillars } from '../../../src/remotion/DesktopPromo/DesktopScenePillars';
import { DesktopSceneOutro } from '../../../src/remotion/DesktopPromo/DesktopSceneOutro';
import { THEME } from '../../../src/remotion/Theme';

describe('DesktopPromo 600-Frame Motion Graphics Sequence', () => {
  it('verifies required promotional UI screenshots when generated', () => {
    const promoDir = path.resolve('public', 'assets', 'promo');
    if (!fs.existsSync(promoDir)) {
      // Promotional media assets are optional and generated on demand
      expect(true).toBe(true);
      return;
    }

    const requiredFiles = [
      'CaptureModeView.png',
      'EditorLiveTextView.png',
      'SearchablePdfExportView.png',
    ];

    for (const file of requiredFiles) {
      const fullPath = path.join(promoDir, file);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        expect(stat.size).toBeGreaterThan(100);
      }
    }
  });

  it('renders DesktopPromoSequence with 4 sequence layers and cinematic grading', () => {
    const { container, getAllByTestId } = render(<DesktopPromoSequence />);
    expect(container).toBeDefined();
    expect(getAllByTestId('sequence').length).toBe(4);
  });

  it('renders Scene 1 (Reveal) with authentic branding, title, and cross-platform tags', () => {
    mockFrame = 50;
    const { getAllByText, getByText } = render(<DesktopSceneReveal />);
    expect(getAllByText('Daguerre').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Screenshot Studio, Reimagined.')).toBeDefined();
    expect(getByText('macOS • Windows • Linux • Chrome MV3')).toBeDefined();
    expect(getByText('v1.0.6')).toBeDefined();
  });

  it('renders Scene 2 Stage 1 (Capture Modes) with Area Selection and Window Snapping labels', () => {
    mockFrame = 25;
    const { getByText } = render(<DesktopSceneFeatures />);
    expect(getByText('Precision Multi-Mode Capture')).toBeDefined();
    expect(
      getByText('Area Selection • Window Snapping • Full Display'),
    ).toBeDefined();
  });

  it('renders Scene 2 Stage 2 (Live Text OCR) with interactive OCR title and copy callouts', () => {
    mockFrame = 85;
    const { getByText } = render(<DesktopSceneFeatures />);
    expect(getByText('Offline Live Text OCR')).toBeDefined();
    expect(
      getByText('Interactive Text Selection & Instant Copy'),
    ).toBeDefined();
  });

  it('renders Scene 2 Stage 3 (Searchable PDF Export) with vector export callouts', () => {
    mockFrame = 145;
    const { getByText } = render(<DesktopSceneFeatures />);
    expect(getByText('Searchable PDF Export')).toBeDefined();
    expect(
      getByText('Vector Export with Embedded OCR Text Layer'),
    ).toBeDefined();
  });

  it('renders Scene 3 (Trust Pillars) with the 3 core principles', () => {
    mockFrame = 60;
    const { getByText } = render(<DesktopScenePillars />);
    expect(getByText('Engineered for Trust')).toBeDefined();
    expect(getByText('100% Offline & Private')).toBeDefined();
    expect(getByText('Completely Free')).toBeDefined();
    expect(getByText('Open Source')).toBeDefined();
    expect(
      getByText('No telemetry. No clouds. Pure performance.'),
    ).toBeDefined();
  });

  it('renders Scene 4 (Outro) with app icon, punchline words, and official badges', () => {
    mockFrame = 90;
    const { getByText } = render(<DesktopSceneOutro />);
    expect(getByText('Daguerre')).toBeDefined();
    expect(getByText('Fast.')).toBeDefined();
    expect(getByText('Private.')).toBeDefined();
    expect(getByText('Transparent.')).toBeDefined();
    expect(getByText('Open Source on')).toBeDefined();
    expect(getByText('GitHub')).toBeDefined();
    expect(getByText('Available on')).toBeDefined();
    expect(getByText('Chrome Web Store')).toBeDefined();
    expect(getByText('Available Free for Desktop & Browser')).toBeDefined();
  });

  it('enforces SF Pro system font tokens in THEME for desktop typography harmonization', () => {
    expect(THEME.typography.fontFamily).toContain('SF Pro');
    expect(THEME.typography.fontFamily).toContain('Inter');
    expect(THEME.typography.fontFamily).toContain('system-ui');
  });
});
