export const stringle = {
  id: 'stringle',
  name: 'Stringle',
  artwork: 'stringle-stage-1.svg',
  available: true,
} as const;

export const dangleleaf = {
  id: 'dangleleaf',
  name: 'Dangleleaf',
  artwork: 'dangleleaf-stage-1.svg',
  available: false,
} as const;

export type PlantId = typeof stringle.id;
export type WebviewMessage = { type: 'ready' } | { type: 'selectPlant'; plantId: PlantId };
export type ShelfMessage =
  | { type: 'shelfState'; plantId: PlantId | null }
  | { type: 'saveError' };

export function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'ready'
    || (value.type === 'selectPlant' && 'plantId' in value && value.plantId === stringle.id);
}

export function isShelfMessage(value: unknown): value is ShelfMessage {
  if (typeof value !== 'object' || value === null || !('type' in value)) return false;
  return value.type === 'saveError'
    || (value.type === 'shelfState' && 'plantId' in value
      && (value.plantId === null || value.plantId === stringle.id));
}
