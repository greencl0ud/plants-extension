import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type * as VSCode from 'vscode';
import { expect, it, vi } from 'vitest';

const host = vi.hoisted(() => ({
  focused: true,
  change: (event: unknown) => { void event; },
  register: vi.fn(),
}));
vi.mock('vscode', async importOriginal => ({
  ...await importOriginal<typeof import('vscode')>(),
  window: {
    get state() { return { focused: host.focused }; },
    registerWebviewViewProvider: host.register,
    onDidChangeWindowState: () => ({ dispose() {} }),
  },
  workspace: {
    getWorkspaceFolder: (uri: { inside: boolean }) => uri.inside ? {} : undefined,
    onDidChangeTextDocument: (listener: (event: unknown) => void) => { host.change = listener; return { dispose() {} }; },
  },
}));
import { activate } from '../src/extension/extension.js';
import type { ShelfViewProvider } from '../src/extension/ShelfViewProvider.js';
import { FileGardenStore } from '../src/extension/GardenStore.js';

it('credits only focused workspace text edits, including unsaved edits, before adding any plants', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'code-plants-activity-'));
  const subscriptions: VSCode.Disposable[] = [];
  const clock = vi.spyOn(Date, 'now').mockReturnValue(new Date(2026, 10, 3, 10).getTime());
  const context = { extensionUri: { toString: () => 'extension' }, storageUri: { toString: () => folder },
    workspaceState: { get: () => undefined }, subscriptions } as unknown as VSCode.ExtensionContext;
  try {
    activate(context);
    const provider = host.register.mock.calls.at(-1)![1] as ShelfViewProvider;
    const change = (inside = true, isUntitled = false, contentChanges = [{ rangeLength: 0, text: 'edit' }]) =>
      host.change({ document: { uri: { inside }, isUntitled }, contentChanges });
    host.focused = false; change();
    host.focused = true; change(false); change(true, true); change(true, false, []);
    change(true, false, [{ rangeLength: 0, text: '' }]);
    await provider.refresh();
    const reader = new FileGardenStore(join(folder, 'garden-v1.json'), () => { throw new Error('Expected existing save'); });
    expect((await reader.transact(g => g)).editingMinutes).toBe(0);
    for (let i = 0; i < 5; i++) {
      clock.mockReturnValue(new Date(2026, 10, 3, 10, i).getTime());
      change(true, false, [{ rangeLength: i % 2, text: i % 2 ? '' : 'paste or formatting' }]);
      change();
      await provider.refresh();
    }
    expect(await reader.transact(g => g)).toMatchObject({ food: 1, editingMinutes: 0, plants: [] });
  } finally {
    clock.mockRestore();
    subscriptions.forEach(item => item?.dispose());
    await rm(folder, { recursive: true, force: true });
  }
});
