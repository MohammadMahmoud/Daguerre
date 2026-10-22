import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Editor } from '../../src/editor';
import {
    addShot,
    clearShots,
    getShot,
    putShots,
    type Edits,
} from '../../src/lib/db';
import { recognize } from '../../src/lib/ocr';
import { defaultBitmap, imageBlob } from '../setup';

vi.mock('../../src/lib/ocr', () => ({ recognize: vi.fn() }));

beforeEach(async () => {
  await clearShots();
  // Stored blobs are cloned by IndexedDB, so decoded captures use this size (fits the stage at scale 1).
  Object.assign(defaultBitmap, { width: 900, height: 600 });
  vi.mocked(recognize).mockResolvedValue({
    text: 'Hello world',
    words: [{ text: 'Hello', x0: 0, y0: 0, x1: 10, y1: 10 }],
  });
});

afterEach(() => Object.assign(defaultBitmap, { width: 1024, height: 768 }));

async function open(edits?: Edits) {
  const id = await addShot(imageBlob(900, 600), {
    title: 'Pricing',
    url: 'https://www.acme.com',
    mode: 'visible',
  });
  if (edits) {
    const shot = (await getShot(id))!;
    await putShots([{ ...shot, edits, original: shot.blob }]);
  }
  history.replaceState(null, '', `/editor.html?id=${id}`);
  render(<Editor />);
  await screen.findByRole('img', { name: 'Screenshot canvas' });
  return id;
}

const canvas = () => screen.getByRole('img', { name: 'Screenshot canvas' });
const key = (k: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(document.body, { key: k, ...init });
const meta = () => document.querySelector('.doc-meta .meta')!.textContent;
const status = () => screen.getByRole('status').textContent;
const button = (name: string | RegExp) => screen.getByRole('button', { name });

function drag(
  from: [number, number],
  to: [number, number],
  init: PointerEventInit = {},
) {
  fireEvent.pointerDown(canvas(), {
    clientX: from[0],
    clientY: from[1],
    button: 0,
    ...init,
  });
  fireEvent.pointerMove(canvas(), {
    clientX: (from[0] + to[0]) / 2,
    clientY: (from[1] + to[1]) / 2,
    ...init,
  });
  fireEvent.pointerMove(canvas(), { clientX: to[0], clientY: to[1], ...init });
  fireEvent.pointerUp(canvas(), { clientX: to[0], clientY: to[1] });
}

async function savedEdits(id: string) {
  fireEvent.click(button(/^Save/));
  await waitFor(() => expect(status()).toBe('Saved to history'));
  return (await getShot(id))!.edits!;
}

test('explains when the screenshot is missing', async () => {
  history.replaceState(null, '', '/editor.html?id=nope');
  render(<Editor />);
  expect(await screen.findByText('Screenshot not found')).toBeTruthy();
});

test('shows the screenshot details and renames it', async () => {
  const id = await open();
  expect(meta()).toBe('900 × 600 px · Visible area · acme.com');
  expect(document.title).toBe('Pricing – Daguerre');
  const title = screen.getByRole('textbox', { name: 'Screenshot title' });
  fireEvent.change(title, { target: { value: '  Plans  ' } });
  fireEvent.keyDown(title, { key: 'Enter' });
  fireEvent.blur(title);
  await waitFor(async () => expect((await getShot(id))!.title).toBe('Plans'));
  fireEvent.change(title, { target: { value: '' } });
  fireEvent.blur(title);
  await waitFor(async () =>
    expect((await getShot(id))!.title).toBe('Untitled'),
  );
  fireEvent.blur(title);
});

describe('annotations', () => {
  test('draws every shape tool, ignoring tiny drags', async () => {
    const id = await open();
    expect(button(/^Saved/)).toHaveProperty('disabled', true);
    for (const k of ['r', 'o', 'l', 'p', 'h', 'b']) {
      key(k);
      drag([100, 100], [300, 250]);
    }
    key('a');
    drag([10, 10], [200, 30], { shiftKey: true });
    drag([50, 50], [51, 51]); // too small
    fireEvent.click(screen.getByRole('button', { name: 'Ellipse' }));
    expect(
      screen
        .getByRole('button', { name: 'Ellipse' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    key('n');
    fireEvent.pointerDown(canvas(), { clientX: 400, clientY: 400, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 450, clientY: 400, button: 0 });
    fireEvent.pointerDown(canvas(), { clientX: 450, clientY: 400, button: 2 }); // right click ignored
    const edits = await savedEdits(id);
    expect(edits.shapes.map((s) => s.kind)).toEqual([
      'rect',
      'ellipse',
      'line',
      'pen',
      'highlight',
      'blur',
      'arrow',
      'step',
      'step',
    ]);
    expect(edits.shapes.at(-1)!.text).toBe('2');
    const arrow = edits.shapes.find((s) => s.kind === 'arrow')!;
    expect(arrow.pts[3]).toBeCloseTo(10); // shift keeps it horizontal
    expect(button(/^Saved/)).toBeTruthy();
  });

  test('undo and redo with buttons and shortcuts', async () => {
    const id = await open();
    key('r');
    drag([100, 100], [300, 250]);
    drag([400, 100], [500, 250]);
    fireEvent.click(button('Undo'));
    key('z', { metaKey: true });
    expect(button('Undo')).toHaveProperty('disabled', true);
    fireEvent.click(button('Redo'));
    key('z', { metaKey: true, shiftKey: true });
    expect(button('Redo')).toHaveProperty('disabled', true);
    key('z', { ctrlKey: true });
    key('y', { ctrlKey: true });
    key('q', { metaKey: true }); // unbound
    key('s', { metaKey: true });
    await waitFor(() => expect(status()).toBe('Saved to history'));
    expect((await getShot(id))!.edits!.shapes).toHaveLength(2);
  });

  test('text: type, commit, edit by double-click, cancel and delete', async () => {
    const id = await open();
    key('t');
    fireEvent.pointerDown(canvas(), { clientX: 50, clientY: 60, button: 0 });
    const input = screen.getByRole('textbox', { name: 'Annotation text' });
    fireEvent.change(input, { target: { value: 'Hello\n' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(
      screen.queryByRole('textbox', { name: 'Annotation text' }),
    ).toBeNull();

    // Click elsewhere while editing commits instead of starting a new text.
    fireEvent.pointerDown(canvas(), { clientX: 300, clientY: 300, button: 0 });
    fireEvent.change(screen.getByRole('textbox', { name: 'Annotation text' }), {
      target: { value: 'Second' },
    });
    fireEvent.pointerDown(canvas(), { clientX: 500, clientY: 500, button: 0 });
    expect(
      screen.queryByRole('textbox', { name: 'Annotation text' }),
    ).toBeNull();

    // Escape discards a new text; an empty new text is dropped.
    fireEvent.pointerDown(canvas(), { clientX: 600, clientY: 100, button: 0 });
    fireEvent.keyDown(
      screen.getByRole('textbox', { name: 'Annotation text' }),
      { key: 'Escape' },
    );
    fireEvent.pointerDown(canvas(), { clientX: 600, clientY: 100, button: 0 });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Annotation text' }));

    key('v');
    fireEvent.doubleClick(canvas(), { clientX: 55, clientY: 65 });
    const edit = screen.getByRole('textbox', {
      name: 'Annotation text',
    }) as HTMLTextAreaElement;
    expect(edit.value).toBe('Hello');
    fireEvent.change(edit, { target: { value: 'Hi' } });
    fireEvent.blur(edit);
    fireEvent.doubleClick(canvas(), { clientX: 800, clientY: 500 }); // nothing there
    let edits = await savedEdits(id);
    expect(edits.shapes.map((s) => s.text)).toEqual(['Hi', 'Second']);

    fireEvent.doubleClick(canvas(), { clientX: 55, clientY: 65 });
    fireEvent.change(screen.getByRole('textbox', { name: 'Annotation text' }), {
      target: { value: '   ' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: 'Annotation text' }));
    key('r');
    fireEvent.doubleClick(canvas(), { clientX: 305, clientY: 305 }); // only in select mode
    edits = await savedEdits(id);
    expect(edits.shapes.map((s) => s.text)).toEqual(['Second']);
  });

  test('select, move, restyle and delete a shape', async () => {
    const id = await open();
    key('r');
    drag([100, 100], [300, 250]);
    key('v');
    fireEvent.pointerDown(canvas(), { clientX: 700, clientY: 500, button: 0 }); // empty space
    fireEvent.pointerUp(canvas());
    drag([100, 100], [150, 120]);
    fireEvent.click(button('Color #3b82f6'));
    fireEvent.click(button('Large size'));
    const custom = screen.getByLabelText('Custom color');
    fireEvent.change(custom, { target: { value: '#123456' } });
    fireEvent.blur(custom);
    let [rect] = (await savedEdits(id)).shapes;
    expect(rect.pts).toEqual([150, 120, 350, 270]);
    expect(rect.color).toBe('#123456');
    expect(rect.size).toBeGreaterThan(5);

    fireEvent.pointerDown(canvas(), { clientX: 150, clientY: 120, button: 0 });
    fireEvent.pointerUp(canvas()); // no movement: nothing to commit
    key('Escape');
    fireEvent.pointerDown(canvas(), { clientX: 150, clientY: 120, button: 0 });
    fireEvent.pointerUp(canvas());
    key('Delete');
    expect((await savedEdits(id)).shapes).toEqual([]);
    key('Backspace'); // nothing selected
  });

  test('reset removes everything', async () => {
    await open({
      shapes: [
        {
          id: 's',
          kind: 'rect',
          color: '#000000',
          size: 3,
          pts: [0, 0, 10, 10],
        },
      ],
      crop: { x: 0, y: 0, w: 300, h: 200 },
    });
    expect(meta()).toMatch(/^300 × 200 px/);
    fireEvent.click(button(/Reset/));
    expect(meta()).toMatch(/^900 × 600 px/);
    expect(screen.queryByRole('button', { name: /Reset/ })).toBeNull();
  });
});

describe('crop', () => {
  test('draw, resize with handles, move and apply', async () => {
    const id = await open();
    key('c');
    const bar = screen.getByRole('group', { name: 'Crop' });
    expect(within(bar).getByText('Drag to select an area')).toBeTruthy();
    fireEvent.pointerMove(canvas(), { clientX: 10, clientY: 10 });
    expect(canvas().style.cursor).toBe('crosshair');
    drag([100, 100], [400, 300]);
    expect(within(bar).getByText('300 × 200')).toBeTruthy();

    fireEvent.pointerMove(canvas(), { clientX: 400, clientY: 200 });
    expect(canvas().style.cursor).toBe('ew-resize');
    fireEvent.pointerMove(canvas(), { clientX: 250, clientY: 200 });
    expect(canvas().style.cursor).toBe('move');
    fireEvent.pointerMove(canvas(), { clientX: 600, clientY: 500 });
    expect(canvas().style.cursor).toBe('crosshair');

    drag([250, 300], [250, 400]); // bottom edge
    expect(within(bar).getByText('300 × 300')).toBeTruthy();
    drag([200, 200], [220, 210]); // move
    key('Enter');
    expect(meta()).toMatch(/^300 × 300 px/);
    expect((await savedEdits(id)).crop).toEqual({
      x: 120,
      y: 110,
      w: 300,
      h: 300,
    });

    key('c');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Crop' })).getByRole('button', {
        name: 'Apply',
      }),
    );
    expect(meta()).toMatch(/^300 × 300 px/); // unchanged crop: no new history entry
    key('c');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Crop' })).getByRole('button', {
        name: 'Clear',
      }),
    );
    drag([10, 10], [12, 12]); // too small to keep
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Crop' })).getByRole('button', {
        name: 'Apply',
      }),
    );
    expect(meta()).toMatch(/^900 × 600 px/);
    key('c');
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Crop' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    key('c');
    key('Escape');
    expect(screen.queryByRole('group', { name: 'Crop' })).toBeNull();
  });

  test('dragging past the stage edge scrolls it', async () => {
    await open();
    key('c');
    const stage = document.querySelector('.stage') as HTMLElement;
    fireEvent.pointerDown(canvas(), { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(canvas(), { clientX: 990, clientY: 690 });
    await waitFor(() => expect(stage.scrollTop).toBeGreaterThan(50));
    expect(stage.scrollLeft).toBeGreaterThan(0);
    fireEvent.pointerMove(canvas(), { clientX: 5, clientY: 5 });
    fireEvent.pointerUp(canvas());
    const top = stage.scrollTop;
    await new Promise((r) => setTimeout(r, 50));
    expect(stage.scrollTop).toBe(top);
  });
});

test('zoom with keys and buttons', async () => {
  await open();
  const zoom = () => document.querySelector('.zoom-value')!.textContent;
  expect(zoom()).toBe('Fit');
  key('+');
  expect(zoom()).toBe('125%');
  key('-');
  key('=');
  fireEvent.click(button('Zoom out'));
  fireEvent.click(button('Zoom in'));
  key('0');
  expect(zoom()).toBe('Fit');
  fireEvent.click(document.querySelector('.zoom-value')!);
  expect(zoom()).toBe('100%');
  fireEvent.click(document.querySelector('.zoom-value')!);
  expect(zoom()).toBe('Fit');
});

describe('export', () => {
  let downloads: string[];
  beforeEach(() => {
    downloads = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  });

  test('menu shows live sizes and exports every format', async () => {
    await open();
    fireEvent.click(button(/Export/));
    const menu = screen.getByRole('dialog', { name: 'Export' });
    await waitFor(() =>
      expect(within(menu).getAllByText('3 B')).toHaveLength(3),
    );
    fireEvent.change(within(menu).getByRole('slider'), {
      target: { value: '0.5' },
    });
    expect((globalThis as any).chrome.storage.local.data.quality).toBe(0.5);
    fireEvent.click(
      within(menu).getByRole('checkbox', {
        name: /Half resolution \(450 × 300\)/,
      }),
    );

    for (const [name, ext] of [
      [/^PNG/, 'png'],
      [/^JPEG/, 'jpg'],
      [/^WebP/, 'webp'],
      [/^PDF/, 'pdf'],
    ] as const) {
      if (!screen.queryByRole('dialog', { name: 'Export' }))
        fireEvent.click(button(/Export/));
      fireEvent.click(button(name));
      await waitFor(() =>
        expect(downloads.at(-1)).toMatch(new RegExp(`\\.${ext}$`)),
      );
      await waitFor(() =>
        expect(button(/Export/)).toHaveProperty('disabled', false),
      );
    }
    expect(downloads[0]).toMatch(/^Daguerre acme\.com /);
  });

  test('searchable PDF runs OCR on the export', async () => {
    await open();
    fireEvent.click(button(/Export/));
    fireEvent.click(button(/^Searchable PDF/));
    await waitFor(() => expect(status()).toBe('PDF ready'));
    expect(recognize).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      expect.any(Function),
    );
    vi.mocked(recognize).mock.calls[0][1]!(0.42);
    await waitFor(() => expect(status()).toBe('Reading text… 42%'));
    expect(downloads).toHaveLength(1);
  });

  test('print renders the image and prints when it loads', async () => {
    const print = vi.spyOn(window, 'print');
    await open();
    key('p', { metaKey: true });
    await waitFor(() =>
      expect(document.querySelector('img.print-only')).not.toBeNull(),
    );
    fireEvent.load(document.querySelector('img.print-only')!);
    expect(print).toHaveBeenCalledOnce();
    act(() => void dispatchEvent(new Event('afterprint')));
    expect(document.querySelector('img.print-only')).toBeNull();
  });

  test('the menu closes on outside click and Escape', async () => {
    await open();
    fireEvent.click(button(/Export/));
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Export' }));
    expect(screen.queryByRole('dialog', { name: 'Export' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog', { name: 'Export' })).toBeNull();
    fireEvent.click(button(/Export/));
    key('Escape');
    expect(screen.queryByRole('dialog', { name: 'Export' })).toBeNull();
  });

  test('encoding failures are reported', async () => {
    await open();
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb) =>
      cb(null),
    );
    fireEvent.click(button(/Export/));
    fireEvent.click(button(/^PNG/));
    await waitFor(() => expect(status()).toMatch(/too large/));
  });
});

describe('clipboard', () => {
  test('copies the image with the button and shortcut', async () => {
    const write = vi.spyOn(navigator.clipboard, 'write');
    await open();
    fireEvent.click(button(/Copy to Clipboard/));
    fireEvent.click(button(/Copy to Clipboard/)); // ignored while busy
    await waitFor(() => expect(status()).toBe('Copied to clipboard'));
    key('c', { metaKey: true });
    await waitFor(() => expect(write).toHaveBeenCalledTimes(2));
  });

  test('copies recognized text and reports progress', async () => {
    const write = vi.spyOn(navigator.clipboard, 'write');
    await open();
    fireEvent.click(button(/Copy Text/));
    await waitFor(() => expect(status()).toBe('Copied 1 word to clipboard'));
    const item = write.mock.calls[0][0][0] as unknown as {
      items: Record<string, Promise<Blob>>;
    };
    expect(await (await item.items['text/plain']).text()).toBe('Hello world');

    vi.mocked(recognize).mockResolvedValueOnce({
      text: 'a b',
      words: [
        { text: 'a', x0: 0, y0: 0, x1: 1, y1: 1 },
        { text: 'b', x0: 0, y0: 0, x1: 1, y1: 1 },
      ],
    });
    key('c', { metaKey: true, shiftKey: true });
    await waitFor(() => expect(status()).toBe('Copied 2 words to clipboard'));
  });

  test('says so when there is no text', async () => {
    vi.mocked(recognize).mockResolvedValueOnce({ text: '', words: [] });
    await open();
    fireEvent.click(button(/Copy Text/));
    await waitFor(() =>
      expect(status()).toBe('No text found in this screenshot.'),
    );
  });

  test('reports non-Error failures generically', async () => {
    vi.mocked(recognize).mockRejectedValueOnce('nope');
    await open();
    fireEvent.click(button(/Copy Text/));
    await waitFor(() => expect(status()).toBe('Something went wrong'));
  });
});

test('warns before leaving with unsaved edits and ignores keys while typing', async () => {
  await open();
  const clean = new Event('beforeunload', { cancelable: true });
  dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
  key('r');
  drag([100, 100], [300, 250]);
  const dirty = new Event('beforeunload', { cancelable: true });
  dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Screenshot title' }), {
    key: 'v',
  });
  expect(
    screen
      .getByRole('button', { name: 'Rectangle' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

test('a capture that fails to decode shows the not-found page', async () => {
  const id = await addShot(imageBlob(10, 10), {
    title: 'x',
    url: '',
    mode: 'visible',
  });
  history.replaceState(null, '', `/editor.html?id=${id}`);
  vi.spyOn(globalThis, 'createImageBitmap').mockRejectedValueOnce(
    new Error('corrupt'),
  );
  render(<Editor />);
  expect(await screen.findByText('Screenshot not found')).toBeTruthy();
});
