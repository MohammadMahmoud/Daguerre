import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from 'remotion';
import { THEME } from './Theme';
import { GlassWindow, SpecularSweep } from './Components';
import { DaguerreLogoSvg } from './BrandMarks';
import captureImage from './Assets/CaptureView.png';

/**
 * Scene 1: The Liquid Glass Reveal & Identity (Frames 0–480 | 0.0s – 8.0s)
 * Camera dives through ambient atmosphere; 3D liquid glass window settles;
 * specular catch-light sweeps; displays the official Daguerre v1.0.6 release.
 */
export function SceneReveal(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Window entrance spring physics (exact user specs: damping 24, mass 0.8, stiffness 120)
  const windowProgress = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });

  // 3D rotation settling from rotateX(8deg) rotateY(-6deg) to center (0deg, 0deg)
  const rotateX = interpolate(windowProgress, [0, 1], [8, 1.2], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rotateY = interpolate(windowProgress, [0, 1], [-6, -0.8], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(windowProgress, [0, 1], [0.86, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(windowProgress, [0, 1], [140, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(windowProgress, [0, 0.35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Specular sweep across squircle glass bevel (frames 40 - 180)
  const specularProgress = interpolate(frame, [40, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Headline Kinetic Spring (staggered entrance)
  const titleSpring = spring({
    frame: frame - 15,
    fps,
    config: THEME.springs.snappy,
  });
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 0.4], [0, 1]);

  // Subtitle Spring (staggered +15 frames after title)
  const subtitleSpring = spring({
    frame: frame - 30,
    fps,
    config: THEME.springs.soft,
  });
  const subtitleY = interpolate(subtitleSpring, [0, 1], [25, 0]);
  const subtitleOpacity = interpolate(subtitleSpring, [0, 0.4], [0, 1]);

  // Platform badges row spring (+45 frames)
  const platformsSpring = spring({
    frame: frame - 45,
    fps,
    config: THEME.springs.snappy,
  });
  const platformsY = interpolate(platformsSpring, [0, 1], [20, 0]);
  const platformsOpacity = interpolate(platformsSpring, [0, 0.5], [0, 1]);

  // Ambient breathing during hold (Ken Burns scale: 1 -> 1.03)
  const breatheScale =
    1 +
    interpolate(frame, [60, 440], [0, 0.03], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  // Camera push forward & exit transition (frames 440 - 480)
  const exitProgress = interpolate(frame, [440, 480], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cameraZoom = 1 + exitProgress * 0.18;
  const sceneFadeOut = 1 - exitProgress * 0.9;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${cameraZoom * breatheScale})`,
        opacity: sceneFadeOut,
      }}
    >
      {/* Kinetic Typography Lockup (Floating above the window) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 36,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            transform: `translateY(${titleY}px)`,
            opacity: titleOpacity,
          }}
        >
          {/* Authentic Daguerre Logo SVG from src/Ui.tsx */}
          <DaguerreLogoSvg size={68} />

          <h1
            style={{
              margin: 0,
              fontFamily: THEME.typography.fontFamily,
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: THEME.colors.textPrimary,
              textShadow: THEME.shadows.textHero,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span
              style={{
                background:
                  'linear-gradient(180deg, #FFFFFF 20%, #A1A1A8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Daguerre
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: '0.04em',
                padding: '6px 16px',
                borderRadius: 9999,
                backgroundColor: 'rgba(10, 132, 255, 0.18)',
                border: '1.5px solid rgba(10, 132, 255, 0.45)',
                color: THEME.colors.accentCyan,
                boxShadow: '0 0 20px rgba(10, 132, 255, 0.25)',
              }}
            >
              v1.0.6
            </span>
          </h1>
        </div>

        <p
          style={{
            margin: '12px 0 0',
            fontFamily: THEME.typography.fontFamily,
            fontSize: 26,
            fontWeight: 400,
            letterSpacing: '-0.015em',
            color: THEME.colors.textMuted,
            transform: `translateY(${subtitleY}px)`,
            opacity: subtitleOpacity,
          }}
        >
          Screenshot Studio,{' '}
          <span
            style={{
              color: THEME.colors.textSecondary,
              fontWeight: 600,
            }}
          >
            Reimagined.
          </span>
        </p>

        {/* Cross-platform badge indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            transform: `translateY(${platformsY}px)`,
            opacity: platformsOpacity,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 18px',
              borderRadius: 9999,
              backgroundColor: THEME.colors.surfaceCard,
              border: `1px solid ${THEME.colors.borderSubtle}`,
              boxShadow: THEME.shadows.solidCard,
            }}
          >
            <span
              style={{
                fontFamily: THEME.typography.subheadlineFontFamily,
                fontSize: 15,
                fontWeight: 500,
                color: THEME.colors.textSecondary,
                letterSpacing: '-0.01em',
              }}
            >
              macOS • Windows • Linux • Chrome MV3
            </span>
          </div>
        </div>
      </div>

      {/* 3D Solid Dark Application Window showing fresh CaptureView */}
      <div style={{ position: 'relative' }}>
        <GlassWindow
          width={1320}
          height={760}
          rotateX={rotateX}
          rotateY={rotateY}
          scale={scale}
          translateY={translateY}
          opacity={opacity}
        >
          <Img
            src={captureImage}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
            }}
          />
          {/* Dynamic Specular Catch-light gliding across top bevel */}
          <SpecularSweep
            progress={specularProgress}
            width={1320}
            height={760}
          />
        </GlassWindow>
      </div>
    </div>
  );
}
