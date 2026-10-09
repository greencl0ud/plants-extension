import { expect, it, vi } from 'vitest';
import { createMessaging } from '../src/webview/messaging.js';

it('sends typed commands, validates responses, and removes listeners', () => {
  const postMessage = vi.fn();
  const listener = vi.fn();
  const messaging = createMessaging({ postMessage }, window);
  const unsubscribe = messaging.subscribe(listener);
  messaging.send({ type: 'ready' });
  expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'shelfState', plantId: 'dangleleaf' } }));
  expect(listener).not.toHaveBeenCalled();
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'shelfState', plantId: null } }));
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
  window.dispatchEvent(new MessageEvent('message', { data: { type: 'saveError' } }));
  expect(listener).toHaveBeenCalledTimes(1);
});
