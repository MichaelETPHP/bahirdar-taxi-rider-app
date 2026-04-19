import { GOOGLE_MAPS_KEY } from '../config/api';

// Bahir Dar city center — all searches biased here
const BAHIRDAR_CENTER = '11.5936,37.3906';
const BAHIRDAR_RADIUS = 30000; // 30km — Bahir Dar region boundary

/**
 * Fetch place predictions from Google Places Autocomplete API.
 * Uses location bias around Bahir Dar for relevant results.
 * @param {string} input - Search query
 * @returns {Promise<Array>} Array of { id, name, address, placeId }
 */
export async function searchPlaces(input) {
  if (!input || input.trim().length < 2) return [];
  if (!GOOGLE_MAPS_KEY) {
    console.error('[Google Places] API key not configured');
    return [];
  }

  const locationBias = `circle:${BAHIRDAR_RADIUS}@${BAHIRDAR_CENTER}`;
  const params = new URLSearchParams({
    input: input.trim(),
    key: GOOGLE_MAPS_KEY,
    components: 'country:et',
    locationbias: locationBias,
    language: 'en',
  });

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    if (__DEV__) console.log('[Google Places] Search:', input.trim());

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      console.error('[Google Places] HTTP error:', res.status, data);
      return [];
    }

    if (data.status === 'INVALID_REQUEST') {
      console.error('[Google Places] Invalid request:', data.error_message);
      return [];
    }

    if (data.status === 'REQUEST_DENIED') {
      console.error('[Google Places] API key invalid or restricted:', data.error_message);
      return [];
    }

    if (data.status === 'OVER_QUERY_LIMIT') {
      console.warn('[Google Places] Rate limited, using local results');
      return [];
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('[Google Places] Unexpected status:', data.status, data.error_message);
      return [];
    }

    const predictions = data.predictions || [];
    if (__DEV__) console.log('[Google Places] Found:', predictions.length, 'results');

    return predictions.slice(0, 12).map((p) => ({
      id: p.place_id,
      name: p.structured_formatting?.main_text || p.description,
      address: p.structured_formatting?.secondary_text || p.description,
      placeId: p.place_id,
    }));
  } catch (err) {
    console.error('[Google Places] Fetch error:', err.message);
    return [];
  }
}

/**
 * Get place detailed coordinates and info.
 * @param {string} placeId - Google place_id
 * @param {object} fallback - { name, address } for display if API fails
 * @returns {Promise<object|null>} { id, name, address, lat, lng }
 */
export async function getPlaceDetails(placeId, fallback = {}) {
  if (!GOOGLE_MAPS_KEY || !placeId) {
    console.warn('[Google Places] Missing API key or placeId');
    return null;
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: GOOGLE_MAPS_KEY,
    fields: 'geometry,formatted_address,name',
  });

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
    if (__DEV__) console.log('[Google Places] Getting details for:', placeId);

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok) {
      console.error('[Google Places Details] HTTP error:', res.status, data);
      return null;
    }

    if (data.status !== 'OK') {
      console.warn('[Google Places Details] Status:', data.status, data.error_message);
      return null;
    }

    if (!data.result) {
      console.warn('[Google Places Details] No result found');
      return null;
    }

    const r = data.result;
    const loc = r.geometry?.location;
    if (!loc?.lat || !loc?.lng) {
      console.warn('[Google Places Details] Missing coordinates for:', placeId);
      return null;
    }

    const result = {
      id: placeId,
      name: r.name || fallback.name || '',
      address: r.formatted_address || fallback.address || '',
      lat: loc.lat,
      lng: loc.lng,
    };
    if (__DEV__) console.log('[Google Places Details] Retrieved:', result.name);
    return result;
  } catch (err) {
    console.error('[Google Places Details] Error:', err.message);
    return null;
  }
}
