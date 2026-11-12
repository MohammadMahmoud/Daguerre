import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const css = readFileSync('src/Styles.css', 'utf8');

function block(selector: string) {
  const target =
    selector.startsWith('.') ||
    selector.startsWith(':') ||
    selector.startsWith('@')
      ? `\n${selector} {`
      : `${selector} {`;
  let start = css.indexOf(target);
  if (start === -1) start = css.indexOf(`${selector} {`);
  else start += 1;
  expect(
    start,
    `Selector "${selector}" must exist in Styles.css`,
  ).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}', start));
}

describe('Apple motion & design tokens', () => {
  test('defines Apple spring and smooth easing curves in :root', () => {
    const rootBody = block(':root');
    expect(rootBody).toContain(
      '--ease-apple-spring: cubic-bezier(0.16, 1, 0.3, 1)',
    );
    expect(rootBody).toContain(
      '--ease-apple-smooth: cubic-bezier(0.25, 0.1, 0.25, 1)',
    );
    expect(rootBody).toContain('--duration-fast: 280ms;');
    expect(rootBody).toContain('--duration-normal: 420ms;');
    expect(rootBody).toContain('--duration-page: 380ms;');
  });

  test('defines dynamic elevation shadow bloom across Dark, Light, and Glass modes', () => {
    const rootDark = block(':root');
    expect(rootDark).toContain('--shadow-hover:');
    expect(rootDark).toContain('0 18px 36px -8px rgba(0, 0, 0, 0.5');
    expect(rootDark).toContain('--shadow-active:');

    const lightRoot = block(":root[data-theme='light']");
    expect(lightRoot).toContain(
      '0 14px 28px -6px rgba(0, 0, 0, 0.1), 0 4px 10px -2px rgba(0, 0, 0, 0.05)',
    );
    expect(lightRoot).toContain('--shadow-active:');

    const glassBody = block(":root[data-appearance='glass']");
    expect(glassBody).toContain('--shadow-hover:');
    expect(glassBody).toContain('0 18px 36px -8px rgba(0, 0, 0, 0.5');
  });
});

describe('Card & box hover elevation and tactile micro-interactions', () => {
  test('primary mode cards elevate with spatial lift and dynamic shadow bloom', () => {
    const rest = block('.mode-card,\n.quick-action');
    expect(rest).toContain('will-change: transform, box-shadow');
    expect(rest).toContain('var(--ease-apple-spring)');
    expect(rest).toContain('var(--duration-normal)');

    const hover = block('.mode-card:not(:disabled):hover');
    expect(hover).toContain('transform: translateY(-3px) scale(1.005)');
    expect(hover).toContain('box-shadow: var(--shadow-hover)');

    const active = block('.mode-card:active,\n.quick-action:active');
    expect(active).toContain('transform: translateY(-0.5px) scale(0.985)');
    expect(active).toContain('box-shadow: var(--shadow-active)');
    expect(active).toContain('90ms var(--ease-apple-spring)');
  });

  test('quick-action wide bar elevates smoothly', () => {
    const hover = block('.quick-action:hover');
    expect(hover).toContain('transform: translateY(-1.5px)');
    expect(hover).toContain('box-shadow: var(--shadow-hover)');
  });

  test('capture card icon brightens when hovering parent card', () => {
    const iconHover = block(
      '.mode-card:not(:disabled):hover .mode-icon,\n.quick-action:hover .mode-icon',
    );
    expect(iconHover).toContain('transform: scale(1.04)');
  });

  test('history card elevates and zooms thumbnail image on hover', () => {
    const cardHover = block('.card:hover');
    expect(cardHover).toContain('transform: translateY(-3px) scale(1.005)');
    expect(cardHover).toContain('box-shadow: var(--shadow-hover)');

    const cardActive = block('.card:active');
    expect(cardActive).toContain('transform: translateY(-0.5px) scale(0.985)');
    expect(cardActive).toContain('box-shadow: var(--shadow-active)');

    const thumbImgHover = block('.card:hover .card-thumb img');
    expect(thumbImgHover).toContain('transform: scale(1.015)');
  });

  test('recent shot cards elevate and zoom preview image on hover', () => {
    const shotHover = block('.shot:hover');
    expect(shotHover).toContain('transform: translateY(-3px) scale(1.005)');
    expect(shotHover).toContain('box-shadow: var(--shadow-hover)');

    const shotActive = block('.shot:active');
    expect(shotActive).toContain('transform: translateY(-0.5px) scale(0.985)');
    expect(shotActive).toContain('box-shadow: var(--shadow-active)');

    const shotImgHover = block('.shot:hover .shot-open img');
    expect(shotImgHover).toContain('transform: scale(1.015)');
  });

  test('settings panels elevate on hover and compress on click', () => {
    const panelHover = block('.panel:hover');
    expect(panelHover).toContain('transform: translateY(-1.5px)');
    expect(panelHover).toContain('box-shadow: var(--shadow-hover)');

    const panelActive = block('.panel:active');
    expect(panelActive).toContain('transform: translateY(-0.5px) scale(0.995)');
    expect(panelActive).toContain('box-shadow: var(--shadow-active)');
  });
});

describe('Buttons, inputs, and navigation', () => {
  test('buttons elevate on hover and compress on click with luxurious timing', () => {
    const btnRest = block('.btn');
    expect(btnRest).toContain(
      'var(--duration-normal) var(--ease-apple-spring)',
    );
    expect(btnRest).toContain(
      'var(--duration-normal) var(--ease-apple-smooth)',
    );

    const btnHover = block('.btn:hover:not(:disabled)');
    expect(btnHover).toContain('transform: translateY(-1px)');
    expect(btnHover).toContain('box-shadow:');

    const btnActive = block('.btn:active:not(:disabled)');
    expect(btnActive).toContain('transform: scale(0.97)');
  });

  test('danger buttons elevate on hover and compress on click with white text', () => {
    const dangerRest = block('.btn.danger,\n.btn-danger');
    expect(dangerRest).toContain(
      'var(--duration-normal) var(--ease-apple-spring)',
    );

    const dangerHover = block(
      '.btn.danger:hover:not(:disabled),\n.btn-danger:hover:not(:disabled)',
    );
    expect(dangerHover).toContain('transform: translateY(-1px)');

    const dangerActive = block(
      '.btn.danger:active:not(:disabled),\n.btn-danger:active:not(:disabled)',
    );
    expect(dangerActive).toContain('transform: scale(0.97)');
    expect(dangerActive).toContain('color: #ffffff !important');
  });

  test('icon buttons and editor tools compress on active press', () => {
    const iconHover = block('.icon-btn:hover:not(:disabled)');
    expect(iconHover).toContain('transform: translateY(-1px)');

    const iconActive = block('.icon-btn:active:not(:disabled)');
    expect(iconActive).toContain('transform: scale(0.97)');

    const toolActive = block('.tool:active');
    expect(toolActive).toContain('transform: scale(0.97)');
  });

  test('inputs and search fields have soft blue focus ring glow', () => {
    const searchFocus = block('.search:focus-within');
    expect(searchFocus).toContain('0 0 0 3px rgba(10, 132, 255, 0.3)');
    expect(searchFocus).toContain('border-color: #0a84ff');

    const shortcutFocus = block('.shortcut-input:focus');
    expect(shortcutFocus).toContain('0 0 0 3px rgba(10, 132, 255, 0.3)');
    expect(shortcutFocus).toContain('border-color: #0a84ff');

    const titleFocus = block('.title-input:focus');
    expect(titleFocus).toContain('0 0 0 3px rgba(10, 132, 255, 0.3)');
    expect(titleFocus).toContain('border-color: #0a84ff');
  });

  test('sidebar navigation items compress on active and brighten icons on hover', () => {
    const navHover = block('.nav-item:hover svg:not(.icon-coffee)');
    expect(navHover).toContain('filter: brightness(1.2)');

    const navActive = block('.nav-item:active');
    expect(navActive).toContain('transform: scale(0.98)');
  });
});

describe('Native macOS toggle switch styling & physics', () => {
  test('inactive track has translucent dark or light fill with inset shadow', () => {
    const inactive = block('.switch');
    expect(inactive).toContain('background: rgba(255, 255, 255, 0.14)');
    expect(inactive).toContain(
      'box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25)',
    );
    expect(inactive).toContain('border-radius: 9999px');
    expect(inactive).toContain('320ms cubic-bezier(0.16, 1, 0.3, 1)');

    const lightInactive = block(":root[data-theme='light'] .switch");
    expect(lightInactive).toContain('background: rgba(0, 0, 0, 0.12)');
  });

  test('active checked track uses vibrant blue with specular inset shadow', () => {
    const active = block('.switch:checked');
    expect(active).toContain('background: #2e7cf6');
    expect(active).toContain(
      'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
    );
    expect(active).toContain(
      'box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.25)',
    );
  });

  test('thumb has pure white pill shape, contact shadow, and tactile stretch on active press', () => {
    const thumb = block('.switch::after');
    expect(thumb).toContain('background: #ffffff');
    expect(thumb).toContain('border-radius: 9999px');
    expect(thumb).toContain('0 1px 3px rgba(0, 0, 0, 0.3)');
    expect(thumb).toContain('320ms cubic-bezier(0.16, 1, 0.3, 1)');

    const checkedThumb = block('.switch:checked::after');
    expect(checkedThumb).toContain('transform: translateX(16px)');

    const activeThumb = block('.switch:active::after');
    expect(activeThumb).toContain('width: 22px');

    const checkedActiveThumb = block('.switch:checked:active::after');
    expect(checkedActiveThumb).toContain('transform: translateX(12px)');
    expect(checkedActiveThumb).toContain('width: 22px');
  });
});

describe('Native macOS typography hierarchy & settings dividers', () => {
  test('primary headlines use #f2f2f7 in dark and #1d1d1f in light with medium weight', () => {
    const root = block(':root');
    expect(root).toContain('--text: #f2f2f7');

    const lightRoot = block(":root[data-theme='light']");
    expect(lightRoot).toContain('--text: #1d1d1f');

    const panelH2 = block('.panel h2');
    expect(panelH2).toContain('font-weight: 500');
    expect(panelH2).toContain('letter-spacing: -0.01em');

    const settingLabel = block('.setting-row label,\n.setting-row strong');
    expect(settingLabel).toContain('font-weight: 500');
    expect(settingLabel).toContain('letter-spacing: -0.01em');

    const modeLabel = block('.mode-label');
    expect(modeLabel).toContain('font-weight: 500');
    expect(modeLabel).toContain('letter-spacing: -0.01em');

    const cardTitle = block('.card-title');
    expect(cardTitle).toContain('font-weight: 500');
    expect(cardTitle).toContain('letter-spacing: -0.01em');
  });

  test('sublines use #98989d in dark and #6e6e73 in light with 13px regular weight', () => {
    const root = block(':root');
    expect(root).toContain('--muted: #98989d');

    const lightRoot = block(":root[data-theme='light']");
    expect(lightRoot).toContain('--muted: #6e6e73');

    const meta = block('.meta');
    expect(meta).toContain('font-weight: 400');
    expect(meta).toContain('font-size: 13px');
    expect(meta).toContain('line-height: 1.35');

    const modeDesc = block('.mode-desc');
    expect(modeDesc).toContain('font-weight: 400');
    expect(modeDesc).toContain('font-size: 13px');
    expect(modeDesc).toContain('line-height: 1.35');
  });

  test('settings groups bundle rows with rounded container and indented hairline dividers', () => {
    const group = block('.settings-group');
    expect(group).toContain('border-radius: 12px');
    expect(group).toContain('background: rgba(255, 255, 255, 0.04)');
    expect(group).toContain('padding: 0 14px');

    const groupRow = block('.settings-group .setting-row');
    expect(groupRow).toContain(
      'border-bottom: 1px solid rgba(255, 255, 255, 0.07)',
    );

    const lastGroupRow = block('.settings-group .setting-row:last-child');
    expect(lastGroupRow).toContain('border-bottom: 0');
  });
});

describe('View transitions & accessibility safeguards', () => {
  test('adds view entrance animation with spring curve and page duration', () => {
    expect(css).toMatch(
      /@keyframes view-enter \{[\s\S]*?transform: translateY\(4px\)[\s\S]*?transform: none/,
    );
    const viewRule = block('.page,\n.history,\n.editor,\n.popup');
    expect(viewRule).toContain(
      'animation: view-enter var(--duration-page) var(--ease-apple-spring)',
    );
  });

  test('respects prefers-reduced-motion by disabling spatial transforms while preserving opacity fades', () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?transform: none !important;[\s\S]*?animation: view-enter-reduced var\(--duration-page\) var\(--ease-apple-smooth\)/,
    );
  });

  test('comprehensively disables card elevation zooms, thumbnail zooms, and animations in reduced motion', () => {
    const reducedBlock = css.slice(
      css.indexOf('@media (prefers-reduced-motion: reduce) {'),
    );
    expect(reducedBlock).toContain('.card-thumb img');
    expect(reducedBlock).toContain('.shot-open img');
    expect(reducedBlock).toContain('.recent-item img');
    expect(reducedBlock).toContain('.mode-icon');
    expect(reducedBlock).toContain('.tile-icon');
    expect(reducedBlock).toContain('.recent-item');
    expect(reducedBlock).toContain('.shortcut-input');
    expect(reducedBlock).toContain('.coffee-steam');
    expect(reducedBlock).toContain('animation: none !important;');
  });

  test('ensures GPU exclusivity across keyframe animations', () => {
    // Keyframe animations must not animate layout triggers (top, left, margin, padding, width, height)
    const keyframeMatches = [
      ...css.matchAll(
        /@keyframes\s+([^{\s]+)\s*\{([^}]+(?:\{[^}]+\}[^}]*)*)\}/g,
      ),
    ];
    for (const match of keyframeMatches) {
      const name = match[1];
      const body = match[2];
      expect(
        body,
        `Keyframe animation "${name}" must not animate layout triggers`,
      ).not.toMatch(
        /(?:^|[^-\w])(?:top|left|right|bottom|margin|padding|width|height)\s*:/,
      );
    }
  });
});
