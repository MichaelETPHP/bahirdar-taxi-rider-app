/**
 * Google Maps API service — Geocoding, Directions, and Search.
 */
import { GOOGLE_MAPS_KEY } from '../config/api';

/**
 * Search places by name using Google Places Autocomplete.
 * @param {string} query
 * @returns {Promise<Array<{ id, name, address, lat, lng, placeId }>>}
 */
export async function searchPlaces(query) {
  if (!query || query.trim().length < 2) return [];
  if (!GOOGLE_MAPS_KEY) {
    console.warn('Google Maps API key not configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      input: query.trim(),
      key: GOOGLE_MAPS_KEY,
      components: 'country:et',
      locationbias: 'circle:30000@11.5936,37.3906', // Bahir Dar bias
      language: 'en',
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Google Places Autocomplete error:', data.status);
      return [];
    }

    return (data.predictions || []).map(p => ({
      id: p.place_id,
      name: p.structured_formatting?.main_text || p.description,
      address: p.structured_formatting?.secondary_text || p.description,
      placeId: p.place_id,
      // Coordinates need a separate details call in Google Places API
      // For searching, we'll return the items and the UI will call getPlaceDetails on select
    }));
  } catch (err) {
    console.error('Google search error:', err);
    return [];
  }
}

/**
 * Get place detailed coordinates and info.
 * @param {string} placeId
 */
export async function getPlaceDetails(placeId) {
  if (!GOOGLE_MAPS_KEY || !placeId) return null;

  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_MAPS_KEY,
      fields: 'geometry,formatted_address,name',
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.result) return null;

    const loc = data.result.geometry.location;
    return {
      id: placeId,
      name: data.result.name,
      address: data.result.formatted_address,
      lat: loc.lat,
      lng: loc.lng,
    };
  } catch {
    return null;
  }
}

/**
 * Reverse geocode coordinates to address string using Google Maps Geocoding API.
 */
export async function reverseGeocode(coords) {
  if (!GOOGLE_MAPS_KEY || !coords) return 'Current Location';

  try {
    const params = new URLSearchParams({
      latlng: `${coords.latitude},${coords.longitude}`,
      key: GOOGLE_MAPS_KEY,
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.[0]) return 'Current Location';

    const item = data.results[0];
    return item.formatted_address || 'Current Location';
  } catch {
    return 'Current Location';
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

  if (!GOOGLE_MAPS_KEY || !origin || !destination) return fallback;

  try {
    const params = new URLSearchParams({
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      key: GOOGLE_MAPS_KEY,
      mode: 'driving',
    });

    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
    const data = await res.json();

    if (data.status !== 'OK' || !data.routes?.[0]) return fallback;

    const route = data.routes[0];
    const leg = route.legs[0];

    // Decode polyline
    const points = decodePolyline(route.overview_polyline.points);

    return {
      coordinates: points,
      distanceKm:  (leg.distance.value / 1000) || 0,
      durationMin: (leg.duration.value / 60) || 0,
    };
  } catch (err) {
    console.error('Google Directions error:', err);
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
