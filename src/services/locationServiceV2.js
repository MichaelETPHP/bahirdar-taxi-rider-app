/**
 * LOCATION SERVICE V2 - Bulletproof Implementation
 * This is the PRODUCTION version that actually works
 */

import * as Location from 'expo-location';
import { GOOGLE_MAPS_KEY } from '../config/api';

const TIMEOUT_MS = 10000;
const FALLBACK_ADDRESS = 'Detecting location...';
const FALLBACK_COORDS = { lat: 11.5936, lng: 37.3906, name: 'Bahir Dar' }; // Bahir Dar center

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
      console.log('📍 [5/5] Reverse geocoding:', { lat: lat.toFixed(4), lng: lng.toFixed(4) });

      const url = 'https://maps.googleapis.com/maps/api/geocode/json';
      const params = new URLSearchParams({
        latlng: `${lat},${lng}`,
        key: GOOGLE_MAPS_KEY,
        language: 'en',
      });

      const fullUrl = `${url}?${params}`;
      console.log('📍 Calling Google Geocode API...');

      const response = await fetch(fullUrl, {
        method: 'GET',
      });

      console.log('📍 Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('📍 Response status from API:', data.status);

      if (data.status !== 'OK') {
        console.warn('⚠️  Google Geocode API error:', data.status);
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
    const city = cityResult?.city || 'Bahir Dar';

    // Create readable address from coordinates
    const fallbackAddress = `${city} (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`;
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
export async function searchPlaces(query, lat, lng) {
  // Validate input
  if (!query || query.trim().length < 2) {
    return [];
  }

  if (!GOOGLE_MAPS_KEY) {
    console.error('❌ Google Maps API Key missing');
    return [];
  }

  try {
    console.log('🔍 Searching places:', { query, lat: lat?.toFixed(2), lng: lng?.toFixed(2) });

    const url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
    const params = new URLSearchParams({
      input: query.trim(),
      key: GOOGLE_MAPS_KEY,
      language: 'en',
      components: 'country:ET',
    });

    // Add location bias if available
    if (lat && lng) {
      params.append('location', `${lat},${lng}`);
      params.append('radius', '50000');
    }

    const fullUrl = `${url}?${params}`;
    const response = await fetch(fullUrl, { timeout: TIMEOUT_MS });

    console.log('🔍 Search response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('🔍 Search API status:', data.status);

    if (data.status === 'OK' && data.predictions?.length > 0) {
      const results = data.predictions.map((p) => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
        description: p.description,
      }));

      console.log('✅ Found', results.length, 'places');
      return results;
    }

    console.warn('⚠️  No predictions found');
    return [];
  } catch (error) {
    console.error('❌ Search failed:', error.message);
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
    console.log('📍 Getting place details for:', placeId);

    const url = 'https://maps.googleapis.com/maps/api/place/details/json';
    const params = new URLSearchParams({
      place_id: placeId,
      fields: 'geometry,formatted_address,name',
      key: GOOGLE_MAPS_KEY,
      language: 'en',
    });

    const fullUrl = `${url}?${params}`;
    const response = await fetch(fullUrl, { timeout: TIMEOUT_MS });

    console.log('📍 Details response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('📍 Details API status:', data.status);

    if (data.status === 'OK' && data.result) {
      const { geometry, formatted_address, name } = data.result;

      if (!geometry?.location) {
        console.error('❌ No geometry in response');
        return null;
      }

      const result = {
        lat: geometry.location.lat,
        lng: geometry.location.lng,
        address: formatted_address,
        name: name,
        placeId,
      };

      console.log('✅ Place details:', result);
      return result;
    }

    console.error('❌ API returned:', data.status);
    return null;
  } catch (error) {
    console.error('❌ Getting place details failed:', error.message);
    return null;
  }
}

/**
 * HELPER: Detect which city user is in
 * Determines if in Addis Ababa or Bahir Dar
 */
export async function detectCity(lat, lng) {
  try {
    console.log('🏙️  Detecting city for:', { lat: lat?.toFixed(4), lng: lng?.toFixed(4) });

    if (!lat || !lng) {
      console.warn('⚠️  Missing coordinates for city detection');
      return { city: 'unknown', area: null };
    }

    // Addis Ababa center: 9.0192°N, 38.7469°E
    const ADDIS_CENTER = { lat: 9.0192, lng: 38.7469, radius: 0.5 };
    const addisDistance = Math.hypot(lat - ADDIS_CENTER.lat, lng - ADDIS_CENTER.lng);

    // Bahir Dar center: 11.5955°N, 37.3944°E
    const BAHIRDAR_CENTER = { lat: 11.5955, lng: 37.3944, radius: 0.5 };
    const bahirdarDistance = Math.hypot(lat - BAHIRDAR_CENTER.lat, lng - BAHIRDAR_CENTER.lng);

    console.log('🏙️  Distance to Addis:', addisDistance.toFixed(2));
    console.log('🏙️  Distance to Bahir Dar:', bahirdarDistance.toFixed(2));

    if (addisDistance < ADDIS_CENTER.radius) {
      console.log('✅ City detected: Addis Ababa');
      return { city: 'Addis Ababa', area: 'addis' };
    }

    if (bahirdarDistance < BAHIRDAR_CENTER.radius) {
      console.log('✅ City detected: Bahir Dar');
      return { city: 'Bahir Dar', area: 'bahirdar' };
    }

    console.warn('⚠️  Outside service areas');
    return { city: 'unknown', area: null };
  } catch (error) {
    console.error('❌ City detection failed:', error.message);
    return { city: 'unknown', area: null };
  }
}

/**
 * HELPER: Full location workflow
 * Get GPS → Geocode → Return everything
 */
export async function getFullLocation() {
  try {
    console.log('📍 Starting full location workflow...');
    const location = await getCurrentLocation();
    const address = await reverseGeocode(location.lat, location.lng);

    const result = {
      lat: location.lat,
      lng: location.lng,
      address,
      accuracy: location.accuracy,
    };

    console.log('✅ Full location ready:', result);
    return result;
  } catch (error) {
    console.error('❌ Full location workflow failed:', error.message);
    // Return fallback
    return {
      lat: FALLBACK_COORDS.lat,
      lng: FALLBACK_COORDS.lng,
      address: FALLBACK_ADDRESS,
      accuracy: null,
      isFallback: true,
    };
  }
}
