import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import useLocationStore from '../store/locationStore';
import { reverseGeocode } from '../services/gebetaMaps';
import { haversineDistance } from '../utils/distanceUtils';

// Only re-geocode when user moves more than this distance (km) — avoids
// hitting the Gebeta API on every GPS tick (every 3s / 5m).
const GEOCODE_THRESHOLD_KM = 0.05; // 50 metres

async function getAddressFromCoords(coords) {
  // Try Gebeta reverse geocoding first (Ethiopian address data)
  try {
    const address = await reverseGeocode(coords);
    if (address && address !== 'Current Location') return address;
  } catch {}
  // Fallback to expo-location reverse geocode
  try {
    const [result] = await Location.reverseGeocodeAsync(coords);
    if (!result) return 'Current Location';
    const parts = [result.street, result.district, result.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Current Location';
  } catch {
    return 'Current Location';
  }
}

export function openLocationSettings() {
  if (Platform.OS === 'ios') {
    Linking.openURL('app-settings:');
  } else {
    Linking.openSettings();
  }
}

export default function useLocation() {
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const { setUserCoords, setPickup } = useLocationStore();
  const watchRef = useRef(null);
  // Track the last position we ran reverse geocoding for
  const lastGeocodedRef = useRef(null);
  const lastPickupNameRef = useRef('Current Location');

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermissionDenied(true);
          setLoading(false);
          return;
        }
        setPermissionGranted(true);
        setPermissionDenied(false);

        // Try to get last known position first for instant loading
        let loc = await Location.getLastKnownPositionAsync({});
        if (!loc) {
          // Fallback to fresh position if no cache
          loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Balanced is faster on iOS / indoors
          });
        }

        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setUserCoords(coords);
        // Always geocode the initial position
        const name = await getAddressFromCoords(coords);
        lastPickupNameRef.current = name;
        lastGeocodedRef.current = coords;
        setPickup({ name, ...coords });

        watchRef.current = await Location.watchPositionAsync(
          {
            // High accuracy for better map following and address lookup
            accuracy: Location.Accuracy.High,
            timeInterval: 4000,
            distanceInterval: 5,
          },
          async (location) => {
            const c = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };
            setUserCoords(c);

            // Only hit the geocoding API when the user has moved >50m from the
            // last geocoded position — prevents a network call every 4 seconds.
            const prev = lastGeocodedRef.current;
            const movedFar =
              !prev ||
              haversineDistance(prev.latitude, prev.longitude, c.latitude, c.longitude) >
                GEOCODE_THRESHOLD_KM;

            if (movedFar) {
              lastGeocodedRef.current = c;
              const addressName = await getAddressFromCoords(c);
              lastPickupNameRef.current = addressName;
              setPickup({ name: addressName, ...c });
            } else {
              // Coordinates changed but address is still the same — update coords only
              setPickup({ name: lastPickupNameRef.current, ...c });
            }
          }
        );
      } catch (err) {
        console.warn('Location error:', err);
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
      }
    };
  }, []);

  return { permissionGranted, permissionDenied, loading };
}
