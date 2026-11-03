import { describe, expect, it } from 'vitest';
import { addPlant, creditMinute, feedPlant, isGarden, localDate, migrateGarden, presentPlant, resetAllowance } from '../src/shared/care.js';

const now = new Date(2026, 9, 20, 10).getTime();
const week = 168 * 60 * 60 * 1000;
const empty = () => migrateGarden([], now);
const planted = () => addPlant(empty(), 'stringle', now);

describe('editing credit', () => {
  it('awards immediately on the fifth distinct minute and deduplicates across restoration', () => {
    let garden = empty();
    for (let i = 0; i < 5; i++) {
      garden = creditMinute(garden, now + i * 60000);
      const restored = JSON.parse(JSON.stringify(garden));
      expect(creditMinute(restored, now + i * 60000 + 1000)).toEqual(garden);
    }
    expect(garden).toMatchObject({ food: 1, editingMinutes: 0, earnedToday: 1, plants: [] });
  });
  it('counts adjacent fixed clock minutes even two seconds apart', () => {
    const first = creditMinute(empty(), now + 59000);
    expect(creditMinute(first, now + 61000).editingMinutes).toBe(2);
  });
  it('caps at twelve food, resets only on a later local date, and keeps food and partial credit', () => {
    let garden = empty();
    for (let i = 0; i < 70; i++) garden = creditMinute(garden, now + i * 60000);
    expect(garden).toMatchObject({ food: 12, earnedToday: 12, editingMinutes: 0 });
    expect(resetAllowance(garden, now - week)).toBe(garden);
    const next = creditMinute({ ...garden, editingMinutes: 3 }, now + 24 * 3600000);
    expect(next).toMatchObject({ food: 12, earnedToday: 0, editingMinutes: 4, earningDate: localDate(now + 24 * 3600000) });
    expect(creditMinute(next, now + 24 * 3600000 + 60000).food).toBe(13);
  });
  it('does not award extra credit after a backward clock change', () => {
    const garden = creditMinute(empty(), now);
    expect(creditMinute(garden, now - 60000)).toBe(garden);
  });
});

describe('feeding and health', () => {
  it('migrates placeholder health to seven days of content with no food or growth', () => {
    const garden = migrateGarden([{ id: 'stringle', addedAt: null, stage: 'Seedling', health: { label: 'Thriving', value: 80 } }], now);
    expect(presentPlant(garden.plants[0]!, now).health.label).toBe('Content');
    expect(presentPlant(garden.plants[0]!, now + week).health.label).toBe('Resting');
    expect(garden).toMatchObject({ food: 0, plants: [{ addedAt: null, growthPoints: 0, careStartedAt: now }] });
  });
  it('feeds a chosen plant, consumes shared food, and refreshes rather than stacks health', () => {
    const garden = addPlant({ ...planted(), food: 3 }, 'pricklepop', now);
    const fed = feedPlant(garden, 'stringle', now);
    expect(fed).toMatchObject({ food: 2, plants: [{ growthPoints: 1, health: { label: 'Thriving' } }, { growthPoints: 0 }] });
    const again = feedPlant(fed, 'stringle', now + week - 1);
    expect(presentPlant(again.plants[0]!, now + 2 * week - 1).health.label).toBe('Content');
    expect(presentPlant(again.plants[0]!, now + 3 * week - 1).health.label).toBe('Resting');
    expect(presentPlant(again.plants[0]!, now - week).health.label).toBe('Thriving');
  });
  it('keeps growth permanently, crosses both thresholds, caps at fifteen, and prevents mature thriving waste', () => {
    let garden = { ...planted(), food: 20 };
    for (let i = 1; i <= 15; i++) {
      garden = feedPlant(garden, 'stringle', now);
      expect(garden.plants[0]?.stage).toBe(i < 5 ? 'Seedling' : i < 15 ? 'Growing' : 'Mature');
    }
    expect(feedPlant(garden, 'stringle', now)).toBe(garden);
    const rested = presentPlant(garden.plants[0]!, now + 3 * week);
    expect(rested).toMatchObject({ stage: 'Mature', growthPoints: 15, health: { label: 'Resting' } });
    const refreshed = feedPlant(garden, 'stringle', now + week);
    expect(refreshed).toMatchObject({ food: 4, plants: [{ growthPoints: 15, health: { label: 'Thriving' } }] });
  });
  it('does nothing without food or for an unowned plant', () => {
    const garden = planted();
    expect(feedPlant(garden, 'stringle', now)).toBe(garden);
    const stocked = { ...garden, food: 1 };
    expect(feedPlant(stocked, 'pricklepop', now)).toBe(stocked);
  });
  it('validates persisted care data', () => {
    const garden = planted();
    expect(isGarden(garden)).toBe(true);
    for (const invalid of [{ ...garden, food: -1 }, { ...garden, editingMinutes: 5 }, { ...garden, earnedToday: 13 },
      { ...garden, plants: [{ ...garden.plants[0], growthPoints: 16 }] },
      { ...garden, plants: [{ ...garden.plants[0], lastFedAt: 'yesterday' }] },
      { ...garden, plants: [{ ...garden.plants[0], careStartedAt: null }] }]) expect(isGarden(invalid)).toBe(false);
  });
});
