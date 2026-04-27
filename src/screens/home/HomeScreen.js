import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, Pressable, Dimensions, Image, Platform, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import ProfessionalRideMap from '../../components/map/ProfessionalRideMap';
import MovableCircleButton from '../../components/map/MovableCircleButton';
import DriverMarker from '../../components/map/DriverMarker';
import UberDestinationMarker from '../../components/map/UberDestinationMarker';
import UberUserLocationMarker from '../../components/map/UberUserLocationMarker';
import ProfessionalRoutePolyline from '../../components/map/ProfessionalRoutePolyline';
import {
  MapPin,
  Clock,
  Flag,
  RefreshCw,
  Hand,
  History,
  ChevronRight,
  XCircle,
  Settings,
  Smile,
} from 'lucide-react-native';
import HamburgerButton from '../../components/ui/HamburgerButton';
import LocationPinButton from '../../components/ui/LocationPinButton';
import BottomSheet from '../../components/ui/BottomSheet';
import CustomDrawer from '../../components/ui/CustomDrawer';
import RideTypeSelector from '../../components/ride/RideTypeSelector';
import LocationBar from '../../components/ride/LocationBar';
import RecentTrips from '../../components/ride/RecentTrips';
import AppButton from '../../components/common/AppButton';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import useRideStore from '../../store/rideStore';
import useLocationV2 from '../../hooks/useLocationV2';
import { detectCity } from '../../services/locationServiceV2';
import { extractNeighborhoodName } from '../../services/addressParserService';

console.log('🚀 HomeScreen loaded, detectCity function available:', typeof detectCity);
import { getNearbyDrivers } from '../../services/tripService';
import { haversineDistance, formatDistance } from '../../utils/distanceUtils';
import useRoute from '../../hooks/useRoute';
import { useNearbyDrivers } from '../../hooks/useTripQueries';
import Button from '../../components/design-system/Button';
import { connectSocket, getSocket, joinRiderRoom } from '../../services/socketService';
import { diagnosticCheckApiKey } from '../../utils/diagnostics';

// Addis Ababa city center — default when GPS not yet available
const ADDIS_ABABA_COORDS = { latitude: 9.0192, longitude: 38.7525 };
const PROMO_BANNERS = [require('../../../assets/banner.gif')];
const BANNER_WIDTH = Dimensions.get('window').width - 40;
const SCREEN_HEIGHT = Dimensions.get('window').height;
// Bottom sheet starts at 45% from top — this padding tells MapView to treat bottom 55% as obstructed
// so animateToRegion / onRegionChangeComplete centers within the visible 45% map area
const MAP_BOTTOM_PADDING = Math.round(SCREEN_HEIGHT * 0.55);
const MAP_PADDING = { top: 0, right: 0, bottom: MAP_BOTTOM_PADDING, left: 0 };

// Throttle socket updates to 500ms to prevent constant re-renders
function createThrottle(intervalMs) {
  let lastTime = 0;
  return (fn) => (...args) => {
    const now = Date.now();
    if (now - lastTime >= intervalMs) {
      lastTime = now;
      fn(...args);
    }
  };
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'greeting';
  if (hour < 17) return 'greetingAfternoon';
  return 'greetingEvening';
}

function normalizeDriverPoint(raw, idx) {
  const rawLat =
    raw?.lat ??
    raw?.latitude ??
    raw?.driver_lat ??
    raw?.current_lat ??
    raw?.location?.lat ??
    raw?.location?.latitude ??
    raw?.location?.driver_lat ??
    raw?.current_location?.lat ??
    raw?.current_location?.latitude ??
    raw?.coords?.lat ??
    raw?.coords?.latitude;
  const rawLng =
    raw?.lng ??
    raw?.lon ??
    raw?.longitude ??
    raw?.driver_lng ??
    raw?.current_lng ??
    raw?.location?.lng ??
    raw?.location?.lon ??
    raw?.location?.longitude ??
    raw?.location?.driver_lng ??
    raw?.current_location?.lng ??
    raw?.current_location?.lon ??
    raw?.current_location?.longitude ??
    raw?.coords?.lng ??
    raw?.coords?.longitude;
  const lat = Number(rawLat);
  const lng = Number(rawLng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const fullName =
    raw?.full_name ??
    raw?.fullName ??
    raw?.name ??
    raw?.driver_name ??
    raw?.driverName ??
    raw?.user?.full_name ??
    raw?.user?.fullName ??
    raw?.user?.name ??
    '';
  const carLabel =
    raw?.vehicle_category ??
    raw?.vehicleType ??
    raw?.car_type ??
    raw?.carType ??
    raw?.vehicle?.type ??
    raw?.vehicle?.model ??
    raw?.vehicle_model ??
    raw?.plate_number ??
    raw?.vehicle?.plate ??
    '';
  return {
    id: String(raw?.driver_id ?? raw?.id ?? raw?.driverId ?? raw?.user_id ?? `redis-${idx}`),
    lat,
    lng,
    heading: Number(raw?.heading ?? raw?.bearing ?? 0) || 0,
    fullName: String(fullName).trim(),
    carLabel: String(carLabel).trim(),
    live: true,
  };
}

function areDriverListsEqual(prev, next) {
  if (prev === next) return true;
  if (!Array.isArray(prev) || !Array.isArray(next)) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (
      a?.id !== b?.id ||
      a?.lat !== b?.lat ||
      a?.lng !== b?.lng ||
      a?.heading !== b?.heading ||
      a?.fullName !== b?.fullName ||
      a?.carLabel !== b?.carLabel ||
      a?.live !== b?.live
    ) {
      return false;
    }
  }
  return true;
}

export default function HomeScreen({ navigation }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { destination, recentDestinations, setDestination, setPickup, pickup, userCoords, setUserCoords, clearStops } = useLocationStore();
  const resetRideState = useRideStore((s) => s.reset);
  const displayCoords = userCoords ?? ADDIS_ABABA_COORDS;
  const selectedRideType = useRideStore((s) => s.selectedRideType);
  const categories = useRideStore((s) => s.categories);
  const categoriesLoading = useRideStore((s) => s.categoriesLoading);
  const categoriesLoaded = useRideStore((s) => s.categoriesLoaded);
  const fareEstimateLoading = useRideStore((s) => s.fareEstimateLoading);
  const selectedCategoryId = useRideStore((s) => s.selectedCategoryId);
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || null;
  const categorySelectionReady =
    !categoriesLoading &&
    !fareEstimateLoading &&
    categoriesLoaded &&
    categories.length > 0 &&
    !!selectedCategory;
  const routeInfo = useRideStore((s) => s.routeInfo);
  const pickupCoordinate = useMemo(() => {
    if (userCoords) return { latitude: userCoords.latitude, longitude: userCoords.longitude };
    if (pickup?.lat != null && pickup?.lng != null) {
      return { latitude: pickup.lat, longitude: pickup.lng };
    }
    return displayCoords;
  }, [userCoords, pickup?.lat, pickup?.lng, displayCoords.latitude, displayCoords.longitude]);

  const {
    coordinates: routeCoordinates,
    distanceKm:  routeDirectDistanceKm,
    durationMin: routeDurationMin,
  } = useRoute(
    destination ? pickupCoordinate : null,
    destination || null
  );

  // Prefer Gebeta direct distance → fare-estimate distance → haversine straight-line
  const routeDistanceKm = useMemo(() => {
    if (!destination) return null;
    if (routeDirectDistanceKm > 0) return routeDirectDistanceKm;
    const roadKm = routeInfo?.distance_km;
    if (typeof roadKm === 'number' && roadKm > 0) return roadKm;
    return haversineDistance(
      pickupCoordinate.latitude,
      pickupCoordinate.longitude,
      destination.lat,
      destination.lng
    );
  }, [destination, routeDirectDistanceKm, routeInfo?.distance_km, pickupCoordinate.latitude, pickupCoordinate.longitude, destination?.lat, destination?.lng]);

  // Prefer Gebeta direct duration → fare-estimate duration
  const routeDurationMinFinal = useMemo(() => {
    if (routeDurationMin > 0) return routeDurationMin;
    return routeInfo?.duration_min ?? 0;
  }, [routeDurationMin, routeInfo?.duration_min]);

  // Arrival time = now + route duration
  const arrivalTime = useMemo(() => {
    if (!destination || routeDurationMinFinal <= 0) return null;
    const eta = new Date(Date.now() + routeDurationMinFinal * 60 * 1000);
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }, [destination, routeDurationMinFinal]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(true);
  const [isInServiceArea, setIsInServiceArea] = useState(true);
  const { currentLocation, currentAddress, loading: locLoading, permissionDenied } = useLocationV2();

  // Get readable neighborhood name instead of full address
  const readableLocationName = useMemo(() => {
    if (!currentAddress || !currentLocation) return 'Getting location...';
    return extractNeighborhoodName(currentAddress, currentLocation.lat, currentLocation.lng);
  }, [currentAddress, currentLocation]);

  // Diagnostic check: verify API key loads correctly in production APK
  useEffect(() => {
    const diag = diagnosticCheckApiKey();
    if (!diag.isLoaded) {
      console.error('🚨 API Key not loaded! Check .env file and Google Cloud configuration.');
      console.error('   Expected key in Constants.expoConfig?.extra?.googleMapsKey or process.env');
    }
  }, []);

  useEffect(() => {
    if (currentLocation) {
      const checkCity = async () => {
        try {
          const res = await detectCity(currentLocation.lat, currentLocation.lng);
          setIsInServiceArea(res?.city !== 'unknown');
        } catch (err) {
          console.error('City check failed:', err);
        }
      };
      checkCity();

      // Sync userCoords in store for map centering
      setUserCoords({ latitude: currentLocation.lat, longitude: currentLocation.lng });

      // Update pickup location with readable name
      if (readableLocationName && readableLocationName !== 'Getting location...') {
        setPickup({
          name: readableLocationName,
          address: currentAddress,
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        });
      }
    }
  }, [currentLocation, readableLocationName, currentAddress, setPickup, setUserCoords]);
  const lastDrawerCloseAt = useRef(0);
  const bannerMarqueeX = useRef(new Animated.Value(0)).current;
  const isLoggedInRef = useRef(!!user?.id);
  const [showSmile, setShowSmile] = useState(false);
  const locationPulseAnim = useRef(new Animated.Value(1)).current;

  // Start waving animation for location text
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(locationPulseAnim, {
          toValue: 1.08,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(locationPulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [locationPulseAnim]);

  // Load drawer state from storage on mount
  useEffect(() => {
    const loadDrawerState = async () => {
      try {
        const stored = await AsyncStorage.getItem('drawerState');
        if (stored && isLoggedInRef.current) {
          setDrawerOpen(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Failed to load drawer state:', e);
      }
    };
    loadDrawerState();
  }, []);

  // Save drawer state to storage when it changes (only while logged in)
  useEffect(() => {
    const saveDrawerState = async () => {
      try {
        if (isLoggedInRef.current) {
          await AsyncStorage.setItem('drawerState', JSON.stringify(drawerOpen));
        }
      } catch (e) {
        console.warn('Failed to save drawer state:', e);
      }
    };
    saveDrawerState();
  }, [drawerOpen]);

  // Clear drawer state on logout
  useEffect(() => {
    if (!user?.id) {
      isLoggedInRef.current = false;
      setDrawerOpen(false);
      AsyncStorage.removeItem('drawerState');
    } else {
      isLoggedInRef.current = true;
    }
  }, [user?.id]);

  const handleCloseDrawer = useCallback(() => {
    lastDrawerCloseAt.current = Date.now();
    setTimeout(() => {
      setDrawerOpen(false);
    }, 200);
  }, []);

  const handleToggleDrawer = useCallback(() => {
    if (drawerOpen) {
      handleCloseDrawer();
      return;
    }
    if (Date.now() - lastDrawerCloseAt.current < 320) return;
    setDrawerOpen(true);
  }, [drawerOpen, handleCloseDrawer]);

  const avatarUrl = user?.avatarUrl || user?.avatar_url || null;
  const userName = user?.fullName ? `, ${user.fullName.split(' ')[0]}` : '';

  const [drivers, setDrivers] = useState([]);
  const driversRef = useRef([]);
  const lastDriverUpdateRef = useRef(0);
  const throttleMs = 800; // Throttle location updates to 800ms (from constant 500ms)

  const { data: nearbyDriversRes } = useNearbyDrivers(displayCoords, 10);

  useEffect(() => {
    if (nearbyDriversRes) {
      const list = Array.isArray(nearbyDriversRes?.data) ? nearbyDriversRes.data : [];
      const mapped = list.map((d, idx) => normalizeDriverPoint(d, idx)).filter(Boolean);
      if (!areDriverListsEqual(driversRef.current, mapped)) {
        driversRef.current = mapped;
        setDrivers(mapped);
      }
    }
  }, [nearbyDriversRes]);

  // Socket live updates for active drivers on Home map.
  useEffect(() => {
    if (!token || !user?.id) return undefined;
    const socket = connectSocket(token);
    joinRiderRoom(user.id);
    if (!socket) return undefined;
    const riderTag = `[RIDER_SOCKET user:${user.id}]`;

    const throttleLocationUpdates = createThrottle(throttleMs);

    const mergeDrivers = (incoming) => {
      const list = Array.isArray(incoming) ? incoming : [];
      const mapped = list.map((d, idx) => normalizeDriverPoint(d, idx)).filter(Boolean);
      if (mapped.length === 0) return;
      const prevMap = new Map(driversRef.current.map((d) => [d.id, d]));
      mapped.forEach((d) => prevMap.set(d.id, { ...(prevMap.get(d.id) || {}), ...d }));
      const next = Array.from(prevMap.values());
      if (!areDriverListsEqual(driversRef.current, next)) {
        driversRef.current = next;
        setDrivers(next);
      }
    };

    const onNearbyUpdate = (payload) => {
      const list =
        payload?.drivers ??
        payload?.data?.drivers ??
        payload?.data ??
        payload?.items ??
        [];
      mergeDrivers(list);
    };

    const handleDriverLocation = (payload) => {
      const point = normalizeDriverPoint(payload?.driver ?? payload?.data ?? payload, 0);
      if (!point) return;
      const base = driversRef.current;
      const idx = base.findIndex((d) => d.id === point.id);
      let next;
      if (idx === -1) {
        next = [...base, point];
      } else {
        next = [...base];
        next[idx] = { ...next[idx], ...point };
      }
      if (!areDriverListsEqual(base, next)) {
        driversRef.current = next;
        setDrivers(next);
      }
    };

    const onDriverLocation = throttleLocationUpdates(handleDriverLocation);

    const handleDriverOnline = (payload) => {
      const point = normalizeDriverPoint(payload?.driver ?? payload?.data ?? payload, 0);
      if (!point) return;
      const base = driversRef.current;
      const idx = base.findIndex((d) => d.id === point.id);
      let next;
      if (idx === -1) {
        next = [...base, point];
      } else {
        next = [...base];
        next[idx] = { ...next[idx], ...point, live: true };
      }
      if (!areDriverListsEqual(base, next)) {
        driversRef.current = next;
        setDrivers(next);
      }
    };

    const onDriverOnline = throttleLocationUpdates(handleDriverOnline);

    const onDriverOffline = (payload) => {
      const id = String(
        payload?.driver_id ??
        payload?.driverId ??
        payload?.id ??
        payload?.data?.driver_id ??
        ''
      );
      if (!id) return;
      const filtered = driversRef.current.filter((d) => d.id !== id);
      if (filtered.length !== driversRef.current.length) {
        driversRef.current = filtered;
        setDrivers(filtered);
      }
    };

    const onConnect = () => {
      // Visible in Expo/Metro logs for quick verification
      // eslint-disable-next-line no-console
      console.info(`${riderTag} connected socket_id=${socket.id}`);
    };
    const onDisconnect = (reason) => {
      // eslint-disable-next-line no-console
      console.warn(`${riderTag} disconnected reason=${reason}`);
    };
    const onConnectError = async (err) => {
      const msg = err?.message || err || '';
      console.error(`${riderTag} connect_error:`, msg);

      // Auto-recover from expired JWTs instantly
      if (msg.includes('Invalid token') || msg.includes('expired')) {
        const currentToken = useAuthStore.getState().token;
        const currentRefreshToken = useAuthStore.getState().refreshToken;

        // Skip refresh for mock/local tokens — they are not real JWTs
        if (!currentToken || !currentToken.startsWith('eyJ')) {
          console.warn(`${riderTag} Mock token detected — skipping socket refresh.`);
          return;
        }

        if (currentRefreshToken) {
          try {
            console.log(`${riderTag} Token naturally expired. Securing a fresh JWT core...`);
            const { refreshTokens } = require('../../services/authService');
            const res = await refreshTokens(currentRefreshToken);
            if (res?.data?.accessToken) {
               await useAuthStore.getState().setTokens(res.data.accessToken, res.data.refreshToken);
               // Updating store triggers a clean re-render & re-hooks the socket with new token
            }
          } catch (e) {
            console.error(`${riderTag} JWT Core refresh rejected by backend.`, e);
          }
        }
      }
    };

    // Keep optional aggregate channels (if backend emits them), and bind official per-driver events.
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('drivers:nearby_update', onNearbyUpdate);
    socket.on('drivers:online', onNearbyUpdate);
    socket.on('driver:location', onDriverLocation);
    socket.on('driver:updated', onDriverLocation);
    socket.on('driver:online', onDriverOnline);
    socket.on('driver:offline', onDriverOffline);
    if (socket.connected) onConnect();

    return () => {
      const s = getSocket();
      s?.off('connect', onConnect);
      s?.off('disconnect', onDisconnect);
      s?.off('connect_error', onConnectError);
      s?.off('drivers:nearby_update', onNearbyUpdate);
      s?.off('drivers:online', onNearbyUpdate);
      s?.off('driver:location', onDriverLocation);
      s?.off('driver:updated', onDriverLocation);
      s?.off('driver:online', onDriverOnline);
      s?.off('driver:offline', onDriverOffline);
    };
  }, [token, user?.id]);


  const hasInitialRegion = useRef(false);
  const hasRefitForUser = useRef(false);
  const MIN_DELTA = 0.003;
  const PADDING = 0.001;
  useEffect(() => {
    if (userCoords && !hasRefitForUser.current) {
      hasRefitForUser.current = true;
      hasInitialRegion.current = false; // Allow one initial center
    }
  }, [!!userCoords]);
  useEffect(() => {
    if (!mapRef.current || hasInitialRegion.current) return;
    // Only center on user + destination — not on drivers array.
    // Drivers update every few seconds via socket/poll which would re-trigger
    // this effect and fight the user's map pan/zoom gestures.
    const coords = [{ latitude: displayCoords.latitude, longitude: displayCoords.longitude }];
    if (destination) {
      coords.push({ latitude: destination.lat, longitude: destination.lng });
    }
    const lats = coords.map((c) => c.latitude);
    const lngs = coords.map((c) => c.longitude);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const latSpan = Math.max(MIN_DELTA, Math.max(...lats) - Math.min(...lats) + PADDING);
    const lngSpan = Math.max(MIN_DELTA, Math.max(...lngs) - Math.min(...lngs) + PADDING);
    const timer = setTimeout(() => {
      if (mapRef.current && !hasInitialRegion.current) {
        mapRef.current.animateToRegion(
          {
            latitude: centerLat,
            longitude: centerLng,
            latitudeDelta: latSpan,
            longitudeDelta: lngSpan,
          },
          250
        );
        hasInitialRegion.current = true;
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destination, displayCoords.latitude, displayCoords.longitude]);

  useEffect(() => {
    if (!mapRef.current || !destination) return;
    const start = { latitude: pickupCoordinate.latitude, longitude: pickupCoordinate.longitude };
    const end = { latitude: destination.lat, longitude: destination.lng };
    const toFit = routeCoordinates.length >= 2 ? routeCoordinates : [start, end];
    mapRef.current.fitToCoordinates(toFit, {
      edgePadding: { top: 88, right: 40, bottom: 220, left: 40 },
      animated: true,
    });
  }, [destination?.id || destination?.placeId]);

  // NEW: Re-center map dynamically when destination is cleared
  useEffect(() => {
    if (!destination && mapRef.current && hasInitialRegion.current) {
      // Small delay to ensure state has settled and map is ready
      const timer = setTimeout(() => {
        if (mapRef.current && !destination) {
          mapRef.current.animateToRegion(
            {
              latitude: displayCoords.latitude,
              longitude: displayCoords.longitude,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            },
            600
          );
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [!!destination, displayCoords.latitude, displayCoords.longitude]);

  const handleFindDrivers = useCallback(() => {
    navigation.navigate('ConfirmRide');
  }, [navigation]);

  const handleClearDestinationFlow = useCallback(() => {
    setDestination(null);
    clearStops();
    resetRideState();
  }, [setDestination, clearStops, resetRideState]);


  const handleRecenter = useCallback(() => {
    InteractionManager.runAfterInteractions(() => {
      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: displayCoords.latitude,
            longitude: displayCoords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          },
          500
        );
      }
    });
  }, [displayCoords.latitude, displayCoords.longitude]);

  const handlePickupDrag = useCallback((coord) => {
    // Update store with dragged position
    setUserCoords({ latitude: coord.latitude, longitude: coord.longitude });
    setPickup({
      name: `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`,
      address: 'Custom pickup location',
      lat: coord.latitude,
      lng: coord.longitude,
    });
  }, [setUserCoords, setPickup]);

  const greeting = t(`home.${getGreeting()}`);

  const waveAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const wave = () => {
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Toggle smile after wave finishes
        setTimeout(() => {
          setShowSmile(prev => !prev);
        }, 1200);
      });
    };
    wave();
    const interval = setInterval(wave, 2500);
    return () => clearInterval(interval);
  }, [waveAnim]);

  const handRotation = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-30deg'],
  });
  const selectBtnSkeletonOpacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(bannerMarqueeX, {
        toValue: -BANNER_WIDTH,
        duration: 7000,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => {
      loop.stop();
      bannerMarqueeX.setValue(0);
    };
  }, [bannerMarqueeX]);

  useEffect(() => {
    if (!(destination && !categoriesLoaded)) return undefined;
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(selectBtnSkeletonOpacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(selectBtnSkeletonOpacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ])
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [destination, categoriesLoaded, selectBtnSkeletonOpacity]);


  return (
    <View style={styles.container} collapsable={false}>
      <ProfessionalRideMap
        mapRef={mapRef}
        style={styles.mapWrapper}
        mapPadding={destination ? undefined : MAP_PADDING}
        showStreetNames={true}
        showRoadLines={true}
      >
        {/* User location marker with professional styling */}
        <UberUserLocationMarker
          coordinate={destination ? pickupCoordinate : displayCoords}
          avatarUrl={avatarUrl}
          heading={0}
          animated={true}
        />
        {useMemo(() => (
          <>
            {destination && (
              <UberDestinationMarker
                coordinate={{ latitude: destination.lat, longitude: destination.lng }}
                title={destination.name || destination.address || t('home.whereTo')}
              />
            )}
            {destination && routeCoordinates.length >= 2 && (
              <ProfessionalRoutePolyline coordinates={routeCoordinates} />
            )}
            {drivers.map((driver) => (
              <DriverMarker key={driver.id} driver={driver} />
            ))}
          </>
        ), [destination, routeCoordinates, drivers, t])}
      </ProfessionalRideMap>

      {/* Route info chip — pointerEvents none so it NEVER blocks map touch */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {destination && routeDistanceKm != null && (
          <View style={[styles.routeInfoChip, { top: insets.top + 118 }]}>
            <MapPin size={11} color={colors.primary} />
            <Text style={styles.routeDistanceKm}>{formatDistance(routeDistanceKm)}</Text>
            {routeDurationMinFinal > 0 && (
              <>
                <View style={styles.routeChipDivider} />
                <Clock size={11} color={colors.primary} />
                <Text style={styles.routeDistanceKm}>
                  {routeDurationMinFinal < 60
                    ? `${Math.round(routeDurationMinFinal)} min`
                    : `${Math.floor(routeDurationMinFinal / 60)}h ${Math.round(routeDurationMinFinal % 60)}m`}
                </Text>
              </>
            )}
            {arrivalTime && (
              <>
                <View style={styles.routeChipDivider} />
                <Flag size={11} color={colors.primary} />
                <Text style={styles.routeDistanceKm}>{arrivalTime}</Text>
              </>
            )}
          </View>
        )}
      </View>

      {/* SOS button - rendered directly to avoid full-screen touch blocking */}
      <MovableCircleButton />

      {/* Location info at bottom - outside glass style */}
      {userCoords && (
        <View style={[styles.locationBottomBar, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
          <Pressable
            style={styles.locationInfoButton}
            onPress={handleRecenter}
            android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
          >
            <MapPin size={13} color={colors.primary} />
            <Text style={styles.locationBottomText} numberOfLines={1}>
              {pickup?.name || 'Current Location'}
            </Text>
          </Pressable>
          <Pressable
            style={styles.locationSyncButton}
            onPress={handleRecenter}
            android_ripple={{ color: 'rgba(0,0,0,0.1)' }}
          >
            <RefreshCw size={12} color={colors.primary} />
          </Pressable>
        </View>
      )}

      {/* Overlays - only capture touches in their bounds */}
      <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="box-none" collapsable={false}>
        {/* Row 1: hamburger + greeting + recenter */}
        <View className="flex-row items-center px-4" pointerEvents="box-none">
          <HamburgerButton isOpen={drawerOpen} onPress={handleToggleDrawer} />
          
          <Pressable 
            className="flex-1 mx-3 h-10 rounded-full bg-black/40 flex-row items-center px-4 overflow-hidden border border-white/10"
            onPress={() => navigation.navigate('Search', { mode: 'destination' })}
          >
            <Text className="text-white font-italic text-sm flex-1" numberOfLines={1}>
              {greeting}{userName}{' '}
            </Text>
            <Animated.View style={{ transform: [{ rotate: handRotation }] }}>
              {showSmile ? (
                <Text style={{ fontSize: 13, marginLeft: 2 }}>😂</Text>
              ) : (
                <Hand size={14} color="#00674F" />
              )}
            </Animated.View>
          </Pressable>

          <LocationPinButton onPress={handleRecenter} />
        </View>

        {/* Row 2: current location label with waving animation */}
        <Animated.View 
          className="px-4 mt-2 items-center" 
          pointerEvents="none"
          style={{ transform: [{ scale: locationPulseAnim }] }}
        >
          <View className="bg-white/90 self-center px-3 py-1 rounded-full flex-row items-center border border-gray-100 shadow-sm">
            <View className="mr-2">
              <MapPin size={9} color="#FF0000" />
            </View>
            <Text 
              className="font-italic text-[10px] font-semibold" 
              style={{ color: '#FF0000' }}
              numberOfLines={1}
            >
              {pickup?.name && pickup.name !== 'Your current location' && pickup.name !== 'Current Location'
                ? pickup.name
                : userCoords
                  ? 'Locating…'
                  : 'Enable location'}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* Bottom sheet — self-positions at bottom, pointerEvents managed internally */}
      <View
        style={styles.sheetWrapper}
        pointerEvents="box-none"
      >
        <BottomSheet
          key="main-ride-sheet"
          style={styles.sheet}
          minHeight={destination ? SCREEN_HEIGHT * 0.52 : 420}
          maxHeight={SCREEN_HEIGHT * 0.85}
          initialExpanded={false}
          onExpandedChange={setSheetExpanded}
          header={!destination ? (
            isInServiceArea ? (
              <LocationBar
                onToPress={() => navigation.navigate('Search', { mode: 'destination' })}
                onFromPress={() => {}}
                onStopPress={(index) => navigation.navigate('Search', { mode: 'stop', stopIndex: index })}
                onAddStopPress={null}
              />
            ) : (
              <View style={styles.outOfAreaBanner}>
                <MapPin size={20} color={colors.textSecondary} />
                <Text style={styles.outOfAreaText}>Bahirdar is not available in your area yet</Text>
              </View>
            )
          ) : (
            <View style={styles.destinationOnlyInput}>
              <Pressable
                style={styles.destinationOnlyMain}
                onPress={() => navigation.navigate('Search', { mode: 'destination' })}
                android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
              >
                <MapPin size={14} color={colors.primary} style={styles.destinationOnlyIcon} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.destinationOnlyText} numberOfLines={1}>
                    {destination?.name || destination?.address || t('home.whereTo')}
                  </Text>
                  {routeDistanceKm != null && (
                    <Text style={styles.destinationSubText}>
                      {formatDistance(routeDistanceKm)} • {Math.round(routeDurationMinFinal)} min
                    </Text>
                  )}
                </View>
              </Pressable>
              <Pressable
                style={styles.destinationOnlyAction}
                onPress={handleClearDestinationFlow}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                android_ripple={{ color: 'rgba(239,68,68,0.1)', borderless: true }}
              >
                <XCircle size={18} color="rgba(239,68,68,0.6)" />
              </Pressable>
            </View>
          )}
        >
          {!destination && (
            <View style={styles.recentSection}>
              {/* Actual search history - limited to 3 */}
              <RecentTrips
                onSelectPlace={(place) => setDestination(place)}
                limit={3}
              />
              
              {/* If no history yet, show a hint */}
              {recentDestinations.length === 0 && (
                <View style={styles.hintSection}>
                  <Text style={styles.hintText}>{t('search.typeToSearch')}</Text>
                </View>
              )}
            </View>
          )}
          {destination && (
            <View style={styles.categorySection}>
              <RideTypeSelector showAll={sheetExpanded} />
            </View>
          )}
        </BottomSheet>
      </View>

      {/* Sticky Select button — fixed at bottom, never moves with sheet */}
      {destination && (
        <View 
          style={[styles.stickyButton, { paddingBottom: Math.max(16, insets.bottom) + 16 }]}
          pointerEvents="box-none"
        >
          <Button
            label={selectedCategory ? `Select ${selectedCategory.name}` : 'Select a Category'}
            onPress={handleFindDrivers}
            loading={!categorySelectionReady}
            disabled={!selectedCategory}
            shimmer={true}
            className="w-full"
          />
        </View>
      )}

      {/* Custom drawer — rendered on top of everything */}
      <CustomDrawer
        visible={drawerOpen}
        onClose={handleCloseDrawer}
        navigation={navigation}
      />

      {/* Location permission gate — blocks the screen until user enables location */}
      {permissionDenied && (
        <View style={styles.locationGate} pointerEvents="box-none">
          <View style={styles.locationGateCard}>
            <View style={styles.locationGateIcon}>
              <MapPin size={32} color={colors.primary} />
            </View>
            <Text style={styles.locationGateTitle}>Location Required</Text>
            <Text style={styles.locationGateBody}>
              BahirdarRide needs your location to show nearby drivers and set your pickup point.
            </Text>
            <Pressable
              style={styles.locationGateBtn}
              onPress={openLocationSettings}
              android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
            >
              <Settings size={14} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.locationGateBtnText}>Open Settings</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
  },
  mapWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'column',
    gap: 8,
    zIndex: 2,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greetingPill: {
    flex: 1,
    flexDirection: 'row',
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.62)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.78)',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  greetingGlassGlowTop: {
    position: 'absolute',
    top: -10,
    left: 10,
    right: 10,
    height: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  greetingGlassGlowSide: {
    position: 'absolute',
    right: -18,
    top: -6,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  greetingText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#0F172A',
    letterSpacing: 0.1,
    textShadowColor: 'rgba(255,255,255,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationRow: {
    alignItems: 'center',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    maxWidth: '72%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  locationText: {
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
    flexShrink: 1,
  },
  routeInfoChip: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  routeChipDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
    marginHorizontal: 2,
  },
  routeDistanceKm: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
    justifyContent: 'flex-end',
  },
  stickyButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 10,
    zIndex: 2,
  },
  selectButtonSkeleton: {
    height: 56,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.border,
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  destinationOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
  },
  destinationOnlyMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  destinationOnlyIcon: {
    marginRight: 10,
  },
  destinationOnlyText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
    lineHeight: 20,
  },
  destinationOnlyAction: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  bannerWrap: {
    marginTop: 12,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  bannerCarousel: {
    width: BANNER_WIDTH * 2,
    flexDirection: 'row',
  },
  bannerImage: {
    width: BANNER_WIDTH,
    height: 54,
  },
  categorySection: {
    marginTop: 10,
    paddingBottom: 20,
  },
  findBtn: {
    marginTop: 10,
  },
  recentSection: {
    marginTop: 16,
  },
  recentLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  recentLabelMargin: {
    marginTop: 10,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 10,
  },
  recentIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recentItemText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  hintSection: {
    paddingVertical: 24,
  },
  hintText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Center pickup pin overlay
  pickupPinWrap: {
    position: 'absolute',
    // Center in the visible map area (top 45% of screen)
    top: SCREEN_HEIGHT * 0.45 / 2 - 28,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  pickupPinContainer: {
    alignItems: 'center',
  },
  pickupPinCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  pickupPinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  pickupPinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary,
    marginTop: -1,
  },
  pickupPinShadowWrap: {
    marginTop: 2,
    alignItems: 'center',
  },
  pickupPinShadow: {
    width: 14,
    height: 5,
    borderRadius: 7,
    backgroundColor: '#000',
    opacity: 0.2,
  },
  // Location permission gate
  locationGate: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9998,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  locationGateCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  locationGateIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${colors.primary}14`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  locationGateTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  locationGateBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  locationGateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  locationGateBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.white,
  },
  locationBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundClor: 'rgba(0,0,0,0)',
  },
  locationInfoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  locationBottomText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  locationSyncButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  outOfAreaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: borderRadius.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    marginBottom: 8,
  },
  outOfAreaText: {
    fontSize: fontSize.sm,
    color: '#991B1B',
    fontWeight: fontWeight.medium,
  },
  destinationSubText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: -1,
    lineHeight: 14,
  },
});
