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
  it('does not award duplicate credit after a backward clock change', () => {
    const garden = creditMinute(creditMinute(empty(), now - 60000), now);
    expect(creditMinute(garden, now - 60000)).toBe(garden);
  });
  it('credits an older failed minute after a newer minute was saved, once across reloads', () => {
    const newer = creditMinute(empty(), now + 60000);
    const retried = creditMinute(newer, now);
    expect(retried.editingMinutes).toBe(2);
    const restored = JSON.parse(JSON.stringify(retried));
    expect(creditMinute(restored, now + 1000)).toEqual(retried);
    expect(creditMinute(restored, now + 61000)).toEqual(retried);
    expect(retried.lastCreditedMinute).toBe(Math.floor((now + 60000) / 60000));
  });
  it('preserves the legacy watermark when upgrading saves without minute identities', () => {
    const { minuteCredits: _history, ...legacy } = creditMinute(empty(), now);
    void _history;
    expect(creditMinute(legacy, now - 60000)).toBe(legacy);
    const upgraded = creditMinute(legacy, now + 120000);
    expect(creditMinute(upgraded, now + 60000).editingMinutes).toBe(3);
    expect(creditMinute(upgraded, now)).toBe(upgraded);
  });
});

describe('late editing credit across local dates', () => {
  const midnight = new Date(2026, 9, 21).getTime();
  const previous = midnight - 60000;
  it('does not credit a capped prior-day edit against the new allowance', () => {
    const capped = { ...migrateGarden([], previous), earnedToday: 12, editingMinutes: 0 };
    const nextDay = resetAllowance(capped, midnight);
    expect(creditMinute(nextDay, previous)).toBe(nextDay);
  });
  it('awards late prior-day food without changing the current daily allowance', () => {
    const partial = { ...migrateGarden([], previous), editingMinutes: 4 };
    const nextDay = { ...resetAllowance(partial, midnight), earnedToday: 12 };
    const late = creditMinute(nextDay, previous);
    expect(late).toMatchObject({ food: 1, editingMinutes: 0, earnedToday: 12,
      earningDate: localDate(midnight) });
    expect(isGarden(JSON.parse(JSON.stringify(late)))).toBe(true);
    expect(creditMinute(late, previous)).toBe(late);
  });
  it('retains a historical daily cap across several rollovers and reloads', () => {
    let garden = resetAllowance(migrateGarden([], now), midnight + 86400000);
    for (let i = 0; i < 70; i++) garden = creditMinute(garden, now + i * 60000);
    expect(garden).toMatchObject({ food: 12, editingMinutes: 0, earnedToday: 0 });
    const restored = JSON.parse(JSON.stringify(garden));
    expect(creditMinute(restored, now + 71 * 60000)).toEqual(garden);
  });
  it('does not invent an allowance for dates before a legacy save was upgraded', () => {
    const { earningHistory: _history, ...legacy } = migrateGarden([], midnight);
    void _history;
    expect(creditMinute(legacy, previous)).toBe(legacy);
  });
  it('uses local calendar dates across a daylight-saving transition', () => {
    const before = new Date(2026, 9, 24, 23, 59).getTime();
    const after = new Date(2026, 9, 25, 2, 30).getTime();
    const capped = { ...migrateGarden([], before), earnedToday: 12 };
    const next = resetAllowance(capped, after);
    expect(next.earningDate).toBe('2026-10-25');
    expect(creditMinute(next, before)).toBe(next);
    expect(creditMinute(next, after).editingMinutes).toBe(1);
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
    for (const invalid of [{ ...garden, minuteCredits: { legacyThrough: null, minutes: ['invalid'] } },
      { ...garden, minuteCredits: { legacyThrough: null, minutes: [1, 1] } },
      { ...garden, earningHistory: { since: localDate(now), earned: { '2026-10-19': 13 } } },
      { ...garden, earningHistory: { since: localDate(now), earned: [] } },
      { ...garden, food: -1 }, { ...garden, editingMinutes: 5 }, { ...garden, earnedToday: 13 },
      { ...garden, plants: [{ ...garden.plants[0], growthPoints: 16 }] },
      { ...garden, plants: [{ ...garden.plants[0], lastFedAt: 'yesterday' }] },
      { ...garden, plants: [{ ...garden.plants[0], careStartedAt: null }] }]) expect(isGarden(invalid)).toBe(false);
  });
});
