/**
 * LOCATION SERVICE V2 - Bulletproof Implementation
 * This is the PRODUCTION version that actually works
 */

import * as Location from 'expo-location';
import { apiRequest } from '../lib/apiClient';

const TIMEOUT_MS = 10000;
const FALLBACK_ADDRESS = 'Detecting location...';

console.log('🔧 Location Service V2 loaded');

/**
 * STEP 1: Get current GPS location
 * This is the most basic function - get GPS coordinates
 */
export async function getCurrentLocation() {
  try {
    console.log('📍 [1/5] Requesting location permissions...');

    // Step 1: Request permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    console.log('📍 [2/5] Permission status:', status);

    if (status !== 'granted') {
      throw new Error(`Permission not granted: ${status}`);
    }

    // Step 2: Get location
    console.log('📍 [3/5] Fetching GPS coordinates...');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: 1000,
      maximumAge: 0, // No cache
    });

    const { latitude, longitude, accuracy } = location.coords;
    console.log('✅ [4/5] Got location:', {
      latitude: latitude.toFixed(4),
      longitude: longitude.toFixed(4),
      accuracy: accuracy.toFixed(0) + 'm',
    });

    return {
      lat: latitude,
      lng: longitude,
      accuracy,
    };
  } catch (error) {
    console.error('❌ [ERROR] Getting location failed:', error.message);
    throw error;
  }
}

/**
 * STEP 2: Convert coordinates to address (Reverse Geocoding)
 * Proxied through our backend (/geo/reverse-geocode), which holds the real
 * Google Maps key server-side and never ships it to the client. The backend
 * itself falls back to Gebeta/Nominatim if Google fails, so a non-fallback
 * response here means all upstream options were exhausted.
 */
export async function reverseGeocode(lat, lng) {
  // Validate inputs
  if (!lat || !lng) {
    console.warn('⚠️  Missing coordinates for reverse geocoding');
    return FALLBACK_ADDRESS;
  }

  try {
    console.log('[Geocod] Requesting backend reverse-geocode:', lat.toFixed(6), lng.toFixed(6));
    const result = await apiRequest('POST', '/geo/reverse-geocode', { lat, lng });
    const address = result?.data?.address;
    if (address) {
      console.log('✅ Address found:', address);
      return address;
    }
    console.warn('[Geocod] Backend returned no address');
  } catch (error) {
    console.warn('⚠️  Backend reverse-geocode failed:', error?.message);
    console.log('    Using local fallback method...');
  }

  // Fallback: Create address from coordinates + city detection
  try {
    console.log('📍 Using fallback geocoding...');

    // Detect city based on coordinates
    const cityResult = await detectCity(lat, lng);
    const city = cityResult?.city && cityResult.city !== 'unknown' ? cityResult.city : null;
    const fallbackAddress = city
      ? `${city} (${lat.toFixed(3)}°, ${lng.toFixed(3)}°)`
      : `${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E`;
    console.log('✅ Fallback address:', fallbackAddress);
    return fallbackAddress;
  } catch (error) {
    console.error('❌ Even fallback failed:', error.message);
    return FALLBACK_ADDRESS;
  }
}

/**
 * STEP 3: Search for places (Autocomplete)
 * Real-time search as user types
 */
export async function searchPlaces(query, lat, lng, radiusMeters = 20000) {
  // Validate input
  if (!query || query.trim().length < 2) {
    return [];
  }

  try {
    const params = new URLSearchParams({ query: query.trim() });
    if (lat != null && lng != null) {
      params.append('lat', String(lat));
      params.append('lng', String(lng));
      params.append('radius', String(Math.round(radiusMeters)));
    }

    const result = await apiRequest('GET', `/geo/places/autocomplete?${params}`);
    const predictions = result?.data ?? [];
    console.log('[Places] Found', predictions.length, 'predictions');
    return predictions;
  } catch (error) {
    console.error('[Places] Search failed:', error?.message);
    return [];
  }
}

/**
 * STEP 4: Get details of a specific place
 * After user selects from search results
 */
export async function getPlaceDetails(placeId) {
  if (!placeId) {
    console.error('❌ Missing placeId');
    return null;
  }

  try {
    console.log('[Places] Details for placeId:', placeId?.substring(0, 20));
    const params = new URLSearchParams({ place_id: placeId });
    const result = await apiRequest('GET', `/geo/places/details?${params}`);
    return result?.data ?? null;
  } catch (error) {
    console.error('[Places] Details failed:', error?.message);
    return null;
  }
}

/**
 * HELPER: Fetch active service areas from admin-controlled API.
 * Result is cached in module scope for 5 minutes to avoid per-render calls.
 */
let _serviceAreasCache = null;
let _serviceAreasCachedAt = 0;
const SERVICE_AREAS_TTL_MS = 5 * 60 * 1000;

async function fetchActiveServiceAreas() {
  const now = Date.now();
  if (_serviceAreasCache && now - _serviceAreasCachedAt < SERVICE_AREAS_TTL_MS) {
    return _serviceAreasCache;
  }
  try {
    const { API_BASE_URL } = await import('../config/api');
    const res = await fetch(`${API_BASE_URL}/cities`, { method: 'GET' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const areas = json?.data?.areas ?? [];
    _serviceAreasCache = areas;
    _serviceAreasCachedAt = now;
    return areas;
  } catch (err) {
    console.warn('⚠️  Could not fetch service areas from API:', err.message);
    // Return cache even if stale on network failure
    return _serviceAreasCache ?? [];
  }
}

/**
 * HELPER: Detect which city user is in.
 * Uses admin-controlled service areas (is_active = true in DB).
 * Falls back to hardcoded bounds if the API is unreachable.
 */
export async function detectCity(lat, lng) {
  try {
    console.log('🏙️  Detecting city for:', { lat: lat?.toFixed(4), lng: lng?.toFixed(4) });

    if (!lat || !lng) {
      console.warn('⚠️  Missing coordinates for city detection');
      return { city: 'unknown', area: null, isActive: false };
    }

    const areas = await fetchActiveServiceAreas();

    if (areas.length > 0) {
      for (const area of areas) {
        const minLat = parseFloat(area.bounds?.minLat ?? area.min_lat);
        const maxLat = parseFloat(area.bounds?.maxLat ?? area.max_lat);
        const minLng = parseFloat(area.bounds?.minLng ?? area.min_lng);
        const maxLng = parseFloat(area.bounds?.maxLng ?? area.max_lng);

        if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
          // area.isActive is already filtered server-side (only active areas returned)
          const areaKey = (area.city ?? '').toLowerCase().replace(/\s+/g, '');
          console.log(`✅ City detected: ${area.city} (area key: ${areaKey})`);
          return { city: area.city, area: areaKey, isActive: true };
        }
      }
      // Coordinates not in ANY active area — service unavailable here
      console.warn('⚠️  Location outside all active service areas');
      return { city: 'unknown', area: null, isActive: false };
    }

    // API returned no areas (e.g. all toggled off) — fallback to hardcoded bounds
    console.warn('⚠️  No active service areas from API, using hardcoded fallback');
    const FALLBACK = [
      { city: 'Addis Ababa', area: 'addisababa', minLat: 8.85, maxLat: 9.15, minLng: 38.60, maxLng: 38.95 },
      { city: 'Bahir Dar',   area: 'bahirdar',   minLat: 11.40, maxLat: 11.75, minLng: 37.20, maxLng: 37.55 },
    ];
    for (const f of FALLBACK) {
      if (lat >= f.minLat && lat <= f.maxLat && lng >= f.minLng && lng <= f.maxLng) {
        return { city: f.city, area: f.area, isActive: true };
      }
    }
    return { city: 'unknown', area: null, isActive: false };
  } catch (error) {
    console.error('❌ City detection failed:', error.message);
    return { city: 'unknown', area: null, isActive: false };
  }
}

/**
 * HELPER: Full location workflow
 * Get GPS → Geocode → Return everything
 */
export async function getFullLocation() {
  const location = await getCurrentLocation();
  const address = await reverseGeocode(location.lat, location.lng);
  console.log('✅ Full location ready:', { lat: location.lat, lng: location.lng, address });
  return {
    lat: location.lat,
    lng: location.lng,
    address,
    accuracy: location.accuracy,
  };
}
