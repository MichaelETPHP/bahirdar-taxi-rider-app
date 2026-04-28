import { apiRequest } from '../lib/apiClient';

/**
 * Trip Service — Refactored to use decoupled apiClient.
 */

const get   = (path, token)       => apiRequest('GET',   path, undefined, { customToken: token });
const post  = (path, body, token) => apiRequest('POST',  path, body, { customToken: token });
const patch = (path, body, token) => apiRequest('PATCH', path, body, { customToken: token });

export function normalizeTripStatus(status) {
  if (status == null) return null;
  const s = String(status).toLowerCase();
  if (s.startsWith('cancelled')) return 'cancelled';
  return s;
}

export function createTrip(body, token) {
  return post('/trips', body, token);
}

export function getTrip(tripId, token) {
  return get(`/trips/${tripId}`, token);
}

export function patchTripArrived(tripId, token, extra = {}) {
  return patch(`/trips/${tripId}/arrived`, Object.keys(extra).length ? extra : {}, token);
}

export function patchTripStart(tripId, token, extra = {}) {
  return patch(`/trips/${tripId}/start`, Object.keys(extra).length ? extra : {}, token);
}

export function patchTripComplete(tripId, token, extra = {}) {
  return patch(`/trips/${tripId}/complete`, Object.keys(extra).length ? extra : {}, token);
}

export function cancelTrip(tripId, reason, token, meta = {}) {
  if (!tripId) throw new Error('tripId is required');
  
  if (tripId.startsWith('pending-')) {
    return Promise.resolve({ success: true, message: 'Optimistic trip cleared' });
  }

  const body = { ...meta };
  if (reason) body.reason = reason;
  return patch(`/trips/${tripId}/cancel`, body, token);
}

export function getDriverLocation(driverId, token) {
  return get(`/users/drivers/${driverId}/location`, token);
}

export function getNearbyDrivers(lat, lng, radiusKm = 5, token) {
  const q = `lat=${lat}&lng=${lng}&radius_km=${radiusKm}`;
  return get(`/users/drivers/nearby?${q}`, token);
}

export function submitRating(tripId, { rating, comment, tip }, token) {
  return post(`/trips/${tripId}/ratings`, { rating, comment, tip }, token);
}

export function getFareEstimate(fromLat, fromLng, toLat, toLng, token) {
  const q = `from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`;
  return get(`/geo/fare-estimate?${q}`, token);
}
