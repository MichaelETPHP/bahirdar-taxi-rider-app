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

export function getWalletBalance(token) {
  return get('/payments/wallet/balance', token);
}

export function getTrip(tripId, token) {
  return get(`/trips/${tripId}`, token);
}

export function getActiveTrip(token) {
  return get('/trips/active', token);
}

function toTripHistoryItem(raw) {
  const timestamp =
    raw.completed_at ||
    raw.cancelled_at ||
    raw.started_at ||
    raw.created_at ||
    new Date().toISOString();
  const date = new Date(timestamp);
  const time = Number.isNaN(date.getTime())
    ? '00:00'
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const fare = Number(
    raw.total_fare_etb ??
    raw.confirmed_fare ??
    raw.estimated_fare_etb ??
    raw.final_fare_etb ??
    0
  );

  return {
    id: String(raw.id ?? raw.trip_id ?? timestamp),
    date: Number.isNaN(date.getTime()) ? timestamp : date.toISOString(),
    time,
    pickup: raw.pickup_address || raw.pickup?.address || 'Pickup location',
    destination: raw.dropoff_address || raw.dropoff?.address || 'Drop-off location',
    distanceKm: Number(raw.actual_distance_km ?? raw.estimated_distance_km ?? raw.distance_km ?? 0),
    durationMin: Number(raw.actual_duration_min ?? raw.estimated_duration_min ?? raw.duration_min ?? 0),
    fareETB: Number.isFinite(fare) ? fare.toFixed(0) : '0',
    rideType: raw.vehicle_category || raw.ride_type || 'economy',
    status: normalizeTripStatus(raw.status) || 'completed',
    userRating: raw.rider_rating ?? raw.user_rating ?? raw.rating ?? '-',
    driver: raw.driver || null,
  };
}

export async function getTripHistory(token, { limit = 50 } = {}) {
  const res = await get(`/trips?limit=${limit}`, token);
  const rows = Array.isArray(res?.data) ? res.data : [];
  return rows.map(toTripHistoryItem);
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

export function getCancelReasons(token, role = 'rider') {
  return get(`/trips/cancel-reasons?role=${role}`, token);
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
  return get(`/geo/nearby-drivers?${q}`, token);
}

export function submitRating(tripId, { rating, comment, tip }, token) {
  return post(`/trips/${tripId}/ratings`, { rating, comment, tip }, token);
}

export function getFareEstimate(fromLat, fromLng, toLat, toLng, token) {
  const q = `from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`;
  return get(`/geo/fare-estimate?${q}`, token);
}
