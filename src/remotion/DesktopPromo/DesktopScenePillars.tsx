import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../Theme';
import { SpecularSweep } from '../Components';

interface TrustCardData {
  title: string;
  subtitle: string;
  tag: string;
  accent: string;
  icon: React.ReactNode;
}

const PILLARS_DATA: TrustCardData[] = [
  {
    tag: 'ZERO CLOUD UPLOADS',
    title: '100% Offline & Private',
    subtitle:
      'Stored only on this device. Screenshots and OCR run strictly in local memory.',
    accent: THEME.colors.accentGreen,
    icon: (
      <svg
        width='32'
        height='32'
        viewBox='0 0 24 24'
        fill='none'
        stroke={THEME.colors.accentGreen}
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <rect x='3' y='11' width='18' height='11' rx='2' ry='2' />
        <path d='M7 11V7a5 5 0 0 1 10 0v4' />
      </svg>
    ),
  },
  {
    tag: 'NO SUBSCRIPTIONS',
    title: 'Completely Free',
    subtitle:
      'No ads. No paywalls. No subscriptions. No artificial feature gates.',
    accent: THEME.colors.accentBlue,
    icon: (
      <svg
        width='32'
        height='32'
        viewBox='0 0 24 24'
        fill='none'
        stroke={THEME.colors.accentBlue}
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z' />
      </svg>
    ),
  },
  {
    tag: 'VERIFIED CODE',
    title: 'Open Source',
    subtitle:
      'Built in public with Rust, Tauri and TypeScript. Transparent and auditable on GitHub.',
    accent: THEME.colors.accentCyan,
    icon: (
      <svg
        width='32'
        height='32'
        viewBox='0 0 24 24'
        fill='none'
        stroke={THEME.colors.accentCyan}
        strokeWidth='2'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <polyline points='16 18 22 12 16 6' />
        <polyline points='8 6 2 12 8 18' />
      </svg>
    ),
  },
];

/**
 * Scene 3: The Trust Pillars (Frames 301–450 | 5.0s – 7.5s, 150 frames total).
 * Staggered floating cards showcasing Daguerre's three core principles:
 * 100% Offline & Private, Completely Free, and Open Source.
 */
export function DesktopScenePillars(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header Entrance Springs
  const headerSpring = spring({
    frame,
    fps,
    config: THEME.springs.snappy,
  });
  const headerY = interpolate(headerSpring, [0, 1], [30, 0]);
  const headerOpacity = interpolate(headerSpring, [0, 0.4], [0, 1]);

  const sublineSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.soft,
  });
  const sublineY = interpolate(sublineSpring, [0, 1], [20, 0]);
  const sublineOpacity = interpolate(sublineSpring, [0, 0.4], [0, 1]);

  // Exit transition to Scene 4 (frames 135 - 150)
  const exitProgress = interpolate(frame, [135, 150], [0, 1], {
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
        padding: '0 80px',
        transform: `scale(${exitZoom})`,
        opacity: exitFade,
      }}
    >
      {/* Header Lockup */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: 48,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: `1.5px solid ${THEME.colors.borderSubtle}`,
            borderRadius: 9999,
            marginBottom: 12,
            transform: `translateY(${headerY}px)`,
            opacity: headerOpacity,
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
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: THEME.colors.textMuted,
            }}
          >
            Core Architecture
          </span>
        </div>

        <h2
          style={{
            margin: 0,
            fontFamily: THEME.typography.fontFamily,
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: THEME.colors.textPrimary,
            transform: `translateY(${headerY}px)`,
            opacity: headerOpacity,
          }}
        >
          Engineered for Trust
        </h2>

        <p
          style={{
            margin: '8px 0 0 0',
            fontFamily: THEME.typography.fontFamily,
            fontSize: 20,
            color: THEME.colors.textMuted,
            letterSpacing: '-0.01em',
            transform: `translateY(${sublineY}px)`,
            opacity: sublineOpacity,
          }}
        >
          No telemetry. No clouds. Pure performance.
        </p>
      </div>

      {/* 3 Staggered Floating Trust Pillar Cards */}
      <div
        style={{
          display: 'flex',
          gap: 28,
          justifyContent: 'center',
          alignItems: 'stretch',
          maxWidth: 1300,
          width: '100%',
          zIndex: 5,
        }}
      >
        {PILLARS_DATA.map((pillar, i) => {
          // Staggered entrance spring (spaced 8 frames apart)
          const cardSpring = spring({
            frame: frame - (14 + i * 8),
            fps,
            config: THEME.springs.hero,
          });
          const cardY = interpolate(cardSpring, [0, 1], [80, 0]);
          const cardScale = interpolate(cardSpring, [0, 1], [0.9, 1.0]);
          const cardOpacity = interpolate(cardSpring, [0, 0.35], [0, 1]);

          // Subtle sin-wave idle floating
          const idleY = Math.sin((frame / fps) * 2 + i * 1.5) * 5;

          // Specular sweep progress across card surface
          const specularProgress = interpolate(
            frame,
            [30 + i * 16, 90 + i * 16],
            [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          return (
            <div
              key={pillar.title}
              style={{
                flex: 1,
                position: 'relative',
                transform: `translateY(${cardY + idleY}px) scale(${cardScale})`,
                opacity: cardOpacity,
                backgroundColor: THEME.colors.surfaceCharcoal,
                borderRadius: 20,
                border: `1.5px solid ${THEME.colors.borderSubtle}`,
                boxShadow: THEME.shadows.solidCard,
                padding: '36px 30px',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Specular Catch-Light */}
              <SpecularSweep
                progress={specularProgress}
                width={400}
                height={320}
              />

              {/* Tag & Icon Row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${THEME.colors.borderHighlight}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 20px ${pillar.accent}22`,
                  }}
                >
                  {pillar.icon}
                </div>

                <span
                  style={{
                    fontFamily: THEME.typography.fontFamily,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: pillar.accent,
                    backgroundColor: `${pillar.accent}14`,
                    padding: '4px 10px',
                    borderRadius: 9999,
                    border: `1px solid ${pillar.accent}33`,
                  }}
                >
                  {pillar.tag}
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  margin: '0 0 12px 0',
                  fontFamily: THEME.typography.fontFamily,
                  fontSize: 24,
                  fontWeight: 700,
                  letterSpacing: '-0.02em',
                  color: THEME.colors.textPrimary,
                }}
              >
                {pillar.title}
              </h3>

              {/* Subtitle */}
              <p
                style={{
                  margin: 0,
                  fontFamily: THEME.typography.fontFamily,
                  fontSize: 15,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  color: THEME.colors.textMuted,
                  letterSpacing: '-0.005em',
                  flex: 1,
                }}
              >
                {pillar.subtitle}
              </p>

              {/* Bottom Hairline Glow */}
              <div
                style={{
                  marginTop: 28,
                  height: 2,
                  width: '100%',
                  background: `linear-gradient(90deg, ${pillar.accent} 0%, transparent 80%)`,
                  opacity: 0.7,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
