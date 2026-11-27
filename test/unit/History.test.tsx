import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { History } from '../../src/History';
import {
  addShot,
  clearShots,
  getShot,
  listShots,
  putShots,
} from '../../src/lib/Db';
import { imageBlob } from '../Setup';

const DAY = 864e5;

async function seed() {
  const today = await addShot(imageBlob(800, 600), {
    title: 'Pricing page',
    url: 'https://www.acme.com/pricing',
    mode: 'full',
  });
  const yesterday = await addShot(imageBlob(800, 600), {
    title: 'Docs',
    url: 'https://docs.dev',
    mode: 'selection',
  });
  const old = await addShot(imageBlob(800, 600), {
    title: 'Local file',
    url: '',
    mode: 'tabs',
  });
  const shift = async (id: string, ms: number) => {
    const s = (await getShot(id))!;
    await putShots([{ ...s, createdAt: s.createdAt - ms }]);
  };
  await shift(yesterday, DAY);
  await shift(old, 400 * DAY);
  return { today, yesterday, old };
}

const card = (title: string) =>
  screen.getByRole('link', { name: `Edit ${title}` }).closest('article')!;

beforeEach(() => clearShots());

test('shows an empty state with shortcuts', async () => {
  render(<History />);
  expect(await screen.findByText('No screenshots yet')).toBeTruthy();
  expect(screen.getByText('0 screenshots · 2 KB on this device')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Clear all/ })).toBeNull();
});

test('formats dates from earlier this year without year', async () => {
  const pastSameYear = await addShot(imageBlob(800, 600), {
    title: 'Earlier this month',
    url: '',
    mode: 'tabs',
  });
  const s = (await getShot(pastSameYear))!;
  await putShots([{ ...s, createdAt: Date.now() - 5 * DAY }]);
  render(<History />);
  expect(await screen.findByText('Earlier this month')).toBeTruthy();
});

test('groups screenshots by day with their details', async () => {
  await seed();
  render(<History />);
  expect(await screen.findByText('Today')).toBeTruthy();
  expect(screen.getByText('Yesterday')).toBeTruthy();
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  expect(screen.getByText('3 screenshots · 2 KB on this device')).toBeTruthy();
  expect(within(card('Pricing page')).getByText('acme.com')).toBeTruthy();
  expect(within(card('Local file')).getByText('Local page')).toBeTruthy();
  expect(within(card('Docs')).getByText('Selection')).toBeTruthy();
});

test('searches by title or URL and filters by capture type', async () => {
  await seed();
  render(<History />);
  await screen.findByText('Today');
  const search = screen.getByRole('searchbox', { name: 'Search screenshots' });
  fireEvent.change(search, { target: { value: 'DOCS.dev' } });
  expect(screen.queryByRole('link', { name: 'Edit Pricing page' })).toBeNull();
  expect(card('Docs')).toBeTruthy();
  fireEvent.change(search, { target: { value: 'nothing' } });
  expect(screen.getByText('No screenshots match your search.')).toBeTruthy();
  fireEvent.change(search, { target: { value: '' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Tabs' }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  fireEvent.click(screen.getByRole('radio', { name: 'All' }));
  expect(screen.getAllByRole('article')).toHaveLength(3);
});

test('bulk select, delete, and undo', async () => {
  await seed();
  render(<History />);
  await screen.findByText('Today');
  fireEvent.click(within(card('Docs')).getByRole('checkbox'));
  expect(screen.getByText('1 selected')).toBeTruthy();
  fireEvent.click(within(card('Docs')).getByRole('checkbox'));
  expect(screen.queryByText('1 selected')).toBeNull();
  fireEvent.click(within(card('Docs')).getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(screen.queryByText(/selected/)).toBeNull();
  fireEvent.click(within(card('Docs')).getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
  expect(screen.getByText('3 selected')).toBeTruthy();
  const header = screen.getByRole('banner');
  fireEvent.click(within(header).getByRole('button', { name: 'Delete' }));
  expect(await screen.findByText('No screenshots yet')).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain(
    'Deleted 3 screenshots',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(3));
  expect(screen.getByRole('status').textContent).toBe('Restored');
});

test('deletes one screenshot from its card', async () => {
  await seed();
  render(<History />);
  await screen.findByText('Today');
  fireEvent.click(within(card('Docs')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
  expect(screen.getByRole('status').textContent).toContain(
    'Deleted 1 screenshot',
  );
});

test('clear all asks for confirmation in a dialog', async () => {
  await seed();
  render(<History />);
  await screen.findByText('Today');
  fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
  const dialog = screen.getByRole('alertdialog', {
    name: 'Delete all 3 screenshots?',
  });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(screen.getAllByRole('article')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
  expect(await screen.findByText('No screenshots yet')).toBeTruthy();
  expect(await listShots()).toEqual([]);
});

test('embedded, it hides its logo and hands screenshots to onOpen', async () => {
  const { today } = await seed();
  const onOpen = vi.fn();
  const { container } = render(<History embedded onOpen={onOpen} />);
  await screen.findByText('Today');
  expect(container.querySelector('.history.embedded')).not.toBeNull();
  expect(container.querySelector('.history-title svg')).toBeNull();
  const link = screen.getByRole('link', { name: 'Edit Pricing page' });
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  link.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(true);
  fireEvent.click(within(card('Pricing page')).getByTitle('Pricing page'));
  expect(onOpen.mock.calls).toEqual([[today], [today]]);
});

test('reloads when the window regains focus', async () => {
  render(<History />);
  expect(await screen.findByText('No screenshots yet')).toBeTruthy();
  await seed();
  act(() => void dispatchEvent(new Event('focus')));
  expect(await screen.findByText('Today')).toBeTruthy();
});

test('copies and downloads from a card', async () => {
  await seed();
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
  render(<History />);
  await screen.findByText('Today');
  fireEvent.click(
    within(card('Docs')).getByRole('button', { name: 'Copy image' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Copied to clipboard'),
  );
  vi.spyOn(navigator.clipboard, 'write').mockRejectedValueOnce(
    new Error('denied'),
  );
  fireEvent.click(
    within(card('Docs')).getByRole('button', { name: 'Copy image' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toMatch(/Could not copy/),
  );
  fireEvent.click(
    within(card('Docs')).getByRole('button', { name: 'Download PNG' }),
  );
  expect(click).toHaveBeenCalledOnce();
});

test('reloads when the tab becomes visible again', async () => {
  render(<History />);
  await screen.findByText('No screenshots yet');
  await addShot(imageBlob(10, 10), {
    title: 'New one',
    url: '',
    mode: 'visible',
  });
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(
    await screen.findByRole('link', { name: 'Edit New one' }),
  ).toBeTruthy();
});

test('calls onChange when clearing all, removing, and restoring screenshots', async () => {
  await seed();
  const onChange = vi.fn();
  render(<History onChange={onChange} />);
  await screen.findByText('Today');
  fireEvent.click(within(card('Docs')).getByRole('button', { name: 'Delete' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete all' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledTimes(3));
});

test('provides complete accessible names and roles across search, filters, and cards', async () => {
  await seed();
  render(<History />);
  await screen.findByText('Today');

  // Search input accessible name
  expect(
    screen.getByRole('searchbox', { name: 'Search screenshots' }),
  ).toBeTruthy();

  // Filter radiogroup
  const radiogroup = screen.getByRole('radiogroup', {
    name: 'Filter by capture type',
  });
  expect(radiogroup).toBeTruthy();
  const radios = within(radiogroup).getAllByRole('radio');
  expect(radios.length).toBeGreaterThanOrEqual(4);
  const allRadio = within(radiogroup).getByRole('radio', { name: 'All' });
  expect(allRadio.getAttribute('aria-checked')).toBe('true');

  // Card interactive elements
  const docsCard = card('Docs');
  expect(
    within(docsCard).getByRole('checkbox', { name: 'Select Docs' }),
  ).toBeTruthy();
  expect(
    within(docsCard).getByRole('button', { name: 'Copy image' }),
  ).toBeTruthy();
  expect(within(docsCard).getByRole('button', { name: /PNG/ })).toBeTruthy();
  expect(within(docsCard).getByRole('button', { name: 'Delete' })).toBeTruthy();
});

test('extension mode omits upload button, empty dropzone, and file drop overlay', async () => {
  const { container } = render(<History />);
  expect(await screen.findByText('No screenshots yet')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Upload' })).toBeNull();
  expect(container.querySelector('.upload-empty-drop')).toBeNull();
  expect(screen.queryByRole('radio', { name: 'Uploaded' })).toBeNull();

  const root = container.querySelector('.history')!;
  const file = new File(['png'], 'Doc.png', { type: 'image/png' });
  fireEvent.dragEnter(root, {
    dataTransfer: { types: ['Files'], files: [file] },
  });
  expect(
    screen.queryByRole('region', { name: 'Drop documents to upload' }),
  ).toBeNull();
});

test('desktop upload mode places Upload before Clear all and handles file picker uploads', async () => {
  const { today } = await seed();
  const onOpen = vi.fn();
  const onChange = vi.fn();
  let resolveUpload!: (v: any) => void;
  const onUpload = vi.fn(
    () =>
      new Promise<any>((resolve) => {
        resolveUpload = resolve;
      }),
  );

  const { container } = render(
    <History
      embedded
      onOpen={onOpen}
      onChange={onChange}
      modes={['selection', 'screen', 'window', 'upload']}
      onUpload={onUpload}
      uploadAccept='.png,.pdf'
    />,
  );
  await screen.findByText('Today');

  const actions = container.querySelector('.history-actions') as HTMLElement;
  const buttons = within(actions).getAllByRole('button');
  expect(buttons.map((b) => b.textContent?.trim())).toEqual([
    'Upload',
    'Clear all',
  ]);
  expect(screen.getByRole('radio', { name: 'Uploaded' })).toBeTruthy();

  // Filter to Selection so we verify successful upload resets non-matching filter to All.
  fireEvent.click(screen.getByRole('radio', { name: 'Selection' }));
  expect(
    screen
      .getByRole('radio', { name: 'Selection' })
      .getAttribute('aria-checked'),
  ).toBe('true');

  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  expect(input.getAttribute('accept')).toBe('.png,.pdf');
  const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => undefined);
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  expect(clickSpy).toHaveBeenCalledOnce();

  const file = new File(['png'], 'Spec.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  expect(onUpload).toHaveBeenCalledWith([file]);
  expect(screen.getByRole('button', { name: 'Uploading…' })).toBeTruthy();

  await act(async () => {
    resolveUpload({
      ids: [today],
      titles: ['Spec'],
      skippedUnsupported: 0,
      skippedTooLarge: 0,
      failed: 0,
      truncatedPdfPages: 0,
    });
  });

  await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
  expect(
    screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked'),
  ).toBe('true');
  const toast = screen.getByRole('status');
  expect(toast.textContent).toContain('Added "Spec"');
  fireEvent.click(within(toast).getByRole('button', { name: 'Open' }));
  expect(onOpen).toHaveBeenCalledWith(today);
});

test('desktop upload mode supports empty-state dropzone, nested drag-and-drop, Escape dismissal, and error toasts', async () => {
  const onOpen = vi.fn();
  const onUpload = vi
    .fn()
    .mockResolvedValueOnce({
      ids: ['u1', 'u2'],
      titles: ['Doc (Page 1)', 'Doc (Page 2)'],
      skippedUnsupported: 1,
      skippedTooLarge: 0,
      failed: 0,
      truncatedPdfPages: 0,
    })
    .mockRejectedValueOnce(new Error('Disk full'));

  const { container } = render(
    <History
      embedded
      onOpen={onOpen}
      modes={['selection', 'screen', 'window', 'upload']}
      onUpload={onUpload}
    />,
  );
  expect(await screen.findByText('Drop images or PDFs here')).toBeTruthy();

  const root = container.querySelector('.history')!;
  const file = new File(['pdf'], 'Doc.pdf', { type: 'application/pdf' });

  // Internal non-file drag does not trigger the drop overlay.
  fireEvent.dragEnter(root, {
    dataTransfer: { types: ['text/plain'], files: [] },
  });
  expect(
    screen.queryByRole('region', { name: 'Drop documents to upload' }),
  ).toBeNull();

  // Nested dragEnter / dragLeave avoids flicker, and Escape dismisses overlay.
  fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'], files: [] } });
  fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'], files: [] } });
  expect(
    screen.getByRole('region', { name: 'Drop documents to upload' }),
  ).toBeTruthy();
  fireEvent.dragLeave(root);
  expect(
    screen.getByRole('region', { name: 'Drop documents to upload' }),
  ).toBeTruthy();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(
    screen.queryByRole('region', { name: 'Drop documents to upload' }),
  ).toBeNull();

  // DragOver + Drop uploads files and displays multi-item toast with "Open first".
  fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'], files: [] } });
  const dataTransfer = {
    types: ['Files'],
    files: [file],
    dropEffect: 'none',
  };
  fireEvent.dragOver(root, { dataTransfer });
  expect(dataTransfer.dropEffect).toBe('copy');
  await act(async () => {
    fireEvent.drop(root, { dataTransfer });
  });
  expect(onUpload).toHaveBeenCalledWith([file]);
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('Added 2 items'),
  );
  fireEvent.click(
    within(screen.getByRole('status')).getByRole('button', {
      name: 'Open first',
    }),
  );
  expect(onOpen).toHaveBeenCalledWith('u1');

  // Failed upload shows user-friendly error toast.
  await act(async () => {
    fireEvent.drop(root, { dataTransfer });
  });
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe(
      'Could not import the selected document.',
    ),
  );
});

test('supports handleDrop=false and external refreshKey reloads with filter reset', async () => {
  await seed();
  const onUpload = vi.fn();
  const { container, rerender } = render(
    <History
      embedded
      modes={['selection', 'screen', 'window', 'upload']}
      onUpload={onUpload}
      handleDrop={false}
      refreshKey={0}
    />,
  );
  await screen.findByText('Today');
  fireEvent.click(screen.getByRole('radio', { name: 'Selection' }));

  const root = container.querySelector('.history')!;
  const file = new File(['png'], 'Ignored.png', { type: 'image/png' });
  fireEvent.dragEnter(root, {
    dataTransfer: { types: ['Files'], files: [file] },
  });
  expect(
    screen.queryByRole('region', { name: 'Drop documents to upload' }),
  ).toBeNull();
  fireEvent.drop(root, { dataTransfer: { types: ['Files'], files: [file] } });
  expect(onUpload).not.toHaveBeenCalled();

  await addShot(imageBlob(800, 600), {
    title: 'External drop doc',
    url: '',
    mode: 'upload',
  });
  rerender(
    <History
      embedded
      modes={['selection', 'screen', 'window', 'upload']}
      onUpload={onUpload}
      handleDrop={false}
      refreshKey={1}
    />,
  );
  expect(
    await screen.findByRole('link', { name: 'Edit External drop doc' }),
  ).toBeTruthy();
  expect(
    screen.getByRole('radio', { name: 'All' }).getAttribute('aria-checked'),
  ).toBe('true');
});
