import { env } from '../config/env';

// Mirrors the backend's bounding-box city detection (osrm.service.ts) so the
// driver marker snaps against the same OSRM instance the trip route itself
// would use, rather than guessing a single city.
const BAHIRDAR_BOUNDS = { minLat: 11.20, maxLat: 11.90, minLng: 37.00, maxLng: 37.80 };

function osrmBaseFor(lat, lng) {
  const inBahirdar =
    lat >= BAHIRDAR_BOUNDS.minLat && lat <= BAHIRDAR_BOUNDS.maxLat &&
    lng >= BAHIRDAR_BOUNDS.minLng && lng <= BAHIRDAR_BOUNDS.maxLng;
  return inBahirdar ? env.osrmBahirdarUrl : env.osrmAddisUrl;
}

// Small in-memory cache — driver GPS updates commonly repeat the same
// coordinate to ~5 decimal places (server-side throttling), so this avoids
// re-querying OSRM every time the same point comes back.
const cache = new Map();
const MAX_CACHE_ENTRIES = 300;

// A snap result further than this from the raw GPS point is almost certainly
// wrong (GPS drift into a field/water, or a gap in the road graph) — better to
// show the raw point than a car floating on an unrelated street.
const MAX_SNAP_DISTANCE_M = 80;

/**
 * Snaps a raw driver GPS point to the nearest road via OSRM's `nearest`
 * service, so the car marker sits on the street instead of slightly
 * off-road/on a building, matching how Uber/Bolt render live driver markers.
 * Returns null on any failure — callers should fall back to the raw point.
 */
export async function snapToNearestRoad(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (cache.has(key)) return cache.get(key);

  const base = osrmBaseFor(lat, lng);
  if (!base) return null;

  try {
    const url = `${base}/nearest/v1/driving/${lng},${lat}?number=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;

    const data = await res.json();
    const waypoint = data?.waypoints?.[0];
    const location = waypoint?.location;
    if (!Array.isArray(location) || location.length < 2) return null;
    if (typeof waypoint.distance === 'number' && waypoint.distance > MAX_SNAP_DISTANCE_M) return null;

    const point = { lat: location[1], lng: location[0] };
    if (cache.size >= MAX_CACHE_ENTRIES) cache.clear();
    cache.set(key, point);
    return point;
  } catch {
    return null; // network error/timeout — caller falls back to the raw GPS point
  }
}
