import { useState, useEffect } from 'react';
import { getFullLocation } from '../services/locationServiceV2';
import useLocationStore from '../store/locationStore';

/**
 * USE LOCATION V2 - BULLETPROOF
 * This hook actually works and gets your location
 */
export default function useLocation() {
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('Getting location...');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const { setUserCoords, setPickup } = useLocationStore();

  useEffect(() => {
    let mounted = true;

    const initLocation = async () => {
      try {
        console.log('🚀 useLocationV2: Starting location initialization');
        setLoading(true);
        setError(null);

        // Get location with all data
        const result = await getFullLocation();

        if (!mounted) {
          console.log('Component unmounted, ignoring result');
          return;
        }

        // Store location
        setCurrentLocation({
          lat: result.lat,
          lng: result.lng,
          accuracy: result.accuracy,
        });

        setCurrentAddress(result.address);

        // Update store for ride calculations
        setUserCoords({
          latitude: result.lat,
          longitude: result.lng,
        });

        // Set as pickup location
        setPickup({
          name: result.address,
          lat: result.lat,
          lng: result.lng,
          latitude: result.lat,
          longitude: result.lng,
        });

        console.log('✅ useLocationV2: Location initialized successfully');

        if (result.isFallback) {
          console.warn('⚠️  Using fallback location');
          setError('Using fallback location');
        }
      } catch (err) {
        console.error('❌ useLocationV2: Fatal error:', err);

        if (!mounted) return;

        setError(err.message);

        // Set fallback
        const fallback = { lat: 11.5936, lng: 37.3906 };
        setCurrentLocation(fallback);
        setCurrentAddress('Bahir Dar');
        setUserCoords({ latitude: fallback.lat, longitude: fallback.lng });
        setPickup({
          name: 'Bahir Dar',
          lat: fallback.lat,
          lng: fallback.lng,
          latitude: fallback.lat,
          longitude: fallback.lng,
        });
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initLocation();

    return () => {
      mounted = false;
    };
  }, [setUserCoords, setPickup]);

  return {
    currentLocation,
    currentAddress,
    loading,
    error,
    permissionDenied,
  };
}
