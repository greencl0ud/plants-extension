import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ShelfScene } from '../src/webview/components/ShelfScene.js';
import { INITIAL_HEALTH, type SavedPlant } from '../src/shared/plants.js';

const plants: SavedPlant[] = ['stringle', 'pricklepop', 'pebblebloom'].map(id => ({
  id: id as SavedPlant['id'], addedAt: null, stage: 'Seedling', health: INITIAL_HEALTH,
}));
const assets = { shelf: '/shelf.svg', background: '/wall.svg', plants: { stringle: '/stringle.svg', dangleleaf: '/dangleleaf.svg', pricklepop: '/pricklepop.svg', pebblebloom: '/pebblebloom.svg' } };
it('supports arrow and endpoint navigation without intercepting plant keys', () => {
  render(<ShelfScene assets={assets} plants={plants} />);
  const area = screen.getByRole('region', { name: 'Plants on your shelf' });
  Object.defineProperties(area, { scrollWidth: { value: 312 }, clientWidth: { value: 160 } });
  fireEvent.keyDown(area, { key: 'ArrowRight' });
  expect(area.scrollLeft).toBe(80);
  fireEvent.keyDown(area, { key: 'End' });
  expect(area.scrollLeft).toBe(152);
  fireEvent.keyDown(area, { key: 'ArrowLeft' });
  expect(area.scrollLeft).toBe(72);
  fireEvent.keyDown(area, { key: 'Home' });
  expect(area.scrollLeft).toBe(0);
  fireEvent.keyDown(screen.getByRole('button', { name: /View information about Stringle/ }), { key: 'End' });
  expect(area.scrollLeft).toBe(0);
});
it('closes a card only when its plant moves completely outside the shelf viewport', () => {
  render(<ShelfScene assets={assets} plants={plants} />);
  const area = screen.getByRole('region', { name: 'Plants on your shelf' });
  const trigger = screen.getByRole('button', { name: /View information about Stringle/ });
  vi.spyOn(area, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 160, 300));
  const bounds = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(-20, 0, 88, 132));
  fireEvent.click(trigger);
  fireEvent.scroll(area);
  expect(screen.getByRole('region', { name: 'Stringle' })).toBeTruthy();
  bounds.mockReturnValue(new DOMRect(-100, 0, 88, 132));
  fireEvent.scroll(area);
  expect(screen.queryByRole('region', { name: 'Stringle' })).toBeNull();
});
it('centres initially but preserves a user scroll when the viewport resizes', () => {
  let resized = () => {};
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resized = callback; }
    observe() {}
    disconnect = disconnect;
  });
  try {
    const view = render(<ShelfScene assets={assets} plants={plants} />);
    const area = screen.getByRole('region', { name: 'Plants on your shelf' });
    Object.defineProperties(area, { scrollWidth: { value: 312 }, clientWidth: { value: 160 } });
    act(() => resized());
    expect(area.scrollLeft).toBe(76);
    area.scrollLeft = 20;
    fireEvent.scroll(area);
    act(() => resized());
    expect(area.scrollLeft).toBe(20);
    view.unmount();
    expect(disconnect).toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
