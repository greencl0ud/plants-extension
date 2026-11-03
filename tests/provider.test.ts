import { expect, it, vi } from 'vitest';
import type * as VSCode from 'vscode';
import { ShelfViewProvider } from '../src/extension/ShelfViewProvider.js';
import type { ShelfMessage } from '../src/shared/plants.js';
import type { GardenStore } from '../src/extension/GardenStore.js';
import { addPlant, migrateGarden, type Garden } from '../src/shared/care.js';

function provider(initial = migrateGarden([], Date.now()), store?: GardenStore) {
  let saved = initial;
  let receive: (message: unknown) => Promise<void> = async () => {};
  const dispose = vi.fn();
  let onDispose = () => {};
  const transact = vi.fn(async (change: (garden: Garden) => Garden) => { saved = change(saved); return saved; });
  const postMessage = vi.fn(async (message: ShelfMessage) => { void message; return true; });
  const webview = {
    options: {}, html: '', cspSource: 'https://*.vscode-cdn.net',
    asWebviewUri: (uri: VSCode.Uri) => ({ toString: () => `https://file+.vscode-resource.vscode-cdn.net/${uri.toString()}` }),
    postMessage,
    onDidReceiveMessage: (listener: typeof receive) => { receive = listener; return { dispose }; },
  };
  const view = { webview, onDidDispose: (listener: () => void) => { onDispose = listener; } };
  const instance = new ShelfViewProvider({ toString: () => 'extension' } as VSCode.Uri, store ?? { transact });
  instance.resolveWebviewView(view as unknown as VSCode.WebviewView);
  return { saved: () => saved, instance, webview, postMessage, transact, receive: (message: unknown) => receive(message), dispose, close: () => onDispose() };
}

it('serializes overlapping additions and preserves dates and uniqueness', async () => {
  const app = provider();
  await Promise.all(['stringle', 'pricklepop', 'pricklepop', 'pebblebloom'].map(plantId => app.receive({ type: 'addPlant', plantId })));
  expect(app.saved().plants.map(plant => plant.id)).toEqual(['stringle', 'pricklepop', 'pebblebloom']);
  expect(app.saved().plants.every(plant => plant.addedAt && plant.growthPoints === 0)).toBe(true);
  await app.receive({ type: 'ready' });
  expect(app.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'shelfState', care: { food: 0, editingMinutes: 0, earnedToday: 0 } }));
});
it('leaves food and growth unchanged after a failed feeding and allows retry', async () => {
  const garden = { ...addPlant(migrateGarden([], Date.now()), 'stringle', Date.now()), food: 1 };
  const app = provider(garden);
  app.transact.mockRejectedValueOnce(new Error('Disk full'));
  await app.receive({ type: 'feedPlant', plantId: 'stringle' });
  expect(app.saved()).toEqual(garden);
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'saveError' });
  await app.receive({ type: 'feedPlant', plantId: 'stringle' });
  expect(app.saved()).toMatchObject({ food: 0, plants: [{ growthPoints: 1 }] });
  expect(app.postMessage).toHaveBeenLastCalledWith({ type: 'feedResult', plantId: 'stringle', outcome: 'fed' });
});
it('retries failed editing credit and does not multiply a minute', async () => {
  const app = provider();
  app.transact.mockRejectedValueOnce(new Error('Disk full'));
  app.instance.credit(1800000000000);
  await app.instance.refresh();
  expect(app.postMessage).toHaveBeenCalledWith({ type: 'earningError' });
  await app.instance.retryCredits();
  expect(app.saved().editingMinutes).toBe(1);
  app.instance.credit(1800000000001);
  await app.instance.refresh();
  expect(app.saved().editingMinutes).toBe(1);
});
it('does not publish an addition on failed persistence and rejects unsupported commands', async () => {
  const app = provider();
  await app.receive({ type: 'feedPlant', plantId: 'dangleleaf' });
  expect(app.transact).not.toHaveBeenCalled();
  app.transact.mockRejectedValueOnce(new Error('Disk full'));
  await app.receive({ type: 'addPlant', plantId: 'stringle' });
  expect(app.saved().plants).toEqual([]);
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

it.each([
  { food: 1, growth: 0, rejected: 'noFood' },
  { food: 2, growth: 14, rejected: 'alreadyThriving' },
])('reports the actual result when stale windows race: $rejected', async ({ food, growth, rejected }) => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { FileGardenStore } = await import('../src/extension/GardenStore.js');
  const folder = await mkdtemp(join(tmpdir(), 'plants-feeding-'));
  try {
    const now = Date.now();
    const initial = addPlant({ ...migrateGarden([], now), food }, 'stringle', now);
    initial.plants[0]!.growthPoints = growth;
    const path = join(folder, 'garden.json');
    const a = provider(initial, new FileGardenStore(path, () => initial));
    const b = provider(initial, new FileGardenStore(path, () => initial));
    await Promise.all([a.receive({ type: 'ready' }), b.receive({ type: 'ready' })]);
    a.postMessage.mockClear(); b.postMessage.mockClear();
    await Promise.all([a.receive({ type: 'feedPlant', plantId: 'stringle' }), b.receive({ type: 'feedPlant', plantId: 'stringle' })]);
    const outcomes = [a, b].map(app => app.postMessage.mock.calls.at(-1)?.[0]);
    expect(outcomes).toEqual(expect.arrayContaining([
      { type: 'feedResult', plantId: 'stringle', outcome: 'fed' },
      { type: 'feedResult', plantId: 'stringle', outcome: rejected },
    ]));
    for (const app of [a, b]) {
      expect(app.postMessage.mock.calls.filter(([message]) => message.type === 'feedResult')).toHaveLength(1);
    }
    const saved = await new FileGardenStore(path, () => { throw new Error('Must restore'); }).transact(g => g);
    expect(saved.food).toBe(food - 1);
    expect(saved.plants[0]?.growthPoints).toBe(growth + 1);
  } finally { await rm(folder, { recursive: true, force: true }); }
});

it('sends feeding results only to the requesting view while refreshing all views', async () => {
  const now = Date.now();
  const a = provider({ ...addPlant(migrateGarden([], now), 'stringle', now), food: 1 });
  const b = provider();
  a.instance.resolveWebviewView({ webview: b.webview, onDidDispose: () => ({ dispose() {} }) } as unknown as VSCode.WebviewView);
  await a.receive({ type: 'feedPlant', plantId: 'stringle' });
  expect(a.postMessage).toHaveBeenLastCalledWith({ type: 'feedResult', plantId: 'stringle', outcome: 'fed' });
  expect(b.postMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ type: 'shelfState' }));
});
