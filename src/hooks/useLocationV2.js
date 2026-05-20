import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { reverseGeocode } from '../services/locationServiceV2';
import useLocationStore from '../store/locationStore';

const GEO_OPTIONS = {
  accuracy: Location.Accuracy.High,
  timeInterval: 3000,    // Fast streaming: 3s interval
  distanceInterval: 5,   // Update every 5m moved
};

console.log('LOG  [LOCATION] Fast GPS streaming enabled (3s interval) on the rider application');

// Throttle reverse geocode to at most once every 30s
const GEOCODE_THROTTLE_MS = 30_000;

export default function useLocation() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('Getting location...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const { setUserCoords, setPickup } = useLocationStore();
  const lastGeocodeAt = useRef(0);
  const lastAddress = useRef('');

  useEffect(() => {
    let mounted = true;
    let subscriber = null;

    const start = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (mounted) {
            setPermissionDenied(true);
            setLoading(false);
          }
          return;
        }

        // Seed with last-known position immediately so map doesn't sit blank
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60_000 });
        if (last && mounted) {
          const { latitude, longitude, accuracy } = last.coords;
          setCurrentLocation({ lat: latitude, lng: longitude, accuracy });
          setUserCoords({ latitude, longitude });
          setLoading(false);
          // Don't geocode stale position — wait for fresh fix
        }

        // Watch for live position updates
        subscriber = await Location.watchPositionAsync(GEO_OPTIONS, async (loc) => {
          if (!mounted) return;

          const { latitude, longitude, accuracy } = loc.coords;

          setCurrentLocation({ lat: latitude, lng: longitude, accuracy });
          setUserCoords({ latitude, longitude });
          setLoading(false);
          setError(null);

          // Throttle geocoding — it's network-heavy, run at most once per 30s
          const now = Date.now();
          if (now - lastGeocodeAt.current >= GEOCODE_THROTTLE_MS) {
            lastGeocodeAt.current = now;
            const address = await reverseGeocode(latitude, longitude);
            if (!mounted || !address) return;
            lastAddress.current = address;
            setCurrentAddress(address);
            setPickup({
              name: address,
              address,
              lat: latitude,
              lng: longitude,
              latitude,
              longitude,
            });
          } else if (lastAddress.current) {
            // Keep showing last geocoded address; coords are already updated
            setPickup({
              name: lastAddress.current,
              address: lastAddress.current,
              lat: latitude,
              lng: longitude,
              latitude,
              longitude,
            });
          }
        });
      } catch (err) {
        if (!mounted) return;
        const msg = err?.message ?? '';
        if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
          setPermissionDenied(true);
        } else {
          setError(msg);
        }
        setLoading(false);
      }
    };

    start();

    return () => {
      mounted = false;
      subscriber?.remove();
    };
  }, []); // run once — watchPositionAsync keeps it live

  const refresh = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc && loc.coords) {
        const { latitude, longitude, accuracy } = loc.coords;
        setCurrentLocation({ lat: latitude, lng: longitude, accuracy });
        setUserCoords({ latitude, longitude });

        // Bypass throttle for forced refresh
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          lastGeocodeAt.current = Date.now();
          lastAddress.current = address;
          setCurrentAddress(address);
          setPickup({
            name: address,
            address,
            lat: latitude,
            lng: longitude,
            latitude,
            longitude,
          });
        }
      }
    } catch (err) {
      console.warn('[Location V2] refresh failed:', err);
    }
  };

  return { currentLocation, currentAddress, loading, error, permissionDenied, refresh };
}
