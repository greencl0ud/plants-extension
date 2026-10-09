import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PlantInfoCard } from '../src/webview/components/PlantInfoCard.js';
import { INITIAL_HEALTH, type SavedPlant } from '../src/shared/plants.js';

const plant: SavedPlant = { id: 'stringle', addedAt: null, stage: 'Seedling', health: INITIAL_HEALTH };
function setup(value = plant) {
  render(<PlantInfoCard plant={value} artwork="/plant.svg" />);
  return screen.getByRole('button', { name: 'View information about Stringle' });
}
afterEach(() => vi.useRealTimers());
it('delays hover, permits moving into the card, and closes after leaving', () => {
  vi.useFakeTimers();
  const trigger = setup();
  fireEvent.pointerEnter(trigger);
  act(() => vi.advanceTimersByTime(299));
  expect(screen.queryByRole('region')).toBeNull();
  act(() => vi.advanceTimersByTime(1));
  const card = screen.getByRole('region', { name: 'Stringle' });
  expect(screen.getByText('unknown')).toBeTruthy();
  expect(screen.getByRole('meter', { name: 'Health' }).getAttribute('aria-valuetext')).toBe('Thriving');
  fireEvent.pointerLeave(trigger);
  fireEvent.pointerEnter(card);
  act(() => vi.advanceTimersByTime(400));
  expect(screen.getByRole('region')).toBeTruthy();
  fireEvent.pointerLeave(card);
  act(() => vi.advanceTimersByTime(150));
  expect(screen.queryByRole('region')).toBeNull();
});
it('opens on focus without moving it, and suppresses reopening after Escape', () => {
  vi.useFakeTimers();
  const trigger = setup();
  act(() => trigger.focus());
  expect(document.activeElement).toBe(trigger);
  expect(screen.getByRole('region')).toBeTruthy();
  fireEvent.keyDown(trigger, { key: 'Escape' });
  fireEvent.pointerEnter(trigger);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.queryByRole('region')).toBeNull();
  act(() => trigger.blur());
  fireEvent.pointerLeave(trigger);
  fireEvent.pointerEnter(trigger);
  act(() => vi.advanceTimersByTime(300));
  expect(screen.getByRole('region')).toBeTruthy();
});
it('pins on click, toggles closed, and dismisses outside', () => {
  vi.useFakeTimers();
  const trigger = setup({ ...plant, addedAt: '2026-10-09T12:00:00.000Z' });
  fireEvent.click(trigger);
  fireEvent.pointerLeave(trigger);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole('region')).toBeTruthy();
  expect(screen.getByText(new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date('2026-10-09T12:00:00.000Z')))).toBeTruthy();
  fireEvent.click(trigger);
  expect(screen.queryByRole('region')).toBeNull();
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('region')).toBeNull();
});
it('cleans up pending hover when removed', () => {
  vi.useFakeTimers();
  const view = render(<PlantInfoCard plant={plant} artwork="/plant.svg" />);
  fireEvent.pointerEnter(screen.getByRole('button'));
  view.unmount();
  act(() => vi.advanceTimersByTime(500));
  expect(screen.queryByRole('region')).toBeNull();
});
it('keeps the card open for keyboard scrolling and restores focus on Escape', () => {
  vi.useFakeTimers();
  const trigger = setup();
  act(() => trigger.focus());
  const card = screen.getByRole('region');
  act(() => card.focus());
  act(() => vi.advanceTimersByTime(200));
  expect(screen.getByRole('region')).toBe(card);
  fireEvent.keyDown(card, { key: 'Escape' });
  expect(screen.queryByRole('region')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
