import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { History } from '../../src/history';
import {
    addShot,
    clearShots,
    getShot,
    listShots,
    putShots,
} from '../../src/lib/db';
import { imageBlob } from '../setup';

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

test('clear all asks for confirmation', async () => {
  await seed();
  const confirm = vi
    .spyOn(window, 'confirm')
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  render(<History />);
  await screen.findByText('Today');
  fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
  await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
  expect(screen.getAllByRole('article')).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: /Clear all/ }));
  expect(await screen.findByText('No screenshots yet')).toBeTruthy();
  expect(await listShots()).toEqual([]);
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
