import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
} from 'remotion';
import { THEME } from '../Theme';
import { BackgroundMesh, SpecularSweep } from '../Components';
import { LiveTextCursor } from '../BrandMarks';
import editorGoogleImage from '../Assets/Promo/EditorGoogleCapture.png';

/**
 * Scene 2: Offline Live Text in Action (Frames 150–450 | 2.5s – 7.5s, 300 frames)
 * Shows the authentic Daguerre Editor View with the captured Google page.
 * The macOS/system cursor glides across the iconic 'Google' text, blooming into
 * mathematically accurate Apple Live Text translucent blue selection, followed
 * by a tactile HUD confirming plain text clipboard copy.
 */
export function SceneOcrDemo(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spatial Entrance Spring (mass: 0.6, stiffness: 140, damping: 20)
  const cardSpring = spring({
    frame,
    fps,
    config: {
      mass: 0.6,
      stiffness: 140,
      damping: 20,
    },
  });

  // Text Entrance Spring (mass: 0.4, stiffness: 220, damping: 16)
  const textSpring = spring({
    frame,
    fps,
    config: {
      mass: 0.4,
      stiffness: 220,
      damping: 16,
    },
  });

  const cardScale = interpolate(cardSpring, [0, 1], [0.93, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardOpacity = interpolate(cardSpring, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textOpacity = interpolate(textSpring, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textY = interpolate(textSpring, [0, 1], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cursor and Selection Timeline:
  // Container dimensions: width 820px, height 722px (matching 1024x902 aspect ratio)
  // Google logo on 820x722:
  // left: 42.5% = 348px
  // top: 42.1% = 304px
  // width: 22.4% = 184px
  // height: 10.4% = 75px
  // Center Y: ~341px

  // Cursor enters from frame 15 to 45, moving to the start of 'Google' (x: 345, y: 341)
  const cursorEntrance = interpolate(frame, [15, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cursor drags across 'Google' from frame 45 to frame 110 (x: 345 to x: 535)
  const cursorDrag = interpolate(frame, [45, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cursorStartX = 345;
  const cursorEndX = 535;
  const cursorY = 341;

  const cursorX =
    cursorEntrance < 1
      ? interpolate(cursorEntrance, [0, 1], [680, cursorStartX])
      : cursorStartX + cursorDrag * (cursorEndX - cursorStartX);

  // Selection blooms progressively as cursor drags across the text
  const selectionProgress = cursorDrag;

  // ⌘C / Ctrl+C Copy HUD Pill Pop (Frame 120–280)
  const hudFrame = Math.max(0, frame - 120);
  const hudSpring = spring({
    frame: hudFrame,
    fps,
    config: {
      mass: 0.4,
      stiffness: 220,
      damping: 16,
    },
  });
  const hudOpacity = interpolate(hudSpring, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hudScale = interpolate(hudSpring, [0, 0.6, 1], [0.85, 1.05, 1.0]);

  // Micro-Settle / Tap state on copy HUD (at frame 125)
  const tapSettle =
    frame >= 120 && frame <= 145
      ? interpolate(frame, [120, 130, 145], [1.0, 0.96, 1.0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1.0;

  // Exit transition (Frames 285–300)
  const exitProgress = interpolate(frame, [285, 300], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneScale = interpolate(exitProgress, [0, 1], [1, 1.06]);
  const sceneOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 1080,
        height: 1920,
        overflow: 'hidden',
        backgroundColor: THEME.colors.canvasBackground,
        transform: `scale(${sceneScale})`,
        opacity: sceneOpacity,
      }}
    >
      <BackgroundMesh />

      {/* Central Viewport Safe Zone Track (840 x 1420 within 1080 x 1920) */}
      <div
        style={{
          position: 'absolute',
          top: 160,
          left: 60,
          width: 840,
          height: 1420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        {/* Top Header Copy */}
        <div
          style={{
            width: '100%',
            textAlign: 'center',
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 9999,
              background: 'rgba(48, 209, 88, 0.12)',
              border: '1px solid rgba(48, 209, 88, 0.3)',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#30d158',
                boxShadow: '0 0 10px #30d158',
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#30d158',
                fontFamily: THEME.typography.fontFamily,
              }}
            >
              100% In-Memory OCR
            </span>
          </div>

          <h2
            style={{
              fontSize: 50,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.035em',
              color: THEME.colors.textPrimary,
              fontFamily: THEME.typography.fontFamily,
              margin: '0 0 12px 0',
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
            }}
          >
            Instant OCR right <br />
            <span
              style={{
                background:
                  'linear-gradient(135deg, #ffffff 30%, #30d158 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              in your browser.
            </span>
          </h2>

          <p
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: '#64d2ff',
              letterSpacing: '-0.01em',
              margin: 0,
              fontFamily: THEME.typography.fontFamily,
            }}
          >
            Select. Copy. Paste.
          </p>
        </div>

        {/* Center: Authentic Daguerre Editor & Accurate Live Text Mockup */}
        <div
          style={{
            width: '100%',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: 1200,
            opacity: cardOpacity,
            transform: `scale(${cardScale})`,
          }}
        >
          <div
            style={{
              width: 820,
              height: 722,
              borderRadius: 22,
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: '#161618',
              border: `1.5px solid ${THEME.colors.glassBorderHighlight}`,
              boxShadow:
                '0 32px 80px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 50px rgba(10, 132, 255, 0.25)',
              transform: 'rotateX(3deg) rotateY(-2deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            <Img
              src={editorGoogleImage}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                display: 'block',
              }}
            />

            {/* Mathematically Accurate Apple Live Text Highlight on 'Google' */}
            {selectionProgress > 0 && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                }}
              >
                {/* Highlight box wrapping 'Google' text (left: 42.5%, top: 42.1%, height: 10.4%) */}
                <div
                  style={{
                    position: 'absolute',
                    top: '41.6%',
                    left: '42.3%',
                    width: `${selectionProgress * 22.2}%`,
                    height: '10.8%',
                    background: 'rgba(10, 132, 255, 0.38)',
                    boxShadow:
                      'inset 0 0 0 1.5px rgba(255, 255, 255, 0.55), 0 0 20px rgba(10, 132, 255, 0.4)',
                    borderRadius: 6,
                    backdropFilter: 'contrast(120%)',
                    WebkitBackdropFilter: 'contrast(120%)',
                  }}
                >
                  {/* Left Selection Pin Handle */}
                  <div
                    style={{
                      position: 'absolute',
                      left: -2,
                      top: -4,
                      bottom: -4,
                      width: 3,
                      backgroundColor: '#0a84ff',
                      borderRadius: 2,
                      boxShadow: '0 0 8px #0a84ff',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        top: -4,
                        left: -3.5,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: '#0a84ff',
                        boxShadow: '0 0 8px rgba(10, 132, 255, 0.8)',
                      }}
                    />
                  </div>

                  {/* Right Selection Pin Handle (tracks cursor) */}
                  <div
                    style={{
                      position: 'absolute',
                      right: -2,
                      top: -4,
                      bottom: -4,
                      width: 3,
                      backgroundColor: '#0a84ff',
                      borderRadius: 2,
                      boxShadow: '0 0 8px #0a84ff',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        left: -3.5,
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        backgroundColor: '#0a84ff',
                        boxShadow: '0 0 8px rgba(10, 132, 255, 0.8)',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Specular Catch-light */}
            <SpecularSweep
              progress={interpolate(frame, [30, 240], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}
              width={820}
              height={722}
            />

            {/* Animated Live Text Cursor */}
            {frame < 220 && (
              <LiveTextCursor
                x={cursorX}
                y={cursorY}
                selecting={frame >= 45 && frame <= 110}
              />
            )}

            {/* Tactile HUD Pill Overlay confirming plain text copy */}
            {frame >= 120 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 40,
                  left: '50%',
                  transform: `translateX(-50%) scale(${hudScale * tapSettle})`,
                  opacity: hudOpacity,
                  background: 'rgba(22, 24, 32, 0.95)',
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                  border: '1.5px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: 9999,
                  padding: '14px 30px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  boxShadow:
                    '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(48, 209, 88, 0.35)',
                  zIndex: 300,
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: '#30d158',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(48, 209, 88, 0.6)',
                  }}
                >
                  <svg
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='#ffffff'
                    strokeWidth='3.2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                  >
                    <polyline points='20 6 9 17 4 12' />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: '#ffffff',
                      fontFamily: THEME.typography.fontFamily,
                      lineHeight: 1.2,
                    }}
                  >
                    Copied as plain text: "Google"
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: '#30d158',
                      fontWeight: 600,
                      fontFamily: THEME.typography.fontFamily,
                    }}
                  >
                    Ready to paste anywhere
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: '#a1a1aa',
                    background: 'rgba(255, 255, 255, 0.12)',
                    padding: '4px 10px',
                    borderRadius: 8,
                    fontFamily: 'ui-monospace, monospace',
                  }}
                >
                  ⌘C
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Feature Pill */}
        <div
          style={{
            padding: '12px 24px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            opacity: textOpacity,
            transform: `translateY(${interpolate(textSpring, [0, 1], [20, 0])}px)`,
          }}
        >
          <span
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: THEME.colors.textSecondary,
              fontFamily: THEME.typography.fontFamily,
            }}
          >
            🔒 On-device OCR reads text directly off the canvas
          </span>
        </div>
      </div>
    </div>
  );
}
