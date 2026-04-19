import { normalizeTripStatus } from '../services/tripService';

/** Default interval for GET /trips/:id fallback when sockets are unreliable */
export const TRIP_STATUS_POLL_MS = 5000;

/**
 * Parse GET /trips/:id (or PATCH response) into { status, trip, driver }.
 * Supports both `{ data: { status, ...tripFields } }` and `{ data: { trip, driver } }`.
 */
export function parseTripPollResponse(res) {
  const root = res?.data ?? res;
  if (!root || typeof root !== 'object') {
    return { status: null, trip: null, driver: null };
  }
  const nested = root.trip && typeof root.trip === 'object' ? root.trip : null;
  const trip = nested ?? root;
  const status = normalizeTripStatus(root.status ?? trip.status);
  const driver = root.driver ?? trip.driver ?? null;
  return { status, trip, driver };
}
