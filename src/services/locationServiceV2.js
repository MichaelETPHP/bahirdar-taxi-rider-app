/**
 * LOCATION SERVICE V2 - Bulletproof Implementation
 * This is the PRODUCTION version that actually works
 */

import * as Location from 'expo-location';
import { GOOGLE_MAPS_KEY } from '../config/api';

const TIMEOUT_MS = 10000;
const FALLBACK_ADDRESS = 'Detecting location...';

console.log('🔧 Location Service V2 loaded');
console.log('📍 Google Maps API Key present:', !!GOOGLE_MAPS_KEY);
console.log('🔑 Key length:', GOOGLE_MAPS_KEY?.length);

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
 * Uses Google Maps API with fallback
 */
export async function reverseGeocode(lat, lng) {
  // Validate inputs
  if (!lat || !lng) {
    console.warn('⚠️  Missing coordinates for reverse geocoding');
    return FALLBACK_ADDRESS;
  }

  // Try Google Geocode API first
  if (GOOGLE_MAPS_KEY) {
    try {
      console.log('[Geocod] Calling with key:', GOOGLE_MAPS_KEY.substring(0, 10) + '...');
      console.log('[Geocod] Coords:', lat.toFixed(6), lng.toFixed(6));

      const url = 'https://maps.googleapis.com/maps/api/geocode/json';
      const params = new URLSearchParams({
        latlng: `${lat},${lng}`,
        key: GOOGLE_MAPS_KEY,
        language: 'en',
      });

      const response = await fetch(`${url}?${params}`, { method: 'GET' });
      console.log('[Geocod] HTTP status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('[Geocod] Response status:', data.status);
      if (data.error_message) {
        console.warn('[Geocod] Error message:', data.error_message);
      }

      if (data.status !== 'OK') {
        console.warn('[Geocod] Non-OK status:', data.status);
      } else if (data.results?.length > 0) {
        const result = data.results[0];
        const formatted = result.formatted_address;
        
        // Try to find the most specific name from address components
        // (neighborhood > sublocality > point_of_interest)
        let specificName = '';
        const components = result.address_components || [];
        
        const preferredTypes = ['neighborhood', 'sublocality_level_1', 'sublocality', 'point_of_interest', 'premise'];
        
        for (const type of preferredTypes) {
          const comp = components.find(c => c.types.includes(type));
          if (comp) {
            specificName = comp.long_name;
            break;
          }
        }

        // If we found a specific name, prefix it to the formatted address or use it as a hint
        // For now, we return the formatted address, but the parser will handle extraction.
        // We'll return a special format if we have a specific name.
        if (specificName && !formatted.startsWith(specificName)) {
          console.log(`✅ Specific location found: ${specificName}`);
          return `${specificName}, ${formatted}`;
        }

        console.log('✅ Address found:', formatted);
        return formatted;
      }
    } catch (error) {
      console.warn('⚠️  Google API call failed:', error.message);
      console.log('    Using fallback method...');
    }
  } else {
    console.warn('⚠️  Google Maps API Key not configured');
    console.log('    Make sure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is in .env.development');
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

  if (!GOOGLE_MAPS_KEY) {
    console.error('❌ Google Maps API Key missing');
    return [];
  }

  try {
    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = new URLSearchParams({
      input: query.trim(),
      key: GOOGLE_MAPS_KEY,
      language: 'en',
      components: 'country:ET',
    });

    if (lat && lng) {
      params.append('location', `${lat},${lng}`);
      params.append('radius', String(Math.round(radiusMeters)));
    }

    const response = await fetch(`${url}?${params}`);
    console.log('[Places] HTTP status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[Places] Response status:', data.status);
    if (data.error_message) {
      console.warn('[Places] Error message:', data.error_message);
    }

    if (data.status === 'OK' && data.predictions?.length > 0) {
      console.log('[Places] Found', data.predictions.length, 'predictions');
      return data.predictions.map((p) => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
        description: p.description,
      }));
    }

    console.warn('[Places] No predictions. Status was:', data.status);
    return [];
  } catch (error) {
    console.error('[Places] Search failed:', error.message);
    return [];
  }
}

/**
 * STEP 4: Get details of a specific place
 * After user selects from search results
 */
export async function getPlaceDetails(placeId) {
  if (!placeId || !GOOGLE_MAPS_KEY) {
    console.error('❌ Missing placeId or API key');
    return null;
  }

  try {
    console.log('[Places] Details for placeId:', placeId?.substring(0, 20));
    console.log('[Places] Using key:', GOOGLE_MAPS_KEY.substring(0, 10) + '...');

    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'geometry,formatted_address,name',
      key: GOOGLE_MAPS_KEY,
      language: 'en',
    });

    const response = await fetch(`${url}?${params}`);
    console.log('[Places] Details HTTP status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('[Places] Details response status:', data.status);
    if (data.error_message) {
      console.warn('[Places] Details error message:', data.error_message);
    }

    if (data.status === 'OK' && data.result) {
      const { geometry, formatted_address, name } = data.result;

      if (!geometry?.location) {
        console.error('[Places] No geometry in response');
        return null;
      }

      return {
        lat: geometry.location.lat,
        lng: geometry.location.lng,
        address: formatted_address,
        name,
        placeId,
      };
    }

    console.error('[Places] Details API returned:', data.status);
    return null;
  } catch (error) {
    console.error('[Places] Details failed:', error.message);
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
