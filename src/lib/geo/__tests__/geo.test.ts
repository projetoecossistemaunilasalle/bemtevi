import { describe, expect, it } from 'vitest';
import { localCityCatalog } from '../cities';
import { haversineKm, nearestCity, roundToApproximate } from '../geo';

describe('haversineKm', () => {
  it('returns ~0 for the same point', () => {
    expect(haversineKm({ lat: -29.9167, lng: -51.1833 }, { lat: -29.9167, lng: -51.1833 })).toBe(0);
  });

  it('estimates the Canoas to Porto Alegre distance within a plausible range', () => {
    const distance = haversineKm({ lat: -29.9167, lng: -51.1833 }, { lat: -30.0277, lng: -51.2287 });
    expect(distance).toBeGreaterThan(10);
    expect(distance).toBeLessThan(15);
  });
});

describe('roundToApproximate', () => {
  it('rounds coordinates to 2 decimal places (~1 km precision)', () => {
    expect(roundToApproximate({ lat: -29.91671, lng: -51.18334 })).toEqual({
      lat: -29.92,
      lng: -51.18,
    });
  });
});

describe('nearestCity', () => {
  it('finds Canoas for coordinates near Canoas', () => {
    const match = nearestCity({ lat: -29.93, lng: -51.18 }, localCityCatalog);
    expect(match.city.city).toBe('Canoas');
    expect(match.distanceKm).toBeLessThanOrEqual(5);
  });

  it('finds Porto Alegre for coordinates near Porto Alegre', () => {
    const match = nearestCity({ lat: -30.02, lng: -51.21 }, localCityCatalog);
    expect(match.city.city).toBe('Porto Alegre');
  });

  it('matches through the blurred coordinate used by the app flow', () => {
    const blurred = roundToApproximate({ lat: -29.9234, lng: -51.1765 });
    expect(nearestCity(blurred, localCityCatalog).city.city).toBe('Canoas');
  });
});
