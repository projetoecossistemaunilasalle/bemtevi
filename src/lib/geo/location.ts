import type { GeoCoordinates } from './geo';

export const LOCATION_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Requests the device position through the browser Geolocation API.
 *
 * Privacy contract: the returned coordinates are held in memory only, are
 * never persisted and never transmitted. They are discarded when the caller
 * finishes processing (component unmount or page reload).
 *
 * Resolves to null when unavailable, denied or timed out.
 */
export function requestBrowserLocation(): Promise<GeoCoordinates | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timeoutId = window.setTimeout(() => resolve(null), LOCATION_REQUEST_TIMEOUT_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        window.clearTimeout(timeoutId);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: LOCATION_REQUEST_TIMEOUT_MS, maximumAge: 60_000 },
    );
  });
}
