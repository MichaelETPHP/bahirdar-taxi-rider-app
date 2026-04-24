import * as Location from 'expo-location';
import { GOOGLE_MAPS_KEY, API_BASE_URL } from '../config/api';
import axios from 'axios';

const TIMEOUT = 15000; // 15 seconds for OSRM and other services
const FALLBACK_ADDRESS = 'Current Location';

/**
 * 1. getCurrentLocation()
 * Get rider's current GPS position with permission handling
 */
export async function getCurrentLocation() {
  try {
    console.log('[Location] Requesting foreground permissions...');
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      console.error('[Location] Permission denied:', status);
      throw new Error('Location permission denied');
    }

    console.log('[Location] Permission granted, fetching location...');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
    });

    const { latitude, longitude, accuracy } = location.coords;
    console.log('[Location] Got location:', { latitude, longitude, accuracy });

    return {
      lat: latitude,
      lng: longitude,
      accuracy,
    };
  } catch (error) {
    console.error('[Location] Error getting current location:', error.message);
    throw error;
  }
}

/**
 * 2. reverseGeocode(lat, lng)
 * Convert GPS coordinates to readable address using Google Geocoding API
 */
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) {
    console.warn('[Geocode] Missing coordinates');
    return FALLBACK_ADDRESS;
  }

  if (!GOOGLE_MAPS_KEY) {
    console.warn('[Geocode] No Google Maps API key configured');
    return FALLBACK_ADDRESS;
  }

  try {
    console.log('[Geocode] Reverse geocoding:', { lat, lng });

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng: `${lat},${lng}`,
          key: GOOGLE_MAPS_KEY,
          language: 'en',
        },
        timeout: TIMEOUT,
      }
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const address = response.data.results[0].formatted_address;
      console.log('[Geocode] Success:', address);
      return address;
    }

    console.warn('[Geocode] No results found, status:', response.data.status);
    return FALLBACK_ADDRESS;
  } catch (error) {
    console.error('[Geocode] Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    return FALLBACK_ADDRESS;
  }
}

/**
 * 3. searchPlaces(query, lat, lng)
 * Search for places using Google Places Autocomplete API
 */
export async function searchPlaces(query, lat, lng) {
  if (!GOOGLE_MAPS_KEY) {
    console.warn('[Search] No Google Maps API key');
    return [];
  }

  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    console.log('[Search] Searching:', { query, userLat: lat, userLng: lng });

    const params = {
      input: query.trim(),
      key: GOOGLE_MAPS_KEY,
      language: 'en',
      components: 'country:ET',
    };

    // Add location bias if user coordinates available
    if (lat && lng) {
      params.location = `${lat},${lng}`;
      params.radius = 50000; // 50km radius
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params,
        timeout: TIMEOUT,
      }
    );

    if (response.data.status === 'OK' && response.data.predictions) {
      const results = response.data.predictions.map((p) => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
        description: p.description,
        matched_substrings: p.matched_substrings || [],
      }));

      console.log('[Search] Found results:', results.length);
      return results;
    }

    console.warn('[Search] No predictions found, status:', response.data.status);
    return [];
  } catch (error) {
    console.error('[Search] Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data?.error_message,
    });
    return [];
  }
}

/**
 * 4. getPlaceDetails(placeId)
 * Get exact coordinates of a selected place
 */
export async function getPlaceDetails(placeId) {
  if (!GOOGLE_MAPS_KEY || !placeId) {
    console.warn('[PlaceDetails] Missing key or placeId');
    return null;
  }

  try {
    console.log('[PlaceDetails] Fetching:', placeId);

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          fields: 'geometry,formatted_address,name,address_components',
          key: GOOGLE_MAPS_KEY,
          language: 'en',
        },
        timeout: TIMEOUT,
      }
    );

    if (response.data.status === 'OK' && response.data.result) {
      const { geometry, formatted_address, name } = response.data.result;

      if (!geometry?.location) {
        console.warn('[PlaceDetails] No geometry found');
        return null;
      }

      const result = {
        lat: geometry.location.lat,
        lng: geometry.location.lng,
        address: formatted_address,
        name: name,
        placeId,
      };

      console.log('[PlaceDetails] Success:', result);
      return result;
    }

    console.warn('[PlaceDetails] Not OK, status:', response.data.status);
    return null;
  } catch (error) {
    console.error('[PlaceDetails] Error:', {
      message: error.message,
      status: error.response?.status,
    });
    return null;
  }
}

/**
 * 5. detectCity(lat, lng)
 * Check if user is in a supported service area
 */
export async function detectCity(lat, lng) {
  try {
    if (!lat || !lng) {
      console.warn('[CityDetect] Missing coordinates');
      return { city: 'unknown' };
    }

    console.log('[CityDetect] Detecting city:', { lat, lng });

    const response = await axios.get(`${API_BASE_URL}/cities/detect`, {
      params: { lat, lng },
      timeout: TIMEOUT,
    });

    const result = response.data;
    console.log('[CityDetect] Result:', result);
    return result;
  } catch (error) {
    console.error('[CityDetect] Error:', {
      message: error.message,
      status: error.response?.status,
    });
    return { city: 'unknown' };
  }
}

/**
 * Helper: Check if location is in Addis Ababa
 */
export function isAddisAbaba(lat, lng) {
  const ADDIS_CENTER = { lat: 9.0192, lng: 38.7469 };
  const distance = Math.hypot(lat - ADDIS_CENTER.lat, lng - ADDIS_CENTER.lng);
  return distance < 0.5; // ~55km radius
}

/**
 * Helper: Check if location is in Bahir Dar
 */
export function isBahirDar(lat, lng) {
  const BAHIRDAR_CENTER = { lat: 11.5955, lng: 37.3944 };
  const distance = Math.hypot(lat - BAHIRDAR_CENTER.lat, lng - BAHIRDAR_CENTER.lng);
  return distance < 0.5; // ~55km radius
}

/**
 * DEPRECATED: Do not use direct OSRM calls from mobile app!
 *
 * Backend API handles routing via /geo/fare-estimate endpoint
 * which internally calls OSRM on the server side via SSH tunnel.
 *
 * Mobile app should call tripService.getFareEstimate() instead.
 */
export async function getRouteFromOSRM(originLat, originLng, destLat, destLng) {
  throw new Error(
    'Direct OSRM calls from mobile app are deprecated!\n\n' +
    'Use tripService.getFareEstimate(pickupLat, pickupLng, dropoffLat, dropoffLng) instead.\n\n' +
    'The backend API handles routing internally via SSH tunnel to OSRM on the server.'
  );
}
