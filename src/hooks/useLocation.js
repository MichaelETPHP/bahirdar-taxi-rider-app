import { useState, useEffect } from 'react';
import { Platform, Linking } from 'react-native';
import { getCurrentLocation, reverseGeocode } from '../services/location.service';
import useLocationStore from '../store/locationStore';

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

/**
 * useLocation hook to get rider's current position and address
 * Includes retry logic and comprehensive error handling
 */
export const useLocation = () => {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const { setUserCoords, setPickup } = useLocationStore();

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('[useLocation] Initializing location fetch...');

        // Get current location with retries
        let location = null;
        let lastError = null;

        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
          try {
            console.log(`[useLocation] Attempt ${attempt + 1}/${MAX_RETRIES}`);
            location = await getCurrentLocation();
            console.log('[useLocation] Location obtained:', location);
            break;
          } catch (err) {
            lastError = err;
            console.warn(`[useLocation] Attempt ${attempt + 1} failed:`, err.message);

            if (err.message === 'Location permission denied') {
              setPermissionDenied(true);
              throw err;
            }

            if (attempt < MAX_RETRIES - 1) {
              await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
            }
          }
        }

        if (!location) {
          throw lastError || new Error('Failed to get location after retries');
        }

        // Set location in state and store
        setCurrentLocation(location);
        const coords = { latitude: location.lat, longitude: location.lng };
        setUserCoords(coords);

        // Get reverse geocoded address
        console.log('[useLocation] Getting reverse geocoded address...');
        const address = await reverseGeocode(location.lat, location.lng);
        console.log('[useLocation] Address:', address);

        setCurrentAddress(address);
        setPickup({
          name: address,
          lat: location.lat,
          lng: location.lng,
          ...coords,
        });

        console.log('[useLocation] Location initialization complete');
      } catch (err) {
        const errorMessage = err.message || 'Unknown error';
        console.error('[useLocation] Fatal error:', errorMessage);
        setError(errorMessage);

        if (errorMessage === 'Location permission denied') {
          setPermissionDenied(true);
          console.log('[useLocation] Location permission was denied');
        }

        // Set fallback location (Addis Ababa center)
        const fallback = {
          lat: 9.0192,
          lng: 38.7469,
          accuracy: null,
        };
        setCurrentLocation(fallback);
        setCurrentAddress('Addis Ababa');
        setUserCoords({ latitude: fallback.lat, longitude: fallback.lng });
        setPickup({
          name: 'Addis Ababa',
          lat: fallback.lat,
          lng: fallback.lng,
          latitude: fallback.lat,
          longitude: fallback.lng,
        });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [setUserCoords, setPickup]);

  return {
    currentLocation,
    currentAddress,
    loading,
    error,
    permissionDenied,
  };
};

export function openLocationSettings() {
  try {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  } catch (err) {
    console.error('[openLocationSettings] Error:', err.message);
  }
}

export default useLocation;
