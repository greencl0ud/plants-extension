import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { PlantInfoCard } from '../src/webview/components/PlantInfoCard.js';
import { INITIAL_HEALTH, type SavedPlant } from '../src/shared/plants.js';

const plant: SavedPlant = { id: 'stringle', addedAt: null, stage: 'Seedling', health: INITIAL_HEALTH };
function Info({ value = plant }: { value?: SavedPlant }) {
  const [open, setOpen] = useState(false);
  return <><PlantInfoCard plant={value} artwork="/plant.svg" open={open} onOpenChange={setOpen} />
    <button type="button">Outside action</button></>;
}
function setup(value = plant) {
  const view = render(<Info value={value} />);
  return { ...view, trigger: screen.getByRole('button', { name: /^View information about/  }) };
}
it('does not open on hover or focus alone', async () => {
  const user = userEvent.setup();
  const { trigger } = setup();
  await user.hover(trigger);
  expect(screen.queryByRole('region')).toBeNull();
  act(() => trigger.focus());
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole('region')).toBeNull();
});
it('opens on click with plant metadata and remains open after the pointer leaves', async () => {
  const user = userEvent.setup();
  const { trigger } = setup({ ...plant, addedAt: '2026-10-09T12:00:00.000Z' });
  await user.click(trigger);
  expect(screen.getByRole('region', { name: 'Stringle' })).toBeTruthy();
  expect(screen.getByText(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date('2026-10-09T12:00:00.000Z')))).toBeTruthy();
  expect(screen.getByText('Seedling')).toBeTruthy();
  expect(screen.getByRole('meter', { name: 'Health' }).getAttribute('aria-valuetext')).toBe('Thriving');
  await user.unhover(trigger);
  expect(screen.getByRole('region')).toBeTruthy();
  await user.click(trigger);
  expect(screen.queryByRole('region')).toBeNull();
});
it('keeps clicks inside the card open and closes on an outside click without stealing focus', async () => {
  const user = userEvent.setup();
  const { trigger } = setup();
  await user.click(trigger);
  await user.click(screen.getByText('unknown'));
  expect(screen.getByRole('region')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Outside action' }));
  expect(screen.queryByRole('region')).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Outside action' }));
});
it.each(['{Enter}', ' '])('supports keyboard activation with %s', async key => {
  const user = userEvent.setup();
  const { trigger } = setup();
  act(() => trigger.focus());
  await user.keyboard(key);
  expect(screen.getByRole('region')).toBeTruthy();
  expect(document.activeElement).toBe(trigger);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('region')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
it('restores trigger focus when Escape dismisses a focused card without reopening', async () => {
  const user = userEvent.setup();
  const { trigger } = setup();
  await user.click(trigger);
  act(() => screen.getByRole('region').focus());
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('region')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await user.hover(trigger);
  expect(screen.queryByRole('region')).toBeNull();
});
it('removes document listeners when an open card unmounts', async () => {
  const user = userEvent.setup();
  const remove = vi.spyOn(document, 'removeEventListener');
  const view = setup();
  await user.click(view.trigger);
  view.unmount();
  expect(remove).toHaveBeenCalledWith('click', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
  fireEvent.click(document.body);
  expect(screen.queryByRole('region')).toBeNull();
});

it('does not open when clicking the transparent space above the plant', () => {
  setup();
  const image = screen.getByRole('img', { name: /Stringle/ });
  // Original SVG frame: 128 × 192. Artwork starts below y=120.
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 128, 192));
  fireEvent.click(image, { clientX: 64, clientY: 100, detail: 1 });
  expect(screen.queryByRole('region', { name: 'Stringle' })).toBeNull();
});

it.each(['stringle', 'pricklepop', 'pebblebloom'] as const)('excludes transparent margins for %s at different scales', id => {
  setup({ ...plant, id });
  const image = screen.getByRole('img');
  const bounds = vi.spyOn(image, 'getBoundingClientRect');
  for (const scale of [0.5, 1, 2]) {
    bounds.mockReturnValue(new DOMRect(10, 20, 128 * scale, 192 * scale));
    fireEvent.click(image, { clientX: 10 + 64 * scale, clientY: 20 + 80 * scale, detail: 1 });
    expect(screen.queryByRole('region')).toBeNull();
    fireEvent.click(image, { clientX: 10 + 64 * scale, clientY: 20 + 170 * scale, detail: 1 });
    expect(screen.getByRole('region')).toBeTruthy();
    fireEvent.click(image, { clientX: 10 + 15 * scale, clientY: 20 + 170 * scale, detail: 1 });
    expect(screen.queryByRole('region')).toBeNull();
  }
});

it.each(['stringle', 'pricklepop', 'pebblebloom'] as const)('shows a pointer only over %s artwork', id => {
  const { trigger } = setup({ ...plant, id });
  const image = screen.getByRole('img');
  vi.spyOn(image, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, 20, 64, 96));
  const move = (x: number, y: number) => fireEvent(image, new MouseEvent('pointermove', {
    bubbles: true, clientX: 10 + x / 2, clientY: 20 + y / 2,
  }));
  move(64, 80);
  expect(getComputedStyle(trigger).cursor).toBe('default');
  move(64, 170);
  expect(getComputedStyle(trigger).cursor).toBe('pointer');
  move(15, 170);
  expect(getComputedStyle(trigger).cursor).toBe('default');
  move(64, 170);
  fireEvent.pointerLeave(trigger);
  expect(getComputedStyle(trigger).cursor).toBe('default');
  expect(screen.queryByRole('region')).toBeNull();
});
