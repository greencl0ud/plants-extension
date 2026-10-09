import { isShelfMessage, type ShelfMessage, type WebviewMessage } from '../shared/plants.js';

export interface ShelfMessaging {
  send(message: WebviewMessage): void;
  subscribe(listener: (message: ShelfMessage) => void): () => void;
}

export function createMessaging(
  api: { postMessage(message: WebviewMessage): void },
  target: Window,
): ShelfMessaging {
  return {
    send: (message) => api.postMessage(message),
    subscribe(listener) {
      const receive = (event: MessageEvent<unknown>): void => {
        if (isShelfMessage(event.data)) listener(event.data);
      };
      target.addEventListener('message', receive);
      return () => target.removeEventListener('message', receive);
    },
  };
}
