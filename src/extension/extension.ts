import * as vscode from 'vscode';
import { ShelfViewProvider } from './ShelfViewProvider.js';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ShelfViewProvider.viewType,
      new ShelfViewProvider(context.extensionUri, context.workspaceState),
    ),
  );
}
