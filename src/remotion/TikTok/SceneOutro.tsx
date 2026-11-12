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
import { ChromeWebStoreBadge, GitHubBadge } from '../BrandMarks';
import daguerreIcon from '../Assets/DaguerreIcon.png';
import storeImage from '../Assets/Promo/StoreVerification.png';

/**
 * Scene 4: Outro & Call to Action (Frames 691–900 | 11.5s – 15.0s, 210 frames)
 * Vertical 9:16 closing lockup featuring the Daguerre app icon,
 * Chrome Web Store & GitHub badges, and prominent CTA button.
 */
export function SceneOutro(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spatial Entrance Spring (mass: 0.6, stiffness: 140, damping: 20)
  const lockupSpring = spring({
    frame,
    fps,
    config: {
      mass: 0.6,
      stiffness: 140,
      damping: 20,
    },
  });

  // CTA Button Pop Spring (mass: 0.4, stiffness: 220, damping: 16)
  const buttonSpring = spring({
    frame: Math.max(0, frame - 35),
    fps,
    config: {
      mass: 0.4,
      stiffness: 220,
      damping: 16,
    },
  });

  const lockupScale = interpolate(lockupSpring, [0, 1], [0.88, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lockupOpacity = interpolate(lockupSpring, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const lockupY = interpolate(lockupSpring, [0, 1], [60, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const buttonScale = interpolate(buttonSpring, [0, 0.6, 1], [0.85, 1.05, 1.0]);
  const buttonOpacity = interpolate(buttonSpring, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Micro-Settle / Tap state on CTA button around frame 80–110
  const ctaTapFrame = Math.max(0, frame - 80);
  const ctaTap =
    frame >= 80 && frame <= 110
      ? interpolate(ctaTapFrame, [0, 10, 25], [1.0, 0.96, 1.0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1.0;

  // Subtle breathing idle on CTA button
  const ctaPulse = Math.sin((frame / fps) * 4) * 0.015;

  // Background store perspective fade-in
  const bgOpacity = interpolate(frame, [0, 40], [0, 0.3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: 1080,
        height: 1920,
        overflow: 'hidden',
        backgroundColor: THEME.colors.canvasBackground,
      }}
    >
      <BackgroundMesh />

      {/* Floating Store Verification in background perspective */}
      <div
        style={{
          position: 'absolute',
          top: 260,
          left: '50%',
          width: 960,
          height: 600,
          transform: 'translateX(-50%) rotateX(12deg) scale(0.9)',
          opacity: bgOpacity,
          borderRadius: 24,
          overflow: 'hidden',
          filter: 'blur(3px)',
          pointerEvents: 'none',
          boxShadow: '0 40px 100px rgba(0, 0, 0, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <Img
          src={storeImage}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

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
        {/* Top Header Label */}
        <div
          style={{
            padding: '8px 20px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            opacity: lockupOpacity,
          }}
        >
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
            Get Started in Seconds
          </span>
        </div>

        {/* Center Main Lockup */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            opacity: lockupOpacity,
            transform: `translateY(${lockupY}px) scale(${lockupScale})`,
            margin: 'auto 0',
          }}
        >
          {/* App Icon Container */}
          <div
            style={{
              width: 144,
              height: 144,
              borderRadius: 36,
              background: 'linear-gradient(135deg, #161820 0%, #0d1117 100%)',
              border: `2px solid ${THEME.colors.glassBorderHighlight}`,
              boxShadow:
                '0 28px 70px -10px rgba(0, 0, 0, 0.9), 0 0 60px rgba(10, 132, 255, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 32,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Img
              src={daguerreIcon}
              style={{
                width: 96,
                height: 96,
                borderRadius: 22,
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              }}
            />
            <SpecularSweep
              progress={interpolate(frame, [20, 140], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              })}
              width={144}
              height={144}
            />
          </div>

          {/* Headline & Subline */}
          <h1
            style={{
              fontSize: 58,
              fontWeight: 800,
              letterSpacing: '-0.035em',
              color: THEME.colors.textPrimary,
              fontFamily: THEME.typography.fontFamily,
              margin: '0 0 12px 0',
              lineHeight: 1.1,
              textShadow: '0 4px 30px rgba(0, 0, 0, 0.7)',
            }}
          >
            Daguerre for Chrome
          </h1>

          <p
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: '#30d158',
              letterSpacing: '-0.01em',
              margin: '0 0 36px 0',
              fontFamily: THEME.typography.fontFamily,
            }}
          >
            Free & Open Source
          </p>

          {/* Badges Stack */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              alignItems: 'center',
              marginBottom: 44,
            }}
          >
            <ChromeWebStoreBadge scale={0.9} />
            <GitHubBadge scale={0.85} />
          </div>

          {/* Primary Call to Action Button */}
          <div
            style={{
              transform: `scale(${(buttonScale + ctaPulse) * ctaTap})`,
              opacity: buttonOpacity,
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #0a84ff 0%, #0066cc 100%)',
                color: '#ffffff',
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                padding: '20px 48px',
                borderRadius: 9999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 14,
                boxShadow:
                  '0 18px 45px rgba(10, 132, 255, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.25)',
                fontFamily: THEME.typography.fontFamily,
                cursor: 'pointer',
              }}
            >
              <svg
                width='24'
                height='24'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.8'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <line x1='12' y1='5' x2='12' y2='19' />
                <line x1='5' y1='12' x2='19' y2='12' />
              </svg>
              <span>Add to Chrome — Link in bio</span>
            </div>
          </div>
        </div>

        {/* Bottom Safety Guarantee */}
        <div
          style={{
            padding: '12px 24px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            opacity: lockupOpacity,
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
            ✓ Verified Publisher on Chrome Web Store
          </span>
        </div>
      </div>
    </div>
  );
}
