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

describe('Accessibility & Keyboard Focus Rings', () => {
  test('global :focus-visible defines high-visibility dual focus ring', () => {
    const focusRing = block(':focus-visible');
    expect(focusRing).toContain('outline: none');
    expect(focusRing).toContain('0 0 0 2px var(--panel)');
    expect(focusRing).toContain('0 0 0 4px var(--accent)');
  });

  test('danger buttons have high-visibility red focus ring', () => {
    const dangerFocus = block(
      '.btn.danger:focus-visible,\n.btn-danger:focus-visible',
    );
    expect(dangerFocus).toContain('outline: none');
    expect(dangerFocus).toContain('0 0 0 2px var(--panel)');
    expect(dangerFocus).toContain('0 0 0 4px #ff453a');
  });

  test('segmented tab controls provide prominent focus ring when navigating with keyboard', () => {
    const segmentedFocus = block('.segmented button:focus-visible');
    expect(segmentedFocus).toContain('outline: none');
    expect(segmentedFocus).toContain('0 0 0 2px var(--panel)');
    expect(segmentedFocus).toContain('0 0 0 4px var(--accent)');
    expect(segmentedFocus).toContain('z-index: 2');
  });

  test('editor tools, swatches, switches, and navigation items share consistent focus ring', () => {
    const sharedFocus = block(
      '.btn:focus-visible,\n' +
        '.icon-btn:focus-visible,\n' +
        '.tool:focus-visible,\n' +
        '.swatch:focus-visible,\n' +
        '.swatch.custom:focus-within,\n' +
        '.size:focus-visible,\n' +
        '.mode-card:focus-visible,\n' +
        '.quick-action:focus-visible,\n' +
        '.switch:focus-visible,\n' +
        '.link:focus-visible,\n' +
        '.card-thumb:focus-visible,\n' +
        '.card-title:focus-visible,\n' +
        '.shot-open:focus-visible,\n' +
        '.nav-item:focus-visible,\n' +
        '.menu-item:focus-visible',
    );
    expect(sharedFocus).toContain('outline: none');
    expect(sharedFocus).toContain('0 0 0 2px var(--panel)');
    expect(sharedFocus).toContain('0 0 0 4px var(--accent)');
  });
});

describe('Touch & Click Boundaries (WCAG 2.5.5 / 2.5.8 Minimum 44×44px)', () => {
  test('compact buttons and segmented tabs expand touch boundary to minimum 44px height', () => {
    const btnBoundary = block(
      '.btn::before,\n' + '.segmented button::before,\n' + '.link::before',
    );
    expect(btnBoundary).toContain('min-height: 44px');
    expect(btnBoundary).toContain('position: absolute');
    expect(btnBoundary).toContain('width: 100%');
  });

  test('small square controls expand touch boundary to minimum 44×44px', () => {
    const squareBoundary = block(
      '.icon-btn::before,\n' +
        '.swatch::before,\n' +
        '.size::before,\n' +
        '.card-check::before,\n' +
        '.switch::before',
    );
    expect(squareBoundary).toContain('min-width: 44px');
    expect(squareBoundary).toContain('min-height: 44px');
    expect(squareBoundary).toContain('position: absolute');
  });

  test('menu items satisfy minimum 44px height', () => {
    const menuItem = block('.menu-item');
    expect(menuItem).toContain('min-height: 44px');
  });
});

describe('Standardized 8-State Coverage', () => {
  test('loading states provide wait cursor and visual busy feedback', () => {
    const loadingState = block(
      '.btn.loading,\n' +
        ".btn[aria-busy='true'],\n" +
        "button[aria-busy='true']",
    );
    expect(loadingState).toContain('cursor: wait');
    expect(loadingState).toContain('opacity: 0.8');
  });

  test('disabled states provide not-allowed cursor and dimmed opacity', () => {
    const disabledState = block(
      '.btn:disabled,\n' +
        '.icon-btn:disabled,\n' +
        '.tool:disabled,\n' +
        '.size:disabled,\n' +
        '.swatch:disabled,\n' +
        '.switch:disabled,\n' +
        '.segmented button:disabled,\n' +
        ".segmented button[aria-disabled='true']",
    );
    expect(disabledState).toContain('cursor: not-allowed');
    expect(disabledState).toContain('opacity: 0.45');
  });

  test('form controls in error state indicate invalid status with danger color and ring', () => {
    const invalidState = block(
      ":is(input, textarea, select)[aria-invalid='true']",
    );
    expect(invalidState).toContain('border-color: var(--danger)');

    const invalidFocus = block(
      ":is(input, textarea, select)[aria-invalid='true']:focus,\n" +
        ":is(input, textarea, select)[aria-invalid='true']:focus-visible",
    );
    expect(invalidFocus).toContain('border-color: var(--danger)');
    expect(invalidFocus).toContain('0 0 0 2px var(--panel)');
    expect(invalidFocus).toContain('0 0 0 4px var(--danger)');
  });
});
