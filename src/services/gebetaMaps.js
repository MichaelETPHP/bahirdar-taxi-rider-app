/**
 * Gebeta Maps API service — DEPRECATED (Moved to Google Maps).
 * Now aliases functions to Google Maps Service.
 *
 * NOTE: Routing is handled by backend OSRM, not Google Maps.
 * Use routeServiceV2.js -> getRouteFromBackend() for routing.
 */
export {
  searchPlaces,
  reverseGeocode,
} from './googleMapsService';
