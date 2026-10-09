import type { Uri as VSCodeUri } from 'vscode';

// Test-only replacement for the module supplied by the VS Code host.
export const Uri = {
  joinPath(base: VSCodeUri, ...parts: string[]) {
    return { toString: () => `${base.toString()}/${parts.join('/')}` };
  },
};
