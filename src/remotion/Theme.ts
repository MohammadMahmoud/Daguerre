/**
 * Solid Dark Theme kinetic motion and design tokens for the Daguerre launch sequence.
 * Replaces liquid glass with high-contrast, obsidian dark surfaces matching the real app.
 */

export const THEME = {
  /**
   * Kinetic spring presets.
   * Derived from Apple iOS / macOS system animations.
   */
  springs: {
    /** Primary hero entrance spring as specified in launch requirements */
    hero: {
      damping: 24,
      mass: 0.8,
      stiffness: 120,
    },
    /** Snappy micro-interaction spring for badges and cursor hits */
    snappy: {
      damping: 20,
      mass: 0.6,
      stiffness: 180,
    },
    /** Smooth deceleration spring for ambient camera glides */
    soft: {
      damping: 28,
      mass: 1.0,
      stiffness: 100,
    },
    /** Tactile spring for card thuds and badge locks */
    tactile: {
      damping: 18,
      mass: 0.5,
      stiffness: 160,
    },
  },

  /**
   * Solid Dark palette matching the authentic Daguerre desktop dark theme.
   */
  colors: {
    canvasBackground: '#090A0D',
    surfaceObsidian: '#0E1015',
    surfaceCharcoal: '#14151B',
    surfaceCard: '#16171F',
    surfaceCardActive: '#181C26',
    surfaceElevated: '#1D1F2A',

    // Solid borders
    borderSubtle: '#222430',
    borderMuted: '#2A2C3A',
    borderActive: '#0A84FF',
    borderHighlight: '#36394A',

    // Glass surfaces and highlights
    glassBackground: 'rgba(255, 255, 255, 0.05)',
    glassBackgroundElevated: 'rgba(255, 255, 255, 0.09)',
    glassBorder: 'rgba(255, 255, 255, 0.14)',
    glassBorderHighlight: 'rgba(255, 255, 255, 0.32)',
    specularGlint: 'rgba(255, 255, 255, 0.85)',

    // Accents
    accentBlue: '#0A84FF',
    accentBlueGlow: 'rgba(10, 132, 255, 0.38)',
    accentCyan: '#64D2FF',
    accentGreen: '#30D158',
    accentGreenGlow: 'rgba(48, 209, 88, 0.32)',
    accentPurple: '#BF5AF2',
    accentPurpleGlow: 'rgba(191, 90, 242, 0.32)',
    accentGold: '#FFD60A',
    accentGoldGlow: 'rgba(255, 214, 10, 0.32)',

    // Typography
    textPrimary: '#FFFFFF',
    textSecondary: '#EBEBF5',
    textMuted: '#98989D',
    textTertiary: '#6E6E73',

    // Ambient background tones (subtle obsidian gradients, not washed out glass)
    ambientDeep: '#060709',
    ambientSubtleBlue: '#091526',
    ambientSubtlePurple: '#130C1E',
    ambientBlue: '#0C2D5A',
    ambientPurple: '#2E124D',
  },

  /**
   * Layered box shadows producing crisp solid elevation depth.
   */
  shadows: {
    windowDefault:
      '0 24px 64px rgba(0, 0, 0, 0.75), 0 4px 16px rgba(0, 0, 0, 0.5)',
    windowElevated:
      '0 32px 80px rgba(0, 0, 0, 0.85), 0 8px 24px rgba(0, 0, 0, 0.6)',
    glassDefault:
      '0 24px 64px rgba(0, 0, 0, 0.75), 0 4px 16px rgba(0, 0, 0, 0.5)',
    glassPillar: '0 24px 60px -8px rgba(0, 0, 0, 0.7)',
    solidCard: '0 12px 28px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4)',
    solidCardActive:
      '0 16px 36px rgba(0, 0, 0, 0.7), 0 0 24px rgba(10, 132, 255, 0.25)',
    badgeHover: '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)',
    textHero: '0 4px 20px rgba(0, 0, 0, 0.7)',
  },

  /**
   * System typography rules.
   */
  typography: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif',
    subheadlineFontFamily:
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif',
    codeFamily:
      '"SF Mono", Menlo, Monaco, "Cascadia Code", Consolas, monospace',
  },
} as const;
