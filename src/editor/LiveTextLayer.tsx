import { Fragment, useMemo } from 'react';
import type { RecognizedTextBlock } from '../lib/OcrService';

/** Fixed family so canvas measurement matches the rendered transparent glyphs. */
const FONT = 'sans-serif';
/** Reference size for measuring; widths scale linearly with font size. */
const MEASURE_PX = 100;
/** Font size relative to line height so the selection highlight fills the line box. */
const FONT_RATIO = 0.85;

/**
 * Transparent, selectable text over the canvas. Each word is positioned on its
 * recognized box and stretched horizontally to the box width, so selection
 * highlights line up with the words in the screenshot.
 */
export function LiveTextLayer({
  blocks,
  width,
  height,
  tool,
}: {
  blocks: RecognizedTextBlock[];
  /** Rendered overlay size in CSS pixels. */
  width: number;
  height: number;
  tool: string;
}) {
  const ctx = useMemo(() => {
    const c = document.createElement('canvas').getContext('2d');
    if (c) c.font = `${MEASURE_PX}px ${FONT}`;
    return c;
  }, []);
  /** Natural word widths at MEASURE_PX, computed once per OCR result. */
  const widths = useMemo(
    () =>
      blocks.map((b) =>
        (b.words ?? [{ text: b.text, bbox: b.bbox }]).map(
          (w) => ctx?.measureText(w.text).width ?? 0,
        ),
      ),
    [blocks, ctx],
  );

  return (
    <div
      className='live-text-overlay'
      aria-label='Recognized text overlay'
      data-tool={tool}
    >
      {blocks.map((block, i) => {
        const lineH = block.bbox.height * height;
        const fontSize = Math.max(1, lineH * FONT_RATIO);
        const words = block.words ?? [{ text: block.text, bbox: block.bbox }];
        return (
          <span
            key={i}
            className='live-text-block'
            tabIndex={0}
            title={block.text}
            style={{
              left: `${block.bbox.x * 100}%`,
              top: `${block.bbox.y * 100}%`,
              width: `${block.bbox.width * 100}%`,
              height: `${block.bbox.height * 100}%`,
              fontSize: `${fontSize}px`,
              lineHeight: `${lineH}px`,
              fontFamily: FONT,
            }}
          >
            {words.map((word, j) => {
              const natural = (widths[i][j] * fontSize) / MEASURE_PX;
              const target = word.bbox.width * width;
              return (
                <Fragment key={j}>
                  {j > 0 && ' '}
                  <span
                    className='live-text-word'
                    style={{
                      left: block.bbox.width
                        ? `${((word.bbox.x - block.bbox.x) / block.bbox.width) * 100}%`
                        : 0,
                      transform:
                        natural > 0 ? `scaleX(${target / natural})` : undefined,
                    }}
                  >
                    {word.text}
                  </span>
                </Fragment>
              );
            })}
          </span>
        );
      })}
    </div>
  );
}
