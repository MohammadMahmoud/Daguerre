import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

const css = readFileSync('src/Styles.css', 'utf8');

function block(selector: string) {
  const target =
    selector.startsWith('.') || selector.startsWith(':')
      ? `\n${selector} {`
      : `${selector} {`;
  let start = css.indexOf(target);
  if (start === -1) start = css.indexOf(`${selector} {`);
  else start += 1;
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}', start));
}

function token(body: string, name: string) {
  const hex = new RegExp(`${name}: (#[0-9a-f]{6})`, 'i').exec(body)?.[1];
  expect(hex, `${name} must be a hex colour`).toBeDefined();
  return hex!;
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test.each([
  ['dark', ':root'],
  ['light', ":root[data-theme='light']"],
])('%s theme text is the opposite of its background', (_name, selector) => {
  const body = block(selector);
  expect(contrast(token(body, '--text'), token(body, '--bg'))).toBeGreaterThan(
    12,
  );
  expect(
    contrast(token(body, '--text'), token(body, '--panel')),
  ).toBeGreaterThan(12);
  expect(contrast(token(body, '--muted'), token(body, '--bg'))).toBeGreaterThan(
    4.5,
  );
});

test.each([
  ['dark', ':root'],
  ['light', ":root[data-theme='light']"],
])('%s toast text contrasts with the toast background', (_name, selector) => {
  const body = block(selector);
  expect(
    contrast(token(body, '--text'), token(body, '--panel-2')),
  ).toBeGreaterThan(10);
});

test('toast uses text color on panel surface', () => {
  expect(block('.toast')).toContain('color: var(--text)');
  expect(block('.toast')).toContain('background: var(--panel-2)');
});

test('dark primary button has dark surface with light text', () => {
  expect(block('.btn.primary')).toContain('color: var(--text)');
  expect(block('.btn.primary')).toContain('background: var(--panel-3)');
});

test('glass mode styles toast with frosted glass', () => {
  const start = css.indexOf(":root[data-appearance='glass'] .toast");
  const rule = css.slice(start, css.indexOf('\n}', start));
  expect(rule).toContain('backdrop-filter: var(--glass-filter)');
  expect(rule).toContain('color: var(--text)');
});

test('editor buttons inherit glass styles under data-appearance', () => {
  expect(css).toMatch(
    /:root\[data-appearance\] \.editor\)\s*\.btn:not\(\.danger, \.ghost\)/,
  );
});

test('Windows and Linux toasts use readable text on their panel background', () => {
  const start = css.indexOf("html:is([data-platform='windows']");
  const rule = css.slice(start, css.indexOf('\n}', start));
  expect(rule).toContain('background: var(--panel)');
  expect(rule).toContain('color: var(--text)');
});

test('the Window design slider glides through a registered number property', () => {
  expect(css).toMatch(/@property --theme-blend \{[^}]*syntax: '<number>'/);
  expect(block(':root')).toContain('transition: --theme-blend');
});

test('danger button uses high-contrast white text on vivid red surface', () => {
  const rule = block('.btn.danger,\n.btn-danger');
  expect(rule).toContain('color: #ffffff !important');
  expect(rule).toContain('#ff453a');
  expect(rule).toContain('#d70015');
});

test('capture page header layout prevents collision with delay controls', () => {
  const headRule = block('.page-head');
  expect(headRule).toContain('flex-wrap: nowrap');
  expect(headRule).toContain('justify-content: space-between');
  const delayRule = block('.delay-field');
  expect(delayRule).toContain('flex-shrink: 0');
  expect(delayRule).toContain('white-space: nowrap');
});

test('editor topbar track prevents button overflow onto the canvas', () => {
  const topbarRule = block('.topbar');
  expect(topbarRule).toContain('flex-wrap: nowrap');
  expect(topbarRule).toContain('overflow-x: auto');
  const editorRule = block('.editor');
  expect(editorRule).toContain('min-width: 860px');
  expect(editorRule).toContain('min-height: 600px');
  const appRule = block('.app');
  expect(appRule).toContain('min-width: 860px');
  expect(appRule).toContain('min-height: 600px');
});
