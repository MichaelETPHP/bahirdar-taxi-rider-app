/**
 * DEPRECATED: Old Route Service
 *
 * ❌ DO NOT USE - This service calls OSRM directly from mobile app
 *
 * MIGRATION:
 * Use routeServiceV2.js instead:
 * import { getRouteFromBackend } from './routeServiceV2';
 *
 * Architecture:
 * OLD (broken):  Mobile App → OSRM localhost:5000 ❌
 *                (phone has no OSRM, timeouts)
 *
 * NEW (correct): Mobile App → Backend API → OSRM (via SSH) ✅
 *                (backend handles routing internally)
 */

export async function getRoadRoute(origin, destination) {
  throw new Error(
    'Direct OSRM calls from mobile app are DEPRECATED!\n\n' +
    'Use routeServiceV2.getRouteFromBackend() instead.\n\n' +
    'The backend API handles all routing via:\n' +
    'POST /api/v1/trips/estimate\n' +
    'Body: { pickupLat, pickupLng, dropoffLat, dropoffLng }\n\n' +
    'Backend connects to OSRM internally via SSH tunnel.'
  );
}

export async function estimateRoute(origin, destination) {
  throw new Error('Use routeServiceV2.getRouteFromBackend() instead');
}
