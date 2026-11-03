import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import lockfile from 'proper-lockfile';
import { isGarden, migrateGarden, type Garden } from '../shared/care.js';

import type { Memento } from 'vscode';
import { isSavedShelf, restorePlant } from '../shared/plants.js';

export function migrateLegacyGarden(state: Memento, now: number): Garden {
  const saved = state.get<unknown>('shelfPlants');
  if (saved !== undefined) {
    if (!isSavedShelf(saved)) throw new Error('Invalid saved shelf');
    return migrateGarden(saved, now);
  }
  const legacy = restorePlant(state.get<unknown>('selectedPlant'));
  return migrateGarden(legacy ? [legacy] : [], now);
}

export interface GardenStore {
  transact(change: (garden: Garden) => Garden): Promise<Garden>;
}
// Every window reads inside the same lock. Atomic replacement keeps food and
// plant progress together, and leaves the previous save intact on write failure.
export class FileGardenStore implements GardenStore {
  private pending: Promise<unknown> = Promise.resolve();
  public constructor(private readonly path: string, private readonly initial: () => Garden) {}
  public transact(change: (garden: Garden) => Garden): Promise<Garden> {
    const operation = this.pending.catch(() => {}).then(async () => {
      await mkdir(dirname(this.path), { recursive: true });
      let compromised: Error | undefined;
      const release = await lockfile.lock(this.path, { realpath: false, stale: 10000, update: 2000,
        retries: { retries: 50, minTimeout: 100, maxTimeout: 300 },
        onCompromised: error => { compromised = error; } });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        let garden: Garden;
        let missing = false;
        try {
          const data: unknown = JSON.parse(await readFile(this.path, 'utf8'));
          if (!isGarden(data)) throw new Error('Invalid garden save');
          garden = data;
        } catch (error) {
          if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
          garden = this.initial();
          missing = true;
        }
        const next = change(garden);
        if (missing || next !== garden) {
          await writeFile(temporary, JSON.stringify(next), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
          if (compromised) throw compromised;
          await rename(temporary, this.path);
        }
        return next;
      } finally {
        await unlink(temporary).catch(() => {});
        await release();
      }
    });
    this.pending = operation;
    return operation;
  }
}
