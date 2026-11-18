import { render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { LiveTextLayer } from '../../../src/editor/LiveTextLayer';

const block = {
  text: 'Hi there',
  bbox: { x: 0.1, y: 0.2, width: 0.5, height: 0.1 },
  words: [
    { text: 'Hi', bbox: { x: 0.1, y: 0.2, width: 0.1, height: 0.1 } },
    { text: 'there', bbox: { x: 0.3, y: 0.2, width: 0.3, height: 0.1 } },
  ],
};

test('positions each word on its box and stretches it to the box width', () => {
  vi.spyOn(
    CanvasRenderingContext2D.prototype,
    'measureText',
  ).mockImplementation(
    (text: string) => ({ width: text.length * 50 }) as TextMetrics,
  );
  render(
    <LiveTextLayer blocks={[block]} width={1000} height={500} tool='select' />,
  );
  const line = screen.getByTitle('Hi there');
  /** Line height 50px, font 42.5px. */
  expect(line.style.lineHeight).toBe('50px');
  expect(line.style.fontSize).toBe('42.5px');
  expect(line.textContent).toBe('Hi there');
  const [hi, there] = Array.from(
    line.querySelectorAll<HTMLElement>('.live-text-word'),
  );
  expect(hi.style.left).toBe('0%');
  /** Natural width 100px at 100px font, 42.5px here; target 100px. */
  expect(hi.style.transform).toBe(`scaleX(${100 / 42.5})`);
  expect(parseFloat(there.style.left)).toBeCloseTo(40);
  expect(there.style.transform).toBe(`scaleX(${300 / 106.25})`);
});

test('falls back to the line text when no word boxes exist', () => {
  vi.spyOn(CanvasRenderingContext2D.prototype, 'measureText').mockReturnValue({
    width: 0,
  } as TextMetrics);
  render(
    <LiveTextLayer
      blocks={[{ text: 'Line', bbox: { x: 0, y: 0, width: 0, height: 0.1 } }]}
      width={100}
      height={100}
      tool='pen'
    />,
  );
  const word = screen.getByText('Line');
  expect(word.className).toBe('live-text-word');
  expect(word.style.transform).toBe('');
  expect(screen.getByLabelText('Recognized text overlay').dataset.tool).toBe(
    'pen',
  );
});
