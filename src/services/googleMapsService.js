/**
 * Google Maps API service — Places Search and Geocoding only.
 * Routing is handled by backend OSRM (see routeServiceV2.js)
 *
 * REQUIRED APIs in Google Cloud:
 * - Places API (for location search/autocomplete)
 * - Geocoding API (for reverse geocoding)
 * - Maps SDK for Android (for displaying map)
 */
import { GOOGLE_MAPS_KEY } from '../config/api';

// Log API key status on module load
if (__DEV__) {
  console.log('[GoogleMaps] API Key configured:', !!GOOGLE_MAPS_KEY);
  if (GOOGLE_MAPS_KEY) {
    console.log('[GoogleMaps] Key preview:', GOOGLE_MAPS_KEY.substring(0, 20) + '...');
  }
}

/**
 * Search places by name using Google Places Autocomplete.
 * @param {string} query
 * @param {object} location - { latitude, longitude } for location bias
 * @returns {Promise<Array<{ id, name, address, lat, lng, placeId }>>}
 */
export async function searchPlaces(query, location) {
  if (!query || query.trim().length < 2) return [];
  if (!GOOGLE_MAPS_KEY) {
    console.error('🚨 Google Maps API key not configured. Check EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env');
    return [];
  }

  try {
    const params = new URLSearchParams({
      input: query.trim(),
      key: GOOGLE_MAPS_KEY,
      components: 'country:et',
      language: 'en',
    });

    if (location?.latitude && location?.longitude) {
      params.append('locationbias', `circle:50000@${location.latitude},${location.longitude}`);
    } else {
      params.append('locationbias', 'circle:100000@11.5936,37.3906');
    }

    console.log('[Places] Calling with key:', GOOGLE_MAPS_KEY.substring(0, 10) + '...');
    console.log('[Places] Query:', query);

    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
    const data = await res.json();

    console.log('[Places] Response status:', data.status);
    if (data.error_message) {
      console.warn('[Places] Error message:', data.error_message);
    }

    if (data.status === 'REQUEST_DENIED') {
      console.error('🚨 REQUEST_DENIED - Possible causes:');
      console.error('  1. API key invalid or expired');
      console.error('  2. Places API not enabled in Google Cloud Console');
      console.error('  3. Billing not configured on project');
      console.error('  4. API key restricted to specific domains/IPs');
      console.error('  5. Quota exceeded');
      return [];
    }

    if (data.status === 'INVALID_REQUEST') {
      console.error('🚨 INVALID_REQUEST:', data.error_message);
      return [];
    }

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('⚠️ Google Places error:', data.status, data.error_message);
      return [];
    }

    const predictions = (data.predictions || []).map(p => ({
      id: p.place_id,
      name: p.structured_formatting?.main_text || p.description,
      address: p.structured_formatting?.secondary_text || p.description,
      placeId: p.place_id,
    }));

    console.log('✓ Found', predictions.length, 'places');
    return predictions;
  } catch (err) {
    console.error('❌ Google search error:', err.message);
    return [];
  }
}

/**
 * Get place detailed coordinates and info.
 * @param {string} placeId
 */
export async function getPlaceDetails(placeId) {
  if (!GOOGLE_MAPS_KEY || !placeId) {
    console.warn('getPlaceDetails: Missing API key or placeId');
    return null;
  }

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_MAPS_KEY,
      fields: 'geometry,formatted_address,name,address_components',
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    const data = await res.json();

    if (data.status === 'REQUEST_DENIED') {
      console.error('🚨 REQUEST_DENIED in getPlaceDetails - Places API not properly configured');
      return null;
    }

    if (data.status !== 'OK' || !data.result) {
      console.warn('⚠️ getPlaceDetails error:', data.status);
      return null;
    }

    const result = data.result;
    const loc = result.geometry?.location;

    if (!loc) return null;

    return {
      id: placeId,
      name: result.name || '',
      address: result.formatted_address || '',
      lat: loc.lat,
      lng: loc.lng,
    };
  } catch (err) {
    console.error('❌ getPlaceDetails error:', err.message);
    return null;
  }
}

/**
 * Reverse geocode coordinates to address string using Google Maps Geocoding API.
 * Returns specific address if available, fallback to formatted location
 */
export async function reverseGeocode(coords) {
  if (!coords?.latitude || !coords?.longitude) {
    console.warn('reverseGeocode: Invalid coordinates');
    return 'Current Location';
  }

  if (!GOOGLE_MAPS_KEY) {
    console.warn('reverseGeocode: API key not configured');
    return 'Current Location';
  }

  try {
    const params = new URLSearchParams({
      latlng: `${coords.latitude},${coords.longitude}`,
      key: GOOGLE_MAPS_KEY,
      language: 'en',
    });

    console.log('[Geocod] Calling with key:', GOOGLE_MAPS_KEY.substring(0, 10) + '...');
    console.log('[Geocod] Coords:', coords.latitude.toFixed(6), coords.longitude.toFixed(6));

    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await res.json();

    console.log('[Geocod] Response status:', data.status);
    if (data.error_message) {
      console.warn('[Geocod] Error message:', data.error_message);
    }

    if (data.status === 'REQUEST_DENIED') {
      console.error('[Geocod] REQUEST_DENIED - check API key and billing');
      return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    }

    if (data.status !== 'OK' || !data.results?.length) {
      console.warn('[Geocod] No results. Status:', data.status);
      return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    }

    // Try to get the most specific address
    const results = data.results;

    // Look for "street_address" or "premise" level result for specificity
    const specificResult = results.find(r =>
      r.types.includes('street_address') ||
      r.types.includes('premise') ||
      r.types.includes('route')
    ) || results[0];

    const address = specificResult.formatted_address || 'Current Location';
    console.log('✓ Reverse geocoded:', address);
    return address;
  } catch (err) {
    console.error('❌ reverseGeocode error:', err.message);
    return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
  }
}

// Routing is handled by backend OSRM via routeServiceV2.js
// Do NOT use Google Directions API - use getRouteFromBackend() instead
// See: src/services/routeServiceV2.js
