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

export interface KnownLocationPattern {
  keywords: string[];
  lat: number;
  lng: number;
}

export const KNOWN_LOCATION_PATTERNS: KnownLocationPattern[] = [
  {
    keywords: ['novos tempos', 'sao caetano', 'marechal rondon'],
    lat: -29.9073,
    lng: -51.1712,
  },
  {
    keywords: ['recanto dos girassois', 'girassois', 'girassol', 'guilherme morsch'],
    lat: -29.9176,
    lng: -51.1865,
  },
  {
    keywords: ['amanhecer', 'xv de novembro', '15 de novembro', 'nossa senhora das gracas'],
    lat: -29.9234,
    lng: -51.1751,
  },
  {
    keywords: ['travessia', 'guilherme schell'],
    lat: -29.9161,
    lng: -51.1824,
  },
  {
    keywords: ['praca brasil', 'getulio vargas'],
    lat: -29.9145,
    lng: -51.1812,
  },
  {
    keywords: ['ubs centro', 'quinze de janeiro', '15 de janeiro', 'ipiranga'],
    lat: -29.9192,
    lng: -51.1795,
  },
  {
    keywords: ['ulbra', 'farroupilha', 'sao jose'],
    lat: -29.9011,
    lng: -51.1578,
  },
  {
    keywords: ['centro porto alegre', 'caps centro'],
    lat: -30.033,
    lng: -51.221,
  },
];

export const KNOWN_SERVICE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'canoas-caps-praca-brasil': { lat: -29.9145, lng: -51.1812 },
  'canoas-caps-novos-tempos': { lat: -29.9073, lng: -51.1712 },
  'canoas-caps-recanto-girassois': { lat: -29.9176, lng: -51.1865 },
  'canoas-caps-ad-amanhecer': { lat: -29.9234, lng: -51.1751 },
  'canoas-caps-ad-travessia': { lat: -29.9161, lng: -51.1824 },
  'canoas-ubs-centro': { lat: -29.9192, lng: -51.1795 },
  'canoas-ulbra-clinica-psicologia': { lat: -29.9011, lng: -51.1578 },
  'caps-novos-tempos': { lat: -29.9073, lng: -51.1712 },
  'caps-recanto-girassois': { lat: -29.9176, lng: -51.1865 },
  'caps-ad-amanhecer': { lat: -29.9234, lng: -51.1751 },
  'caps-ad-travessia': { lat: -29.9161, lng: -51.1824 },
};
