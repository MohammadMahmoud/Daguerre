import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from 'remotion';
import { THEME } from './Theme';
import { GlassWindow } from './Components';
import { LiveTextCursor } from './BrandMarks';
import editorImage from './Assets/EditorView.png';

/**
 * Scene 4: Offline Live Text OCR & Searchable PDFs (Frames 1680–2340 | 28.0s – 39.0s)
 * Shows interactive on-device text selection with Apple-style translucent blue highlight
 * (rgba(10, 132, 255, 0.38)), instant clipboard copying, and bilingual eng+deu support.
 */
export function SceneFeatures(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Camera entrance spring (smooth push-in transition)
  const pushProgress = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });

  const cameraScale = interpolate(pushProgress, [0, 1], [0.93, 1.04]);
  const cameraY = interpolate(pushProgress, [0, 1], [60, -10]);
  const sceneOpacity = interpolate(pushProgress, [0, 0.25], [0, 1]);

  // Section headline spring
  const headlineSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.snappy,
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [24, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 0.4], [0, 1]);

  // Dynamic feature badges
  let activeBadge = 'Offline Live Text OCR';
  let badgeHighlightColor: string = THEME.colors.accentBlue;

  if (frame >= 320 && frame < 520) {
    activeBadge = 'Searchable PDF & Instant Text Copy';
    badgeHighlightColor = THEME.colors.accentGreen;
  } else if (frame >= 520) {
    activeBadge = '100% Client-Side • Zero Cloud Uploads';
    badgeHighlightColor = THEME.colors.accentCyan;
  }

  // Live Text Cursor trajectory (glide over canvas text)
  const cursorProgress = interpolate(frame, [80, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cursorDragProgress = interpolate(frame, [160, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cursorX =
    interpolate(cursorProgress, [0, 1], [980, 480]) + cursorDragProgress * 360;
  const cursorY = interpolate(cursorProgress, [0, 1], [540, 305]);
  const isSelecting = frame >= 160 && frame <= 280;

  // OCR Highlight selection bounding box width animation
  const highlightWidth = interpolate(cursorDragProgress, [0, 1], [0, 360], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Copy pill pop-up (frames 250 - 340)
  const copyPillSpring = spring({
    frame: frame - 250,
    fps,
    config: THEME.springs.snappy,
  });
  const copyPillScale = interpolate(copyPillSpring, [0, 1], [0, 1]);
  const copyPillOpacity = interpolate(
    frame,
    [250, 260, 330, 345],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Searchable PDF preview card pop-in (frame 360+)
  const pdfCardSpring = spring({
    frame: frame - 360,
    fps,
    config: THEME.springs.hero,
  });
  const pdfCardX = interpolate(pdfCardSpring, [0, 1], [500, 0]);
  const pdfCardOpacity = interpolate(pdfCardSpring, [0, 0.4], [0, 1]);

  // Exit transition for Scene 4 (frames 620 - 660)
  const exitProgress = interpolate(frame, [620, 660], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneExitScale = 1 + exitProgress * 0.12;
  const sceneExitOpacity = 1 - exitProgress * 0.9;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${cameraScale * sceneExitScale}) translateY(${cameraY}px)`,
        opacity: sceneOpacity * sceneExitOpacity,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 24,
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
        }}
      >
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: THEME.colors.accentCyan,
            marginBottom: 8,
            display: 'block',
          }}
        >
          Intelligence Suite
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: THEME.typography.fontFamily,
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: THEME.colors.textPrimary,
          }}
        >
          On-Device Live Text OCR Recognition
        </h1>
      </div>

      {/* Feature Badge */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 24px',
          borderRadius: 9999,
          backgroundColor: THEME.colors.surfaceCard,
          border: `1.5px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadows.badgeHover,
        }}
      >
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: badgeHighlightColor,
            boxShadow: `0 0 14px ${badgeHighlightColor}`,
          }}
        />
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: THEME.colors.textPrimary,
          }}
        >
          {activeBadge}
        </span>
      </div>

      {/* Editor Canvas Window with Live Text OCR Overlay */}
      <div style={{ position: 'relative' }}>
        <GlassWindow width={1380} height={740} scale={1.0}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Img
              src={editorImage}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
            />

            {/* Simulated Live Text Recognizable Elements */}
            <div
              style={{
                position: 'absolute',
                top: 270,
                left: 450,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                userSelect: 'none',
              }}
            >
              {/* Target Line 1 */}
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div
                  style={{
                    fontFamily: THEME.typography.fontFamily,
                    fontSize: 28,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: 'rgba(255, 255, 255, 0.94)',
                    padding: '4px 8px',
                    borderRadius: 4,
                  }}
                >
                  Daguerre 100% Private Offline OCR
                </div>

                {/* Animated Apple-style translucent blue highlight (rgba(10, 132, 255, 0.38)) */}
                {highlightWidth > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: highlightWidth,
                      height: '100%',
                      backgroundColor: THEME.colors.accentBlueGlow,
                      border: '1.5px solid rgba(10, 132, 255, 0.75)',
                      borderRadius: 4,
                      boxShadow: '0 0 18px rgba(10, 132, 255, 0.45)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
            </div>

            {/* Apple Clipboard Pill Pop-up */}
            {copyPillScale > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: 200,
                  left: 600,
                  transform: `scale(${copyPillScale})`,
                  opacity: copyPillOpacity,
                  padding: '12px 24px',
                  borderRadius: 16,
                  backgroundColor: THEME.colors.surfaceCard,
                  border: `1.5px solid ${THEME.colors.borderActive}`,
                  boxShadow: THEME.shadows.solidCardActive,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  zIndex: 200,
                }}
              >
                <svg
                  width='20'
                  height='20'
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
                    fontSize: 16,
                    fontWeight: 600,
                    color: THEME.colors.textPrimary,
                  }}
                >
                  Copied Text to Clipboard
                </span>
              </div>
            )}

            {/* Interactive Live Text Cursor */}
            {frame >= 70 && frame <= 290 && (
              <LiveTextCursor x={cursorX} y={cursorY} selecting={isSelecting} />
            )}

            {/* Searchable PDF Card Showcase */}
            {frame >= 350 && (
              <div
                style={{
                  position: 'absolute',
                  right: 40,
                  bottom: 40,
                  width: 440,
                  padding: '24px 28px',
                  borderRadius: 20,
                  backgroundColor: THEME.colors.surfaceCharcoal,
                  border: `1.5px solid ${THEME.colors.accentGreen}`,
                  boxShadow: THEME.shadows.solidCard,
                  transform: `translateX(${pdfCardX}px)`,
                  opacity: pdfCardOpacity,
                  zIndex: 220,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: 'rgba(48, 209, 88, 0.16)',
                    border: '1.5px solid rgba(48, 209, 88, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#30D158',
                  }}
                >
                  <svg
                    width='28'
                    height='28'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                  >
                    <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' />
                    <polyline points='14 2 14 8 20 8' />
                    <line x1='16' y1='13' x2='8' y2='13' />
                    <line x1='16' y1='17' x2='8' y2='17' />
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#FFFFFF',
                      marginBottom: 4,
                    }}
                  >
                    Searchable PDF Export
                  </div>
                  <div style={{ fontSize: 13, color: THEME.colors.textMuted }}>
                    Full text layer embedded with exact bounding coordinates.
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassWindow>
      </div>
    </div>
  );
}
