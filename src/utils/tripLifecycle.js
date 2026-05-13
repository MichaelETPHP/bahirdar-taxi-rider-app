import { normalizeTripStatus } from '../services/tripService';

/** Default interval for GET /trips/:id fallback when sockets are unreliable */
export const TRIP_STATUS_POLL_MS = 2000;

/**
 * Parse GET /trips/:id (or PATCH response) into { status, trip, driver }.
 * Supports both `{ data: { status, ...tripFields } }` and `{ data: { trip, driver } }`.
 * Also reconstructs a driver object from flat DB columns (driver_name, driver_phone, etc.)
 * which is what the FIND_BY_ID SQL query returns.
 */
export function parseTripPollResponse(res) {
  const root = res?.data ?? res;
  if (!root || typeof root !== 'object') {
    return { status: null, trip: null, driver: null };
  }
  const nested = root.trip && typeof root.trip === 'object' ? root.trip : null;
  const trip = nested ?? root;
  const status = normalizeTripStatus(root.status ?? trip.status);

  // Prefer pre-nested driver object; fall back to reconstructing from flat columns
  let driver = root.driver ?? trip.driver ?? null;
  if (!driver && (trip.driver_name || trip.driver_phone || trip.plate_number)) {
    driver = {
      name:       trip.driver_name   ?? null,
      full_name:  trip.driver_name   ?? null,
      phone:      trip.driver_phone  ?? null,
      avatar_url: trip.driver_avatar ?? trip.avatar_url ?? null,
      rating:     trip.driver_rating ?? null,
      vehicle: {
        make:        trip.make         ?? null,
        model:       trip.model        ?? null,
        plateNumber: trip.plate_number ?? null,
        color:       trip.color        ?? null,
        category:    trip.vehicle_type ?? trip.vehicle_category ?? null,
      },
    };
  }

  return { status, trip, driver };
}
