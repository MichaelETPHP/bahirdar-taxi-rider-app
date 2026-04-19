/**
 * Route service — calls the public OSRM demo server directly.
 *
 * OSRM has global road coverage (including Bahirdar) and returns actual
 * road-following geometry.  The backend proxy (/geo/route) was omitting
 * the geometry field, which caused the straight-line fallback.
 *
 * API:  https://router.project-osrm.org/route/v1/driving/{lon},{lat};{lon},{lat}
 *       ?overview=full&geometries=geojson&steps=false
 *
 * NOTE: The public demo server is suitable for development.  For production
 * point OSRM_BASE at your own OSRM instance.
 */

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const TIMEOUT_MS = 10000;

/**
 * Fetch a road-following route between two points via OSRM.
 *
 * @param {{ latitude: number, longitude: number }} origin
 * @param {{ latitude: number, longitude: number }} destination
 * @returns {Promise<{ coordinates: Array<{latitude,longitude}>, distanceKm: number, durationMin: number }>}
 */
export async function getRoadRoute(origin, destination) {
  const fallback = {
    coordinates: [
      { latitude: origin.latitude,      longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ],
    distanceKm:  0,
    durationMin: 0,
  };

  if (!origin || !destination) return fallback;

  try {
    // OSRM expects coordinates as longitude,latitude
    const url =
      `${OSRM_BASE}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}` +
      `?overview=full&geometries=geojson&steps=false`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return fallback;

    let json;
    try { json = await res.json(); } catch { return fallback; }

    if (json?.code !== 'Ok') return fallback;

    const route = json?.routes?.[0];
    if (!route) return fallback;

    const geomCoords = route?.geometry?.coordinates;
    if (!Array.isArray(geomCoords) || geomCoords.length < 2) return fallback;

    // GeoJSON coordinates are [longitude, latitude]
    const coordinates = geomCoords.map(([lng, lat]) => ({
      latitude:  lat,
      longitude: lng,
    }));

    const distanceKm  = (route.distance  ?? 0) / 1000;        // metres → km
    const durationMin = (route.duration  ?? 0) / 60;          // seconds → minutes

    return { coordinates, distanceKm, durationMin };
  } catch {
    return fallback;
  }
}
