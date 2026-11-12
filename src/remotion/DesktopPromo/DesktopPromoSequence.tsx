import React from 'react';
import { Sequence } from 'remotion';
import { BackgroundMesh, CinematicGrade } from '../Components';
import { DesktopSceneReveal } from './DesktopSceneReveal';
import { DesktopSceneFeatures } from './DesktopSceneFeatures';
import { DesktopScenePillars } from './DesktopScenePillars';
import { DesktopSceneOutro } from './DesktopSceneOutro';

/**
 * Daguerre 600-Frame (10-Second, 60fps) Desktop Promo Motion Graphics Sequence.
 * Harmonized typography and authentic dark UI flow across 4 core scenes:
 * - Scene 1 (Frames 0–120 | 0.0s – 2.0s): Application Reveal & 3D Window Settling
 * - Scene 2 (Frames 121–300 | 2.0s – 5.0s): Precision Capture, Live Text OCR & Searchable PDF Export
 * - Scene 3 (Frames 301–450 | 5.0s – 7.5s): Trust Pillars (100% Offline, Free, Open Source)
 * - Scene 4 (Frames 451–600 | 7.5s – 10.0s): Outro Lockup & Official Platform Badges
 */
export function DesktopPromoSequence(): React.JSX.Element {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#08080A',
        overflow: 'hidden',
      }}
    >
      {/* Layer 1: Ambient Background Mesh */}
      <BackgroundMesh />

      {/* Layer 2: Scene 1 - Application Reveal (0.0s – 2.0s | frames 0–120) */}
      <Sequence
        from={0}
        durationInFrames={121}
        name='Scene 1: Reveal & Identity'
      >
        <DesktopSceneReveal />
      </Sequence>

      {/* Layer 3: Scene 2 - Feature Walkthrough (2.0s – 5.0s | frames 121–300) */}
      <Sequence
        from={120}
        durationInFrames={181}
        name='Scene 2: Feature Walkthrough'
      >
        <DesktopSceneFeatures />
      </Sequence>

      {/* Layer 4: Scene 3 - Trust Pillars (5.0s – 7.5s | frames 301–450) */}
      <Sequence from={300} durationInFrames={151} name='Scene 3: Trust Pillars'>
        <DesktopScenePillars />
      </Sequence>

      {/* Layer 5: Scene 4 - Outro & Badges (7.5s – 10.0s | frames 451–600) */}
      <Sequence
        from={450}
        durationInFrames={150}
        name='Scene 4: Outro & Badges'
      >
        <DesktopSceneOutro />
      </Sequence>

      {/* Layer 6: Cinematic Grade, Vignette & Grain */}
      <CinematicGrade />
    </div>
  );
}

/**
 * Semantic alias for DesktopPromoSequence.
 */
export const DesktopPromo = DesktopPromoSequence;
