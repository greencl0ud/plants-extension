import { expect, it, vi } from 'vitest';
import type * as VSCode from 'vscode';
import { ShelfViewProvider } from '../src/extension/ShelfViewProvider.js';
import { INITIAL_HEALTH, type SavedPlant } from '../src/shared/plants.js';

const legacy: SavedPlant = { id: 'stringle', addedAt: '2026-10-01T12:00:00.000Z', stage: 'Seedling', health: INITIAL_HEALTH };
function provider(saved: unknown = undefined, fail = false, collection?: unknown) {
  const values = new Map<string, unknown>([['selectedPlant', saved]]);
  if (collection !== undefined) values.set('shelfPlants', collection);
  let receive: (message: unknown) => Promise<void> = async () => {};
  const dispose = vi.fn();
  let onDispose = () => {};
  const update = vi.fn(async (key: string, next: unknown) => {
    if (fail) throw new Error('Save failed');
    values.set(key, next);
  });
  const state = { get: (key: string) => values.get(key), update, keys: () => [...values.keys()] } as unknown as VSCode.Memento;
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
  return { values, webview, postMessage, update, receive: (message: unknown) => receive(message), dispose, close: () => onDispose() };
}

it.each(['stringle', legacy])('migrates legacy save %j once while retaining the original', async saved => {
  const app = provider(saved);
  await app.receive({ type: 'ready' });
  const expected = typeof saved === 'string' ? { ...legacy, addedAt: null } : legacy;
  expect(app.values.get('shelfPlants')).toEqual([expected]);
  expect(app.values.get('selectedPlant')).toEqual(saved);
  await app.receive({ type: 'ready' });
  expect(app.update).toHaveBeenCalledOnce();
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'shelfState', plants: [expected] });
});
it('preserves legacy data on failed migration and can retry', async () => {
  const app = provider(legacy, true);
  await app.receive({ type: 'ready' });
  expect(app.values.get('selectedPlant')).toEqual(legacy);
  expect(app.values.has('shelfPlants')).toBe(false);
  expect(app.postMessage).toHaveBeenCalledWith({ type: 'shelfState', plants: [legacy] });
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'saveError' });
  const retry = provider(app.values.get('selectedPlant'));
  await retry.receive({ type: 'ready' });
  expect(retry.values.get('shelfPlants')).toEqual([legacy]);
});
it('serializes overlapping additions, rejects duplicates, and preserves order and dates', async () => {
  const app = provider(legacy);
  await Promise.all([
    app.receive({ type: 'addPlant', plantId: 'pricklepop' }),
    app.receive({ type: 'addPlant', plantId: 'pricklepop' }),
    app.receive({ type: 'addPlant', plantId: 'pebblebloom' }),
    app.receive({ type: 'addPlant', plantId: 'stringle' }),
  ]);
  const saved = app.values.get('shelfPlants') as SavedPlant[];
  expect(saved.map(plant => plant.id)).toEqual(['stringle', 'pricklepop', 'pebblebloom']);
  expect(saved[0]).toEqual(legacy);
  expect(saved[1]?.addedAt).toEqual(expect.any(String));
  expect(app.update).toHaveBeenCalledTimes(2);
  const restored = provider(undefined, false, saved);
  await restored.receive({ type: 'ready' });
  expect(restored.postMessage).toHaveBeenLastCalledWith({ type: 'shelfState', plants: saved });
  expect(restored.update).not.toHaveBeenCalled();
});
it('does not publish additions when persistence fails', async () => {
  const app = provider(undefined, true, [legacy]);
  await app.receive({ type: 'addPlant', plantId: 'pricklepop' });
  expect(app.values.get('shelfPlants')).toEqual([legacy]);
  expect(app.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'saveError' });
});
it('rejects unsupported commands and protects invalid collection saves', async () => {
  const app = provider(undefined, false, [legacy, legacy]);
  await app.receive({ type: 'addPlant', plantId: 'dangleleaf' });
  await app.receive({ type: 'addPlant', plantId: 'pricklepop' });
  expect(app.update).not.toHaveBeenCalled();
  expect(app.values.get('shelfPlants')).toEqual([legacy, legacy]);
  expect(app.postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'saveError' });
});
it('retains CSP and resource restrictions and disposes listeners', () => {
  const app = provider();
  expect(app.webview.html).toContain("default-src 'none'");
  expect(app.webview.html).toMatch(/script-src 'nonce-[a-f0-9]+'/);
  expect(app.webview.html).not.toContain('unsafe-inline');
  expect(app.webview.options).toMatchObject({ enableScripts: true, localResourceRoots: expect.any(Array) });
  app.close();
  expect(app.dispose).toHaveBeenCalledOnce();
});

it('waits for an in-flight save and continues processing after a failure', async () => {
  const app = provider();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  app.update.mockImplementationOnce(async () => { await gate; throw new Error('Save failed'); });
  const first = app.receive({ type: 'addPlant', plantId: 'stringle' });
  const second = app.receive({ type: 'addPlant', plantId: 'pricklepop' });
  await Promise.resolve();
  expect(app.update).toHaveBeenCalledOnce();
  expect(app.postMessage).not.toHaveBeenCalled();
  release();
  await Promise.all([first, second]);
  expect(app.postMessage).toHaveBeenCalledWith({ type: 'saveError' });
  expect(app.values.get('shelfPlants')).toEqual([expect.objectContaining({ id: 'pricklepop' })]);
});
