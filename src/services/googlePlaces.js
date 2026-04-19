import { GOOGLE_MAPS_KEY } from '../config/api';

// Bahir Dar city center — all searches biased here
const BAHIRDAR_CENTER = '11.5936,37.3906';
const BAHIRDAR_RADIUS = 30000; // 30km — Bahir Dar region boundary

/**
 * Fetch place predictions from Google Places Autocomplete API.
 * Uses location bias around Bahir Dar for relevant results.
 * @param {string} input - Search query
 * @param {object} [userLocation] - ignored, bias is always Bahir Dar city
 * @returns {Promise<Array>} Array of { id, name, address, placeId }
 */
export async function searchPlaces(input, userLocation) {
  if (!input || input.trim().length < 2) return [];
  if (!GOOGLE_MAPS_KEY) {
    console.warn('Google Maps API key not configured');
    return [];
  }

  // Always bias to Bahir Dar city
  const locationBias = `circle:${BAHIRDAR_RADIUS}@${BAHIRDAR_CENTER}`;

  const params = new URLSearchParams({
    input: input.trim(),
    key: GOOGLE_MAPS_KEY,
    components: 'country:et',
    locationbias: locationBias,
    language: 'en',
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
    );
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Places Autocomplete error:', data.status, data.error_message);
      return [];
    }

    const predictions = data.predictions || [];
    return predictions.slice(0, 8).map((p) => ({
      id: p.place_id,
      name: p.structured_formatting?.main_text || p.description,
      address: p.structured_formatting?.secondary_text || '',
      placeId: p.place_id,
    }));
  } catch (err) {
    console.warn('Places search error:', err);
    return [];
  }
}

/**
 * Fetch place details (coordinates, full address) when user selects a prediction.
 * @param {string} placeId - Google place_id
 * @param {object} fallback - { name, address } for display if API fails
 * @returns {Promise<object|null>} { id, name, address, lat, lng }
 */
export async function getPlaceDetails(placeId, fallback = {}) {
  if (!GOOGLE_PLACES_KEY || !placeId) return null;

  const params = new URLSearchParams({
    place_id: placeId,
    key: GOOGLE_PLACES_KEY,
    fields: 'geometry,formatted_address,name',
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`
    );
    const data = await res.json();

    if (data.status !== 'OK' || !data.result) return null;

    const r = data.result;
    const loc = r.geometry?.location;
    if (!loc?.lat || !loc?.lng) return null;

    return {
      id: placeId,
      name: r.name || fallback.name || '',
      address: r.formatted_address || fallback.address || '',
      lat: loc.lat,
      lng: loc.lng,
    };
  } catch {
    return null;
  }
}
