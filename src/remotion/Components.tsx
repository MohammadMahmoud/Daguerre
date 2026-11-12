import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from './Theme';

/**
 * Animated Ambient Background Mesh (Bottom layer of 5-layer stack).
 * Deep rich obsidian matte background with subtle dark atmosphere.
 */
export function BackgroundMesh(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtle dark drift over timeline
  const t = (frame / fps) * 0.3;
  const orb1X = 30 + Math.sin(t) * 10;
  const orb1Y = 35 + Math.cos(t * 0.8) * 8;
  const orb2X = 70 + Math.cos(t * 0.9) * 8;
  const orb2Y = 65 + Math.sin(t * 1.1) * 10;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: THEME.colors.canvasBackground,
        overflow: 'hidden',
        zIndex: 0,
      }}
    >
      {/* Orb 1: Deep subtle navy */}
      <div
        style={{
          position: 'absolute',
          left: `${orb1X}%`,
          top: `${orb1Y}%`,
          width: 1100,
          height: 1100,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${THEME.colors.ambientSubtleBlue} 0%, rgba(9, 21, 38, 0.3) 45%, transparent 70%)`,
          filter: 'blur(100px)',
          opacity: 0.7,
        }}
      />

      {/* Orb 2: Deep subtle violet */}
      <div
        style={{
          position: 'absolute',
          left: `${orb2X}%`,
          top: `${orb2Y}%`,
          width: 1000,
          height: 1000,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${THEME.colors.ambientSubtlePurple} 0%, rgba(19, 12, 30, 0.25) 50%, transparent 70%)`,
          filter: 'blur(110px)',
          opacity: 0.6,
        }}
      />

      {/* Center Subtle Flare */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 800,
          height: 500,
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(10, 132, 255, 0.08) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Precision Grid Accent */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(circle, rgba(255, 255, 255, 0.035) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          opacity: 0.35,
          maskImage:
            'radial-gradient(ellipse at center, black 45%, transparent 85%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 45%, transparent 85%)',
        }}
      />
    </div>
  );
}

/**
 * Dynamic Specular Catch-Light that sweeps diagonally across the window frame.
 */
export function SpecularSweep({
  progress,
  width = 1200,
  height = 700,
}: {
  progress: number;
  width?: number;
  height?: number;
}): React.JSX.Element {
  const sweepX = interpolate(progress, [0, 1], [-width * 0.4, width * 1.4], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        borderRadius: 'inherit',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -height * 0.5,
          left: sweepX,
          width: width * 0.3,
          height: height * 2,
          transform: 'rotate(25deg)',
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.12) 50%, transparent 100%)',
          filter: 'blur(12px)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}

/**
 * Top Layers of the 5-Layer Stack: Cinematic Grade, Vignette & Grain.
 */
export function CinematicGrade(): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {/* High-contrast solid dark vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 65%, rgba(5, 5, 8, 0.7) 100%)',
        }}
      />

      {/* Ultra-fine analog grain texture simulation */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.03,
          mixBlendMode: 'screen',
        }}
      >
        <filter id='cinematicFilmNoise'>
          <feTurbulence
            type='fractalNoise'
            baseFrequency='0.8'
            numOctaves='3'
            stitchTiles='stitch'
          />
          <feColorMatrix type='saturate' values='0' />
        </filter>
        <rect width='100%' height='100%' filter='url(#cinematicFilmNoise)' />
      </svg>
    </div>
  );
}

/**
 * Solid Dark Application Window Container matching the authentic Daguerre desktop dark theme.
 */
export function GlassWindow({
  children,
  width = 1440,
  height = 860,
  rotateX = 0,
  rotateY = 0,
  scale = 1,
  translateY = 0,
  opacity = 1,
}: {
  children: React.ReactNode;
  width?: number;
  height?: number;
  rotateX?: number;
  rotateY?: number;
  scale?: number;
  translateY?: number;
  opacity?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        width,
        height,
        transform: `perspective(1600px) translateY(${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        opacity,
        transformStyle: 'preserve-3d',
        borderRadius: 20,
        backgroundColor: '#121319', // Solid Dark Theme (No liquid glass)
        border: `1.5px solid ${THEME.colors.borderSubtle}`,
        boxShadow: THEME.shadows.windowElevated,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Window Top Chrome Bar with macOS Traffic Lights */}
      <div
        style={{
          height: 44,
          backgroundColor: '#161720', // Solid titlebar
          borderBottom: `1px solid ${THEME.colors.borderSubtle}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 9,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#FF5F57',
            boxShadow: 'inset 0 0.5px 0.5px rgba(0,0,0,0.3)',
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#FEB024',
            boxShadow: 'inset 0 0.5px 0.5px rgba(0,0,0,0.3)',
          }}
        />
        <div
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: '#28C840',
            boxShadow: 'inset 0 0.5px 0.5px rgba(0,0,0,0.3)',
          }}
        />
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: THEME.typography.fontFamily,
            fontSize: 13,
            fontWeight: 500,
            color: THEME.colors.textMuted,
            letterSpacing: '-0.01em',
            marginRight: 50,
          }}
        >
          Daguerre
        </div>
      </div>

      {/* Main Window Viewport */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0D0E12',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Semantic alias for GlassWindow reflecting the authentic Solid Dark styling.
 */
export const AppWindow = GlassWindow;
