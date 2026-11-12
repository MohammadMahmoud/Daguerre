import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from 'remotion';
import { THEME } from '../Theme';
import { GlassWindow, SpecularSweep } from '../Components';
import { DaguerreLogoSvg } from '../BrandMarks';
import captureModeImage from '../Assets/CaptureModeView.png';

/**
 * Scene 1: Application Reveal & Headline Introduction (Frames 0–120 | 0.0s – 2.0s).
 * Features 3D perspective settling of the authentic dark desktop window,
 * diagonal specular lighting sweep, and kinetic typography lockup.
 */
export function DesktopSceneReveal(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window entrance spring physics (damping: 24, mass: 0.8, stiffness: 120)
  const windowProgress = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });

  // 3D rotation settling from perspective angle (rotateX: 8deg, rotateY: -6deg) to center
  const rotateX = interpolate(windowProgress, [0, 1], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rotateY = interpolate(windowProgress, [0, 1], [-6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(windowProgress, [0, 1], [0.88, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(windowProgress, [0, 1], [110, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(windowProgress, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Dynamic specular catch-light sweep across top squircle bevel (frames 20 - 75)
  const specularProgress = interpolate(frame, [20, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Kinetic Typography Springs
  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.snappy,
  });
  const titleY = interpolate(titleSpring, [0, 1], [24, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 0.4], [0, 1]);

  const subtitleSpring = spring({
    frame: frame - 22,
    fps,
    config: THEME.springs.soft,
  });
  const subtitleY = interpolate(subtitleSpring, [0, 1], [20, 0]);
  const subtitleOpacity = interpolate(subtitleSpring, [0, 0.4], [0, 1]);

  const platformSpring = spring({
    frame: frame - 32,
    fps,
    config: THEME.springs.snappy,
  });
  const platformY = interpolate(platformSpring, [0, 1], [16, 0]);
  const platformOpacity = interpolate(platformSpring, [0, 0.4], [0, 1]);

  // Subtle breathing float during hold
  const breathe =
    1 +
    interpolate(frame, [40, 105], [0, 0.02], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  // Exit transition to Scene 2 (frames 105 - 120)
  const exitProgress = interpolate(frame, [105, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneZoom = 1 + exitProgress * 0.08;
  const sceneFadeOut = 1 - exitProgress;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${sceneZoom * breathe})`,
        opacity: sceneFadeOut,
      }}
    >
      {/* Kinetic Typography Lockup */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 32,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
          }}
        >
          <DaguerreLogoSvg size={58} />
          <h1
            style={{
              margin: 0,
              fontFamily: THEME.typography.fontFamily,
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: THEME.colors.textPrimary,
              textShadow: THEME.shadows.textHero,
              lineHeight: 1,
            }}
          >
            Daguerre
          </h1>
          <span
            style={{
              alignSelf: 'flex-start',
              padding: '4px 10px',
              backgroundColor: '#1E202B',
              border: `1px solid ${THEME.colors.borderHighlight}`,
              borderRadius: 8,
              fontSize: 13,
              fontFamily: THEME.typography.fontFamily,
              fontWeight: 600,
              color: THEME.colors.accentBlue,
              letterSpacing: '0.02em',
              marginTop: 6,
            }}
          >
            v1.0.6
          </span>
        </div>

        <p
          style={{
            margin: '10px 0 0 0',
            fontFamily: THEME.typography.fontFamily,
            fontSize: 22,
            fontWeight: 400,
            color: THEME.colors.textMuted,
            letterSpacing: '-0.01em',
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity,
          }}
        >
          Screenshot Studio, Reimagined.
        </p>

        {/* Supported Platforms Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 14,
            padding: '6px 16px',
            backgroundColor: 'rgba(20, 21, 27, 0.85)',
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: 9999,
            transform: `translateY(${platformY}px)`,
            opacity: platformOpacity,
          }}
        >
          <span
            style={{
              fontFamily: THEME.typography.subheadlineFontFamily,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '0.02em',
              color: THEME.colors.textTertiary,
              textTransform: 'uppercase',
            }}
          >
            macOS • Windows • Linux • Chrome MV3
          </span>
        </div>
      </div>

      {/* 3D Floating Application Window */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
        }}
      >
        <GlassWindow
          width={1320}
          height={680}
          rotateX={rotateX}
          rotateY={rotateY}
          scale={scale}
          translateY={translateY}
          opacity={opacity}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <Img
              src={captureModeImage}
              alt='Daguerre Desktop Capture Mode'
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />

            {/* Specular Glint Across Window Surface */}
            <SpecularSweep
              progress={specularProgress}
              width={1320}
              height={680}
            />
          </div>
        </GlassWindow>
      </div>
    </div>
  );
}
