import type { ServiceDirectoryEntry, ServiceLocation } from './types';

export interface NormalizeContactLocationsOptions {
  allowDerivation?: boolean;
  preserveDenormalizedContactIndexes?: ReadonlySet<number>;
}

const hasOwn = (value: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key);

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeCity(value: string) {
  return value.trim();
}

function normalizeState(value: string) {
  return value.trim().toUpperCase();
}

export function locationPairKey(city: string, state: string) {
  return `${stripAccents(normalizeCity(city)).toLocaleLowerCase('pt-BR')}|${normalizeState(state)}`;
}

function locationSlug(city: string) {
  return (
    stripAccents(normalizeCity(city))
      .toLocaleLowerCase('pt-BR')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'local'
  );
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function baseLocationId(city: string, state: string) {
  return `loc-${locationSlug(city)}-${normalizeState(state).toLocaleLowerCase('en-US')}`;
}

function uniqueDerivedLocationId(city: string, state: string, usedIds: Set<string>, forceSuffix = false) {
  const baseId = baseLocationId(city, state);
  if (!forceSuffix && !usedIds.has(baseId)) return baseId;

  const suffix = stableHash(locationPairKey(city, state));
  let candidate = `${baseId}-${suffix}`;
  let collisionIndex = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseId}-${suffix}-${collisionIndex}`;
    collisionIndex += 1;
  }
  return candidate;
}

function addDerivedLocation(
  locations: ServiceLocation[],
  city: string,
  state: string,
): { location: ServiceLocation; locations: ServiceLocation[] } {
  const pair = locationPairKey(city, state);
  const existing = locations.find((location) => locationPairKey(location.city, location.state) === pair);
  if (existing) return { location: existing, locations };

  const usedIds = new Set(locations.map((location) => location.id));
  const location = {
    id: uniqueDerivedLocationId(city, state, usedIds),
    city: normalizeCity(city),
    state: normalizeState(state),
  };
  return { location, locations: [...locations, location] };
}

export function deriveLocationsFromContacts(
  contacts: Array<Pick<ServiceDirectoryEntry, 'city' | 'state'>>,
): ServiceLocation[] {
  const entries: ServiceLocation[] = [];
  const seenPairs = new Set<string>();

  contacts.forEach((contact) => {
    const city = normalizeCity(contact.city);
    const state = normalizeState(contact.state);
    if (!city || !state) return;

    const pair = locationPairKey(city, state);
    if (seenPairs.has(pair)) return;
    seenPairs.add(pair);
    entries.push({ id: baseLocationId(city, state), city, state });
  });

  const baseCounts = new Map<string, number>();
  entries.forEach((location) => {
    baseCounts.set(location.id, (baseCounts.get(location.id) ?? 0) + 1);
  });

  const usedIds = new Set<string>();
  return entries.map((location) => {
    const id = uniqueDerivedLocationId(location.city, location.state, usedIds, (baseCounts.get(location.id) ?? 0) > 1);
    usedIds.add(id);
    return { ...location, id };
  });
}

export function normalizeContactLocations(
  contacts: ServiceDirectoryEntry[],
  locations: ServiceLocation[],
  { allowDerivation = true, preserveDenormalizedContactIndexes }: NormalizeContactLocationsOptions = {},
): { contacts: ServiceDirectoryEntry[]; locations: ServiceLocation[] } {
  let nextLocations = locations.map((location) => ({ ...location }));

  contacts = contacts.map((contact, contactIndex) => {
    const hasLocationId = hasOwn(contact, 'locationId');
    const rawLocationId = contact.locationId;
    const locationId = typeof rawLocationId === 'string' ? rawLocationId.trim() : rawLocationId;
    const referencedLocation =
      typeof locationId === 'string' && locationId.length > 0
        ? nextLocations.find((location) => location.id === locationId)
        : undefined;

    if (referencedLocation) {
      if (preserveDenormalizedContactIndexes?.has(contactIndex)) {
        return { ...contact, locationId: referencedLocation.id };
      }

      return {
        ...contact,
        locationId: referencedLocation.id,
        city: referencedLocation.city,
        state: referencedLocation.state,
      };
    }

    if (typeof locationId === 'string' && locationId.length > 0) {
      return { ...contact, locationId };
    }

    const city = typeof contact.city === 'string' ? contact.city : '';
    const state = typeof contact.state === 'string' ? contact.state : '';
    const cityIsSet = city.trim().length > 0;
    const stateIsSet = state.trim().length > 0;
    const matchingLocation =
      cityIsSet && stateIsSet
        ? nextLocations.find(
            (location) => locationPairKey(location.city, location.state) === locationPairKey(city, state),
          )
        : undefined;

    if (matchingLocation && (!hasLocationId || rawLocationId === undefined)) {
      return {
        ...contact,
        locationId: matchingLocation.id,
        city: matchingLocation.city,
        state: matchingLocation.state,
      };
    }

    if (allowDerivation && !hasLocationId && cityIsSet && stateIsSet) {
      const derived = addDerivedLocation(nextLocations, city, state);
      nextLocations = derived.locations;
      return {
        ...contact,
        locationId: derived.location.id,
        city: derived.location.city,
        state: derived.location.state,
      };
    }

    if (!cityIsSet && !stateIsSet) {
      return { ...contact, locationId: null, city: '', state: '' };
    }

    return { ...contact, locationId: null };
  });

  return { contacts, locations: nextLocations };
}

export function locationLabel(location: ServiceLocation) {
  return `${location.city} - ${location.state}`;
}

export function applyLocationSelection(
  _contact: ServiceDirectoryEntry,
  locationId: string | null,
  locations: ServiceLocation[],
): Partial<ServiceDirectoryEntry> {
  if (!locationId) return { locationId: null, city: '', state: '' };

  const location = locations.find((candidate) => candidate.id === locationId);
  if (!location) return { locationId, city: '', state: '' };

  return { locationId: location.id, city: location.city, state: location.state };
}
