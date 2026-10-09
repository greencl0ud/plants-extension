export interface BootstrapData {
  shelf: string;
  background: string;
  plants: { stringle: string; dangleleaf: string };
}

function isAssetUri(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.endsWith('.vscode-resource.vscode-cdn.net');
  } catch {
    return false;
  }
}

export function isBootstrapData(value: unknown): value is BootstrapData {
  return typeof value === 'object' && value !== null
    && 'shelf' in value && isAssetUri(value.shelf)
    && 'background' in value && isAssetUri(value.background)
    && 'plants' in value && typeof value.plants === 'object' && value.plants !== null
    && 'stringle' in value.plants && isAssetUri(value.plants.stringle)
    && 'dangleleaf' in value.plants && isAssetUri(value.plants.dangleleaf);
}

// JSON is stored in a double-quoted HTML attribute, never executable script.
export function serializeBootstrap(data: BootstrapData): string {
  return JSON.stringify(data).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
}

export function parseBootstrap(serialized: string): BootstrapData {
  const value: unknown = JSON.parse(serialized);
  if (!isBootstrapData(value)) throw new Error('Invalid shelf artwork configuration.');
  return value;
}
