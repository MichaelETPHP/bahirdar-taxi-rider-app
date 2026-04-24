/**
 * Route Service V2 - Backend API Integration
 *
 * Mobile app → Backend API → OSRM (via SSH tunnel)
 *
 * The backend API handles all routing internally.
 * Mobile app never calls OSRM directly.
 */

import { getFareEstimate } from './tripService';

const FALLBACK_COORDS = [
  { latitude: 9.0192, longitude: 38.7469 },  // Addis center
  { latitude: 9.0300, longitude: 38.7550 },  // Slightly east
];

/**
 * Get route from backend API (which uses OSRM internally via SSH)
 *
 * @param {number} originLat - Pickup latitude
 * @param {number} originLng - Pickup longitude
 * @param {number} destLat - Dropoff latitude
 * @param {number} destLng - Dropoff longitude
 * @param {string} token - Auth token
 *
 * @returns {Promise<{
 *   coordinates: Array<{latitude, longitude}>,
 *   distanceKm: number,
 *   durationMin: number
 * }>}
 */
export async function getRouteFromBackend(originLat, originLng, destLat, destLng, token) {
  try {
    console.log('🛣️  Route request to backend API:', {
      from: `${originLat.toFixed(4)}, ${originLng.toFixed(4)}`,
      to: `${destLat.toFixed(4)}, ${destLng.toFixed(4)}`,
    });

    // Call backend fare-estimate endpoint (which includes OSRM routing)
    const fareData = await getFareEstimate(originLat, originLng, destLat, destLng, token);

    // Extract route data from backend response
    const routeData = fareData?.data;

    if (!routeData) {
      throw new Error('No route data in backend response');
    }

    // Backend returns route geometry as GeoJSON or polyline coordinates
    let coordinates = [];

    // Check if backend returns geometry as GeoJSON coordinates
    if (routeData.geometry?.coordinates) {
      coordinates = routeData.geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));
    }
    // Check if polyline field itself is a GeoJSON object (backend osrm.service behavior)
    else if (routeData.polyline && typeof routeData.polyline === 'object' && routeData.polyline.coordinates) {
      coordinates = routeData.polyline.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));
    }
    // Check if backend returns coordinates directly
    else if (routeData.coordinates && Array.isArray(routeData.coordinates)) {
      coordinates = routeData.coordinates;
    }
    // Check if backend returns polyline as encoded string
    else if (routeData.polyline && typeof routeData.polyline === 'string') {
      console.log('📦 Decoding polyline string from backend...');
      coordinates = decodePolyline(routeData.polyline);
    }

    // Fallback to straight line if no coordinates
    if (!coordinates || coordinates.length < 2) {
      console.warn('⚠️  No coordinates from backend, using fallback');
      coordinates = [
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng },
      ];
    }

    const distanceKm = routeData.distance_km || routeData.distance || 0;
    const durationMin = routeData.duration_min || routeData.duration || 0;

    console.log('✅ Route received from backend:', {
      distance: `${distanceKm.toFixed(2)} km`,
      duration: `${Math.round(durationMin)} min`,
      waypoints: coordinates.length,
    });

    console.log('🛣️  Polyline will use', coordinates.length, 'points for smooth road routing');

    return {
      coordinates,
      distanceKm,
      durationMin,
    };
  } catch (error) {
    console.error('❌ Backend routing failed:', error.message);

    // ── Public OSRM Fallback (Ensures user always sees a road-following route) ──
    try {
      console.log('🔄 Attempting Public OSRM Fallback...');
      const publicUrl = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
      const response = await fetch(publicUrl);
      const publicData = await response.json();

      if (publicData.code === 'Ok' && publicData.routes?.[0]) {
        const route = publicData.routes[0];
        const coordinates = route.geometry.coordinates.map(([lng, lat]) => ({
          latitude: lat,
          longitude: lng,
        }));
        
        console.log('✅ Public OSRM Success! Recovered smooth road route.');
        return {
          coordinates,
          distanceKm: parseFloat((route.distance / 1000).toFixed(2)),
          durationMin: Math.ceil(route.duration / 60),
        };
      }
    } catch (fallbackError) {
      console.error('❌ Public OSRM fallback failed:', fallbackError.message);
    }

    // Absolute last resort: Straight line
    return {
      coordinates: [
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng },
      ],
      distanceKm: 0,
      durationMin: 0,
    };
  }
}

/**
 * Simple polyline decoder (if backend returns encoded polyline)
 * Most modern backends return decoded coordinates, so this is rarely needed.
 */
function decodePolyline(encoded) {
  let points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let result = 0, shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}
