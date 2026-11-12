import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../Theme';
import { BackgroundMesh, SpecularSweep } from '../Components';

interface PillarCardProps {
  index: number;
  icon: React.ReactNode;
  accentColor: string;
  glowColor: string;
  badge: string;
  headline: string;
  subline: string;
  startFrame: number;
}

function PillarCard({
  index,
  icon,
  accentColor,
  glowColor,
  badge,
  headline,
  subline,
  startFrame,
}: PillarCardProps): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardLocalFrame = Math.max(0, frame - startFrame);

  // Emil Kowalski Card Spring (mass: 0.6, stiffness: 140, damping: 20)
  const cardSpring = spring({
    frame: cardLocalFrame,
    fps,
    config: {
      mass: 0.6,
      stiffness: 140,
      damping: 20,
    },
  });

  const cardOpacity = interpolate(cardSpring, [0, 0.3], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardY = interpolate(cardSpring, [0, 1], [80, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Idle floating breathing wave (offset per card)
  const t = (frame / fps) * 2 + index * 1.2;
  const floatY = Math.sin(t) * 4;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 820,
        opacity: cardOpacity,
        transform: `translateY(${cardY + floatY}px) scale(${cardScale})`,
        background: 'rgba(22, 24, 32, 0.88)',
        backdropFilter: 'blur(36px) saturate(190%)',
        WebkitBackdropFilter: 'blur(36px) saturate(190%)',
        border: `1.5px solid ${THEME.colors.glassBorderHighlight}`,
        borderRadius: 22,
        padding: '28px 32px',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `0 24px 60px -8px rgba(0, 0, 0, 0.7), 0 0 40px ${glowColor}`,
      }}
    >
      {/* Specular edge sweep */}
      <SpecularSweep
        progress={interpolate(cardLocalFrame, [10, 100], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })}
        width={820}
        height={140}
      />

      {/* Leading Accent Icon Container */}
      <div
        style={{
          width: 68,
          height: 68,
          borderRadius: 18,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          border: `1.5px solid ${accentColor}`,
          boxShadow: `0 0 24px ${glowColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: accentColor,
        }}
      >
        {icon}
      </div>

      {/* Copy Flow */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: accentColor,
              background: `rgba(${accentColor === '#30D158' ? '48, 209, 88' : accentColor === '#0A84FF' ? '10, 132, 255' : '191, 90, 242'}, 0.14)`,
              padding: '3px 10px',
              borderRadius: 6,
              fontFamily: THEME.typography.fontFamily,
            }}
          >
            {badge}
          </span>
        </div>

        <h3
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: THEME.colors.textPrimary,
            margin: 0,
            fontFamily: THEME.typography.fontFamily,
          }}
        >
          {headline}
        </h3>

        <p
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: THEME.colors.textMuted,
            margin: 0,
            letterSpacing: '-0.01em',
            fontFamily: THEME.typography.fontFamily,
            lineHeight: 1.35,
          }}
        >
          {subline}
        </p>
      </div>
    </div>
  );
}

/**
 * Scene 3: Trust Pillars Speed-Run (Frames 451–690 | 7.5s – 11.5s, 240 frames)
 * Fast stagger of 3 elevated glass cards:
 * 1. 100% Offline & Private
 * 2. Zero Commercial Noise
 * 3. Verified Open Source
 */
export function ScenePillars(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Header Text Spring (mass: 0.4, stiffness: 220, damping: 16)
  const headerSpring = spring({
    frame,
    fps,
    config: {
      mass: 0.4,
      stiffness: 220,
      damping: 16,
    },
  });

  const headerOpacity = interpolate(headerSpring, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headerY = interpolate(headerSpring, [0, 1], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Exit transition (Frames 225–240)
  const exitProgress = interpolate(frame, [225, 240], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneScale = interpolate(exitProgress, [0, 1], [1, 1.05]);
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
        {/* Header Block */}
        <div
          style={{
            width: '100%',
            textAlign: 'center',
            opacity: headerOpacity,
            transform: `translateY(${headerY}px)`,
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 18px',
              borderRadius: 9999,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.16)',
              marginBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: '#ffffff',
                fontFamily: THEME.typography.fontFamily,
              }}
            >
              Pure Local Engineering
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
              margin: '0 0 10px 0',
              textShadow: '0 4px 24px rgba(0, 0, 0, 0.6)',
            }}
          >
            Built for privacy, <br />
            <span
              style={{
                background:
                  'linear-gradient(135deg, #ffffff 30%, #64d2ff 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              not telemetry.
            </span>
          </h2>
          <p
            style={{
              fontSize: 22,
              fontWeight: 500,
              color: THEME.colors.textMuted,
              letterSpacing: '-0.01em',
              margin: 0,
              fontFamily: THEME.typography.fontFamily,
            }}
          >
            Three non-negotiable architectural principles.
          </p>
        </div>

        {/* 3 Staggered Glass Cards */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            alignItems: 'center',
            margin: 'auto 0',
          }}
        >
          {/* Card 1: 100% Offline & Private (Staggers at frame 15) */}
          <PillarCard
            index={0}
            startFrame={15}
            accentColor='#30D158'
            glowColor='rgba(48, 209, 88, 0.25)'
            badge='Security First'
            headline='100% Offline & Private'
            subline='Never hits an external server. Runs in-memory.'
            icon={
              <svg
                width='32'
                height='32'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
              </svg>
            }
          />

          {/* Card 2: Zero Commercial Noise (Staggers at frame 45) */}
          <PillarCard
            index={1}
            startFrame={45}
            accentColor='#0A84FF'
            glowColor='rgba(10, 132, 255, 0.25)'
            badge='Honest Software'
            headline='Zero Commercial Noise'
            subline='No ads. No subscriptions. No paywalls.'
            icon={
              <svg
                width='32'
                height='32'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <circle cx='12' cy='12' r='10' />
                <path d='M4.93 4.93l14.14 14.14' />
              </svg>
            }
          />

          {/* Card 3: Verified Open Source (Staggers at frame 75) */}
          <PillarCard
            index={2}
            startFrame={75}
            accentColor='#BF5AF2'
            glowColor='rgba(191, 90, 242, 0.25)'
            badge='Full Transparency'
            headline='Verified Open Source'
            subline='Auditable code on GitHub.'
            icon={
              <svg
                width='32'
                height='32'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <polyline points='16 18 22 12 16 6' />
                <polyline points='8 6 2 12 8 18' />
              </svg>
            }
          />
        </div>

        {/* Bottom Safety Pill */}
        <div
          style={{
            padding: '12px 24px',
            borderRadius: 9999,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            opacity: headerOpacity,
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
            🛡️ MIT Licensed • Independent engineering
          </span>
        </div>
      </div>
    </div>
  );
}
