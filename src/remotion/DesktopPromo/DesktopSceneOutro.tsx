import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from '../Theme';
import {
  GitHubBadge,
  ChromeWebStoreBadge,
  DaguerreAppIcon,
} from '../BrandMarks';

/**
 * Scene 4: Outro & Call to Action (Frames 451–600 | 7.5s – 10.0s, 150 frames total).
 * Bold closing lockup featuring the centered authentic Daguerre squircle app icon,
 * kinetic punchline ("Fast. Private. Transparent."), and dual official launch badges
 * (GitHub + Chrome Web Store).
 */
export function DesktopSceneOutro(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for app icon
  const iconSpring = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });
  const iconScale = interpolate(iconSpring, [0, 1], [0.8, 1.0]);
  const iconY = interpolate(iconSpring, [0, 1], [40, 0]);
  const iconOpacity = interpolate(iconSpring, [0, 0.35], [0, 1]);

  // Title spring (+10 frames)
  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: THEME.springs.snappy,
  });
  const titleY = interpolate(titleSpring, [0, 1], [24, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 0.4], [0, 1]);

  // Kinetic Punchline Stagger: "Fast." "Private." "Transparent."
  const word1Spring = spring({
    frame: frame - 28,
    fps,
    config: THEME.springs.snappy,
  });
  const word1Y = interpolate(word1Spring, [0, 1], [18, 0]);
  const word1Opacity = interpolate(word1Spring, [0, 0.4], [0, 1]);

  const word2Spring = spring({
    frame: frame - 40,
    fps,
    config: THEME.springs.snappy,
  });
  const word2Y = interpolate(word2Spring, [0, 1], [18, 0]);
  const word2Opacity = interpolate(word2Spring, [0, 0.4], [0, 1]);

  const word3Spring = spring({
    frame: frame - 52,
    fps,
    config: THEME.springs.snappy,
  });
  const word3Y = interpolate(word3Spring, [0, 1], [18, 0]);
  const word3Opacity = interpolate(word3Spring, [0, 0.4], [0, 1]);

  // Dual Badges Spring (+60 frames)
  const badgesSpring = spring({
    frame: frame - 60,
    fps,
    config: THEME.springs.tactile,
  });
  const badgesY = interpolate(badgesSpring, [0, 1], [30, 0]);
  const badgesScale = interpolate(badgesSpring, [0, 1], [0.92, 1.0]);
  const badgesOpacity = interpolate(badgesSpring, [0, 0.4], [0, 1]);

  // Subtitle Spring (+72 frames)
  const ctaSpring = spring({
    frame: frame - 72,
    fps,
    config: THEME.springs.soft,
  });
  const ctaOpacity = interpolate(ctaSpring, [0, 0.5], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      {/* Central Authentic App Icon */}
      <div
        style={{
          transform: `translateY(${iconY}px) scale(${iconScale})`,
          opacity: iconOpacity,
          marginBottom: 20,
        }}
      >
        <DaguerreAppIcon size={130} glow={true} />
      </div>

      {/* Main Title & Version Lockup */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          marginBottom: 16,
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: THEME.typography.fontFamily,
            fontSize: 54,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: THEME.colors.textPrimary,
            textShadow: THEME.shadows.textHero,
            lineHeight: 1,
          }}
        >
          Daguerre
        </h1>
        <span
          style={{
            padding: '3px 10px',
            backgroundColor: '#1E202B',
            border: `1px solid ${THEME.colors.borderHighlight}`,
            borderRadius: 7,
            fontSize: 13,
            fontFamily: THEME.typography.fontFamily,
            fontWeight: 600,
            color: THEME.colors.accentBlue,
            letterSpacing: '0.02em',
          }}
        >
          v1.0.6
        </span>
      </div>

      {/* Kinetic Punchline: Fast. Private. Transparent. */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          marginBottom: 36,
        }}
      >
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 26,
            fontWeight: 650,
            letterSpacing: '-0.02em',
            color: THEME.colors.textPrimary,
            transform: `translateY(${word1Y}px)`,
            opacity: word1Opacity,
          }}
        >
          Fast.
        </span>
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 26,
            fontWeight: 650,
            letterSpacing: '-0.02em',
            color: THEME.colors.accentBlue,
            transform: `translateY(${word2Y}px)`,
            opacity: word2Opacity,
          }}
        >
          Private.
        </span>
        <span
          style={{
            fontFamily: THEME.typography.fontFamily,
            fontSize: 26,
            fontWeight: 650,
            letterSpacing: '-0.02em',
            color: THEME.colors.textPrimary,
            transform: `translateY(${word3Y}px)`,
            opacity: word3Opacity,
          }}
        >
          Transparent.
        </span>
      </div>

      {/* Official GitHub & Chrome Web Store Badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          transform: `translateY(${badgesY}px) scale(${badgesScale})`,
          opacity: badgesOpacity,
          marginBottom: 24,
        }}
      >
        <GitHubBadge scale={1.05} />
        <ChromeWebStoreBadge scale={1.05} />
      </div>

      {/* Closing CTA */}
      <p
        style={{
          margin: 0,
          fontFamily: THEME.typography.subheadlineFontFamily,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: THEME.colors.textTertiary,
          opacity: ctaOpacity,
        }}
      >
        Available Free for Desktop & Browser
      </p>
    </div>
  );
}
