import type { CityLocation } from './cities';

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
