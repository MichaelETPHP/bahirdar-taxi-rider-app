import { API_BASE_URL } from '../config/api';

async function request(method, path, body, token) {
  const headers = {
    'Content-Type': 'application/json',
    // Keep-Alive helps with connection reuse
    'Connection': 'keep-alive',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      keepalive: true,  // Reuse connection
    });

    clearTimeout(timeoutId);
    const text = await res.text();
    let data = {};

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text };
      }
    }

    if (!res.ok) {
      throw {
        status: res.status,
        message: data?.error?.message || data?.message || 'Request failed',
        code: data?.error?.code,
      };
    }
    return data;
  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      throw {
        status: 504,
        message: 'Request timeout. Please check your connection.',
        code: 'REQUEST_TIMEOUT',
      };
    }
    throw err;
  }
}

/**
 * Normalize trip status strings from the API for client comparisons.
 */
export function normalizeTripStatus(status) {
  if (status == null) return null;
  const s = String(status).toLowerCase();
  if (s.startsWith('cancelled')) return 'cancelled';
  return s;
}

/**
 * POST /trips — confirm and create a new trip
 */
export function createTrip(body, token) {
  return request('POST', '/trips', body, token);
}

/**
 * GET /trips/:tripId — poll trip status as fallback
 */
export function getTrip(tripId, token) {
  return request('GET', `/trips/${tripId}`, undefined, token);
}

/**
 * PATCH /trips/:tripId/arrived — driver marked at pickup (rider app: usually driven by backend/socket; exposed for parity / tests).
 * @param {object} [extra] — optional JSON body fields accepted by your API
 */
export function patchTripArrived(tripId, token, extra = {}) {
  return request('PATCH', `/trips/${tripId}/arrived`, Object.keys(extra).length ? extra : {}, token);
}

/**
 * PATCH /trips/:tripId/start — trip started (pickup complete).
 */
export function patchTripStart(tripId, token, extra = {}) {
  return request('PATCH', `/trips/${tripId}/start`, Object.keys(extra).length ? extra : {}, token);
}

/**
 * PATCH /trips/:tripId/complete — trip ended, fare finalized server-side.
 */
export function patchTripComplete(tripId, token, extra = {}) {
  return request('PATCH', `/trips/${tripId}/complete`, Object.keys(extra).length ? extra : {}, token);
}

/**
 * PATCH /trips/:tripId/cancel — rider, driver, or system cancellation.
 * @param {string} [reason]
 * @param {object} [meta] — e.g. { cancelled_by: 'rider' } if your API requires it
 */
export function cancelTrip(tripId, reason, token, meta = {}) {
  if (!tripId || typeof tripId !== 'string' || tripId.trim() === '') {
    const err = new Error(`cancelTrip: tripId is required but got "${tripId}"`);
    err.code = 'MISSING_TRIP_ID';
    throw err;
  }
  const body = { ...meta };
  if (reason !== undefined && reason !== null) body.reason = reason;
  return request('PATCH', `/trips/${tripId}/cancel`, body, token);
}

/**
 * GET /users/drivers/:driverId/location — poll every 3s during trip
 */
export function getDriverLocation(driverId, token) {
  return request('GET', `/users/drivers/${driverId}/location`, undefined, token);
}

/**
 * GET /users/drivers/nearby?lat&lng&radius_km
 * Returns online/active drivers from Redis around rider location.
 */
export function getNearbyDrivers(lat, lng, radiusKm = 5, token) {
  const q = `lat=${lat}&lng=${lng}&radius_km=${radiusKm}`;
  return request('GET', `/users/drivers/nearby?${q}`, undefined, token);
}

/**
 * POST /trips/:tripId/ratings
 */
export function submitRating(tripId, { rating, comment, tip }, token) {
  return request('POST', `/trips/${tripId}/ratings`, { rating, comment, tip }, token);
}

/**
 * GET /geo/fare-estimate?from_lat&from_lng&to_lat&to_lng
 * Returns real OSRM distance + fare per vehicle category.
 */
export function getFareEstimate(fromLat, fromLng, toLat, toLng, token) {
  const q = `from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`;
  return request('GET', `/geo/fare-estimate?${q}`, undefined, token);
}
