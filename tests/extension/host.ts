// Executed by the real Extension Development Host, not the Vitest vscode mock.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import * as vscode from 'vscode';

export async function run(): Promise<void> {
  const directory = process.env.CODE_PLANTS_TEST_SESSION;
  assert.ok(directory, 'Missing isolated test session');
  try {
    const extension = vscode.extensions.all.find(item => item.packageJSON.name === 'code-plants');
    assert.ok(extension, 'Code Plants must be installed in the development host');
    await extension.activate();
    assert.equal(extension.isActive, true);
    for (let attempt = 0; ; attempt++) {
      try { await fs.access(path.join(directory, 'attached')); break; } catch {
        assert.ok(attempt < 90, 'Timed out waiting for browser automation');
        await delay(500);
      }
    }
    await vscode.commands.executeCommand('codePlants.shelf.focus');
    await fs.writeFile(path.join(directory, 'ready'), 'Activation and reveal passed');
    // Keep the test host alive while the parent exercises the real webview.
    for (let attempt = 0; attempt < 180; attempt++) {
      try {
        await fs.access(path.join(directory, 'finish'));
        return;
      } catch {
        await delay(500);
      }
    }
    throw new Error('Timed out waiting for the webview smoke test');
  } catch (error) {
    await fs.writeFile(path.join(directory, 'host-error.txt'), error instanceof Error ? error.stack ?? error.message : String(error));
    throw error;
  }
}
