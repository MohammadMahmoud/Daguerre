import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { THEME } from './Theme';
import {
  GitHubBadge,
  ChromeWebStoreBadge,
  DaguerreAppIcon,
} from './BrandMarks';

/**
 * Scene 7: Outro & Official Launch Lockup (Frames 3360–3600 | 56.0s – 60.0s)
 * Bold closing lockup featuring centered authentic Daguerre app icon,
 * dual platform launch badges (GitHub + Chrome Web Store), and kinetic
 * punchline "Fast. Private. Transparent."
 */
export function SceneOutro(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring for central app icon
  const iconSpring = spring({
    frame,
    fps,
    config: THEME.springs.hero,
  });
  const iconScale = interpolate(iconSpring, [0, 1], [0.8, 1.0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const iconY = interpolate(iconSpring, [0, 1], [50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const iconOpacity = interpolate(iconSpring, [0, 0.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Title spring (+12 frames)
  const titleSpring = spring({
    frame: frame - 12,
    fps,
    config: THEME.springs.snappy,
  });
  const titleY = interpolate(titleSpring, [0, 1], [30, 0]);
  const titleOpacity = interpolate(titleSpring, [0, 0.5], [0, 1]);

  // Dual badges entrance spring (+28 frames)
  const badgesSpring = spring({
    frame: frame - 28,
    fps,
    config: THEME.springs.tactile,
  });
  const badgesY = interpolate(badgesSpring, [0, 1], [40, 0]);
  const badgesScale = interpolate(badgesSpring, [0, 1], [0.92, 1.0]);
  const badgesOpacity = interpolate(badgesSpring, [0, 0.4], [0, 1]);

  // Word Stagger for Closing Punchline: "Fast." "Private." "Transparent."
  const word1Spring = spring({
    frame: frame - 55,
    fps,
    config: THEME.springs.snappy,
  });
  const word2Spring = spring({
    frame: frame - 68,
    fps,
    config: THEME.springs.snappy,
  });
  const word3Spring = spring({
    frame: frame - 82,
    fps,
    config: THEME.springs.snappy,
  });

  const word1Y = interpolate(word1Spring, [0, 1], [20, 0]);
  const word1Opacity = interpolate(word1Spring, [0, 0.5], [0, 1]);

  const word2Y = interpolate(word2Spring, [0, 1], [20, 0]);
  const word2Opacity = interpolate(word2Spring, [0, 0.5], [0, 1]);

  const word3Y = interpolate(word3Spring, [0, 1], [20, 0]);
  const word3Opacity = interpolate(word3Spring, [0, 0.5], [0, 1]);

  // Slow ambient drift (Ken Burns)
  const ambientScale = 1 + (frame / fps) * 0.012;

  // Final soft fade-out (last 20 frames: 220 - 240)
  const finalFade = interpolate(frame, [220, 240], [1, 0.85], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${ambientScale})`,
        opacity: finalFade,
      }}
    >
      {/* Centered App Icon with Specular Aura */}
      <div
        style={{
          transform: `translateY(${iconY}px) scale(${iconScale})`,
          opacity: iconOpacity,
          marginBottom: 24,
        }}
      >
        <DaguerreAppIcon size={150} />
      </div>

      {/* Hero Title & Platform Availability */}
      <div
        style={{
          textAlign: 'center',
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
          marginBottom: 40,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            marginBottom: 10,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: THEME.typography.fontFamily,
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              background: 'linear-gradient(180deg, #FFFFFF 30%, #C4C4CD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: THEME.shadows.textHero,
            }}
          >
            Daguerre
          </h1>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.04em',
              padding: '6px 16px',
              borderRadius: 9999,
              backgroundColor: 'rgba(10, 132, 255, 0.18)',
              border: '1.5px solid rgba(10, 132, 255, 0.45)',
              color: THEME.colors.accentCyan,
              boxShadow: '0 0 20px rgba(10, 132, 255, 0.25)',
            }}
          >
            v1.0.6
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: THEME.typography.fontFamily,
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            color: THEME.colors.textMuted,
          }}
        >
          Desktop for macOS, Windows & Linux • Extension for Chrome MV3
        </p>
      </div>

      {/* Dual Platform Launch Badges */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          transform: `translateY(${badgesY}px) scale(${badgesScale})`,
          opacity: badgesOpacity,
          marginBottom: 54,
        }}
      >
        <GitHubBadge scale={1.1} />
        <ChromeWebStoreBadge scale={1.1} />
      </div>

      {/* Closing Punchline: "Fast. Private. Transparent." */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: THEME.typography.fontFamily,
          fontSize: 32,
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        <span
          style={{
            transform: `translateY(${word1Y}px)`,
            opacity: word1Opacity,
            color: THEME.colors.textPrimary,
          }}
        >
          Fast.
        </span>
        <span
          style={{
            transform: `translateY(${word2Y}px)`,
            opacity: word2Opacity,
            color: THEME.colors.accentCyan,
            textShadow: '0 0 20px rgba(100, 210, 255, 0.4)',
          }}
        >
          Private.
        </span>
        <span
          style={{
            transform: `translateY(${word3Y}px)`,
            opacity: word3Opacity,
            color: THEME.colors.textPrimary,
          }}
        >
          Transparent.
        </span>
      </div>
    </div>
  );
}
