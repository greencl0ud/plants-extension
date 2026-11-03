export const stringle = {
  id: 'stringle',
  name: 'Stringle',
  artwork: 'stringle-stage-1.svg',
  available: true,
  description: 'A small two-leaf plant in a terracotta pot',
} as const;

export const dangleleaf = {
  id: 'dangleleaf',
  name: 'Dangleleaf',
  artwork: 'dangleleaf-stage-1.svg',
  available: false,
  description: 'A small plant with a heart-shaped leaf in a terracotta pot',
} as const;

export const pricklepop = {
  id: 'pricklepop', name: 'Pricklepop', artwork: 'pricklepop-stage-1.svg', available: true,
  description: 'Pricklepop in a terracotta pot',
} as const;
export const pebblebloom = {
  id: 'pebblebloom', name: 'Pebblebloom', artwork: 'pebblebloom-stage-1.svg', available: true,
  description: 'Pebblebloom in a terracotta pot',
} as const;
export const plants = [stringle, dangleleaf, pricklepop, pebblebloom] as const;
export const availablePlants = [stringle, pricklepop, pebblebloom] as const;
export type PlantDefinition = typeof plants[number];
export type PlantId = typeof availablePlants[number]['id'];
export function isPlantId(value: unknown): value is PlantId {
  return availablePlants.some(plant => plant.id === value);
}
export function getPlant(id: PlantId) {
  return availablePlants.find(plant => plant.id === id)!;
}
// Visible artwork bounds within the original 128 × 192 SVG frames.
// Keep these alongside plant definitions when replacing stage-one artwork.
export const plantArtworkBounds: Record<PlantId, { left: number; top: number; right: number; bottom: number }> = {
  stringle: { left: 30, top: 123, right: 98, bottom: 190 },
  pricklepop: { left: 30, top: 113, right: 98, bottom: 190 },
  pebblebloom: { left: 30, top: 101, right: 98, bottom: 190 },
};

export type WebviewMessage = { type: 'ready' } | { type: 'addPlant' | 'feedPlant'; plantId: PlantId };
export type FeedRejection = 'noFood' | 'alreadyThriving' | 'notOwned';
export type ShelfMessage =
  | { type: 'shelfState'; plants: SavedPlant[]; care?: CareSummary }
  | { type: 'feedResult'; plantId: PlantId; outcome: 'fed' | FeedRejection }
  | { type: 'earningError' }
  | { type: 'saveError' };

export function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'ready'
    || ((value.type === 'addPlant' || value.type === 'feedPlant') && 'plantId' in value && isPlantId(value.plantId));
}

export const INITIAL_HEALTH = { label: 'Thriving', value: 80 } as const;

export interface SavedPlant {
  id: PlantId;
  addedAt: string | null;
  stage: 'Seedling' | 'Growing' | 'Mature';
  health: { label: 'Resting' | 'Content' | 'Thriving'; value: number };
  growthPoints?: number;
}

export function isSavedPlant(value: unknown): value is SavedPlant {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value && isPlantId(value.id)
    && 'addedAt' in value && (value.addedAt === null
      || (typeof value.addedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value.addedAt)
        && Number.isFinite(Date.parse(value.addedAt))))
    && 'stage' in value && (value.stage === 'Seedling' || value.stage === 'Growing' || value.stage === 'Mature')
    && 'health' in value && typeof value.health === 'object' && value.health !== null)) return false;
  return 'label' in value.health && 'value' in value.health
    && ((value.health.label === 'Thriving' && (value.health.value === 80 || value.health.value === 100))
      || (value.health.label === 'Content' && value.health.value === 2 / 3 * 100)
      || (value.health.label === 'Resting' && value.health.value === 1 / 3 * 100))
    && (!('growthPoints' in value) || (Number.isInteger(value.growthPoints)
      && typeof value.growthPoints === 'number' && value.growthPoints >= 0 && value.growthPoints <= 15));
}

export function restorePlant(value: unknown): SavedPlant | null {
  if (isSavedPlant(value)) return value;
  return value === stringle.id
    ? { id: stringle.id, addedAt: null, stage: 'Seedling', health: INITIAL_HEALTH }
    : null;
}

export function isSavedShelf(value: unknown): value is SavedPlant[] {
  return Array.isArray(value) && value.every(isSavedPlant)
    && new Set(value.map(plant => plant.id)).size === value.length;
}

export function isShelfMessage(value: unknown): value is ShelfMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'saveError' || value.type === 'earningError'
    || (value.type === 'feedResult' && 'plantId' in value && isPlantId(value.plantId)
      && 'outcome' in value && typeof value.outcome === 'string'
      && ['fed', 'noFood', 'alreadyThriving', 'notOwned'].includes(value.outcome))
    || (value.type === 'shelfState' && 'plants' in value && isSavedShelf(value.plants)
      && (!('care' in value) || isCareSummary(value.care)));
}

export interface CareSummary {
  food: number;
  editingMinutes: number;
  earnedToday: number;
}
export function isCareSummary(value: unknown): value is CareSummary {
  if (typeof value !== 'object' || value === null) return false;
  return 'food' in value && Number.isSafeInteger(value.food) && typeof value.food === 'number' && value.food >= 0
    && 'editingMinutes' in value && Number.isInteger(value.editingMinutes) && typeof value.editingMinutes === 'number' && value.editingMinutes >= 0 && value.editingMinutes < 5
    && 'earnedToday' in value && Number.isInteger(value.earnedToday) && typeof value.earnedToday === 'number' && value.earnedToday >= 0 && value.earnedToday <= 12;
}
