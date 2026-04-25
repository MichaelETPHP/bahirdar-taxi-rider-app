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

    // Show straight line immediately while the real route loads (UX: something appears instantly)
    setCoordinates(fallback);
    setLoading(true);

    // Stale-request guard
    const token = {};
    abortRef.current = token;

    (async () => {
      try {
        // Get auth token from store
        const authToken = useAuthStore.getState().token;

        // Call backend API for routing (which uses OSRM internally)
        const result = await getRouteFromBackend(
          orig.latitude,
          orig.longitude,
          dest.latitude,
          dest.longitude,
          authToken
        );

        if (abortRef.current !== token) return;

        // We MUST have at least 3 points for a real road-following route
        // (2 points is almost always just the straight line fallback)
        const hasRoadPoints = Array.isArray(result.coordinates) && result.coordinates.length > 2;
        
        if (hasRoadPoints) {
          setCoordinates(result.coordinates);
        } else {
          console.warn('[useRoute] Backend returned insufficient road points. Keeping straight line.');
          setCoordinates(fallback);
        }

        setDistanceKm(result.distanceKm || 0);
        setDurationMin(result.durationMin || 0);
      } catch (err) {
        console.error('[useRoute] failed to fetch road route:', err.message);
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
