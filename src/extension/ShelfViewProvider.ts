import { randomBytes } from 'node:crypto';
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
  <main id="shelf" aria-label="Plant Shelf">
    <div class="shelf-display">
      <img class="background-art" src="${backgroundUri}" alt="" width="800" height="500" draggable="false">
    <div class="shelf-stage">
      <div class="scene-window">
        <div class="shelf-scene">
          <img class="shelf-art" src="${shelfUri}" alt="A wooden plant shelf" width="800" height="500" draggable="false">
          <img id="shelf-plant" class="shelf-plant" src="${plantUri}" alt="${stringle.name}, a small two-leaf plant in a terracotta pot" width="128" height="192" draggable="false" hidden>
        </div>
      </div>
    </div>
    <footer class="shelf-actions">
      <button id="add-plant" type="button" aria-haspopup="dialog">Add <span aria-hidden="true">+</span></button>
    </footer>
    </div>
  </main>
  <p id="shelf-status" class="visually-hidden" role="status"></p>
  <dialog id="plant-dialog" aria-labelledby="plant-dialog-title">
    <div class="dialog-content">
      <header class="dialog-header">
        <h1 id="plant-dialog-title">Plants</h1>
        <button id="close-dialog" type="button" autofocus>Close</button>
      </header>
      <ul class="plant-list">
        <li>
          <button id="select-plant" class="plant-card" type="button" disabled>
            <span class="plant-preview">
              <img src="${plantUri}" alt="A small two-leaf plant in a terracotta pot" width="128" height="192" draggable="false">
            </span>
            <span class="plant-name">${stringle.name}</span>
            <span id="plant-status">Loading shelf…</span>
          </button>
        </li>
        <li>
          <article class="plant-card plant-card-unavailable" aria-labelledby="dangleleaf-name">
            <span class="plant-preview">
              <img src="${dangleleafUri}" alt="A small plant with a heart-shaped leaf in a terracotta pot" width="128" height="192" draggable="false">
            </span>
            <h2 id="dangleleaf-name" class="plant-name">${dangleleaf.name}</h2>
            <span class="availability-badge"><span class="availability-full">Not available yet</span><span class="availability-compact">Unavailable</span></span>
          </article>
        </li>
      </ul>
      <p id="selection-error" role="status"></p>
    </div>
  </dialog>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
