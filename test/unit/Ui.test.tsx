import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ConfirmDialog, Icon } from '../../src/Ui';

function renderDialog() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const pageKey = vi.fn();
  addEventListener('keydown', pageKey);
  const opener = document.createElement('button');
  document.body.append(opener);
  opener.focus();
  const view = render(
    <ConfirmDialog
      title='Discard changes?'
      confirmLabel='Discard'
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      Edits will be lost.
    </ConfirmDialog>,
  );
  return { ...view, onConfirm, onCancel, pageKey, opener };
}

test('is a labelled modal that focuses Cancel first', () => {
  renderDialog();
  const dialog = screen.getByRole('alertdialog', { name: 'Discard changes?' });
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(dialog.getAttribute('aria-describedby')).toBe('dialog-body');
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Cancel' }),
  );
});

test('keeps Tab inside, swallows page shortcuts and cancels on Escape', () => {
  const { onCancel, pageKey } = renderDialog();
  const [cancel, discard] = within(
    screen.getByRole('alertdialog'),
  ).getAllByRole('button');
  fireEvent.keyDown(cancel, { key: 'Tab' });
  expect(document.activeElement).toBe(discard);
  fireEvent.keyDown(discard, { key: 'Tab' });
  expect(document.activeElement).toBe(cancel);
  fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(discard);
  fireEvent.keyDown(discard, { key: 'v' });
  expect(pageKey).not.toHaveBeenCalled();
  fireEvent.keyDown(discard, { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledOnce();
  removeEventListener('keydown', pageKey);
});

test('confirms, cancels on a backdrop click and restores focus', () => {
  const { onConfirm, onCancel, opener, unmount, container } = renderDialog();
  fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
  expect(onConfirm).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('alertdialog'));
  expect(onCancel).not.toHaveBeenCalled();
  fireEvent.click(container.querySelector('.dialog-backdrop')!);
  expect(onCancel).toHaveBeenCalledOnce();
  unmount();
  expect(document.activeElement).toBe(opener);
  opener.remove();
});

test('Icon renders with default and custom class names', () => {
  const { container } = render(
    <Icon name='timer' size={20} className='custom-class' />,
  );
  const svg = container.querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg?.getAttribute('class')).toBe('icon icon-timer custom-class');
  expect(svg?.getAttribute('width')).toBe('20');
  expect(svg?.getAttribute('height')).toBe('20');
});

test('coffee Icon renders structured steam and cup paths for animation', () => {
  const { container } = render(<Icon name='coffee' />);
  const svg = container.querySelector('svg');
  expect(svg?.getAttribute('class')).toBe('icon icon-coffee');
  expect(container.querySelector('.coffee-handle')).not.toBeNull();
  expect(container.querySelector('.coffee-cup')).not.toBeNull();
  expect(container.querySelectorAll('.coffee-steam')).toHaveLength(3);
  expect(container.querySelector('.coffee-steam-1')).not.toBeNull();
  expect(container.querySelector('.coffee-steam-2')).not.toBeNull();
  expect(container.querySelector('.coffee-steam-3')).not.toBeNull();
});
