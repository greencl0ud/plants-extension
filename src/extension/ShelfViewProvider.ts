import { randomBytes } from 'node:crypto';
import { serializeBootstrap, type BootstrapData } from '../shared/bootstrap.js';
import * as vscode from 'vscode';
import { plants, INITIAL_HEALTH, restorePlant, isWebviewMessage, isSavedShelf, type SavedPlant, type ShelfMessage } from '../shared/plants.js';

export class ShelfViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codePlants.shelf';
  private pending: Promise<void> = Promise.resolve();

  private readShelf(): SavedPlant[] {
    const saved = this.workspaceState.get<unknown>('shelfPlants');
    if (saved !== undefined) {
      if (!isSavedShelf(saved)) throw new Error('Invalid saved shelf');
      return saved;
    }
    const legacy = restorePlant(this.workspaceState.get<unknown>('selectedPlant'));
    return legacy ? [legacy] : [];
  }


  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly workspaceState: vscode.Memento,
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    const webview = view.webview;
    const listener = webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isWebviewMessage(message)) return;
      // Serialize read-modify-write operations, including requests from replaced views.
      const previous = this.pending;
      let release = () => {};
      this.pending = new Promise<void>(resolve => { release = resolve; });
      await previous;
      try {
        let shelf = this.readShelf();
        const needsMigration = this.workspaceState.get<unknown>('shelfPlants') === undefined
          && shelf.length > 0;
        if (message.type === 'addPlant' && !shelf.some(plant => plant.id === message.plantId)) {
          const next: SavedPlant[] = [...shelf, {
            id: message.plantId, addedAt: new Date().toISOString(), stage: 'Seedling', health: INITIAL_HEALTH,
          }];
          await this.workspaceState.update('shelfPlants', next);
          shelf = next;
        } else if (needsMigration) {
          // Keep the legacy key intact, including when this write fails.
          await this.workspaceState.update('shelfPlants', shelf);
        }
        const response: ShelfMessage = { type: 'shelfState', plants: shelf };
        await webview.postMessage(response);
      } catch {
        if (message.type === 'ready') {
          try {
            const response: ShelfMessage = { type: 'shelfState', plants: this.readShelf() };
            await webview.postMessage(response);
          } catch { /* Do not overwrite an invalid save. */ }
        }
        const error: ShelfMessage = { type: 'saveError' };
        await webview.postMessage(error);
      } finally {
        release();
      }
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
    const backgroundUri = webview.asWebviewUri(
      vscode.Uri.joinPath(backgroundRoot, 'funky-wallpaper.svg'),
    );
    const nonce = randomBytes(16).toString('hex');
    const bootstrap: BootstrapData = {
      shelf: shelfUri.toString(), background: backgroundUri.toString(),
      plants: Object.fromEntries(plants.map(plant => [plant.id,
        webview.asWebviewUri(vscode.Uri.joinPath(plantRoot, plant.artwork)).toString(),
      ])) as BootstrapData['plants'],
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
