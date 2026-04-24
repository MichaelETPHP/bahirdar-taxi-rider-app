import { useState, useEffect, useRef } from 'react';
import { getRouteFromBackend } from '../services/routeServiceV2';
import useAuthStore from '../store/authStore';

/**
 * Fetches a road-following route.
 *
 * Strategy:
 *   1. OSRM (global coverage, road geometry) — primary
 *   2. Gebeta Direction API                  — fallback
 *   3. Straight line                         — last resort
 *
 * Returns coordinates for the polyline plus distance and duration for the
 * info chip / arrival time.
 */
export default function useRoute(origin, destination) {
  const [coordinates, setCoordinates] = useState([]);
  const [distanceKm,  setDistanceKm]  = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!origin || !destination) {
      setCoordinates([]);
      setDistanceKm(0);
      setDurationMin(0);
      return;
    }

    // Normalise both points to { latitude, longitude }
    const orig = {
      latitude:  origin.latitude  ?? origin.lat,
      longitude: origin.longitude ?? origin.lng,
    };
    const dest = {
      latitude:  destination.latitude  ?? destination.lat,
      longitude: destination.longitude ?? destination.lng,
    };

    if (
      !Number.isFinite(orig.latitude)  || !Number.isFinite(orig.longitude) ||
      !Number.isFinite(dest.latitude)  || !Number.isFinite(dest.longitude)
    ) return;

    const fallback = [
      { latitude: orig.latitude, longitude: orig.longitude },
      { latitude: dest.latitude, longitude: dest.longitude },
    ];

    // Show straight line immediately while the real route loads
    setCoordinates(fallback);
    setLoading(true);

    // Stale-request guard
    const token = {};
    abortRef.current = token;

    (async () => {
      try {
        // Get auth token from store
        const authToken = useAuthStore.getState().token;

        // Call backend API for routing (backend handles OSRM internally)
        const result = await getRouteFromBackend(
          orig.latitude,
          orig.longitude,
          dest.latitude,
          dest.longitude,
          authToken
        );

        if (abortRef.current !== token) return;

        // Backend returns coordinates directly
        const coords = result.coordinates || fallback;

        setCoordinates(coords.length >= 2 ? coords : fallback);
        setDistanceKm(result.distanceKm || 0);
        setDurationMin(result.durationMin || 0);
      } catch (err) {
        console.error('useRoute error:', err);
        if (abortRef.current === token) setCoordinates(fallback);
      } finally {
        if (abortRef.current === token) setLoading(false);
      }
    })();

    return () => { abortRef.current = null; };
  }, [
    origin?.latitude  ?? origin?.lat,
    origin?.longitude ?? origin?.lng,
    destination?.latitude ?? destination?.lat,
    destination?.longitude ?? destination?.lng,
  ]);

  return { coordinates, distanceKm, durationMin, loading };
}
