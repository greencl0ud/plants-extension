import * as vscode from 'vscode';
import { ShelfViewProvider } from './ShelfViewProvider.js';
import { FileGardenStore, migrateLegacyGarden, type GardenStore } from './GardenStore.js';
import { isGarden, type Garden } from '../shared/care.js';

export function activate(context: vscode.ExtensionContext): void {
  // storageUri is shared by windows opening the same workspace. The UI extension
  // keeps this local even when workspace documents are on a remote host.
  const storage = context.storageUri;
  const initial = () => migrateLegacyGarden(context.workspaceState, Date.now());
  const store: GardenStore = storage
    ? new FileGardenStore(vscode.Uri.joinPath(storage, 'garden-v1.json').fsPath, initial)
    : { async transact(change) {
      const saved = context.workspaceState.get<unknown>('gardenV1');
      if (saved !== undefined && !isGarden(saved)) throw new Error('Invalid garden save');
      const garden = saved === undefined ? initial() : saved as Garden;
      const next = change(garden);
      if (saved === undefined || next !== garden) await context.workspaceState.update('gardenV1', next);
      return next;
    } };
  const provider = new ShelfViewProvider(context.extensionUri, store);
  const timer = setInterval(() => { void provider.retryCredits(); void provider.refresh(); }, 15000);
  context.subscriptions.push(
    { dispose: () => clearInterval(timer) },
    vscode.window.registerWebviewViewProvider(ShelfViewProvider.viewType, provider),
    vscode.workspace.onDidChangeTextDocument(event => {
      if (vscode.window.state.focused && !event.document.isUntitled
        && event.contentChanges.some(change => change.rangeLength > 0 || change.text.length > 0)
        && vscode.workspace.getWorkspaceFolder(event.document.uri)) provider.credit(Date.now());
    }),
    vscode.window.onDidChangeWindowState(state => { if (state.focused) void provider.refresh(); }),
  );
}
