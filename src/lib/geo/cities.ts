export interface CityLocation {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

/**
 * Catalog of cities used for on-device location lookups.
 * Coordinates are approximate (city-level precision only).
 *
 * When cities become dashboard-managed via the database, this module
 * becomes the fallback catalog and the UI reads the published list instead.
 */
export const localCityCatalog: CityLocation[] = [
  { city: 'Canoas', state: 'RS', lat: -29.9167, lng: -51.1833 },
  { city: 'Porto Alegre', state: 'RS', lat: -30.0277, lng: -51.2287 },
  { city: 'São Leopoldo', state: 'RS', lat: -29.7603, lng: -51.1472 },
  { city: 'Novo Hamburgo', state: 'RS', lat: -29.6783, lng: -51.1309 },
  { city: 'Esteio', state: 'RS', lat: -29.8608, lng: -51.1783 },
  { city: 'Gravataí', state: 'RS', lat: -29.9443, lng: -50.9925 },
];
