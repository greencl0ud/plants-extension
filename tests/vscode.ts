import type { Uri as VSCodeUri } from 'vscode';

// Test-only replacement for the module supplied by the VS Code host.
export const Uri = {
  joinPath(base: VSCodeUri, ...parts: string[]) {
    const path = `${base.toString()}/${parts.join('/')}`;
    return { toString: () => path, fsPath: path };
  },
};
