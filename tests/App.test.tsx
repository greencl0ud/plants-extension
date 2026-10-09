import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { App } from '../src/webview/components/App.js';
import type { ShelfMessage } from '../src/shared/plants.js';
import type { ShelfMessaging } from '../src/webview/messaging.js';

const assets = { shelf: '/shelf.svg', background: '/wall.svg', plants: { stringle: '/stringle.svg', dangleleaf: '/dangleleaf.svg' } };
function harness(initial?: ShelfMessage) {
  const listeners = new Set<(message: ShelfMessage) => void>();
  const send = vi.fn((message) => {
    if (message.type === 'ready' && initial) listeners.forEach(listener => listener(initial));
  });
  const messaging: ShelfMessaging = {
    send,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
  const view = render(<StrictMode><App assets={assets} messaging={messaging} /></StrictMode>);
  return { ...view, send, listeners, receive: (message: ShelfMessage) => act(() => listeners.forEach(listener => listener(message))) };
}

it('subscribes before ready and cleans up under StrictMode', () => {
  const app = harness({ type: 'shelfState', plantId: 'stringle' });
  expect(screen.getByRole('img', { name: /Stringle, a small/ })).toBeTruthy();
  expect(app.listeners.size).toBe(1);
  app.unmount();
  expect(app.listeners.size).toBe(0);
});

it('loads an empty shelf, prevents duplicate commands, and completes selection', async () => {
  const user = userEvent.setup();
  const app = harness();
  await user.click(screen.getByRole('button', { name: 'Add' }));
  const select = screen.getByRole('button', { name: /Stringle/ }) as HTMLButtonElement;
  expect(select.disabled).toBe(true);
  app.receive({ type: 'shelfState', plantId: null });
  expect(select.disabled).toBe(false);
  expect(screen.queryByRole('img', { name: /Stringle, a small/ })).toBeNull();
  expect(screen.getByRole('article', { name: 'Dangleleaf' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Dangleleaf/ })).toBeNull();
  await user.click(select);
  await user.click(select);
  expect(select.disabled).toBe(true);
  expect(app.send.mock.calls.filter(([message]) => message.type === 'selectPlant')).toHaveLength(1);
  expect(app.send).toHaveBeenCalledWith({ type: 'selectPlant', plantId: 'stringle' });
  app.receive({ type: 'shelfState', plantId: 'stringle' });
  expect(screen.getByRole('img', { name: /Stringle, a small/ })).toBeTruthy();
  expect(screen.getByText('Stringle added to shelf.')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add' }));
  await user.click(screen.getByRole('button', { name: 'Add' }));
  expect(screen.getByText('On your shelf')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: /Stringle/ }));
  app.receive({ type: 'shelfState', plantId: 'stringle' });
  expect(screen.getAllByRole('img', { name: /Stringle, a small/ })).toHaveLength(1);
});

it('shows save failure and allows retry without changing the shelf', async () => {
  const user = userEvent.setup();
  const app = harness({ type: 'shelfState', plantId: null });
  await user.click(screen.getByRole('button', { name: 'Add' }));
  const select = screen.getByRole('button', { name: /Stringle/ }) as HTMLButtonElement;
  await user.click(select);
  app.receive({ type: 'saveError' });
  expect(screen.getByText('Could not save your plant. Please try again.')).toBeTruthy();
  expect(select.disabled).toBe(false);
  expect(screen.queryByRole('img', { name: /Stringle, a small/ })).toBeNull();
  await user.click(select);
  expect(screen.queryByText('Could not save your plant. Please try again.')).toBeNull();
  app.receive({ type: 'shelfState', plantId: 'stringle' });
  expect(screen.getByRole('img', { name: /Stringle, a small/ })).toBeTruthy();
});

it('synchronizes Close and cancel with dialog state', async () => {
  const user = userEvent.setup();
  harness({ type: 'shelfState', plantId: null });
  const add = screen.getByRole('button', { name: 'Add' });
  await user.click(add);
  await user.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  await user.click(add);
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('requires both ends of a backdrop gesture to be outside', async () => {
  const user = userEvent.setup();
  harness({ type: 'shelfState', plantId: null });
  await user.click(screen.getByRole('button', { name: 'Add' }));
  const dialog = screen.getByRole('dialog');
  vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 10, 100, 100));
  fireEvent(dialog, new MouseEvent('pointerdown', { bubbles: true, clientX: 50, clientY: 50 }));
  fireEvent(dialog, new MouseEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent(dialog, new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
  fireEvent(dialog, new MouseEvent('pointercancel', { bubbles: true }));
  fireEvent(dialog, new MouseEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent(dialog, new MouseEvent('pointerdown', { bubbles: true, clientX: 0, clientY: 0 }));
  fireEvent(dialog, new MouseEvent('pointerup', { bubbles: true, clientX: 0, clientY: 0 }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
