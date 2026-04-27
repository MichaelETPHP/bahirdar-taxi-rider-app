/**
 * Google Maps API service — Geocoding, Directions, and Search.
 * REQUIRED APIs in Google Cloud:
 * - Places API
 * - Maps JavaScript API
 * - Geocoding API
 * - Directions API
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

    // Add location bias if current location is available
    if (location?.latitude && location?.longitude) {
      params.append('locationbias', `circle:50000@${location.latitude},${location.longitude}`);
    } else {
      // Default bias to Addis Ababa/Bahir Dar area
      params.append('locationbias', 'circle:100000@11.5936,37.3906');
    }

    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`;
    console.log('🔍 Searching places:', { query, location, url: url.split('key=')[0] + 'key=***' });

    const res = await fetch(url);
    const data = await res.json();

    console.log('🔍 Search response status:', data.status);

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

    console.log('🔄 Reverse geocoding:', { lat: coords.latitude, lng: coords.longitude });

    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await res.json();

    if (data.status === 'REQUEST_DENIED') {
      console.error('🚨 REQUEST_DENIED in reverseGeocode - Geocoding API not configured');
      return `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    }

    if (data.status !== 'OK' || !data.results?.length) {
      console.warn('⚠️ reverseGeocode no results:', data.status);
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

/**
 * Get driving route polyline between two points using Google Directions API.
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

  if (!origin || !destination) {
    console.warn('getRoute: Missing origin or destination');
    return fallback;
  }

  if (!GOOGLE_MAPS_KEY) {
    console.warn('getRoute: API key not configured');
    return fallback;
  }

  try {
    const params = new URLSearchParams({
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      key: GOOGLE_MAPS_KEY,
      mode: 'driving',
    });

    console.log('🛣️ Requesting route:', {
      origin: `${origin.latitude.toFixed(4)}, ${origin.longitude.toFixed(4)}`,
      destination: `${destination.latitude.toFixed(4)}, ${destination.longitude.toFixed(4)}`,
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const data = await res.json();

    if (data.status === 'REQUEST_DENIED') {
      console.error('🚨 REQUEST_DENIED in getRoute - Directions API not configured');
      return fallback;
    }

    if (data.status !== 'OK' || !data.routes?.length) {
      console.warn('⚠️ getRoute error:', data.status);
      return fallback;
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode polyline
    const points = decodePolyline(route.overview_polyline.points);

    console.log('✓ Route found:', {
      distanceKm: (leg.distance.value / 1000).toFixed(2),
      durationMin: (leg.duration.value / 60).toFixed(0),
      pointsCount: points.length,
    });

    return {
      coordinates: points,
      distanceKm:  (leg.distance.value / 1000) || 0,
      durationMin: (leg.duration.value / 60) || 0,
    };
  } catch (err) {
    console.error('❌ Google Directions error:', err.message);
    return fallback;
  }
}

/**
 * Decodes a Google Maps polyline.
 */
function decodePolyline(encoded) {
  if (!encoded) return [];
  const poly = [];
  let index = 0, len = encoded.length;
  let lat = 0, lng = 0;

  while (index < len) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    poly.push({ latitude: (lat / 1e5), longitude: (lng / 1e5) });
  }
  return poly;
}

// Fallback for tile URL if needed, though we moved to native Google Maps
export function gebetaTileUrl() {
  return '';
}
