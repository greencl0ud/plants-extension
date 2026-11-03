import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { FileGardenStore, migrateLegacyGarden } from '../src/extension/GardenStore.js';
import { addPlant, creditMinute, feedPlant, migrateGarden } from '../src/shared/care.js';
const folders: string[] = [];
afterEach(async () => { await Promise.all(folders.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function location() { const folder = await mkdtemp(join(tmpdir(), 'code-plants-')); folders.push(folder); return join(folder, 'garden.json'); }
const now = Date.now();
it('coordinates independent window stores and survives reload without duplicate minute credit or lost spending', async () => {
  const path = await location();
  const initial = () => ({ ...addPlant(migrateGarden([], now), 'stringle', now), food: 1 });
  const a = new FileGardenStore(path, initial);
  const b = new FileGardenStore(path, initial);
  await Promise.all([a.transact(g => creditMinute(g, now)), b.transact(g => creditMinute(g, now))]);
  await Promise.all([a.transact(g => feedPlant(g, 'stringle', now)), b.transact(g => feedPlant(g, 'stringle', now))]);
  const reloaded = new FileGardenStore(path, () => { throw new Error('Must not remigrate'); });
  const garden = await reloaded.transact(g => creditMinute(g, now));
  expect(garden).toMatchObject({ food: 0, editingMinutes: 1, plants: [{ growthPoints: 1 }] });
});
it('preserves an existing save when a transaction fails and can retry', async () => {
  const path = await location();
  const store = new FileGardenStore(path, () => migrateGarden([], now));
  await store.transact(g => g);
  const before = await readFile(path, 'utf8');
  await expect(store.transact(() => { throw new Error('failure'); })).rejects.toThrow('failure');
  expect(await readFile(path, 'utf8')).toBe(before);
  expect((await store.transact(g => creditMinute(g, now))).editingMinutes).toBe(1);
});
it('refuses to overwrite malformed saved data', async () => {
  const path = await location();
  await writeFile(path, '{broken');
  const store = new FileGardenStore(path, () => migrateGarden([], now));
  await expect(store.transact(g => creditMinute(g, now))).rejects.toThrow();
  expect(await readFile(path, 'utf8')).toBe('{broken');
});

it('migrates collection and legacy saves once, retains the old keys, and protects invalid collections', async () => {
  const original = { id: 'stringle', addedAt: '2026-10-01T00:00:00.000Z', stage: 'Seedling', health: { label: 'Thriving', value: 80 } };
  for (const values of [new Map<string, unknown>([['selectedPlant', 'stringle']]),
    new Map<string, unknown>([['selectedPlant', original]]),
    new Map<string, unknown>([['shelfPlants', [original]]])]) {
    const state = { get: (key: string) => values.get(key) } as import('vscode').Memento;
    const garden = migrateLegacyGarden(state, now);
    const path = await location();
    await new FileGardenStore(path, () => garden).transact(g => g);
    const restored = await new FileGardenStore(path, () => { throw new Error('No second migration'); }).transact(g => g);
    expect(restored.plants[0]).toMatchObject({ id: 'stringle', growthPoints: 0, careStartedAt: now });
    expect(values.size).toBe(1);
    if (values.has('shelfPlants')) expect(restored.plants[0]?.addedAt).toBe(original.addedAt);
  }
  const invalid = { get: () => [original, original] } as unknown as import('vscode').Memento;
  expect(() => migrateLegacyGarden(invalid, now)).toThrow('Invalid saved shelf');
});

it('retries an older failed window credit after another window saves a newer minute', async () => {
  const { ShelfViewProvider } = await import('../src/extension/ShelfViewProvider.js');
  const path = await location();
  const first = new Date(2026, 10, 3, 10).getTime();
  const a = new FileGardenStore(path, () => migrateGarden([], first));
  const b = new FileGardenStore(path, () => migrateGarden([], first));
  const uri = {} as import('vscode').Uri;
  let fail = true;
  let notifyFailure = () => {};
  const failed = new Promise<void>(resolve => { notifyFailure = resolve; });
  const windowA = new ShelfViewProvider(uri, { async transact(change) {
    if (fail) { notifyFailure(); throw new Error('Disk unavailable'); }
    return a.transact(change);
  } });
  const windowB = new ShelfViewProvider(uri, b);
  windowA.credit(first);
  await failed;
  windowB.credit(first + 60000);
  await windowB.refresh();
  fail = false;
  await windowA.refresh();
  const reloaded = new FileGardenStore(path, () => { throw new Error('Must restore'); });
  expect((await reloaded.transact(g => g)).editingMinutes).toBe(2);
  windowA.credit(first + 1000);
  windowB.credit(first + 61000);
  await Promise.all([windowA.refresh(), windowB.refresh()]);
  expect((await reloaded.transact(g => g)).editingMinutes).toBe(2);
});

it('preserves yesterday\'s cap when an independent window advances the calendar', async () => {
  const path = await location();
  const midnight = new Date(2026, 10, 4).getTime();
  const previous = midnight - 60000;
  const a = new FileGardenStore(path, () => ({ ...migrateGarden([], previous), earnedToday: 12 }));
  const b = new FileGardenStore(path, () => { throw new Error('Must restore'); });
  await a.transact(g => g);
  await b.transact(g => creditMinute(g, midnight));
  const { resetAllowance } = await import('../src/shared/care.js');
  await b.transact(g => resetAllowance(g, midnight + 86400000));
  await a.transact(g => creditMinute(g, previous));
  const restored = await new FileGardenStore(path, () => { throw new Error('Must restore'); }).transact(g => g);
  expect(restored).toMatchObject({ food: 0, editingMinutes: 1, earnedToday: 0 });
});
