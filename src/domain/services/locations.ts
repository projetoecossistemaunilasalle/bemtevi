// Compatibility facade: canonical implementation lives in @bemtevi/content-core (model/locations).
export {
  locationPairKey,
  deriveLocationsFromContacts,
  normalizeContactLocations,
  locationLabel,
  applyLocationSelection,
} from '@bemtevi/content-core';
export type { NormalizeContactLocationsOptions } from '@bemtevi/content-core';
