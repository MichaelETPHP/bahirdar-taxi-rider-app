import { useEffect, useRef, useState } from 'react';
import { snapToNearestRoad } from '../services/roadSnap';

function keyFor(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/**
 * Returns the road-snapped version of a raw GPS point, falling back to the
 * raw point immediately (so the marker never waits on a network round trip)
 * and correcting to the snapped position once OSRM resolves it. The snap
 * result is only applied while it still matches the current raw point — if
 * the driver has already moved on by the time a slow response lands, it's
 * discarded rather than pulling the marker backward.
 */
export default function useRoadSnappedCoordinate(rawLat, rawLng) {
  const [snapped, setSnapped] = useState(null); // { key, lat, lng }
  const requestedKeyRef = useRef(null);

  const currentKey = keyFor(rawLat, rawLng);

  useEffect(() => {
    if (!currentKey || requestedKeyRef.current === currentKey) return;
    requestedKeyRef.current = currentKey;

    let cancelled = false;
    snapToNearestRoad(rawLat, rawLng).then((point) => {
      if (cancelled || !point) return;
      setSnapped({ key: currentKey, lat: point.lat, lng: point.lng });
    });

    return () => {
      cancelled = true;
    };
  }, [currentKey, rawLat, rawLng]);

  if (snapped && snapped.key === currentKey) {
    return { lat: snapped.lat, lng: snapped.lng };
  }
  return { lat: rawLat, lng: rawLng };
}
