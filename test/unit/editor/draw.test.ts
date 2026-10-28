import { describe, expect, test, vi } from 'vitest';
import {
  bounds,
  constrain,
  drawShape,
  handleAt,
  handlePoint,
  hitTest,
  normRect,
  render,
  resizeRect,
} from '../../../src/editor/draw';
import type { Shape } from '../../../src/lib/db';

const shape = (
  kind: Shape['kind'],
  pts: number[],
  extra: Partial<Shape> = {},
): Shape => ({
  id: kind,
  kind,
  color: '#ff4d4f',
  size: 4,
  pts,
  ...extra,
});

function context() {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 200;
  return canvas.getContext('2d')!;
}

describe('geometry', () => {
  test('normRect normalises any drag direction', () => {
    expect(normRect(10, 20, 4, 2)).toEqual({ x: 4, y: 2, w: 6, h: 18 });
  });

  test('constrain snaps lines to 45 degrees and boxes to squares', () => {
    const [x, y] = constrain('line', 0, 0, 10, 9);
    expect(x).toBeCloseTo(y);
    expect(constrain('arrow', 0, 0, 10, 1)[1]).toBeCloseTo(0);
    expect(constrain('rect', 0, 0, 10, -3)).toEqual([10, -10]);
    expect(constrain('ellipse', 5, 5, 5, 5)).toEqual([5, 5]);
  });

  const crop = { x: 100, y: 100, w: 200, h: 400 };

  test('handleAt finds corners, whole edges, and nothing inside', () => {
    expect(handleAt(crop, 102, 98, 5)).toBe('nw');
    expect(handleAt(crop, 300, 500, 5)).toBe('se');
    expect(handleAt(crop, 140, 503, 5)).toBe('s');
    expect(handleAt(crop, 297, 250, 5)).toBe('e');
    expect(handleAt(crop, 98, 250, 5)).toBe('w');
    expect(handleAt(crop, 200, 300, 5)).toBeUndefined();
    expect(handleAt(crop, 200, 520, 5)).toBeUndefined();
  });

  test('handlePoint returns corners and edge midpoints', () => {
    expect(handlePoint(crop, 'ne')).toEqual([300, 100]);
    expect(handlePoint(crop, 's')).toEqual([200, 500]);
    expect(handlePoint(crop, 'w')).toEqual([100, 300]);
  });

  test('resizeRect moves only the dragged edges and flips past the opposite edge', () => {
    expect(resizeRect(crop, 's', 999, 800)).toEqual({
      x: 100,
      y: 100,
      w: 200,
      h: 700,
    });
    expect(resizeRect(crop, 'nw', 150, 120)).toEqual({
      x: 150,
      y: 120,
      w: 150,
      h: 380,
    });
    expect(resizeRect(crop, 'e', 50, 0)).toEqual({
      x: 50,
      y: 100,
      w: 50,
      h: 400,
    });
  });
});

describe('drawShape', () => {
  const img = document.createElement('canvas');
  img.width = 200;
  img.height = 200;

  test.each([
    shape('rect', [10, 10, 50, 40]),
    shape('ellipse', [10, 10, 50, 40]),
    shape('line', [10, 10, 50, 40]),
    shape('arrow', [10, 10, 50, 40]),
    shape('pen', [10, 10, 20, 20, 30, 15]),
    shape('pen', [10, 10]),
    shape('highlight', [10, 10, 60, 10]),
    shape('blur', [10, 10, 60, 50], { size: 8 }),
    shape('blur', [10, 10, 10, 50], { size: 8 }),
    shape('text', [10, 10], { text: 'Hello\nWorld', size: 20 }),
    shape('text', [10, 10], { color: '#ffffff', size: 20 }),
    shape('step', [50, 50], { text: '1', size: 12 }),
    shape('step', [50, 50], { color: '#ffffff', size: 12 }),
  ])('draws $kind and restores state', (s) => {
    const ctx = context();
    const restore = vi.spyOn(ctx, 'restore');
    drawShape(ctx, s, img);
    expect(restore).toHaveBeenCalledOnce();
  });

  test('blur pixelates the image region', () => {
    const ctx = context();
    const drawImage = vi.spyOn(ctx, 'drawImage');
    drawShape(ctx, shape('blur', [0, 0, 40, 40], { size: 10 }), img);
    expect(drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      4,
      4,
      0,
      0,
      40,
      40,
    );
  });

  test('render sizes the canvas to the region and draws every shape', () => {
    const canvas = document.createElement('canvas');
    const ctx = render(
      canvas,
      img,
      [shape('rect', [0, 0, 10, 10]), shape('line', [0, 0, 5, 5])],
      { x: 10, y: 20, w: 50, h: 25 },
      2,
    );
    expect([canvas.width, canvas.height]).toEqual([100, 50]);
    const draw = vi.spyOn(ctx, 'drawImage');
    render(canvas, img, [], { x: 10, y: 20, w: 50, h: 25 }, 2);
    expect(draw).toHaveBeenCalledWith(img, 10, 20, 50, 25, 10, 20, 50, 25);
  });
});

describe('bounds and hitTest', () => {
  const ctx = context();

  test('bounds per kind', () => {
    expect(bounds(ctx, shape('step', [50, 50], { size: 10 }))).toEqual({
      x: 40,
      y: 40,
      w: 20,
      h: 20,
    });
    expect(bounds(ctx, shape('blur', [0, 0, 10, 20]))).toEqual({
      x: 0,
      y: 0,
      w: 10,
      h: 20,
    });
    expect(bounds(ctx, shape('rect', [0, 0, 10, 20]))).toEqual({
      x: -2,
      y: -2,
      w: 14,
      h: 24,
    });
    const text = bounds(
      ctx,
      shape('text', [5, 5], { text: 'ab\nc', size: 10 }),
    );
    expect(text).toMatchObject({ x: 5, y: 5, h: 25 });
    expect(bounds(ctx, shape('text', [0, 0], { size: 10 })).h).toBe(12.5);
  });

  test('hitTest returns the top-most shape under the point', () => {
    const line = shape('line', [0, 0, 100, 0]);
    const pen = shape('pen', [200, 200]);
    const rect = { ...shape('rect', [0, 0, 50, 50]), id: 'top' };
    expect(hitTest(ctx, [line, rect], 10, 1, 2)?.id).toBe('top');
    expect(hitTest(ctx, [rect, line], 80, 1, 2)?.id).toBe('line');
    expect(hitTest(ctx, [pen], 201, 201, 2)?.id).toBe('pen');
    expect(hitTest(ctx, [line, rect, pen], 150, 150, 2)).toBeUndefined();
  });
});
