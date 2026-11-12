import React from 'react';
import { THEME } from './Theme';
import actualIconPng from './Assets/DaguerreIcon.png';

/**
 * Authentic Daguerre Logo SVG directly taken from src/Ui.tsx.
 * Features the signature onyx squircle background with silver-plated viewfinder
 * reticle brackets and center focal dot.
 */
export function DaguerreLogoSvg({
  size = 64,
  mono = false,
}: {
  size?: number;
  mono?: boolean;
}): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 28 28'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      style={{ flexShrink: 0 }}
    >
      {!mono && (
        <>
          <defs>
            <linearGradient id='sc-onyx-remotion' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='0' stopColor='#2a2a2f' />
              <stop offset='1' stopColor='#050506' />
            </linearGradient>
            <linearGradient id='sc-silver-remotion' x1='0' y1='0' x2='1' y2='1'>
              <stop offset='0' stopColor='#ffffff' />
              <stop offset='0.5' stopColor='#c9ccd2' />
              <stop offset='1' stopColor='#8e929a' />
            </linearGradient>
          </defs>
          <rect
            x='0.5'
            y='0.5'
            width='27'
            height='27'
            rx='7.5'
            fill='url(#sc-onyx-remotion)'
            stroke='rgba(255,255,255,.16)'
          />
        </>
      )}
      <path
        d={
          mono
            ? 'M5 10V5h5M18 5h5v5M23 18v5h-5M10 23H5v-5'
            : 'M8 11.5V8h3.5M16.5 8H20v3.5M20 16.5V20h-3.5M11.5 20H8v-3.5'
        }
        stroke={mono ? '#ffffff' : 'url(#sc-silver-remotion)'}
        strokeWidth={mono ? '2.5' : '2.2'}
        fill='none'
        strokeLinecap='round'
        strokeLinejoin='round'
      />
      <circle
        cx='14'
        cy='14'
        r={mono ? '2.4' : '2'}
        fill={mono ? '#ffffff' : 'url(#sc-silver-remotion)'}
      />
    </svg>
  );
}

/**
 * Official GitHub Vector Logo and Badge.
 */
export function GitHubBadge({
  scale = 1,
}: {
  scale?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16 * scale,
        padding: `${14 * scale}px ${26 * scale}px`,
        backgroundColor: THEME.colors.surfaceCard,
        border: `1.5px solid ${THEME.colors.borderSubtle}`,
        borderRadius: 9999,
        boxShadow: THEME.shadows.badgeHover,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <svg
        width={30 * scale}
        height={30 * scale}
        viewBox='0 0 24 24'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        style={{ flexShrink: 0 }}
      >
        <path
          fillRule='evenodd'
          clipRule='evenodd'
          d='M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z'
          fill={THEME.colors.textPrimary}
        />
      </svg>
      <div
        style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}
      >
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 12 * scale,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: THEME.colors.textMuted,
            lineHeight: 1.1,
          }}
        >
          Open Source on
        </span>
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 20 * scale,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: THEME.colors.textPrimary,
            lineHeight: 1.2,
          }}
        >
          GitHub
        </span>
      </div>
    </div>
  );
}

/**
 * Official Chrome Web Store Vector Badge.
 */
export function ChromeWebStoreBadge({
  scale = 1,
}: {
  scale?: number;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16 * scale,
        padding: `${14 * scale}px ${26 * scale}px`,
        backgroundColor: THEME.colors.surfaceCard,
        border: `1.5px solid ${THEME.colors.borderSubtle}`,
        borderRadius: 9999,
        boxShadow: THEME.shadows.badgeHover,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* Official 4-color Chrome icon */}
      <svg
        width={30 * scale}
        height={30 * scale}
        viewBox='0 0 192 192'
        fill='none'
        xmlns='http://www.w3.org/2000/svg'
        style={{ flexShrink: 0 }}
      >
        <circle cx='96' cy='96' r='88' fill='#1A1C20' />
        <path
          d='M96 16C131.2 16 161.4 39.2 171.6 71.6L96 71.6L96 16Z'
          fill='#EA4335'
        />
        <path
          d='M96 16C61.4 16 31.6 38.6 20.8 70.4L64 144L96 71.6L96 16Z'
          fill='#EA4335'
        />
        <path
          d='M171.6 71.6C174.6 79.2 176 87.4 176 96C176 137.6 144.4 171.6 104 175.6L64 144L96 71.6H171.6Z'
          fill='#FBBC04'
        />
        <path
          d='M20.8 70.4C17.6 78.4 16 87 16 96C16 138.8 49.6 173.6 91.8 175.8L126 120.4L64 144L20.8 70.4Z'
          fill='#34A853'
        />
        <circle cx='96' cy='96' r='38' fill='#FFFFFF' />
        <circle cx='96' cy='96' r='30' fill='#4285F4' />
      </svg>
      <div
        style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}
      >
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 12 * scale,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: THEME.colors.textMuted,
            lineHeight: 1.1,
          }}
        >
          Available on
        </span>
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 20 * scale,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: THEME.colors.textPrimary,
            lineHeight: 1.2,
          }}
        >
          Chrome Web Store
        </span>
      </div>
    </div>
  );
}

/**
 * Authentic Daguerre App Squircle Icon using the actual 512x512 production icon asset.
 */
export function DaguerreAppIcon({
  size = 140,
  glow = true,
}: {
  size?: number;
  glow?: boolean;
}): React.JSX.Element {
  const borderRadius = size * 0.224; // Apple standard squircle curvature

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {glow && (
        <div
          style={{
            position: 'absolute',
            inset: -size * 0.2,
            background: `radial-gradient(circle, ${THEME.colors.accentBlueGlow} 0%, transparent 70%)`,
            filter: 'blur(32px)',
            opacity: 0.8,
            zIndex: 0,
          }}
        />
      )}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius,
          overflow: 'hidden',
          boxShadow:
            '0 20px 40px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.35)',
          border: '1.5px solid rgba(255, 255, 255, 0.24)',
          zIndex: 1,
        }}
      >
        <img
          src={actualIconPng}
          alt='Daguerre'
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    </div>
  );
}

/**
 * Authentic Apple macOS Live Text pointer cursor with hover indicator.
 */
export function LiveTextCursor({
  x,
  y,
  selecting = false,
}: {
  x: number;
  y: number;
  selecting?: boolean;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: 'translate(-2px, -2px)',
        pointerEvents: 'none',
        zIndex: 999,
        transition: 'transform 0.05s ease-out',
        filter: 'drop-shadow(0 4px 10px rgba(0, 0, 0, 0.5))',
      }}
    >
      {selecting ? (
        // I-beam selection cursor
        <svg width='22' height='28' viewBox='0 0 22 28' fill='none'>
          <path
            d='M6 3h10M6 25h10M11 3v22'
            stroke='#FFFFFF'
            strokeWidth='2.5'
            strokeLinecap='round'
          />
          <path
            d='M6 3h10M6 25h10M11 3v22'
            stroke='#0A84FF'
            strokeWidth='1.2'
            strokeLinecap='round'
          />
        </svg>
      ) : (
        // macOS precision black arrow cursor with white border
        <svg width='26' height='28' viewBox='0 0 26 28' fill='none'>
          <path d='M2 2l8.5 22 3.8-8.2 8.7-2.8L2 2z' fill='#FFFFFF' />
          <path d='M3.8 4.2l6.7 17.4 3-6.5 6.9-2.2L3.8 4.2z' fill='#1A1A1E' />
        </svg>
      )}
    </div>
  );
}
