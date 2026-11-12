import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from './Theme';
import { SpecularSweep } from './Components';

interface PillarCardProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  accentColor: string;
  glowColor: string;
  tag: string;
}

/**
 * Single Glass Feature Card with elevation bloom and subtle idle levitation.
 */
function PillarCard({
  index,
  icon,
  title,
  subtitle,
  accentColor,
  glowColor,
  tag,
}: PillarCardProps): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered entrance spring (24 frames offset between cards)
  const entranceSpring = spring({
    frame: frame - (24 + index * 22),
    fps,
    config: THEME.springs.hero,
  });

  const cardY = interpolate(entranceSpring, [0, 1], [120, 0]);
  const cardScale = interpolate(entranceSpring, [0, 1], [0.86, 1.0]);
  const cardOpacity = interpolate(entranceSpring, [0, 0.4], [0, 1]);

  // Sin-wave idle levitation after entrance settles
  const idleT = (frame / fps) * 1.8 + index * 1.5;
  const idleY = Math.sin(idleT) * 6;
  const idleRotate = Math.cos(idleT * 0.8) * 1.2;

  // Specular sweep progress
  const specularProgress = interpolate(
    frame,
    [40 + index * 30, 140 + index * 30],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <div
      style={{
        position: 'relative',
        width: 380,
        height: 480,
        borderRadius: 28,
        transform: `translateY(${cardY + idleY}px) rotate(${idleRotate}deg) scale(${cardScale})`,
        opacity: cardOpacity,
        transformStyle: 'preserve-3d',
      }}
    >
      {/* Dynamic Ambient Drop-Shadow Bloom */}
      <div
        style={{
          position: 'absolute',
          inset: -15,
          borderRadius: 36,
          background: `radial-gradient(circle at 50% 40%, ${glowColor} 0%, transparent 72%)`,
          filter: 'blur(34px)',
          opacity: 0.7,
          zIndex: 0,
        }}
      />

      {/* Main Solid Dark Card Surface */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 28,
          backgroundColor: THEME.colors.surfaceCard,
          border: `1.5px solid ${THEME.colors.borderSubtle}`,
          boxShadow: THEME.shadows.solidCard,
          padding: '44px 34px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Specular Catch-light */}
        <SpecularSweep progress={specularProgress} width={380} height={480} />

        {/* Top Header: Tag & Icon */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 32,
            }}
          >
            {/* Round Icon Glow Container */}
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                backgroundColor: '#1E202B',
                border: `1px solid ${accentColor}`,
                boxShadow: `0 8px 24px ${glowColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              {icon}
            </div>

            {/* Pillar Index Tag */}
            <span
              style={{
                fontFamily: THEME.typography.fontFamily,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: accentColor,
                padding: '4px 12px',
                borderRadius: 9999,
                backgroundColor: '#1E202B',
                border: '1px solid #2C2E3C',
              }}
            >
              {tag}
            </span>
          </div>

          {/* Title */}
          <h2
            style={{
              margin: '0 0 16px',
              fontFamily: THEME.typography.fontFamily,
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: THEME.colors.textPrimary,
              lineHeight: 1.15,
            }}
          >
            {title}
          </h2>

          {/* Subtitle / Description */}
          <p
            style={{
              margin: 0,
              fontFamily: THEME.typography.fontFamily,
              fontSize: 18,
              fontWeight: 400,
              lineHeight: 1.5,
              color: THEME.colors.textMuted,
            }}
          >
            {subtitle}
          </p>
        </div>

        {/* Bottom Micro-Interaction: Verified Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingTop: 20,
            borderTop: `1px solid ${THEME.colors.borderSubtle}`,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: accentColor,
              boxShadow: `0 0 10px ${accentColor}`,
            }}
          />
          <span
            style={{
              fontFamily: THEME.typography.fontFamily,
              fontSize: 13,
              fontWeight: 500,
              color: THEME.colors.textTertiary,
              letterSpacing: '0.02em',
            }}
          >
            Guaranteed in Core Architecture
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Scene 6: The Trust Pillars (Frames 2880–3360 | 48.0s – 56.0s)
 * Centered high-elevation glass stage displaying 3 beautifully illuminated
 * floating feature cards with smooth spring entrance stagger.
 */
export function ScenePillars(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Stage entrance camera glide
  const stageSpring = spring({
    frame,
    fps,
    config: THEME.springs.soft,
  });

  const stageScale = interpolate(stageSpring, [0, 1], [0.94, 1.0]);
  const stageOpacity = interpolate(stageSpring, [0, 0.3], [0, 1]);

  // Section headline spring
  const headlineSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.snappy,
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [24, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 0.4], [0, 1]);

  // Exit transition for Scene 6 (frames 440 - 480)
  const exitProgress = interpolate(frame, [440, 480], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneExitScale = 1 + exitProgress * 0.15;
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
        transform: `scale(${stageScale * sceneExitScale})`,
        opacity: stageOpacity * sceneExitOpacity,
      }}
    >
      {/* Section Headline */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 48,
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
          Core Architecture
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: THEME.typography.fontFamily,
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: THEME.colors.textPrimary,
          }}
        >
          Built on Uncompromising Principles
        </h1>
      </div>

      {/* 3 Floating Pillar Cards */}
      <div
        style={{
          display: 'flex',
          gap: 36,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Card 1: 100% Private & Local */}
        <PillarCard
          index={0}
          tag='01 // Privacy'
          accentColor={THEME.colors.accentGreen}
          glowColor={THEME.colors.accentGreenGlow}
          title='100% Private & Local'
          subtitle='Stored only on this device. Zero cloud uploads, zero trackers, zero compromise.'
          icon={
            <svg
              width='32'
              height='32'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' />
              <path d='m9 12 2 2 4-4' />
            </svg>
          }
        />

        {/* Card 2: Completely Free */}
        <PillarCard
          index={1}
          tag='02 // Freedom'
          accentColor={THEME.colors.accentGold}
          glowColor={THEME.colors.accentGoldGlow}
          title='Completely Free'
          subtitle='No ads. No subscriptions. No paywalls. Every feature unlocked for everyone.'
          icon={
            <svg
              width='32'
              height='32'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' />
            </svg>
          }
        />

        {/* Card 3: Open-Source */}
        <PillarCard
          index={2}
          tag='03 // Code'
          accentColor={THEME.colors.accentPurple}
          glowColor={THEME.colors.accentPurpleGlow}
          title='Open-Source'
          subtitle='Built in public with Rust, Tauri 2 & TypeScript. Auditable, secure, and community-driven.'
          icon={
            <svg
              width='32'
              height='32'
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
            >
              <polyline points='16 18 22 12 16 6' />
              <polyline points='8 6 2 12 8 18' />
            </svg>
          }
        />
      </div>
    </div>
  );
}
