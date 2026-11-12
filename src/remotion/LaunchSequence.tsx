import React from 'react';
import { Sequence } from 'remotion';
import { BackgroundMesh, CinematicGrade } from './Components';
import { SceneReveal } from './SceneReveal';
import { SceneCaptureModes } from './SceneCaptureModes';
import { SceneAnnotations } from './SceneAnnotations';
import { SceneFeatures } from './SceneFeatures';
import { SceneHistory } from './SceneHistory';
import { ScenePillars } from './ScenePillars';
import { SceneOutro } from './SceneOutro';

/**
 * Daguerre 60-Second 60fps Product Launch Motion Graphics Sequence.
 * Orchestrates a comprehensive 3600-frame journey across 7 scenes:
 * - Frames 0–480: The Solid Dark Reveal & Identity (v1.0.6)
 * - Frames 480–1080: Precision Multi-Mode Capture Studio
 * - Frames 1080–1680: Creative Annotation & Redaction Suite
 * - Frames 1680–2340: Offline Live Text OCR & Searchable PDFs
 * - Frames 2340–2880: Local History & Instant Search
 * - Frames 2880–3360: The Uncompromising Trust Pillars
 * - Frames 3360–3600: Outro, Official Badges & "Fast. Private. Transparent."
 */
export function LaunchSequence(): React.JSX.Element {
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
      {/* Layer 1: Ambient Background Mesh (Continuous across entire 60s video) */}
      <BackgroundMesh />

      {/* Layer 2: Scene Sequences (60fps Rhythmic Flow) */}
      {/* Scene 1: The Solid Dark Reveal & Identity (0.0s – 8.0s) */}
      <Sequence
        from={0}
        durationInFrames={481}
        name='Scene 1: Reveal & Identity'
      >
        <SceneReveal />
      </Sequence>

      {/* Scene 2: Precision Multi-Mode Capture Studio (8.0s – 18.0s) */}
      <Sequence
        from={480}
        durationInFrames={601}
        name='Scene 2: Capture Engine'
      >
        <SceneCaptureModes />
      </Sequence>

      {/* Scene 3: Creative Annotation & Redaction Suite (18.0s – 28.0s) */}
      <Sequence
        from={1080}
        durationInFrames={601}
        name='Scene 3: Annotation Suite'
      >
        <SceneAnnotations />
      </Sequence>

      {/* Scene 4: Offline Live Text OCR & Searchable PDFs (28.0s – 39.0s) */}
      <Sequence
        from={1680}
        durationInFrames={661}
        name='Scene 4: Live Text OCR'
      >
        <SceneFeatures />
      </Sequence>

      {/* Scene 5: Local History & Instant Search (39.0s – 48.0s) */}
      <Sequence
        from={2340}
        durationInFrames={541}
        name='Scene 5: Private History'
      >
        <SceneHistory />
      </Sequence>

      {/* Scene 6: The Trust Pillars (48.0s – 56.0s) */}
      <Sequence
        from={2880}
        durationInFrames={481}
        name='Scene 6: Trust Pillars'
      >
        <ScenePillars />
      </Sequence>

      {/* Scene 7: Outro & Official Launch Lockup (56.0s – 60.0s) */}
      <Sequence
        from={3360}
        durationInFrames={240}
        name='Scene 7: Outro & Badges'
      >
        <SceneOutro />
      </Sequence>

      {/* Layer 5: Film Grade, Vignette & Grain */}
      <CinematicGrade />
    </div>
  );
}
