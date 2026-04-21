import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Image, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import RideMap from '../../components/map/RideMap';
import MovableCircleButton from '../../components/map/MovableCircleButton';
import DriverMarker from '../../components/map/DriverMarker';
import DestMarker from '../../components/map/DestMarker';
import UserMarker from '../../components/map/UserMarker';
import RoutePolyline from '../../components/map/RoutePolyline';
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
} from 'lucide-react-native';
import HamburgerButton from '../../components/ui/HamburgerButton';
import LocationPinButton from '../../components/ui/LocationPinButton';
import BottomSheet from '../../components/ui/BottomSheet';
import CustomDrawer from '../../components/ui/CustomDrawer';
import RideTypeSelector from '../../components/ride/RideTypeSelector';
import LocationBar from '../../components/ride/LocationBar';
import AppButton from '../../components/common/AppButton';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import useRideStore from '../../store/rideStore';
import useLocation, { openLocationSettings } from '../../hooks/useLocation';
import { mockTrips } from '../../data/mockTrips';
import { mockLocations } from '../../data/mockLocations';
import { getNearbyDrivers } from '../../services/tripService';
import { haversineDistance, formatDistance } from '../../utils/distanceUtils';
import useRoute from '../../hooks/useRoute';
import { useNearbyDrivers } from '../../hooks/useTripQueries';
import Button from '../../components/design-system/Button';
import { connectSocket, getSocket, joinRiderRoom } from '../../services/socketService';

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
  const { destination, recentDestinations, setDestination, setPickup, pickup, userCoords, clearStops } = useLocationStore();
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
  const lastDrawerCloseAt = useRef(0);
  const bannerMarqueeX = useRef(new Animated.Value(0)).current;
  const isLoggedInRef = useRef(!!user?.id);

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


  const { permissionDenied } = useLocation();

  const avatarUrl = user?.avatarUrl || user?.avatar_url || null;
  const userName = user?.fullName ? `, ${user.fullName.split(' ')[0]}` : '';

  const [drivers, setDrivers] = useState([]);
  const driversRef = useRef([]);

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

    const throttleLocationUpdates = createThrottle(500);

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
      hasInitialRegion.current = false;
      hasRefitForUser.current = true;
    }
  }, [userCoords]);
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
  }, [destination, pickupCoordinate.latitude, pickupCoordinate.longitude, destination?.lat, destination?.lng, routeCoordinates]);

  const handleFindDrivers = useCallback(() => {
    navigation.navigate('ConfirmRide');
  }, [navigation]);

  const handleClearDestinationFlow = useCallback(() => {
    setDestination(null);
    clearStops();
    resetRideState();
  }, [setDestination, clearStops, resetRideState]);

  const handleRecenter = useCallback(() => {
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
  }, [displayCoords.latitude, displayCoords.longitude]);

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
      ]).start();
    };
    wave();
    const interval = setInterval(wave, 2000);
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

  const recentTrips = useMemo(() => mockTrips.slice(0, 4), []);

  const getLocationFromTripDestination = useCallback((destName) => {
    const found = mockLocations.find((l) => l.name === destName);
    return found || { id: `trip-${destName}`, name: destName, address: destName, lat: 9.0192, lng: 38.7525 };
  }, []);

  return (
    <View style={styles.container} collapsable={false}>
      {/* Map - full touch access for pan & zoom */}
      <View style={styles.mapWrapper}>
        <RideMap
          mapRef={mapRef}
          mapPadding={destination ? undefined : MAP_PADDING}
        >
          <UserMarker
            coordinate={destination ? pickupCoordinate : displayCoords}
            avatarUrl={avatarUrl}
            name={user?.fullName}
            label={destination ? t('home.currentLocation') : undefined}
          />
          {destination && (
            <DestMarker
              coordinate={{ latitude: destination.lat, longitude: destination.lng }}
              caption={t('ride.destination')}
              title={destination.name || destination.address || t('home.whereTo')}
            />
          )}
          {destination && routeCoordinates.length >= 2 ? (
            <RoutePolyline coordinates={routeCoordinates} />
          ) : null}
          {drivers.map((driver) => (
            <DriverMarker key={driver.id} driver={driver} />
          ))}
        </RideMap>

        {destination && routeDistanceKm != null ? (
          <View style={[styles.routeInfoChip, { top: insets.top + 118 }]} pointerEvents="none">
            {/* Distance */}
            <MapPin size={11} color={colors.primary} />
            <Text style={styles.routeDistanceKm}>{formatDistance(routeDistanceKm)}</Text>
            {/* Duration */}
            {routeDurationMinFinal > 0 ? (
              <>
                <View style={styles.routeChipDivider} />
                <Clock size={11} color={colors.primary} />
                <Text style={styles.routeDistanceKm}>
                  {routeDurationMinFinal < 60
                    ? `${Math.round(routeDurationMinFinal)} min`
                    : `${Math.floor(routeDurationMinFinal / 60)}h ${Math.round(routeDurationMinFinal % 60)}m`}
                </Text>
              </>
            ) : null}
            {/* Arrival time */}
            {arrivalTime ? (
              <>
                <View style={styles.routeChipDivider} />
                <Flag size={11} color={colors.primary} />
                <Text style={styles.routeDistanceKm}>{arrivalTime}</Text>
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* SOS button - box-none lets map receive touches outside the button */}
      <View style={styles.sosButtonWrap} pointerEvents="box-none">
        <MovableCircleButton />
      </View>

      {/* Location info at bottom - outside glass style */}
      {userCoords && (
        <View style={[styles.locationBottomBar, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={styles.locationInfoButton}
            onPress={handleRecenter}
            activeOpacity={0.8}
          >
            <MapPin size={13} color={colors.primary} />
            <Text style={styles.locationBottomText} numberOfLines={1}>
              {pickup?.name || 'Current Location'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.locationSyncButton}
            onPress={handleRecenter}
            activeOpacity={0.7}
          >
            <RefreshCw size={12} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Overlays - only capture touches in their bounds */}
      <View style={[styles.topBar, { top: insets.top + 12 }]} pointerEvents="box-none" collapsable={false}>
        {/* Row 1: hamburger + greeting + recenter */}
        <View className="flex-row items-center px-4" pointerEvents="box-none">
          <HamburgerButton isOpen={drawerOpen} onPress={handleToggleDrawer} />
          
          <View className="flex-1 mx-3 h-10 rounded-full bg-black/40 flex-row items-center px-4 overflow-hidden border border-white/10">
            <Text className="text-white font-italic text-sm flex-1" numberOfLines={1}>
              {greeting}{userName}{' '}
            </Text>
            <Animated.View style={{ transform: [{ rotate: handRotation }] }}>
              <Hand size={14} color="#00674F" />
            </Animated.View>
          </View>

          <LocationPinButton onPress={handleRecenter} />
        </View>

        {/* Row 2: current location label */}
        <View className="px-4 mt-2" pointerEvents="none">
          <View className="bg-white/90 self-start px-3 py-1 rounded-full flex-row items-center border border-gray-100 shadow-sm">
            <View className="mr-2">
              <MapPin size={9} color="#00674F" />
            </View>
            <Text className="text-primary font-italic text-[10px] font-semibold" numberOfLines={1}>
              {pickup?.name && pickup.name !== 'Your current location' && pickup.name !== 'Current Location'
                ? pickup.name
                : userCoords
                  ? 'Locating…'
                  : 'Enable location'}
            </Text>
          </View>
        </View>
      </View>

      {/* Bottom sheet:
            • No destination  → opens at 50%, no expansion needed
            • With destination → collapses to 50% by default (3 categories visible),
                                  swipe up expands to 90% (all categories) */}
      <View
        style={[
          styles.sheetWrapper,
          { top: SCREEN_HEIGHT * (destination ? 0.1 : 0.5) },
        ]}
        pointerEvents="box-none"
      >
        <BottomSheet
          key={destination ? 'sheet-destination' : 'sheet-search'}
          style={styles.sheet}
          minHeight={destination ? SCREEN_HEIGHT * 0.5 : undefined}
          maxHeight={SCREEN_HEIGHT * (destination ? 0.9 : 0.5)}
          initialExpanded={destination ? false : true}
          onExpandedChange={setSheetExpanded}
          header={!destination ? (
            <LocationBar
              onToPress={() => navigation.navigate('Search', { mode: 'destination' })}
              onFromPress={() => {}}
              onStopPress={(index) => navigation.navigate('Search', { mode: 'stop', stopIndex: index })}
              onAddStopPress={null}
            />
          ) : (
            <View style={styles.destinationOnlyInput}>
              <TouchableOpacity
                style={styles.destinationOnlyMain}
                onPress={() => navigation.navigate('Search', { mode: 'destination' })}
                activeOpacity={0.8}
              >
                <MapPin size={14} color={colors.primary} style={styles.destinationOnlyIcon} />
                <Text style={styles.destinationOnlyText} numberOfLines={1}>
                  {destination?.name || destination?.address || t('home.whereTo')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.destinationOnlyAction}
                onPress={handleClearDestinationFlow}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.7}
              >
                <XCircle size={18} color="rgba(239,68,68,0.6)" />
              </TouchableOpacity>
            </View>
          )}
        >
          {!destination && (
            <View style={styles.recentSection}>
              {/* Recent trips - max 4 */}
              {recentTrips.length > 0 && (
                <>
                  <Text style={styles.recentLabel}>{t('home.recentTrips')}</Text>
                  {recentTrips.map((trip) => {
                    const loc = getLocationFromTripDestination(trip.destination);
                    return (
                      <TouchableOpacity
                        key={trip.id}
                        style={styles.recentItem}
                        onPress={() => setDestination(loc)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.recentIcon}>
                          <History size={14} color={colors.primary} />
                        </View>
                        <Text style={styles.recentItemText} numberOfLines={1}>{trip.destination}</Text>
                        <ChevronRight size={12} color={colors.textSecondary} />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
              {/* Recent search destinations */}
              {recentDestinations.length > 0 && (
                <>
                  <Text style={[styles.recentLabel, recentTrips.length > 0 && styles.recentLabelMargin]}>{t('search.recent')}</Text>
                  {recentDestinations.map((loc) => (
                    <TouchableOpacity
                      key={loc.id}
                      style={styles.recentItem}
                      onPress={() => setDestination(loc)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.recentIcon}>
                        <MapPin size={14} color={colors.primary} />
                      </View>
                      <Text style={styles.recentItemText} numberOfLines={1}>{loc.name}</Text>
                      <ChevronRight size={12} color={colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {recentTrips.length === 0 && recentDestinations.length === 0 && (
                <View style={styles.hintSection}>
                  <Text style={styles.hintText}>{t('search.typeToSearch')}</Text>
                </View>
              )}
            </View>
          )}
          {destination && (
            <>
              <RideTypeSelector showAll={sheetExpanded} />
            </>
          )}
        </BottomSheet>
      </View>

      {/* Sticky Select button — fixed at bottom, never moves with sheet */}
      {destination && (
        <View style={[styles.stickyButton, { paddingBottom: Math.max(16, insets.bottom) + 16 }]}>
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
            <TouchableOpacity
              style={styles.locationGateBtn}
              onPress={openLocationSettings}
              activeOpacity={0.85}
            >
              <Settings size={14} color={colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.locationGateBtnText}>Open Settings</Text>
            </TouchableOpacity>
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
  },
  sosButtonWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'column',
    gap: 6,
    zIndex: 1,
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
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 2,
    ...shadow.md,
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
    borderTopLeftRadius: 46,
    borderTopRightRadius: 46,
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
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationInfoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: borderRadius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
});
