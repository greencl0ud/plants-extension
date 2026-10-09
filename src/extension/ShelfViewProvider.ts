import { randomBytes } from 'node:crypto';
import { serializeBootstrap, type BootstrapData } from '../shared/bootstrap.js';
import * as vscode from 'vscode';
import { dangleleaf, isWebviewMessage, stringle, type ShelfMessage } from '../shared/plants.js';

export class ShelfViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codePlants.shelf';

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceState: vscode.Memento,
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    const webview = view.webview;
    const sendState = async (): Promise<void> => {
      const saved = this.workspaceState.get<unknown>('selectedPlant');
      const message: ShelfMessage = {
        type: 'shelfState', plantId: saved === stringle.id ? stringle.id : null,
      };
      await webview.postMessage(message);
    };
    const listener = webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isWebviewMessage(message)) return;
      if (message.type === 'selectPlant') {
        try {
          await this.workspaceState.update('selectedPlant', message.plantId);
        } catch {
          const error: ShelfMessage = { type: 'saveError' };
          await webview.postMessage(error);
          return;
        }
      }
      await sendState();
    });
    view.onDidDispose(() => listener.dispose());
    const bundleRoot = vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview');
    const shelfRoot = vscode.Uri.joinPath(this.extensionUri, 'assets', 'shelves');
    const backgroundRoot = vscode.Uri.joinPath(this.extensionUri, 'assets', 'backgrounds');
    const plantRoot = vscode.Uri.joinPath(this.extensionUri, 'assets', 'plants');
    webview.options = {
      enableScripts: true,
      localResourceRoots: [bundleRoot, shelfRoot, backgroundRoot, plantRoot],
    };

    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(bundleRoot, 'main.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(bundleRoot, 'main.css'));
    const shelfUri = webview.asWebviewUri(vscode.Uri.joinPath(shelfRoot, 'shelf.svg'));
    const plantUri = webview.asWebviewUri(vscode.Uri.joinPath(plantRoot, stringle.artwork));
    const dangleleafUri = webview.asWebviewUri(vscode.Uri.joinPath(plantRoot, dangleleaf.artwork));
    const backgroundUri = webview.asWebviewUri(
      vscode.Uri.joinPath(backgroundRoot, 'funky-wallpaper.svg'),
    );
    const nonce = randomBytes(16).toString('hex');
    const bootstrap: BootstrapData = {
      shelf: shelfUri.toString(), background: backgroundUri.toString(),
      plants: { stringle: plantUri.toString(), dangleleaf: dangleleafUri.toString() },
    };

    webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>Plant Shelf</title>
</head>
<body>
  <div id="root" data-bootstrap="${serializeBootstrap(bootstrap)}"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
