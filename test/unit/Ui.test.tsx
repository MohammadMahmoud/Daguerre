import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { ConfirmDialog, Icon, Toast, Tooltip } from '../../src/Ui';

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

test('ConfirmDialog buttons are explicitly typed as button', () => {
  renderDialog();
  const buttons = within(screen.getByRole('alertdialog')).getAllByRole(
    'button',
  );
  expect(buttons).toHaveLength(2);
  for (const btn of buttons) {
    expect(btn.getAttribute('type')).toBe('button');
  }
});

test('Toast has accessible status role and polite live region', () => {
  const { rerender } = render(<Toast message='Screenshot copied' />);
  const toast = screen.getByRole('status');
  expect(toast.getAttribute('aria-live')).toBe('polite');
  expect(toast.getAttribute('data-show')).toBe('');
  expect(toast.textContent).toBe('Screenshot copied');

  rerender(<Toast message={undefined} />);
  expect(toast.getAttribute('data-show')).toBeNull();
});

test('Tooltip displays accessible tooltip on hover and focus', () => {
  render(
    <Tooltip content='Undo action'>
      <button>Action</button>
    </Tooltip>,
  );
  expect(screen.queryByRole('tooltip')).toBeNull();
  const trigger = screen.getByRole('button', { name: 'Action' });
  fireEvent.focus(trigger);
  const tooltip = screen.getByRole('tooltip');
  expect(tooltip.textContent).toBe('Undo action');
  fireEvent.blur(trigger);
  expect(screen.queryByRole('tooltip')).toBeNull();
});

test('Tooltip supports right, bottom, and left positioning', () => {
  const { rerender } = render(
    <Tooltip content='Right tip' position='right'>
      <button>Right</button>
    </Tooltip>,
  );
  fireEvent.focus(screen.getByRole('button', { name: 'Right' }));
  expect(screen.getByRole('tooltip').textContent).toBe('Right tip');

  rerender(
    <Tooltip content='Bottom tip' position='bottom'>
      <button>Bottom</button>
    </Tooltip>,
  );
  fireEvent.focus(screen.getByRole('button', { name: 'Bottom' }));
  expect(screen.getByRole('tooltip').textContent).toBe('Bottom tip');

  rerender(
    <Tooltip content='Left tip' position='left'>
      <button>Left</button>
    </Tooltip>,
  );
  fireEvent.focus(screen.getByRole('button', { name: 'Left' }));
  expect(screen.getByRole('tooltip').textContent).toBe('Left tip');
});
