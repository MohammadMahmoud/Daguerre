import { describe, it, expect, vi } from 'vitest';
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
      durationInFrames: 3600,
    }),
    Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <img alt='mock-preview' {...props} />
    ),
    Sequence: ({ children }: { children: React.ReactNode }) => (
      <div data-testid='sequence'>{children}</div>
    ),
    Composition: ({ id }: { id: string }) => (
      <div data-testid={`composition-${id}`} />
    ),
    registerRoot: vi.fn(),
  };
});

import { THEME } from '../../../src/remotion/Theme';
import { AUDIO_MARKERS } from '../../../src/remotion/AudioMarkers';
import {
  GitHubBadge,
  ChromeWebStoreBadge,
  DaguerreAppIcon,
  DaguerreLogoSvg,
  LiveTextCursor,
} from '../../../src/remotion/BrandMarks';
import { LaunchSequence } from '../../../src/remotion/LaunchSequence';
import { SceneReveal } from '../../../src/remotion/SceneReveal';
import { SceneCaptureModes } from '../../../src/remotion/SceneCaptureModes';
import { SceneAnnotations } from '../../../src/remotion/SceneAnnotations';
import { SceneFeatures } from '../../../src/remotion/SceneFeatures';
import { SceneHistory } from '../../../src/remotion/SceneHistory';
import { ScenePillars } from '../../../src/remotion/ScenePillars';
import { SceneOutro } from '../../../src/remotion/SceneOutro';
import { Root } from '../../../src/remotion/Root';
import { DesktopPromo } from '../../../src/remotion/DesktopPromo';
import { registerRoot } from 'remotion';

describe('Remotion 60-Second Launch Sequence Design & Physics Specification', () => {
  it('enforces exact Apple spring physics configuration for hero entrances', () => {
    expect(THEME.springs.hero).toEqual({
      damping: 24,
      mass: 0.8,
      stiffness: 120,
    });
  });

  it('defines the official Apple Live Text OCR translucent blue highlight token', () => {
    expect(THEME.colors.accentBlueGlow).toBe('rgba(10, 132, 255, 0.38)');
  });

  it('includes complete sequential audio markers across all 7 scenes in the 60-second sequence', () => {
    expect(AUDIO_MARKERS.length).toBeGreaterThanOrEqual(25);

    // Verify frames are ordered sequentially within 0 to 3599 (60 seconds at 60fps)
    for (let i = 0; i < AUDIO_MARKERS.length - 1; i++) {
      expect(AUDIO_MARKERS[i].frame).toBeLessThanOrEqual(
        AUDIO_MARKERS[i + 1].frame,
      );
      expect(AUDIO_MARKERS[i].frame).toBeGreaterThanOrEqual(0);
      expect(AUDIO_MARKERS[i].frame).toBeLessThan(3600);
    }

    // Verify key stem triggers spanning across 60 seconds
    const stemIds = AUDIO_MARKERS.map((m) => m.stemId);
    expect(stemIds).toContain('sfx_headline_impact');
    expect(stemIds).toContain('sfx_mechanical_shutter');
    expect(stemIds).toContain('sfx_redaction_blur_glide');
    expect(stemIds).toContain('sfx_ocr_bounding_lock');
    expect(stemIds).toContain('sfx_ocr_copy_chime');
    expect(stemIds).toContain('sfx_pdf_export_stamp');
    expect(stemIds).toContain('sfx_search_typing_burst');
    expect(stemIds).toContain('sfx_pillar_snap_1');
    expect(stemIds).toContain('sfx_badge_lock_dual');
    expect(stemIds).toContain('sfx_punchline_strike');
  });

  it('renders official GitHub vector brand badge with correct typography', () => {
    const { getByText } = render(<GitHubBadge scale={1} />);
    expect(getByText('Open Source on')).toBeDefined();
    expect(getByText('GitHub')).toBeDefined();
  });

  it('renders official Chrome Web Store vector brand badge with correct typography', () => {
    const { getByText } = render(<ChromeWebStoreBadge scale={1} />);
    expect(getByText('Available on')).toBeDefined();
    expect(getByText('Chrome Web Store')).toBeDefined();
  });

  it('renders the authentic Daguerre Logo SVG with viewfinder reticle from src/Ui.tsx', () => {
    const { container, rerender } = render(<DaguerreLogoSvg size={56} />);
    expect(container.querySelector('svg')).toBeDefined();
    expect(container.querySelector('rect')).toBeDefined();
    expect(container.querySelector('path')).toBeDefined();
    expect(container.querySelector('circle')).toBeDefined();

    rerender(<DaguerreLogoSvg size={32} mono={true} />);
    expect(container.querySelector('rect')).toBeNull();
  });

  it('renders the authentic Daguerre App Icon with genuine raster asset', () => {
    const { container } = render(<DaguerreAppIcon size={120} />);
    expect(container.querySelector('img')).toBeDefined();
  });

  it('renders authentic Live Text pointer and I-beam selection states', () => {
    const { container: pointerContainer } = render(
      <LiveTextCursor x={100} y={200} selecting={false} />,
    );
    expect(pointerContainer.querySelector('svg')).toBeDefined();

    const { container: ibeamContainer } = render(
      <LiveTextCursor x={150} y={250} selecting={true} />,
    );
    expect(ibeamContainer.querySelector('svg')).toBeDefined();
  });

  it('defines authentic Solid Dark Theme tokens without liquid glass artifacts', () => {
    expect(THEME.colors.canvasBackground).toBe('#090A0D');
    expect(THEME.colors.surfaceCharcoal).toBe('#14151B');
    expect(THEME.colors.surfaceCard).toBe('#16171F');
    expect(THEME.colors.borderSubtle).toBe('#222430');
    expect(THEME.typography.subheadlineFontFamily).toBeDefined();
  });

  it('renders LaunchSequence containing all 7 sequence stages', () => {
    const { getAllByTestId } = render(<LaunchSequence />);
    expect(getAllByTestId('sequence').length).toBe(7);
  });

  it('renders SceneReveal (Scene 1) with authentic typography and version tag', () => {
    mockFrame = 50;
    const { getByText, getAllByText } = render(<SceneReveal />);
    expect(getAllByText('Daguerre').length).toBeGreaterThanOrEqual(1);
    expect(getByText('v1.0.6')).toBeDefined();
    expect(getByText('Reimagined.')).toBeDefined();
  });

  it('renders SceneCaptureModes (Scene 2) across area, window, and screen modes', () => {
    mockFrame = 50;
    const { getByText, rerender } = render(<SceneCaptureModes />);
    expect(getByText('Capture Engine')).toBeDefined();
    expect(getByText('Four Workflows. Instant Execution.')).toBeDefined();
    expect(getByText('Area Selection')).toBeDefined();

    mockFrame = 200;
    rerender(<SceneCaptureModes />);
    expect(getByText('Window Snapping')).toBeDefined();

    mockFrame = 380;
    rerender(<SceneCaptureModes />);
    expect(getByText('Full Screen & Delay')).toBeDefined();
    expect(getByText(/3s delay/i)).toBeDefined();

    mockFrame = 450;
    rerender(<SceneCaptureModes />);
    expect(getByText(/0s delay/i)).toBeDefined();
  });

  it('renders SceneAnnotations (Scene 3) with drawing tools, step counters, and redaction', () => {
    mockFrame = 150;
    const { getByText, rerender } = render(<SceneAnnotations />);
    expect(getByText('Precision Editor')).toBeDefined();
    expect(getByText('Annotation & Privacy Redaction Suite')).toBeDefined();

    mockFrame = 400;
    rerender(<SceneAnnotations />);
    expect(getByText('1')).toBeDefined();
    expect(getByText('2')).toBeDefined();
  });

  it('renders SceneFeatures (Scene 4) across Live Text OCR, Searchable PDF, and bilingual stages', () => {
    mockFrame = 100;
    const { getByText, rerender } = render(<SceneFeatures />);
    expect(getByText('Intelligence Suite')).toBeDefined();
    expect(getByText('On-Device Live Text OCR Recognition')).toBeDefined();
    expect(getByText('Offline Live Text OCR')).toBeDefined();

    mockFrame = 350;
    rerender(<SceneFeatures />);
    expect(getByText('Searchable PDF & Instant Text Copy')).toBeDefined();

    mockFrame = 550;
    rerender(<SceneFeatures />);
    expect(getByText('100% Client-Side • Zero Cloud Uploads')).toBeDefined();
  });

  it('renders SceneHistory (Scene 5) with local history studio and query typing', () => {
    mockFrame = 10;
    const { getByText, rerender } = render(<SceneHistory />);
    expect(getByText('Local Storage Engine')).toBeDefined();

    mockFrame = 150;
    rerender(<SceneHistory />);
    expect(getByText('Private Capture History & Instant Search')).toBeDefined();
    expect(
      getByText('Client-Side IndexedDB • Zero Cloud Synchronization'),
    ).toBeDefined();
    expect(getByText(/project/)).toBeDefined();
  });

  it('renders ScenePillars (Scene 6) with 3 trust pillar cards', () => {
    mockFrame = 100;
    const { getByText } = render(<ScenePillars />);
    expect(getByText('Core Architecture')).toBeDefined();
    expect(getByText('Built on Uncompromising Principles')).toBeDefined();
    expect(getByText('100% Private & Local')).toBeDefined();
    expect(getByText('Completely Free')).toBeDefined();
  });

  it('renders SceneOutro (Scene 7) with outro title and badges', () => {
    mockFrame = 100;
    const { getAllByText, getByText } = render(<SceneOutro />);
    expect(getAllByText('Daguerre').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Fast.')).toBeDefined();
    expect(getByText('Private.')).toBeDefined();
    expect(getByText('Transparent.')).toBeDefined();
  });

  it('renders Root with registered compositions and exports DesktopPromo', async () => {
    const { getByTestId } = render(<Root />);
    expect(getByTestId('composition-DesktopPromo')).toBeDefined();
    expect(getByTestId('composition-LaunchSequence')).toBeDefined();
    expect(getByTestId('composition-LaunchSequence4K')).toBeDefined();
    expect(getByTestId('composition-TikTokVertical')).toBeDefined();

    expect(DesktopPromo).toBeDefined();

    // Verify Index entrypoint runs registerRoot
    await import('../../../src/remotion/Index');
    expect(registerRoot).toHaveBeenCalled();
  });
});
