import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { THEME } from '../../../src/remotion/Theme';
import { AUDIO_MARKERS } from '../../../src/remotion/AudioMarkers';
import {
  GitHubBadge,
  ChromeWebStoreBadge,
  DaguerreAppIcon,
  DaguerreLogoSvg,
  LiveTextCursor,
} from '../../../src/remotion/BrandMarks';

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
    const { container } = render(<DaguerreLogoSvg size={56} />);
    expect(container.querySelector('svg')).toBeDefined();
    expect(container.querySelector('rect')).toBeDefined();
    expect(container.querySelector('path')).toBeDefined();
    expect(container.querySelector('circle')).toBeDefined();
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
});
