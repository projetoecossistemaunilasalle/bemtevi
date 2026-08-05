# Geo

On-device location utilities for the contacts directory.

Privacy posture (LGPD): the "Usar minha localização" flow never sends data to
BemTeVi servers. It uses the browser Geolocation API, rounds the coordinates
to ~1 km precision (`roundToApproximate`), keeps them only in memory, finds the
nearest city from the bundled `localCityCatalog` (`cities.ts`) via
`nearestCity`, and discards everything when the screen unmounts or reloads.

## Modules

- `cities.ts` — bundled catalog of known cities (approximate coordinates).
  Fallback source while cities are still free text; when cities become
  dashboard-managed via the database, the UI should read the published list
  and this catalog remains as the geographic lookup table.
- `geo.ts` — `haversineKm`, `roundToApproximate`, `nearestCity` (pure).
- `location.ts` — `requestBrowserLocation` wrapper for the browser API,
  resolving to `null` on denial, timeout or unavailability.
