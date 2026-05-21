import { Car, Star, Phone, AlertTriangle } from 'lucide-react-native';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Alert, Linking, Vibration, BackHandler, Animated
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RideMap from '../../components/map/RideMap';
import DriverMarker from '../../components/map/DriverMarker';
import PickupMarker from '../../components/map/PickupMarker';
import RoutePolyline from '../../components/map/RoutePolyline';
import DriverProfileCard from '../../components/ride/DriverProfileCard';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getSocket, disconnectSocket } from '../../services/socketService';
import { cancelTrip, getCancelReasons, getDriverLocation, getTrip } from '../../services/tripService';
import CancelReasonModal from '../../components/ride/CancelReasonModal';
import { parseTripPollResponse, TRIP_STATUS_POLL_MS } from '../../utils/tripLifecycle';
import useRoute from '../../hooks/useRoute';
import { formatEthiopianPhone } from '../../utils/phoneFormatter';
import { haversineDistance, formatDistance } from '../../utils/distanceUtils';
import { normalizeAvatarUrl } from '../../utils/avatarUrl';
import { extractDriverMarkerMeta, resolveCategoryIconFromCategories } from '../../utils/driverCategoryIcon';

const LOCATION_POLL_MS = 1500;
const ADDIS_ABABA_COORDS = { latitude: 9.0192, longitude: 38.7525 };

// Animated progress bar for ETA / distance


/**
 * Resolve avatar URL to absolute URL with proper protocol
 * Handles relative paths, data URLs, and URL normalization
 */
/**
 * Resolve avatar URL to absolute URL with proper protocol
 */
function resolveAvatarUrl(rawUrl) {
  return normalizeAvatarUrl(rawUrl);
}

const APPROACH_FALLBACK_SPEED_KMH = 24;

function pickNumber(...values) {
  for (const value of values) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function extractDriverLocation(rawPayload, categories = []) {
  const raw = rawPayload?.driver ?? rawPayload?.data ?? rawPayload ?? {};
  const markerMeta = extractDriverMarkerMeta(raw);
  const lat = pickNumber(
    raw?.lat,
    raw?.latitude,
    raw?.current_lat,
    raw?.currentLat,
    raw?.location?.lat,
    raw?.location?.latitude
  );
  const lng = pickNumber(
    raw?.lng,
    raw?.lon,
    raw?.longitude,
    raw?.current_lng,
    raw?.currentLng,
    raw?.location?.lng,
    raw?.location?.longitude
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return {
    lat,
    lng,
    heading: pickNumber(raw?.heading, raw?.bearing, raw?.course, 0) || 0,
    speed_kmh: pickNumber(raw?.speed_kmh, raw?.speedKmh, raw?.speed),
    driverId: raw?.driver_id ?? raw?.driverId ?? raw?.id ?? null,
    carIconUrl: markerMeta.carIconUrl || resolveCategoryIconFromCategories(raw, categories),
    carLabel: markerMeta.carLabel,
    fullName: markerMeta.fullName,
  };
}

function estimateEtaMinutes(distanceKm, speedKmh) {
  if (!Number.isFinite(distanceKm)) return null;
  if (distanceKm <= 0.05) return 0;
  const kmh = Number.isFinite(speedKmh) && speedKmh > 3 ? speedKmh : APPROACH_FALLBACK_SPEED_KMH;
  return Math.max(1, Math.round((distanceKm / kmh) * 60));
}

export default function DriverMatchedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const driverPollRef = useRef(null);
  const tripStatusPollRef = useRef(null);
  const handledRef = useRef(false);
  const initialDistRef = useRef(null);

  const {
    tripId, tripData, driver, driverLocation, setDriverLocation,
    setTripStatus, setFinalFare, resetTrip, mergeTripData, setDriver,
  } = useRideStore();
  const { token } = useAuthStore();
  const { userCoords, destination } = useLocationStore();
  const categories = useRideStore((s) => s.categories);

  const [cancelLoading, setCancelLoading]       = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [avatarBust, setAvatarBust] = useState(Date.now()); // Cache buster for avatar refresh
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Refresh avatar cache when driver changes
  useEffect(() => {
    if (driver?.id) {
      setAvatarBust(Date.now());
    }
  }, [driver?.id, driver?.avatar_url, driver?.photoUrl]);

  useEffect(() => {
    Vibration.vibrate([0, 100, 80, 180]);
  }, []);

  // ── Prevent accidental exit ───────────────────────────
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (e.data.action.type === 'GO_BACK') {
        e.preventDefault();
      }
    });
    return () => {
      backHandler.remove();
      unsubscribe();
    };
  }, [navigation]);

  // Driver coord
  const driverCoord = driverLocation
    ? { latitude: driverLocation.lat, longitude: driverLocation.lng }
    : (driver?.currentLat ?? driver?.lat ?? driver?.location?.lat) != null
      ? {
          latitude: pickNumber(driver?.currentLat, driver?.lat, driver?.location?.lat, driver?.location?.latitude),
          longitude: pickNumber(driver?.currentLng, driver?.lng, driver?.location?.lng, driver?.location?.longitude),
        }
      : null;
  const etaRaw = Number(driver?.etaMinutes ?? driver?.eta_minutes);
  const liveSpeedKmh = pickNumber(driverLocation?.speed_kmh, driverLocation?.speedKmh, driverLocation?.speed);
  const distKmRaw = Number(driver?.distanceKm);
  const distKm = Number.isFinite(distKmRaw) ? distKmRaw : null;
  const ratingRaw = Number(driver?.rating);
  const rating = Number.isFinite(ratingRaw) ? ratingRaw : 0;

  // Capture initial distance on first render
  const currentDist = driver?.distanceKm ?? null;
  if (initialDistRef.current === null && currentDist != null) {
    initialDistRef.current = currentDist;
  }

  // Capture driver starting coordinate for stable full route
  const [driverStartCoord, setDriverStartCoord] = useState(null);

  useEffect(() => {
    if (driverCoord && !driverStartCoord) {
      setDriverStartCoord(driverCoord);
    }
  }, [driverCoord, driverStartCoord]);

  // Driver → pickup stable route
  const originCoord = driverStartCoord || driverCoord;
  const { coordinates: fullRouteCoords } = useRoute(originCoord, userCoords);
  const distanceToPickupKm = driverCoord && userCoords
    ? haversineDistance(
        driverCoord.latitude,
        driverCoord.longitude,
        userCoords.latitude,
        userCoords.longitude
      )
    : distKm;

  if (initialDistRef.current === null && Number.isFinite(distanceToPickupKm) && distanceToPickupKm > 0) {
    initialDistRef.current = distanceToPickupKm;
  }

  const baselineDistanceKm = Number.isFinite(initialDistRef.current) && initialDistRef.current > 0
    ? initialDistRef.current
    : (Number.isFinite(distKm) && distKm > 0 ? distKm : null);
  const progressReady = Number.isFinite(distanceToPickupKm);
  const arrivalProgress = baselineDistanceKm && Number.isFinite(distanceToPickupKm)
    ? Math.max(0, Math.min(1, 1 - (distanceToPickupKm / baselineDistanceKm)))
    : 0;
  const etaMin = Number.isFinite(etaRaw) ? etaRaw : estimateEtaMinutes(distanceToPickupKm, liveSpeedKmh);
  const etaText = etaMin != null ? `${Math.max(1, Math.round(etaMin))} min away` : 'Driver en route';
  const approachText = Number.isFinite(distanceToPickupKm)
    ? `${formatDistance(distanceToPickupKm)} to pickup`
    : 'Driver location updating...';
  const arrivalStatusText = arrivalProgress >= 0.92
    ? 'Driver is almost here'
    : arrivalProgress >= 0.55
      ? 'Driver is getting closer'
      : 'Driver is coming';

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: arrivalProgress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [arrivalProgress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // Fit map to show driver + pickup
  useEffect(() => {
    if (!driverCoord || !userCoords || !mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        [driverCoord, { latitude: userCoords.latitude, longitude: userCoords.longitude }],
        { edgePadding: { top: 120, right: 60, bottom: 380, left: 60 }, animated: true }
      );
    }, 600);
  }, [driverCoord?.latitude, userCoords?.latitude]);

  const clearPolls = useCallback(() => {
    clearInterval(driverPollRef.current);
    clearInterval(tripStatusPollRef.current);
  }, []);

  const navigate = useCallback((screen) => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearPolls();
    navigation.replace(screen);
  }, [navigation, clearPolls]);

  const goHome = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearPolls();
    disconnectSocket();
    resetTrip();
    navigation.replace('Home');
  }, [navigation, resetTrip, clearPolls]);

  // Poll driver location as a fallback when trip-room socket updates lag
  useEffect(() => {
    if (!driver?.id || !token) return;
    const syncDriverLocation = async () => {
      try {
        const res = await getDriverLocation(driver.id, token);
        const nextLocation = extractDriverLocation(res?.data ?? res, categories);
        if (!nextLocation) return;
        if (nextLocation.carIconUrl || nextLocation.carLabel || nextLocation.fullName) {
          setDriver({
            ...driver,
            ...(nextLocation.fullName ? { name: nextLocation.fullName, full_name: nextLocation.fullName } : {}),
            ...(nextLocation.carIconUrl ? { car_icon_url: nextLocation.carIconUrl, carIconUrl: nextLocation.carIconUrl } : {}),
            vehicle: {
              ...(driver?.vehicle || {}),
              ...(nextLocation.carLabel ? { category: nextLocation.carLabel } : {}),
              ...(nextLocation.carIconUrl ? { categoryIconUrl: nextLocation.carIconUrl } : {}),
            },
          });
        }
        setDriverLocation(nextLocation);
      } catch (_) {}
    };

    syncDriverLocation();
    driverPollRef.current = setInterval(async () => {
      syncDriverLocation();
    }, LOCATION_POLL_MS);
    return () => clearInterval(driverPollRef.current);
  }, [categories, driver, driver?.id, token, setDriver, setDriverLocation]);

  // Fallback: poll trip status — only listen for forward transitions, never overwrite matched driver
  useEffect(() => {
    if (!tripId || !token) return;
    tripStatusPollRef.current = setInterval(async () => {
      try {
        const res = await getTrip(tripId, token);
        const { status, trip } = parseTripPollResponse(res);
        if (!status || handledRef.current) return;
        // Merge trip data (fare, addresses, etc.) but do NOT overwrite matched driver
        if (trip && typeof trip === 'object') mergeTripData(trip);
        // Only act on forward transitions — ignore 'searching' / 'matched' (already here)
        if (status === 'driver_arrived') {
          setTripStatus('driver_arrived');
          navigate('DriverArrived');
        } else if (status === 'in_progress') {
          setTripStatus('in_progress');
          navigate('TripActive');
        } else if (status === 'completed') {
          const t = trip;
          if (t && typeof t === 'object') {
            setFinalFare({
              amount: parseFloat(t.final_fare_etb ?? t.estimated_fare_etb ?? 0),
              distanceKm: parseFloat(t.distance_km ?? 0),
              durationMin: parseFloat(t.duration_min ?? 0),
            });
          }
          setTripStatus('completed');
          disconnectSocket();
          navigate('TripComplete');
        } else if (status === 'cancelled') {
          Alert.alert('Trip Cancelled', 'This trip was cancelled.', [{ text: 'OK', onPress: goHome }]);
        }
      } catch (_) {}
    }, TRIP_STATUS_POLL_MS);
    return () => clearInterval(tripStatusPollRef.current);
  }, [tripId, token, mergeTripData, setTripStatus, setFinalFare, navigate, goHome]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const playArrivalSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../../audio/trip_offer_honk.mp3')
        );
        await sound.playAsync();
      } catch (error) {
        console.log('Error playing arrival sound:', error);
      }
    };

    const onArrived = () => { 
      playArrivalSound();
      setTripStatus('driver_arrived'); 
      navigate('DriverArrived'); 
    };
    const onCancelled = ({ reason }) => {
      Alert.alert('Trip Cancelled', reason || 'Driver cancelled.', [{ text: 'OK', onPress: goHome }]);
    };
    const onDriverLocation = (payload) => {
      const nextLocation = extractDriverLocation(payload, categories);
      if (!nextLocation) return;
      const rawId = nextLocation.driverId ? String(nextLocation.driverId) : '';
      if (rawId && String(driver?.id) !== rawId) return;
      if (nextLocation.carIconUrl || nextLocation.carLabel || nextLocation.fullName) {
        setDriver({
          ...driver,
          ...(nextLocation.fullName ? { name: nextLocation.fullName, full_name: nextLocation.fullName } : {}),
          ...(nextLocation.carIconUrl ? { car_icon_url: nextLocation.carIconUrl, carIconUrl: nextLocation.carIconUrl } : {}),
          vehicle: {
            ...(driver?.vehicle || {}),
            ...(nextLocation.carLabel ? { category: nextLocation.carLabel } : {}),
            ...(nextLocation.carIconUrl ? { categoryIconUrl: nextLocation.carIconUrl } : {}),
          },
        });
      }
      setDriverLocation(nextLocation);
    };
    socket.on('trip:driver_arrived', onArrived);
    socket.on('trip:cancelled', onCancelled);
    socket.on('trip:driver:location', onDriverLocation);
    socket.on('driver:location', onDriverLocation);
    socket.on('driver:updated', onDriverLocation);
    return () => {
      socket.off('trip:driver_arrived', onArrived);
      socket.off('trip:cancelled', onCancelled);
      socket.off('trip:driver:location', onDriverLocation);
      socket.off('driver:location', onDriverLocation);
      socket.off('driver:updated', onDriverLocation);
    };
  }, [categories, driver, driver?.id, navigate, goHome, setDriver, setTripStatus, setDriverLocation]);

  const handleCall = () => {
    const phone = formatEthiopianPhone(driver?.phone);
    if (phone && phone !== '—') Linking.openURL(`tel:${driver?.phone}`);
  };



  const handleSOS = () => {
    Alert.alert(
      'Support Center',
      'Call 9040 for assistance?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call 9040', style: 'default', onPress: () => Linking.openURL('tel:9040') },
      ]
    );
  };

  const handleCancel = () => setCancelModalVisible(true);

  const handleCancelConfirm = async (reason) => {
    setCancelLoading(true);
    try {
      if (tripId) await cancelTrip(tripId, reason.label, token, { reason_id: reason.id });
    } catch (_) {}
    setCancelModalVisible(false);
    goHome();
  };

  // Extract avatar from multiple possible sources (same as driver app)
  const rawAvatarUrl =
    driver?.avatar_url ||
    driver?.avatarUrl ||
    driver?.photoUrl ||
    driver?.photo_url ||
    driver?.profile_image ||
    driver?.profile_image_url ||
    null;

  // Resolve to absolute URL with proper handling
  const avatarUrl = resolveAvatarUrl(rawAvatarUrl);

  const driverNameFull = driver?.name || driver?.full_name || driver?.fullName || 'Driver';
  const driverFirstName = String(driverNameFull).split(' ')[0] || 'Driver';
  const progressCarIconUrl = driver?.carIconUrl || driver?.car_icon_url || driver?.vehicle?.categoryIconUrl || null;
  const carMake = driver?.vehicle?.make || '';
  const carModel = driver?.vehicle?.model || driver?.vehicle_model || driver?.vehicle_category || driver?.car_type || '';
  const carColor = driver?.vehicle?.color || '';
  const carPlate = driver?.vehicle?.plateNumber || 
    driver?.vehicle?.plate_number || 
    driver?.vehicle?.plate || 
    driver?.vehicle_plate ||
    driver?.car_plate ||
    driver?.plate_number || 
    driver?.plateNumber || 
    driver?.plate || 
    driver?.license_plate ||
    tripData?.driver?.plate_number ||
    tripData?.driver?.vehicle?.plate_number ||
    '';
  const carLine = [carMake, carModel, carColor, carPlate].filter(Boolean).join(' · ') || 'Vehicle';
  const fare = Math.round(parseFloat(tripData?.estimated_fare_etb || 0)).toString();
  const pickupName = tripData?.pickup_address || 'Your location';
  const dropoffName = tripData?.dropoff_address || destination?.name || 'Destination';

  return (
    <View style={styles.root}>
      {/* ── Background Map ── */}
      <View style={StyleSheet.absoluteFill}>
        <RideMap
          mapRef={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{
            latitude: driverCoord?.latitude ?? userCoords?.latitude ?? ADDIS_ABABA_COORDS.latitude,
            longitude: driverCoord?.longitude ?? userCoords?.longitude ?? ADDIS_ABABA_COORDS.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          }}
        >
          {userCoords && (
            <PickupMarker coordinate={userCoords} title={tripData?.pickup_address || 'Your location'} />
          )}
          {driverCoord && driver && (
            <DriverMarker
              driver={{
                id: driver.id,
                lat: driverCoord.latitude,
                lng: driverCoord.longitude,
                heading: driverLocation?.heading ?? 0,
                fullName: driver.name,
                carLabel: driver?.vehicle?.category || driver?.vehicle_category || driver?.car_type || '',
                carIconUrl: driver?.carIconUrl || driver?.car_icon_url || driver?.vehicle?.categoryIconUrl,
                live: true,
              }}
              routeCoords={fullRouteCoords}
            />
          )}
          <RoutePolyline coordinates={fullRouteCoords} dashed />
        </RideMap>
        {/* Emerald Overlay */}
        <View style={styles.mapOverlay} />
        {/* Map Watermark */}
        <View style={styles.watermarkContainer} pointerEvents="none">
          <Text style={styles.mapWatermark}>ETHIOPIAN CITIES</Text>
        </View>
      </View>

      {/* ── Top badge: "Driver is on the way!" ── */}
      <View style={[styles.topBadge, { top: insets.top + 16 }]}>
        <Car size={13} color={colors.white} />
        <Text style={styles.topBadgeText}>Driver is on the way!</Text>
      </View>

      {/* ── Unified Central Card ── */}
      <View style={styles.unifiedCardContainer}>
        <View style={styles.unifiedCard}>
          {/* 1. Driver Profile Section */}
          <DriverProfileCard 
            driver={driver} 
            avatarUrl={`${avatarUrl}?bust=${avatarBust}`} 
            rating={rating} 
            onCall={handleCall}
          />

          <View style={styles.cardDivider} />

          {/* 2. Trip Details Section */}
          <View style={styles.progressSection}>
            <View style={styles.progressTopRow}>
              <Text style={styles.progressTitle}>{arrivalStatusText}</Text>
              <Text style={styles.progressEta}>{etaText}</Text>
            </View>
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              {progressReady ? (
                <Animated.View style={[styles.progressCarWrap, { left: progressWidth }]}>
                  {progressCarIconUrl ? (
                    <Image
                      source={{ uri: progressCarIconUrl }}
                      resizeMode="contain"
                      style={styles.progressCar}
                    />
                  ) : (
                    <View style={styles.progressCarFallback}>
                      <Car size={16} color={colors.primary} strokeWidth={2.2} />
                    </View>
                  )}
                </Animated.View>
              ) : null}
            </View>
            <Text style={styles.progressCaption}>{approachText}</Text>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.locationSection}>
            <View style={styles.locationItem}>
              <View style={[styles.locationDot, { backgroundColor: colors.success }]} />
              <View style={styles.locationTextWrap}>
                <Text style={styles.locationLabel}>PICKUP</Text>
                <Text style={styles.locationAddress} numberOfLines={1}>{pickupName}</Text>
              </View>
            </View>
            
            <View style={styles.locationConnector}>
              <View style={styles.locationDash} />
              <View style={styles.locationDash} />
            </View>

            <View style={styles.locationItem}>
              <View style={[styles.locationDot, { backgroundColor: colors.mapDestination }]} />
              <View style={styles.locationTextWrap}>
                <Text style={styles.locationLabel}>DESTINATION</Text>
                <Text style={styles.locationAddress} numberOfLines={1}>{dropoffName}</Text>
              </View>
            </View>
          </View>

          {fare !== '0.00' && (
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>ESTIMATED FARE</Text>
              <Text style={styles.fareAmount}>ETB {fare}</Text>
            </View>
          )}

          <View style={styles.cardDivider} />

          {/* 3. Footer Action: Cancel */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelText}>
              {cancelLoading ? 'Cancelling…' : 'Cancel Trip'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Support Footer */}
      <View style={[styles.supportFooter, { bottom: Math.max(16, insets.bottom) + 12 }]}>
        <Text style={styles.supportLabel}>Need help?</Text>
        <TouchableOpacity 
          style={styles.supportBtn} 
          onPress={() => Linking.openURL('tel:9040')}
          activeOpacity={0.7}
        >
          <Phone size={14} color={colors.white} />
          <Text style={styles.supportText}>Call Support 9040</Text>
        </TouchableOpacity>
      </View>

      <CancelReasonModal
        visible={cancelModalVisible}
        onClose={() => setCancelModalVisible(false)}
        onConfirm={handleCancelConfirm}
        fetchReasons={() => getCancelReasons(token, 'rider')}
        loading={cancelLoading}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 103, 79, 0.65)', // Emerald Overlay
  },


  // Top badge
  topBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 50,
    zIndex: 10,
  },
  topBadgeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.3,
  },
  unifiedCardContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  unifiedCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 8,
    ...shadow.lg,
    shadowOpacity: 0.2,
    elevation: 12,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  progressSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  progressTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  progressTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#0F172A',
  },
  progressEta: {
    fontSize: 12,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#DCEFE7',
    overflow: 'hidden',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressCarWrap: {
    position: 'absolute',
    top: -13,
    marginLeft: -14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCar: {
    width: 28,
    height: 28,
  },
  progressCarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0, 103, 79, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCaption: {
    marginTop: 8,
    fontSize: 11,
    color: '#64748B',
    fontWeight: fontWeight.medium,
  },
  locationSection: {
    padding: 16,
    gap: 2,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  locationTextWrap: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: '#334155',
  },
  locationConnector: {
    paddingLeft: 3.5,
    gap: 3,
    marginVertical: 2,
  },
  locationDash: {
    width: 1,
    height: 4,
    backgroundColor: '#CBD5E1',
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  fareLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: '#64748B',
  },
  fareAmount: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  cancelBtn: {
    margin: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: '#EF4444',
  },
  supportFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 6,
  },
  supportLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  supportText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  watermarkContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapWatermark: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.08)',
    letterSpacing: 8,
    textAlign: 'center',
  },
});
