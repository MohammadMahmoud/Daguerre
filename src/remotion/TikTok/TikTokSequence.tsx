import React from 'react';
import { Sequence } from 'remotion';
import { CinematicGrade } from '../Components';
import { SceneHook } from './SceneHook';
import { SceneOcrDemo } from './SceneOcrDemo';
import { ScenePillars } from './ScenePillars';
import { SceneOutro } from './SceneOutro';

/**
 * TikTok / Reels 15-second Vertical Product Video Sequence (9:16, 1080x1920, 60fps).
 *
 * Timeline Orchestration:
 * - Scene 1: The Hook (Frames 0–150 | 0.0s – 2.5s)
 * - Scene 2: Offline Live Text in Action (Frames 150–450 | 2.5s – 7.5s)
 * - Scene 3: Trust Pillars Speed-Run (Frames 450–690 | 7.5s – 11.5s)
 * - Scene 4: Outro & Call to Action (Frames 690–900 | 11.5s – 15.0s)
 */
export function TikTokSequence(): React.JSX.Element {
  return (
    <div
      style={{
        position: 'relative',
        width: 1080,
        height: 1920,
        overflow: 'hidden',
        backgroundColor: '#08080A',
      }}
    >
      {/* Scene 1: The Hook (Frames 0–150) */}
      <Sequence from={0} durationInFrames={150} name='Scene 1: The Hook'>
        <SceneHook />
      </Sequence>

      {/* Scene 2: Offline Live Text Demo (Frames 150–450) */}
      <Sequence from={150} durationInFrames={300} name='Scene 2: Live Text OCR'>
        <SceneOcrDemo />
      </Sequence>

      {/* Scene 3: Trust Pillars Speed-Run (Frames 450–690) */}
      <Sequence from={450} durationInFrames={240} name='Scene 3: Trust Pillars'>
        <ScenePillars />
      </Sequence>

      {/* Scene 4: Outro & Call to Action (Frames 690–900) */}
      <Sequence from={690} durationInFrames={210} name='Scene 4: Outro & CTA'>
        <SceneOutro />
      </Sequence>

      {/* Top Layer 5: Cinematic Grade, Vignette, and Fine Analog Film Grain */}
      <CinematicGrade />
    </div>
  );
}
