import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from 'remotion';
import { THEME } from '../Theme';
import { GlassWindow } from '../Components';
import { LiveTextCursor } from '../BrandMarks';
import captureModeImage from '../Assets/CaptureModeView.png';
import editorLiveTextImage from '../Assets/EditorLiveTextView.png';
import searchablePdfImage from '../Assets/SearchablePdfExportView.png';

/**
 * Scene 2: Feature Walkthrough (Frames 121–300 | 2.0s – 5.0s, 180 frames total).
 * Smoothly demonstrates:
 * 1. Area Selection & Window Snapping (local frames 0–60)
 * 2. Offline Live Text OCR text selection and clipboard copy (local frames 60–120)
 * 3. Searchable PDF Export Dialog with harmonized typography (local frames 120–180)
 */
export function DesktopSceneFeatures(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Scene Entrance Spring
  const sceneSpring = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });
  const sceneOpacity = interpolate(sceneSpring, [0, 0.25], [0, 1]);
  const sceneScale = interpolate(sceneSpring, [0, 1], [0.95, 1.0]);

  // Stage Breakdown:
  // Stage 1 (0 <= frame < 60): Capture Modes (Area Selection & Window Snapping)
  // Stage 2 (60 <= frame < 120): Live Text OCR
  // Stage 3 (120 <= frame < 180): Searchable PDF Export
  const isStage1 = frame < 60;
  const isStage2 = frame >= 60 && frame < 120;
  const isStage3 = frame >= 120;

  // Crossfade between images
  const crossfadeStage2 = interpolate(frame, [56, 66], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const crossfadeStage3 = interpolate(frame, [116, 126], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Dynamic Camera Movement
  // Gentle pan & zoom per stage
  let cameraZoom: number;
  let cameraPanY: number;
  let cameraPanX = 0;

  if (isStage1) {
    const p1 = interpolate(frame, [0, 60], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    cameraZoom = 1.0 + p1 * 0.05;
    cameraPanY = -p1 * 15;
  } else if (isStage2) {
    const p2 = interpolate(frame, [60, 120], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    cameraZoom = 1.05 + p2 * 0.06;
    cameraPanX = -p2 * 20;
    cameraPanY = -15 - p2 * 10;
  } else {
    const p3 = interpolate(frame, [120, 180], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    cameraZoom = 1.08 - p3 * 0.04;
    cameraPanX = p3 * 25;
    cameraPanY = -20 + p3 * 10;
  }

  // Header Typography Animation per stage
  const headerSpring1 = spring({
    frame: frame - 4,
    fps,
    config: THEME.springs.snappy,
  });
  const headerSpring2 = spring({
    frame: frame - 64,
    fps,
    config: THEME.springs.snappy,
  });
  const headerSpring3 = spring({
    frame: frame - 124,
    fps,
    config: THEME.springs.snappy,
  });

  // Live Text Cursor Movement (Stage 2: frames 65 - 115)
  const cursorProgress = interpolate(frame, [68, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorX = interpolate(cursorProgress, [0, 1], [590, 840]);
  const cursorY = interpolate(cursorProgress, [0, 1], [480, 480]);

  // Clipboard Copied Pill Bounce (Stage 2: frames 92 - 120)
  const pillSpring = spring({
    frame: frame - 92,
    fps,
    config: THEME.springs.hero,
  });
  const pillScale = interpolate(pillSpring, [0, 1], [0.75, 1.0]);
  const pillOpacity = interpolate(pillSpring, [0, 0.4], [0, 1]);

  // Stage 1 Capture Card Highlight Glow
  const highlightGlow1 = interpolate(frame, [15, 35, 55], [0, 1, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit transition to Scene 3 (frames 165 - 180)
  const exitProgress = interpolate(frame, [165, 180], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitZoom = 1 + exitProgress * 0.06;
  const exitFade = 1 - exitProgress;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${sceneScale * exitZoom})`,
        opacity: sceneOpacity * exitFade,
      }}
    >
      {/* Top Dynamic Header Pill & Feature Name */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: 24,
          height: 82,
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        {/* Stage 1 Header */}
        {isStage1 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `translateY(${interpolate(headerSpring1, [0, 1], [16, 0])}px)`,
              opacity: interpolate(headerSpring1, [0, 0.4], [0, 1]),
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                backgroundColor: 'rgba(10, 132, 255, 0.14)',
                border: `1.5px solid ${THEME.colors.accentBlue}`,
                borderRadius: 9999,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: THEME.colors.accentBlue,
                  boxShadow: `0 0 8px ${THEME.colors.accentBlue}`,
                }}
              />
              <span
                style={{
                  fontFamily: THEME.typography.fontFamily,
                  fontSize: 12,
                  fontWeight: 650,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: THEME.colors.accentBlue,
                }}
              >
                Precision Multi-Mode Capture
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: THEME.typography.fontFamily,
                fontSize: 28,
                fontWeight: 650,
                letterSpacing: '-0.02em',
                color: THEME.colors.textPrimary,
              }}
            >
              Area Selection • Window Snapping • Full Display
            </h2>
          </div>
        )}

        {/* Stage 2 Header */}
        {isStage2 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `translateY(${interpolate(headerSpring2, [0, 1], [16, 0])}px)`,
              opacity: interpolate(headerSpring2, [0, 0.4], [0, 1]),
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                backgroundColor: 'rgba(48, 209, 88, 0.14)',
                border: `1.5px solid ${THEME.colors.accentGreen}`,
                borderRadius: 9999,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: THEME.colors.accentGreen,
                  boxShadow: `0 0 8px ${THEME.colors.accentGreen}`,
                }}
              />
              <span
                style={{
                  fontFamily: THEME.typography.fontFamily,
                  fontSize: 12,
                  fontWeight: 650,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: THEME.colors.accentGreen,
                }}
              >
                Offline Live Text OCR
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: THEME.typography.fontFamily,
                fontSize: 28,
                fontWeight: 650,
                letterSpacing: '-0.02em',
                color: THEME.colors.textPrimary,
              }}
            >
              Interactive Text Selection & Instant Copy
            </h2>
          </div>
        )}

        {/* Stage 3 Header */}
        {isStage3 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transform: `translateY(${interpolate(headerSpring3, [0, 1], [16, 0])}px)`,
              opacity: interpolate(headerSpring3, [0, 0.4], [0, 1]),
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 14px',
                backgroundColor: 'rgba(100, 210, 255, 0.14)',
                border: `1.5px solid ${THEME.colors.accentCyan}`,
                borderRadius: 9999,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: THEME.colors.accentCyan,
                  boxShadow: `0 0 8px ${THEME.colors.accentCyan}`,
                }}
              />
              <span
                style={{
                  fontFamily: THEME.typography.fontFamily,
                  fontSize: 12,
                  fontWeight: 650,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: THEME.colors.accentCyan,
                }}
              >
                Searchable PDF Export
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: THEME.typography.fontFamily,
                fontSize: 28,
                fontWeight: 650,
                letterSpacing: '-0.02em',
                color: THEME.colors.textPrimary,
              }}
            >
              Vector Export with Embedded OCR Text Layer
            </h2>
          </div>
        )}
      </div>

      {/* Main Window Frame with Stage Crossfades */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          transform: `scale(${cameraZoom}) translate(${cameraPanX}px, ${cameraPanY}px)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <GlassWindow width={1340} height={700}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {/* Layer 1: Capture Mode View */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 1 - crossfadeStage2,
              }}
            >
              <Img
                src={captureModeImage}
                alt='Capture Modes'
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              {/* Highlight callout on Select Area card */}
              {isStage1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20%',
                    left: '21%',
                    width: '27%',
                    height: '24%',
                    borderRadius: 14,
                    border: `2px solid ${THEME.colors.accentBlue}`,
                    boxShadow: `0 0 24px rgba(10, 132, 255, ${highlightGlow1 * 0.6})`,
                    pointerEvents: 'none',
                    opacity: highlightGlow1,
                  }}
                />
              )}

              {/* Highlight callout on Window card */}
              {isStage1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20%',
                    left: '50%',
                    width: '27%',
                    height: '24%',
                    borderRadius: 14,
                    border: `2px solid ${THEME.colors.accentBlue}`,
                    boxShadow: `0 0 24px rgba(10, 132, 255, ${highlightGlow1 * 0.6})`,
                    pointerEvents: 'none',
                    opacity: highlightGlow1,
                  }}
                />
              )}
            </div>

            {/* Layer 2: Editor Live Text View */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: crossfadeStage2 * (1 - crossfadeStage3),
              }}
            >
              <Img
                src={editorLiveTextImage}
                alt='Editor Live Text OCR'
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              {/* Animated Live Text Cursor */}
              {isStage2 && (
                <LiveTextCursor
                  x={cursorX}
                  y={cursorY}
                  selecting={frame >= 80}
                />
              )}

              {/* Floating Pill: Copied to Clipboard */}
              {isStage2 && frame >= 92 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '40%',
                    left: '50%',
                    transform: `translate(-50%, -50%) scale(${pillScale})`,
                    opacity: pillOpacity,
                    backgroundColor: '#14151E',
                    border: `1.5px solid ${THEME.colors.accentBlue}`,
                    borderRadius: 9999,
                    padding: '10px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow:
                      '0 12px 32px rgba(0,0,0,0.7), 0 0 20px rgba(10, 132, 255, 0.4)',
                    zIndex: 100,
                  }}
                >
                  <svg
                    width='18'
                    height='18'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke={THEME.colors.accentBlue}
                    strokeWidth='2.5'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                  <span
                    style={{
                      fontFamily: THEME.typography.fontFamily,
                      fontSize: 14,
                      fontWeight: 650,
                      color: THEME.colors.textPrimary,
                    }}
                  >
                    Copied to Clipboard
                  </span>
                </div>
              )}
            </div>

            {/* Layer 3: Searchable PDF Export View */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                opacity: crossfadeStage3,
              }}
            >
              <Img
                src={searchablePdfImage}
                alt='Searchable PDF Export'
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
          </div>
        </GlassWindow>
      </div>
    </div>
  );
}
