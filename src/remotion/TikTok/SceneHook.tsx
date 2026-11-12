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
import popupImage from '../Assets/Promo/ExtensionPopupTop.png';

/**
 * Scene 1: The Hook (Frames 0–150 | 0.0s – 2.5s)
 * Vertical 9:16 framing with dynamic camera dive into the authentic Daguerre extension popup.
 * Clicks 'Select area' (Shift+Alt+S), launching the capture workflow.
 */
export function SceneHook(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Emil Kowalski Text & Badge Spring (mass: 0.4, stiffness: 220, damping: 16)
  const textSpring = spring({
    frame,
    fps,
    config: {
      mass: 0.4,
      stiffness: 220,
      damping: 16,
    },
  });

  // Card & Camera Entrance Spring (mass: 0.6, stiffness: 140, damping: 20)
  const cameraSpring = spring({
    frame,
    fps,
    config: {
      mass: 0.6,
      stiffness: 140,
      damping: 20,
    },
  });

  // Smooth camera scale: 0.92 -> 1.02, dynamic push-in
  const cameraScale = interpolate(cameraSpring, [0, 1], [0.92, 1.02], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cameraY = interpolate(cameraSpring, [0, 1], [50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Headline & Subline animations
  const textOpacity = interpolate(textSpring, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textY = interpolate(textSpring, [0, 1], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Shortcut Pill Pulse & Tap State (Frames 45–75)
  const tapFrame = Math.max(0, frame - 45);
  const tapProgress = spring({
    frame: tapFrame,
    fps,
    config: {
      mass: 0.3,
      stiffness: 300,
      damping: 18,
    },
  });
  const tapScale =
    frame >= 45 && frame < 75
      ? interpolate(tapProgress, [0, 0.5, 1], [1, 0.95, 1.0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  // Click glow on 'Select area' card inside popup (around frame 45–80)
  const clickGlow =
    frame >= 45 && frame <= 85
      ? interpolate(frame, [45, 55, 85], [0, 1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;

  // Scene Exit transition: zoom forward smoothly (Frames 135–150)
  const exitProgress = interpolate(frame, [135, 150], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneScale = interpolate(exitProgress, [0, 1], [1, 1.08]);
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
      {/* Layer 1: Ambient Background Mesh */}
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
              background: 'rgba(10, 132, 255, 0.12)',
              border: '1px solid rgba(10, 132, 255, 0.3)',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#0a84ff',
                boxShadow: '0 0 10px #0a84ff',
              }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#64d2ff',
                fontFamily: THEME.typography.fontFamily,
              }}
            >
              Daguerre for Chrome
            </span>
          </div>

          <h1
            style={{
              fontSize: 54,
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.035em',
              color: THEME.colors.textPrimary,
              fontFamily: THEME.typography.fontFamily,
              margin: '0 0 12px 0',
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
            }}
          >
            Stop retyping text <br />
            <span
              style={{
                background:
                  'linear-gradient(135deg, #ffffff 30%, #64d2ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              from images.
            </span>
          </h1>

          <p
            style={{
              fontSize: 24,
              fontWeight: 500,
              color: THEME.colors.textMuted,
              letterSpacing: '-0.01em',
              margin: 0,
              fontFamily: THEME.typography.fontFamily,
            }}
          >
            One shortcut. Done.
          </p>
        </div>

        {/* Center: Real Daguerre Extension Popup Glass Mockup */}
        <div
          style={{
            width: '100%',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: 1200,
            transform: `scale(${cameraScale}) translateY(${cameraY}px)`,
          }}
        >
          <div
            style={{
              width: 520,
              height: 840,
              borderRadius: 24,
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: '#0c0d10',
              border: `1.5px solid ${THEME.colors.glassBorderHighlight}`,
              boxShadow:
                '0 32px 80px -12px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1), 0 0 50px rgba(10, 132, 255, 0.25)',
              transform: 'rotateX(3deg) rotateY(-2deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            <Img
              src={popupImage}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                display: 'block',
              }}
            />

            {/* Tap highlight on 'Select area' card */}
            {clickGlow > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '32.4%',
                  left: '4.4%',
                  width: '44.4%',
                  height: '25.5%',
                  borderRadius: 18,
                  border: '2px solid #0a84ff',
                  boxShadow: '0 0 28px rgba(10, 132, 255, 0.75)',
                  pointerEvents: 'none',
                  opacity: clickGlow,
                }}
              />
            )}

            {/* Specular Edge Sweep */}
            <SpecularSweep
              progress={interpolate(frame, [15, 120], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}
              width={520}
              height={840}
            />

            {/* Simulated Floating Shortcut Pill */}
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                left: '50%',
                transform: `translateX(-50%) scale(${tapScale})`,
                background: 'rgba(22, 24, 32, 0.94)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 16,
                padding: '12px 22px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                boxShadow:
                  '0 16px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(10, 132, 255, 0.35)',
                zIndex: 50,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.14)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, monospace',
                    color: '#ffffff',
                  }}
                >
                  Shift
                </span>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.14)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, monospace',
                    color: '#ffffff',
                  }}
                >
                  Alt
                </span>
                <span
                  style={{
                    background: 'rgba(255, 255, 255, 0.14)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: 'ui-monospace, monospace',
                    color: '#ffffff',
                  }}
                >
                  S
                </span>
              </div>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#f0f6fc',
                  fontFamily: THEME.typography.fontFamily,
                }}
              >
                Instant Region Capture
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Microcopy Pill */}
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
            ⚡ Press Shift+Alt+S to capture & extract text instantly
          </span>
        </div>
      </div>
    </div>
  );
}
