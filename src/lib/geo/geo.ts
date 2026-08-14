import { localCityCatalog, KNOWN_LOCATION_PATTERNS, KNOWN_SERVICE_COORDINATES, type CityLocation } from './cities';

export interface GeoCoordinates {
  lat: number;
  lng: number;
}

export interface NearestCityMatch {
  city: CityLocation;
  distanceKm: number;
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export function haversineKm(a: GeoCoordinates, b: GeoCoordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * Rounds coordinates to 2 decimal places (~1 km precision) so the exact
 * device position is never kept. Used before any distance comparison.
 */
export function roundToApproximate(coordinates: GeoCoordinates): GeoCoordinates {
  return {
    lat: Math.round(coordinates.lat * 100) / 100,
    lng: Math.round(coordinates.lng * 100) / 100,
  };
}

export function nearestCity(coordinates: GeoCoordinates, catalog: CityLocation[]): NearestCityMatch {
  let match: CityLocation = catalog[0];
  let closestDistance = Infinity;
  for (const candidate of catalog) {
    const distance = haversineKm(coordinates, candidate);
    if (distance < closestDistance) {
      closestDistance = distance;
      match = candidate;
    }
  }
  return { city: match, distanceKm: Math.round(closestDistance * 10) / 10 };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

function deterministicCityOffset(key: string): { latOffset: number; lngOffset: number } {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const radius = 0.003 + (Math.abs(hash >> 8) % 50) / 10000;
  return {
    latOffset: Math.round(Math.sin(angle) * radius * 10000) / 10000,
    lngOffset: Math.round(Math.cos(angle) * radius * 10000) / 10000,
  };
}

/**
 * Resolves the geographic coordinates of a service.
 * Precedence:
 * 1. Explicit lat/lng on the service entry.
 * 2. ID match in KNOWN_SERVICE_COORDINATES.
 * 3. Keyword / address match in KNOWN_LOCATION_PATTERNS (e.g. CAPS Novos Tempos, Girassóis, Amanhecer, Travessia).
 * 4. City-level coordinates with deterministic dispersion so pins do not stack on top of each other.
 */
export function getServiceCoordinates(service: {
  id?: string;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
}): GeoCoordinates | null {
  if (
    typeof service.lat === 'number' &&
    typeof service.lng === 'number' &&
    Number.isFinite(service.lat) &&
    Number.isFinite(service.lng)
  ) {
    return { lat: service.lat, lng: service.lng };
  }

  if (service.id && KNOWN_SERVICE_COORDINATES[service.id]) {
    return KNOWN_SERVICE_COORDINATES[service.id];
  }

  const searchableText = normalizeText(
    `${service.name ?? ''} ${service.id ?? ''} ${service.address ?? ''} ${service.city ?? ''}`,
  );

  for (const pattern of KNOWN_LOCATION_PATTERNS) {
    const matched = pattern.keywords.some((kw) => searchableText.includes(normalizeText(kw)));
    if (matched) {
      return { lat: pattern.lat, lng: pattern.lng };
    }
  }

  if (service.city && service.city.trim()) {
    const normCity = service.city.trim().toLowerCase();
    const normState = service.state ? service.state.trim().toUpperCase() : '';
    const match = localCityCatalog.find(
      (c) => c.city.toLowerCase() === normCity && (!normState || c.state.toUpperCase() === normState),
    );
    if (match) {
      const key = service.id || service.name || service.address || service.city;
      const { latOffset, lngOffset } = deterministicCityOffset(key);
      return {
        lat: Math.round((match.lat + latOffset) * 10000) / 10000,
        lng: Math.round((match.lng + lngOffset) * 10000) / 10000,
      };
    }
  }

  return null;
}
