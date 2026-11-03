import { randomBytes } from 'node:crypto';
import { serializeBootstrap, type BootstrapData } from '../shared/bootstrap.js';
import * as vscode from 'vscode';
import { plants, isWebviewMessage, type ShelfMessage } from '../shared/plants.js';

import { addPlant, feedPlant, getFeedRejection, creditMinute, presentPlant, resetAllowance, type Garden } from '../shared/care.js';
import type { GardenStore } from './GardenStore.js';

export class ShelfViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codePlants.shelf';
  private pending: Promise<void> = Promise.resolve();
  private views = new Set<vscode.Webview>();
  private credits = new Set<number>();
  private retrying = false;
  private earningFailed = false;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly store: GardenStore,
  ) {}

  private async publish(garden: Garden): Promise<void> {
    const now = Date.now();
    const response: ShelfMessage = { type: 'shelfState',
      plants: garden.plants.map(plant => presentPlant(plant, now)),
      care: { food: garden.food, editingMinutes: garden.editingMinutes, earnedToday: garden.earnedToday } };
    await Promise.all([...this.views].map(view => view.postMessage(response)));
    if (this.earningFailed) await this.broadcast({ type: 'earningError' });
  }
  private async broadcast(message: ShelfMessage): Promise<void> {
    await Promise.all([...this.views].map(view => view.postMessage(message)));
  }
  private enqueue(work: () => Promise<void>): Promise<void> {
    const operation = this.pending.catch(() => {}).then(work);
    this.pending = operation;
    return operation;
  }
  private async transact(change: (garden: Garden) => Garden): Promise<Garden> {
    // Drain unsaved credit before advancing the calendar or spending food.
    const times = [...this.credits].sort((a, b) => a - b);
    try {
      const garden = await this.store.transact(garden => change(times.reduce(creditMinute, garden)));
      times.forEach(time => this.credits.delete(time));
      this.earningFailed = false;
      return garden;
    } catch (error) {
      if (times.length) this.earningFailed = true;
      throw error;
    }
  }
  public async refresh(): Promise<void> {
    await this.enqueue(async () => {
      try { await this.publish(await this.transact(garden => resetAllowance(garden, Date.now()))); }
      catch { await this.broadcast({ type: this.earningFailed ? 'earningError' : 'saveError' }); }
    });
  }
  public credit(now: number): void {
    // Preserve the first edit time in each fixed minute while a save retries.
    if (![...this.credits].some(time => Math.floor(time / 60000) === Math.floor(now / 60000))) this.credits.add(now);
    void this.retryCredits();
  }
  public async retryCredits(): Promise<void> {
    if (this.retrying || this.credits.size === 0) return;
    this.retrying = true;
    try {
      await this.enqueue(async () => {
        try {
          const garden = await this.transact(garden => garden);
          await this.publish(garden);
        } catch {
          this.earningFailed = true;
          await this.broadcast({ type: 'earningError' });
        }
      });
    } finally { this.retrying = false; }
  }
  public resolveWebviewView(view: vscode.WebviewView): void {
    const webview = view.webview;
    this.views.add(webview);
    const listener = webview.onDidReceiveMessage(async (message: unknown) => {
      if (!isWebviewMessage(message)) return;
      await this.enqueue(async () => {
        try {
          const now = Date.now();
          let feedResult: Extract<ShelfMessage, { type: 'feedResult' }> | undefined;
          const garden = await this.transact(saved => {
            const current = resetAllowance(saved, now);
            if (message.type === 'addPlant') return addPlant(current, message.plantId, now);
            if (message.type === 'feedPlant') {
              const rejection = getFeedRejection(current, message.plantId, now);
              feedResult = { type: 'feedResult', plantId: message.plantId, outcome: rejection ?? 'fed' };
              return feedPlant(current, message.plantId, now);
            }
            return current;
          });
          await this.publish(garden);
          // Operation results belong to the requesting view, not other views with stale state.
          if (feedResult) await webview.postMessage(feedResult);
        } catch { await webview.postMessage({ type: 'saveError' } satisfies ShelfMessage); }
      });
    });
    view.onDidDispose(() => { listener.dispose(); this.views.delete(webview); });
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
