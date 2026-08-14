import { describe, expect, it } from 'vitest';
import { localCityCatalog } from '../cities';
import { getServiceCoordinates, haversineKm, nearestCity, roundToApproximate } from '../geo';

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

describe('getServiceCoordinates', () => {
  it('returns explicit coordinates when present', () => {
    expect(getServiceCoordinates({ lat: -29.5, lng: -51.2 })).toEqual({ lat: -29.5, lng: -51.2 });
  });

  it('resolves known seed services even when lat/lng are missing', () => {
    expect(getServiceCoordinates({ id: 'canoas-caps-praca-brasil' })).toEqual({
      lat: -29.9145,
      lng: -51.1812,
    });
  });

  it('resolves specific Canoas CAPS locations by name patterns', () => {
    const novosTempos = getServiceCoordinates({ name: 'CAPS II Novos Tempos', city: 'Canoas', state: 'RS' });
    const girassois = getServiceCoordinates({ name: 'CAPS III Recanto dos Girassóis', city: 'Canoas', state: 'RS' });
    const amanhecer = getServiceCoordinates({ name: 'CAPS AD III Amanhecer', city: 'Canoas', state: 'RS' });
    const travessia = getServiceCoordinates({ name: 'CAPS AD III Travessia', city: 'Canoas', state: 'RS' });

    expect(novosTempos).toEqual({ lat: -29.9073, lng: -51.1712 });
    expect(girassois).toEqual({ lat: -29.9176, lng: -51.1865 });
    expect(amanhecer).toEqual({ lat: -29.9234, lng: -51.1751 });
    expect(travessia).toEqual({ lat: -29.9161, lng: -51.1824 });

    // Confirm all 4 CAPS have distinct locations
    const points = [novosTempos, girassois, amanhecer, travessia];
    const uniqueKeys = new Set(points.map((p) => `${p?.lat},${p?.lng}`));
    expect(uniqueKeys.size).toBe(4);
  });

  it('disperses multiple unmapped services in the same city so pins do not overlap', () => {
    const s1 = getServiceCoordinates({ id: 'service-a', city: 'Canoas', state: 'RS' });
    const s2 = getServiceCoordinates({ id: 'service-b', city: 'Canoas', state: 'RS' });

    expect(s1).not.toBeNull();
    expect(s2).not.toBeNull();
    expect(`${s1?.lat},${s1?.lng}`).not.toEqual(`${s2?.lat},${s2?.lng}`);
  });

  it('returns null for unknown city without coordinates', () => {
    expect(getServiceCoordinates({ city: 'Cidade Desconhecida', state: 'XX' })).toBeNull();
  });
});
