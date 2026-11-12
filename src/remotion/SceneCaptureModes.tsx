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
import captureImage from './Assets/CaptureView.png';

interface ModeCardProps {
  index: number;
  icon: React.ReactNode;
  title: string;
  shortcut: string;
  desc: string;
  active: boolean;
}

function ModeCard({
  index,
  icon,
  title,
  shortcut,
  desc,
  active,
}: ModeCardProps): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({
    frame: frame - (20 + index * 18),
    fps,
    config: THEME.springs.hero,
  });

  const translateY = interpolate(cardSpring, [0, 1], [40, 0]);
  const opacity = interpolate(cardSpring, [0, 0.4], [0, 1]);
  const scale = active ? 1.04 : 1.0;

  return (
    <div
      style={{
        flex: 1,
        padding: '24px 20px',
        borderRadius: 20,
        backgroundColor: active
          ? THEME.colors.surfaceCardActive
          : THEME.colors.surfaceCharcoal,
        border: active
          ? `1.5px solid ${THEME.colors.borderActive}`
          : `1px solid ${THEME.colors.borderSubtle}`,
        boxShadow: active
          ? THEME.shadows.solidCardActive
          : THEME.shadows.solidCard,
        transform: `translateY(${translateY}px) scale(${scale})`,
        opacity,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'all 0.2s ease-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: active ? '#0A84FF' : '#1E202B',
            border: active ? 'none' : '1px solid #2C2E3C',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontFamily: THEME.typography.codeFamily,
            fontSize: 12,
            fontWeight: 600,
            padding: '4px 8px',
            borderRadius: 6,
            backgroundColor: '#0E1015',
            border: '1px solid #262835',
            color: active ? THEME.colors.accentCyan : THEME.colors.textMuted,
          }}
        >
          {shortcut}
        </span>
      </div>
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: THEME.colors.textPrimary,
            marginBottom: 4,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: THEME.colors.textMuted,
            lineHeight: 1.4,
          }}
        >
          {desc}
        </div>
      </div>
    </div>
  );
}

/**
 * Scene 2: Precision Multi-Mode Capture Studio (Frames 480–1080 | 8.0s – 18.0s)
 * Deep dive into Selection, Window, Screen, and Delay Timer workflows.
 */
export function SceneCaptureModes(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const enterSpring = spring({
    frame,
    fps,
    config: THEME.springs.soft,
  });

  const scale = interpolate(enterSpring, [0, 1], [0.94, 1.0]);
  const opacity = interpolate(enterSpring, [0, 0.3], [0, 1]);

  // Stage headline spring
  const headlineSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.snappy,
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [24, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 0.4], [0, 1]);

  // Interactive capture highlight phases
  const activeIndex = frame < 200 ? 0 : frame < 400 ? 1 : 2;

  // Countdown timer pulse for delay capture (frames 360 to 480)
  const timerCount =
    frame >= 360 && frame < 420 ? '3s' : frame >= 420 ? '0s' : '5s';

  // Exit transition (frames 560 to 600)
  const exitProgress = interpolate(frame, [560, 600], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sceneExitScale = 1 + exitProgress * 0.14;
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
        transform: `scale(${scale * sceneExitScale})`,
        opacity: opacity * sceneExitOpacity,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 34,
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
          Capture Engine
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
          Four Workflows. Instant Execution.
        </h1>
      </div>

      {/* Main Window showing fresh live capture view */}
      <div style={{ position: 'relative' }}>
        <GlassWindow width={1340} height={620} scale={1.0}>
          <Img
            src={captureImage}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'top center',
            }}
          />

          {/* Floating Action Cards Layer */}
          <div
            style={{
              position: 'absolute',
              bottom: 30,
              left: 40,
              right: 40,
              display: 'flex',
              gap: 20,
              zIndex: 50,
            }}
          >
            <ModeCard
              index={0}
              active={activeIndex === 0}
              title='Area Selection'
              shortcut='⌥⇧S'
              desc='Freezes active screen to preserve menus, hover states and tooltips.'
              icon={
                <svg
                  width='22'
                  height='22'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                >
                  <path d='M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3' />
                  <path d='M12 9v6M9 12h6' />
                </svg>
              }
            />

            <ModeCard
              index={1}
              active={activeIndex === 1}
              title='Window Snapping'
              shortcut='⌥⇧W'
              desc='Target any open application with pixel-perfect borders and transparent shadows.'
              icon={
                <svg
                  width='22'
                  height='22'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                >
                  <rect x='3' y='4' width='18' height='16' rx='2' />
                  <path d='M3 9h18M6.5 6.5h.01M9.5 6.5h.01' />
                </svg>
              }
            />

            <ModeCard
              index={2}
              active={activeIndex === 2}
              title='Full Screen & Delay'
              shortcut='⌥⇧V'
              desc={`Instant entire display snapshot with configurable ${timerCount} delay timer.`}
              icon={
                <svg
                  width='22'
                  height='22'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                >
                  <rect x='3' y='4' width='18' height='13' rx='2' />
                  <path d='M8 21h8M12 17v4' />
                </svg>
              }
            />
          </div>
        </GlassWindow>
      </div>
    </div>
  );
}
