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
    const logTag = `[🛣️ ROUTE]`;
    console.log(`${logTag} Requesting road route:`, {
      origin: `${originLat.toFixed(6)},${originLng.toFixed(6)}`,
      destination: `${destLat.toFixed(6)},${destLng.toFixed(6)}`,
    });

    // Call backend fare-estimate endpoint
    const fareData = await getFareEstimate(originLat, originLng, destLat, destLng, token);
    const routeData = fareData?.data;

    if (!routeData) {
      console.warn(`${logTag} No route data returned from backend. Status:`, fareData?.status);
      throw new Error('No route data in backend response');
    }

    let coordinates = [];

    console.log(`${logTag} Available route data keys:`, Object.keys(routeData));
    console.log(`${logTag} Full routeData:`, JSON.stringify(routeData).substring(0, 500));
    console.log(`${logTag} polyline type:`, typeof routeData.polyline, '| geometry type:', typeof routeData.geometry);

    // Priority 1: GeoJSON geometry (backend returns this)
    if (routeData.geometry?.coordinates && Array.isArray(routeData.geometry.coordinates) && routeData.geometry.coordinates.length > 0) {
      console.log(`${logTag} ✅ Using geometry.coordinates (${routeData.geometry.coordinates.length} points)`);
      coordinates = routeData.geometry.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));
    }
    // Priority 2: Polyline as GeoJSON object
    else if (routeData.polyline && typeof routeData.polyline === 'object' && Array.isArray(routeData.polyline.coordinates) && routeData.polyline.coordinates.length > 0) {
      console.log(`${logTag} ✅ Using polyline.coordinates (${routeData.polyline.coordinates.length} points)`);
      coordinates = routeData.polyline.coordinates.map(([lng, lat]) => ({
        latitude: lat,
        longitude: lng,
      }));
    }
    // Priority 3: Direct coordinates array
    else if (Array.isArray(routeData.coordinates) && routeData.coordinates.length > 0) {
      console.log(`${logTag} ✅ Using direct coordinates array (${routeData.coordinates.length} points)`);
      coordinates = routeData.coordinates.map(c => ({
        latitude: c.latitude ?? c.lat,
        longitude: c.longitude ?? c.lng,
      }));
    }
    // Priority 4: Encoded polyline string
    else if (typeof routeData.polyline === 'string' && routeData.polyline.length > 0) {
      console.log(`${logTag} 🔄 Decoding polyline string...`);
      coordinates = decodePolyline(routeData.polyline);
      console.log(`${logTag} ✅ Decoded to ${coordinates.length} points`);
    }

    // Validation: Ensure we actually got road points
    if (!coordinates || coordinates.length < 2) {
      console.warn(`${logTag} Could not extract road-snapped points from backend response. Falling back to straight line.`);
      coordinates = [
        { latitude: originLat, longitude: originLng },
        { latitude: destLat, longitude: destLng },
      ];
    } else {
      console.log(`${logTag} Success! Received ${coordinates.length} road-snapped points.`);
    }

    const distanceKm = routeData.distance_km || routeData.distance || 0;
    const durationMin = routeData.duration_min || routeData.duration || 0;

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
