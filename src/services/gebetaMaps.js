/**
 * Gebeta Maps API service — Ethiopian maps, Addis Ababa coverage.
 * Docs: https://mapapi.gebeta.app
 * Scopes used: GEOCODING, DIRECTION, TILE
 */
import { GEBETA_KEY } from '../config/api';

const BASE = 'https://mapapi.gebeta.app/api/v1/route';

/**
 * Search places by name — biased to Addis Ababa.
 * GET /geocoding?name={query}&apiKey={key}
 * @param {string} query
 * @returns {Promise<Array<{ id, name, address, lat, lng }>>}
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];
  if (!GEBETA_KEY) {
    console.warn('Gebeta Maps API key not configured');
    return [];
  }
  try {
    const url = `${BASE}/geocoding/?name=${encodeURIComponent(query.trim())}&apiKey=${GEBETA_KEY}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!text || text.trim() === '') return [];
    let data;
    try { data = JSON.parse(text); } catch { return []; }

    const items = data?.data ?? data?.results ?? [];
    if (!Array.isArray(items) || items.length === 0) return [];

    return items.slice(0, 10).map((p, i) => ({
      id:      p.id      || `gebeta-${i}-${Date.now()}`,
      name:    p.name    || p.place_name || p.title || '',
      address: p.address || p.full_address || p.description || 'Addis Ababa',
      lat:     parseFloat(p.latitude  ?? p.lat ?? 0),
      lng:     parseFloat(p.longitude ?? p.lng ?? p.lon ?? 0),
    })).filter((p) => p.lat !== 0 && p.lng !== 0 && p.name);
  } catch (err) {
    console.warn('Gebeta search error:', err);
    return [];
  }
}

/**
 * Reverse geocode coordinates → address string.
 * GET /reversegeocoding?latitude={lat}&longitude={lng}&apiKey={key}
 * @param {{ latitude: number, longitude: number }} coords
 * @returns {Promise<string>} Human readable address
 */
export async function reverseGeocode(coords) {
  if (!GEBETA_KEY || !coords) return 'Current Location';
  try {
    const url = `${BASE}/reversegeocoding/?latitude=${coords.latitude}&longitude=${coords.longitude}&apiKey=${GEBETA_KEY}`;
    const res = await fetch(url);
    const text = await res.text();
    if (!text || text.trim() === '') return 'Current Location';
    let data;
    try { data = JSON.parse(text); } catch { return 'Current Location'; }

    const item = data?.data?.[0] ?? data?.data ?? data?.result;
    if (!item) return 'Current Location';

    const parts = [
      item.name,
      item.street,
      item.district || item.area,
      item.city || 'Addis Ababa',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Current Location';
  } catch {
    return 'Current Location';
  }
}

/**
 * Get driving route polyline between two points.
 * GET /direction?la1={lat1}&lo1={lng1}&la2={lat2}&lo2={lng2}&apiKey={key}
 * @param {{ latitude: number, longitude: number }} origin
 * @param {{ latitude: number, longitude: number }} destination
 * @returns {Promise<{ coordinates: Array, distanceKm: number, durationMin: number }>}
 */
export async function getRoute(origin, destination) {
  const fallback = {
    coordinates: [
      { latitude: origin.latitude,      longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
    ],
    distanceKm:  0,
    durationMin: 0,
  };
  if (!GEBETA_KEY || !origin || !destination) return fallback;

  try {
    // Gebeta Maps Direction API
    // https://mapapi.gebeta.app/api/v1/route/direction/?la1=&lo1=&la2=&lo2=&apiKey=
    const url =
      `${BASE}/direction/` +
      `?la1=${origin.latitude}&lo1=${origin.longitude}` +
      `&la2=${destination.latitude}&lo2=${destination.longitude}` +
      `&apiKey=${GEBETA_KEY}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    const text = await res.text();
    if (!text || text.trim().length < 2) return fallback;

    let data;
    try { data = JSON.parse(text); } catch { return fallback; }

    // Gebeta response: { msg, data: { features: [...], distance, duration } }
    const payload   = data?.data ?? data;
    const distanceM = parseFloat(payload?.distance ?? 0);
    const durationS = parseFloat(payload?.duration ?? 0);
    const distanceKm  = distanceM > 0 ? distanceM / 1000 : 0;
    const durationMin = durationS > 0 ? durationS / 60   : 0;

    // Extract coordinates from GeoJSON FeatureCollection
    let coords = [];
    const features = payload?.features ?? [];
    for (const feature of features) {
      const geomCoords = feature?.geometry?.coordinates;
      if (!Array.isArray(geomCoords)) continue;
      if (feature.geometry.type === 'LineString') {
        geomCoords.forEach(([lng, lat]) => coords.push({ latitude: lat, longitude: lng }));
      } else if (feature.geometry.type === 'MultiLineString') {
        geomCoords.forEach((line) =>
          line.forEach(([lng, lat]) => coords.push({ latitude: lat, longitude: lng }))
        );
      }
    }

    return {
      coordinates: coords.length > 1 ? coords : fallback.coordinates,
      distanceKm:  distanceKm  || fallback.distanceKm,
      durationMin: durationMin || fallback.durationMin,
    };
  } catch {
    return fallback;
  }
}

/**
 * Tile URL template for react-native-maps UrlTile.
 * Usage: <UrlTile urlTemplate={gebetaTileUrl()} />
 */
export function gebetaTileUrl() {
  return `https://mapapi.gebeta.app/api/v1/map/{z}/{x}/{y}?apiKey=${GEBETA_KEY}`;
}
