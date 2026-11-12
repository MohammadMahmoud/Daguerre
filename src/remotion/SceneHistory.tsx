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
import historyImage from './Assets/HistoryView.png';

/**
 * Scene 5: Privacy-First Local History Studio (Frames 2340–2880 | 39.0s – 48.0s)
 * Shows client-side IndexedDB history, date grouping, fast search, and bulk management.
 */
export function SceneHistory(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const enterSpring = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });

  const scale = interpolate(enterSpring, [0, 1], [0.93, 1.0]);
  const opacity = interpolate(enterSpring, [0, 0.3], [0, 1]);

  // Section headline spring
  const headlineSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.snappy,
  });
  const headlineY = interpolate(headlineSpring, [0, 1], [24, 0]);
  const headlineOpacity = interpolate(headlineSpring, [0, 0.4], [0, 1]);

  // Search input typing simulation (frames 100 to 220)
  const searchTextLength = Math.min(
    14,
    Math.floor(
      interpolate(frame, [100, 200], [0, 14], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      }),
    ),
  );
  const fullSearchQuery = 'project update';
  const displayedQuery = fullSearchQuery.slice(0, searchTextLength);

  // Search pill highlight
  const searchPillSpring = spring({
    frame: frame - 80,
    fps,
    config: THEME.springs.snappy,
  });
  const searchPillScale = interpolate(searchPillSpring, [0, 1], [0.9, 1.0]);

  // Exit transition (frames 500 to 540)
  const exitProgress = interpolate(frame, [500, 540], [0, 1], {
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
        transform: `scale(${scale * sceneExitScale})`,
        opacity: opacity * sceneExitOpacity,
      }}
    >
      {/* Section Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: 30,
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
          Local Storage Engine
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
          Private Capture History & Instant Search
        </h1>
      </div>

      {/* Main Window showing fresh HistoryView */}
      <div style={{ position: 'relative' }}>
        <GlassWindow width={1380} height={740} scale={1.0}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <Img
              src={historyImage}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'top center',
              }}
            />

            {/* Interactive Search Overlay Pill */}
            <div
              style={{
                position: 'absolute',
                top: 88,
                left: 310,
                width: 380,
                height: 42,
                borderRadius: 12,
                backgroundColor: 'rgba(28, 30, 40, 0.96)',
                border: '1.5px solid rgba(10, 132, 255, 0.6)',
                boxShadow:
                  '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(10, 132, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 12,
                transform: `scale(${searchPillScale})`,
                zIndex: 100,
              }}
            >
              <svg
                width='18'
                height='18'
                viewBox='0 0 24 24'
                fill='none'
                stroke='#0A84FF'
                strokeWidth='2.5'
              >
                <circle cx='11' cy='11' r='8' />
                <line x1='21' y1='21' x2='16.65' y2='16.65' />
              </svg>
              <span
                style={{
                  fontFamily: THEME.typography.fontFamily,
                  fontSize: 15,
                  fontWeight: 500,
                  color: '#FFFFFF',
                }}
              >
                {displayedQuery}
                <span
                  style={{
                    display: 'inline-block',
                    width: 2,
                    height: 16,
                    backgroundColor: '#0A84FF',
                    marginLeft: 2,
                    verticalAlign: 'middle',
                    opacity: Math.sin(frame * 0.2) > 0 ? 1 : 0,
                  }}
                />
              </span>
            </div>

            {/* Offline Storage Metric Tag */}
            <div
              style={{
                position: 'absolute',
                bottom: 30,
                right: 36,
                padding: '12px 22px',
                borderRadius: 9999,
                backgroundColor: 'rgba(20, 22, 30, 0.92)',
                border: '1.5px solid rgba(255, 255, 255, 0.15)',
                boxShadow: THEME.shadows.badgeHover,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  backgroundColor: '#30D158',
                  boxShadow: '0 0 10px #30D158',
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: THEME.colors.textSecondary,
                }}
              >
                Client-Side IndexedDB • Zero Cloud Synchronization
              </span>
            </div>
          </div>
        </GlassWindow>
      </div>
    </div>
  );
}
