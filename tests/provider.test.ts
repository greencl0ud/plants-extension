import { expect, it, vi } from 'vitest';
import type * as VSCode from 'vscode';
import { ShelfViewProvider } from '../src/extension/ShelfViewProvider.js';

function provider(saved: unknown = null, fail = false) {
  let value = saved;
  let receive: (message: unknown) => Promise<void> = async () => {};
  const dispose = vi.fn();
  let onDispose = () => {};
  const update = vi.fn(async (_key: string, next: unknown) => {
    if (fail) throw new Error('Save failed');
    value = next;
  });
  const state = {
    get: () => value, update, keys: () => [],
  } as unknown as VSCode.Memento;
  const postMessage = vi.fn(async () => true);
  const webview = {
    options: {}, html: '', cspSource: 'https://*.vscode-cdn.net',
    asWebviewUri: (uri: VSCode.Uri) => ({ toString: () => `https://file+.vscode-resource.vscode-cdn.net/${uri.toString()}` }),
    postMessage,
    onDidReceiveMessage: (listener: typeof receive) => { receive = listener; return { dispose }; },
  };
  const view = { webview, onDidDispose: (listener: () => void) => { onDispose = listener; } };
  new ShelfViewProvider({ toString: () => 'extension' } as VSCode.Uri, state)
    .resolveWebviewView(view as unknown as VSCode.WebviewView);
  return { webview, postMessage, update, receive: (message: unknown) => receive(message), dispose, close: () => onDispose() };
}

it('restores saved state and saves only validated commands', async () => {
  const app = provider('stringle');
  await app.receive({ type: 'ready' });
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'shelfState', plantId: 'stringle' });
  await app.receive({ type: 'selectPlant', plantId: 'dangleleaf' });
  expect(app.update).not.toHaveBeenCalled();
  await app.receive({ type: 'selectPlant', plantId: 'stringle' });
  expect(app.update).toHaveBeenCalledWith('selectedPlant', 'stringle');
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'shelfState', plantId: 'stringle' });
  app.close();
  expect(app.dispose).toHaveBeenCalledOnce();
});

it('returns an empty shelf for invalid saved data and reports failed persistence', async () => {
  const app = provider('invalid', true);
  await app.receive({ type: 'ready' });
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'shelfState', plantId: null });
  await app.receive({ type: 'selectPlant', plantId: 'stringle' });
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'saveError' });
});

it('retains CSP and resource restrictions and supplies a validated bootstrap shell', () => {
  const app = provider();
  expect(app.webview.html).toContain("default-src 'none'");
  expect(app.webview.html).toMatch(/script-src 'nonce-[a-f0-9]+'/);
  expect(app.webview.html).not.toContain('unsafe-inline');
  expect(app.webview.html).toContain('data-bootstrap=');
  expect(app.webview.html).not.toContain('plant-card');
  expect(app.webview.options).toMatchObject({ enableScripts: true, localResourceRoots: expect.any(Array) });
});
