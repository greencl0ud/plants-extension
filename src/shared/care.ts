import { isSavedShelf, isCareSummary, type SavedPlant, type PlantId, type CareSummary } from './plants.js';

const WEEK = 168 * 60 * 60 * 1000;
export interface CarePlant extends SavedPlant {
  careStartedAt: number;
  lastFedAt: number | null;
  growthPoints: number;
}
export interface Garden extends CareSummary {
  version: 1;
  plants: CarePlant[];
  earningDate: string;
  // Closed-day totals let late credit use its original local day's allowance.
  earningHistory?: { since: string; earned: Record<string, number> };
  lastCreditedMinute: number | null;
  // Retain identities for delayed retries; legacy saves only know a watermark.
  minuteCredits?: { legacyThrough: number | null; minutes: number[] };
}
export function localDate(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function migrateGarden(plants: SavedPlant[], now: number): Garden {
  return { version: 1, food: 0, editingMinutes: 0, earnedToday: 0,
    earningDate: localDate(now), lastCreditedMinute: null,
    minuteCredits: { legacyThrough: null, minutes: [] },
    earningHistory: { since: localDate(now), earned: {} },
    plants: plants.map(plant => ({ ...plant, careStartedAt: now, lastFedAt: null, growthPoints: 0 })) };
}
export function presentPlant(plant: CarePlant, now: number): CarePlant {
  const age = Math.max(0, now - (plant.lastFedAt ?? plant.careStartedAt));
  const label = plant.lastFedAt !== null && age < WEEK ? 'Thriving'
    : age < (plant.lastFedAt === null ? WEEK : 2 * WEEK) ? 'Content' : 'Resting';
  return { ...plant, stage: plant.growthPoints >= 15 ? 'Mature' : plant.growthPoints >= 5 ? 'Growing' : 'Seedling',
    health: { label, value: (label === 'Thriving' ? 1 : label === 'Content' ? 2 / 3 : 1 / 3) * 100 } };
}
export function resetAllowance(garden: Garden, now: number): Garden {
  const date = localDate(now);
  if (date <= garden.earningDate) return garden;
  const history = garden.earningHistory ?? { since: garden.earningDate, earned: {} };
  return { ...garden, earningDate: date, earnedToday: 0,
    earningHistory: { ...history, earned: { ...history.earned, [garden.earningDate]: garden.earnedToday } } };
}
export function creditMinute(saved: Garden, now: number): Garden {
  const garden = resetAllowance(saved, now);
  const date = localDate(now);
  const dailyHistory = garden.earningHistory ?? { since: garden.earningDate, earned: {} };
  // Older legacy allowances are unknown; never charge them to today's balance.
  if (date < dailyHistory.since) return garden;
  const earned = date === garden.earningDate ? garden.earnedToday : dailyHistory.earned[date] ?? 0;
  const minute = Math.floor(now / 60000);
  const history = garden.minuteCredits ?? { legacyThrough: garden.lastCreditedMinute, minutes: [] };
  if (earned >= 12 || (history.legacyThrough !== null && minute <= history.legacyThrough)
    || history.minutes.includes(minute)) return garden;
  const progress = garden.editingMinutes + 1;
  const foodEarned = progress === 5 ? 1 : 0;
  return { ...garden, lastCreditedMinute: Math.max(garden.lastCreditedMinute ?? minute, minute),
    minuteCredits: { ...history, minutes: [...history.minutes, minute] }, editingMinutes: progress % 5,
    food: garden.food + foodEarned,
    earnedToday: garden.earnedToday + (date === garden.earningDate ? foodEarned : 0),
    earningHistory: date === garden.earningDate ? dailyHistory
      : { ...dailyHistory, earned: { ...dailyHistory.earned, [date]: earned + foodEarned } } };
}
export function feedPlant(garden: Garden, id: PlantId, now: number): Garden {
  const plant = garden.plants.find(plant => plant.id === id);
  if (!plant || garden.food < 1 || (plant.growthPoints >= 15 && presentPlant(plant, now).health.label === 'Thriving')) return garden;
  return { ...garden, food: garden.food - 1, plants: garden.plants.map(plant => plant.id === id
    ? presentPlant({ ...plant, lastFedAt: now, growthPoints: Math.min(15, plant.growthPoints + 1) }, now) : plant) };
}
export function addPlant(garden: Garden, id: PlantId, now: number): Garden {
  if (garden.plants.some(plant => plant.id === id)) return garden;
  return { ...garden, plants: [...garden.plants, presentPlant({ id, addedAt: new Date(now).toISOString(),
    stage: 'Seedling', health: { label: 'Content', value: 2 / 3 * 100 }, careStartedAt: now, lastFedAt: null, growthPoints: 0 }, now)] };
}
export function isGarden(value: unknown): value is Garden {
  if (typeof value !== 'object' || value === null) return false;
  const data = value as Record<string, unknown>;
  if (!isCareSummary(value)) return false;
  return data.version === 1 && typeof data.earningDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.earningDate)
    && (data.lastCreditedMinute === null || Number.isSafeInteger(data.lastCreditedMinute))
    && (!('earningHistory' in data) || isEarningHistory(data.earningHistory, data.earningDate))
    && (!('minuteCredits' in data) || isMinuteCredits(data.minuteCredits, data.lastCreditedMinute))
    && isSavedShelf(data.plants) && data.plants.every(plant =>
      'careStartedAt' in plant && typeof plant.careStartedAt === 'number' && Number.isFinite(plant.careStartedAt)
      && 'lastFedAt' in plant && (plant.lastFedAt === null || (typeof plant.lastFedAt === 'number' && Number.isFinite(plant.lastFedAt)))
      && typeof plant.growthPoints === 'number');
}

function isMinuteCredits(value: unknown, latest: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  if (!('legacyThrough' in value) || !('minutes' in value)) return false;
  const { legacyThrough, minutes } = value;
  return (legacyThrough === null || (Number.isSafeInteger(legacyThrough) && typeof legacyThrough === 'number'
    && typeof latest === 'number' && legacyThrough <= latest))
    && Array.isArray(minutes) && new Set(minutes).size === minutes.length
    && minutes.every(minute => Number.isSafeInteger(minute) && typeof latest === 'number' && minute <= latest
      && (legacyThrough === null || (typeof legacyThrough === 'number' && minute > legacyThrough)));
}

function isEarningHistory(value: unknown, currentDate: string): boolean {
  if (typeof value !== 'object' || value === null || !('since' in value) || !('earned' in value)) return false;
  return typeof value.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.since) && value.since <= currentDate
    && typeof value.earned === 'object' && value.earned !== null && !Array.isArray(value.earned)
    && Object.entries(value.earned).every(([date, total]) => /^\d{4}-\d{2}-\d{2}$/.test(date)
      && date >= String(value.since) && date < currentDate
      && Number.isInteger(total) && typeof total === 'number' && total >= 0 && total <= 12);
}
