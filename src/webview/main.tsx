import './tokens.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { parseBootstrap } from '../shared/bootstrap.js';
import type { WebviewMessage } from '../shared/plants.js';
import { createMessaging } from './messaging.js';
import { App } from './components/App.js';

declare function acquireVsCodeApi(): { postMessage(message: WebviewMessage): void };
const root = document.getElementById('root');
if (!root) throw new Error('Missing shelf root.');
try {
  const assets = parseBootstrap(root.dataset.bootstrap ?? '');
  const messaging = createMessaging(acquireVsCodeApi(), window);
  createRoot(root).render(<StrictMode><App assets={assets} messaging={messaging} /></StrictMode>);
} catch {
  root.setAttribute('role', 'alert');
  root.textContent = 'Could not load the plant shelf. Please reload the window.';
}
