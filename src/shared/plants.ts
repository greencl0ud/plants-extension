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
export type WebviewMessage = { type: 'ready' } | { type: 'selectPlant'; plantId: PlantId };
export type ShelfMessage =
  | { type: 'shelfState'; plantId: PlantId | null; plant: SavedPlant | null }
  | { type: 'saveError' };

export function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'ready'
    || (value.type === 'selectPlant' && 'plantId' in value && isPlantId(value.plantId));
}

export const INITIAL_HEALTH = { label: 'Thriving', value: 80 } as const;

export interface SavedPlant {
  id: PlantId;
  addedAt: string | null;
  stage: 'Seedling';
  health: typeof INITIAL_HEALTH;
}

export function isSavedPlant(value: unknown): value is SavedPlant {
  if (typeof value !== 'object' || value === null) return false;
  if (!('id' in value && isPlantId(value.id)
    && 'addedAt' in value && (value.addedAt === null
      || (typeof value.addedAt === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value.addedAt)
        && Number.isFinite(Date.parse(value.addedAt))))
    && 'stage' in value && value.stage === 'Seedling'
    && 'health' in value && typeof value.health === 'object' && value.health !== null)) return false;
  return 'label' in value.health && value.health.label === INITIAL_HEALTH.label
    && 'value' in value.health && value.health.value === INITIAL_HEALTH.value;
}

export function restorePlant(value: unknown): SavedPlant | null {
  if (isSavedPlant(value)) return value;
  return value === stringle.id
    ? { id: stringle.id, addedAt: null, stage: 'Seedling', health: INITIAL_HEALTH }
    : null;
}

export function isShelfMessage(value: unknown): value is ShelfMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'saveError'
    || (value.type === 'shelfState' && 'plantId' in value && 'plant' in value
      && ((value.plantId === null && value.plant === null)
        || (isSavedPlant(value.plant) && value.plantId === value.plant.id)));
}
