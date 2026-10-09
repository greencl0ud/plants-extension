import { describe, expect, it } from 'vitest';
import { isShelfMessage, isWebviewMessage } from '../src/shared/plants.js';
import { isBootstrapData, parseBootstrap, serializeBootstrap } from '../src/shared/bootstrap.js';

export const assets = {
  shelf: 'https://file+.vscode-resource.vscode-cdn.net/shelf.svg',
  background: 'https://file+.vscode-resource.vscode-cdn.net/background.svg',
  plants: {
    stringle: 'https://file+.vscode-resource.vscode-cdn.net/stringle.svg',
    dangleleaf: 'https://file+.vscode-resource.vscode-cdn.net/dangleleaf.svg',
  },
};

describe('message boundaries', () => {
  it('accepts supported commands and responses', () => {
    expect(isWebviewMessage({ type: 'ready' })).toBe(true);
    expect(isWebviewMessage({ type: 'selectPlant', plantId: 'stringle' })).toBe(true);
    expect(isShelfMessage({ type: 'shelfState', plantId: null })).toBe(true);
    expect(isShelfMessage({ type: 'shelfState', plantId: 'stringle' })).toBe(true);
    expect(isShelfMessage({ type: 'saveError' })).toBe(true);
  });
  it.each([null, [], {}, 'ready', { type: 'unknown' }, { type: 'selectPlant', plantId: 'dangleleaf' }, { type: 'shelfState' }])('rejects malformed payload %j', (value) => {
    expect(isWebviewMessage(value)).toBe(false);
    expect(isShelfMessage(value)).toBe(false);
  });
});

describe('bootstrap data', () => {
  it('round trips attribute-sensitive content without injecting HTML', () => {
    const data = { ...assets, shelf: assets.shelf + '?value="<&\'>' };
    const container = document.createElement('div');
    container.innerHTML = `<div data-bootstrap="${serializeBootstrap(data)}"></div>`;
    expect(container.children).toHaveLength(1);
    expect(parseBootstrap((container.firstElementChild as HTMLElement).dataset.bootstrap!)).toEqual(data);
  });
  it.each([null, {}, { ...assets, shelf: 'javascript:alert(1)' }, { ...assets, background: 'https://example.com/image.svg' }, { ...assets, plants: {} }])('rejects invalid data %j', (value) => {
    expect(isBootstrapData(value)).toBe(false);
    expect(() => parseBootstrap(JSON.stringify(value))).toThrow();
  });
});
