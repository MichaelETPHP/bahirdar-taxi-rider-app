import { Car, Star, Phone, Clock, DollarSign, Share2, AlertTriangle } from 'lucide-react-native';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Animated, Alert, Linking, Share, Easing, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import RideMap from '../../components/map/RideMap';
import DriverMarker from '../../components/map/DriverMarker';
import PickupMarker from '../../components/map/PickupMarker';
import RoutePolyline from '../../components/map/RoutePolyline';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getSocket, disconnectSocket } from '../../services/socketService';
import { cancelTrip, getDriverLocation, getTrip } from '../../services/tripService';
import { parseTripPollResponse, TRIP_STATUS_POLL_MS } from '../../utils/tripLifecycle';
import useRoute from '../../hooks/useRoute';

const LOCATION_POLL_MS = 3000;

// Animated progress bar for ETA / distance
function ETAProgressBar({ distanceKm, initialDistanceKm }) {
  const progress = useRef(new Animated.Value(0)).current;
  const prevDist = useRef(initialDistanceKm ?? distanceKm ?? 1);

  useEffect(() => {
    const maxDist = prevDist.current || 1;
    const ratio = initialDistanceKm
      ? Math.max(0, Math.min(1, 1 - distanceKm / initialDistanceKm))
      : 0;
    Animated.timing(progress, {
      toValue: ratio,
      duration: 800,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [distanceKm, initialDistanceKm]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={pb.track}>
      <Animated.View style={[pb.fill, { width }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 3,
  },
});

/**
 * Resolve avatar URL to absolute URL with proper protocol
 * Handles relative paths, data URLs, and URL normalization
 */
function resolveAvatarUrl(rawUrl) {
  if (!rawUrl) return null;
  const normalized = String(rawUrl).trim();
  if (!normalized) return null;

  // Already an absolute URL
  if (/^https?:\/\//i.test(normalized)) return normalized;

  // Protocol-relative URL
  if (normalized.startsWith('//')) return `https:${normalized}`;

  // Data URL (base64 embedded image)
  if (normalized.startsWith('data:image/')) return normalized;

  // Try to resolve from API origin (for relative paths)
  try {
    // Get API base URL from environment or use default
    const apiUrl = process.env.REACT_APP_API_URL || 'https://api.example.com/api/v1';
    const origin = apiUrl.replace(/\/api\/v1\/?$/, '');

    if (normalized.startsWith('/')) {
      return `${origin}${normalized}`;
    }
    return new URL(normalized, `${origin}/`).toString();
  } catch (e) {
    console.log('[Avatar] URL resolution failed:', e);
    return null;
  }
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
    setTripStatus, setFinalFare, resetTrip, mergeTripData,
  } = useRideStore();
  const { token } = useAuthStore();
  const { userCoords, destination } = useLocationStore();

  const [cancelLoading, setCancelLoading] = useState(false);
  const [avatarBust, setAvatarBust] = useState(Date.now()); // Cache buster for avatar refresh

  // Refresh avatar cache when driver changes
  useEffect(() => {
    if (driver?.id) {
      setAvatarBust(Date.now());
    }
  }, [driver?.id, driver?.avatar_url, driver?.photoUrl]);

  // Sheet slide-up animation
  const sheetAnim = useRef(new Animated.Value(300)).current;
  useEffect(() => {
    Vibration.vibrate([0, 100, 80, 180]);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 14,
      bounciness: 8,
    }).start();
  }, []);

  // Driver coord
  const driverCoord = driverLocation
    ? { latitude: driverLocation.lat, longitude: driverLocation.lng }
    : (driver?.currentLat ?? driver?.lat ?? driver?.location?.lat) != null
      ? {
          latitude: Number(driver?.currentLat ?? driver?.lat ?? driver?.location?.lat),
          longitude: Number(driver?.currentLng ?? driver?.lng ?? driver?.location?.lng),
        }
      : null;

  // Capture initial distance on first render
  const currentDist = driver?.distanceKm ?? null;
  if (initialDistRef.current === null && currentDist != null) {
    initialDistRef.current = currentDist;
  }

  // Driver → pickup route
  const { coordinates: routeCoords } = useRoute(driverCoord, userCoords);

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

  // Poll driver location every 3 s
  useEffect(() => {
    if (!driver?.id || !token) return;
    driverPollRef.current = setInterval(async () => {
      try {
        const res = await getDriverLocation(driver.id, token);
        const d = res?.data;
        if (!d?.lat) return;
        setDriverLocation({ lat: d.lat, lng: d.lng, heading: d.heading ?? 0 });
      } catch (_) {}
    }, LOCATION_POLL_MS);
    return () => clearInterval(driverPollRef.current);
  }, [driver?.id, token, setDriverLocation]);

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
    const onArrived = () => { setTripStatus('driver_arrived'); navigate('DriverArrived'); };
    const onCancelled = ({ reason }) => {
      Alert.alert('Trip Cancelled', reason || 'Driver cancelled.', [{ text: 'OK', onPress: goHome }]);
    };
    socket.on('trip:driver_arrived', onArrived);
    socket.on('trip:cancelled', onCancelled);
    return () => {
      socket.off('trip:driver_arrived', onArrived);
      socket.off('trip:cancelled', onCancelled);
    };
  }, [navigate, goHome, setTripStatus]);

  const handleCall = () => {
    const phone = driver?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleShareTrip = async () => {
    const driverName = driver?.name || driver?.full_name || driver?.fullName || 'Your driver';
    const plate = driver?.vehicle?.plateNumber || driver?.plate_number || driver?.plateNumber || '—';
    const pickup = tripData?.pickup_address || 'pickup';
    const dropoff = tripData?.dropoff_address || 'destination';
    try {
      await Share.share({
        message:
          `I'm riding with ${driverName} (${plate}) from ${pickup} to ${dropoff}. Track my trip on BahirdarRide.`,
      });
    } catch (_) {}
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

  const handleCancel = () => {
    Alert.alert(
      'Cancel Trip',
      'A cancellation fee may apply. Cancel anyway?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Trip',
          style: 'destructive',
          onPress: async () => {
            setCancelLoading(true);
            try { if (tripId) await cancelTrip(tripId, 'Changed my mind', token); } catch (_) {}
            goHome();
          },
        },
      ]
    );
  };

  const etaMin = driver?.etaMinutes ?? null;
  const distKmRaw = Number(driver?.distanceKm);
  const distKm = Number.isFinite(distKmRaw) ? distKmRaw : null;
  const ratingRaw = Number(driver?.rating);
  const rating = Number.isFinite(ratingRaw) ? ratingRaw : 0;

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
  const carMake = driver?.vehicle?.make || '';
  const carModel = driver?.vehicle?.model || driver?.vehicle_model || driver?.vehicle_category || driver?.car_type || '';
  const carColor = driver?.vehicle?.color || '';
  const carPlate = driver?.vehicle?.plateNumber || driver?.plate_number || driver?.plateNumber || '';
  const carLine = [carMake, carModel, carColor, carPlate].filter(Boolean).join(' · ') || 'Vehicle';
  const fare = parseFloat(tripData?.estimated_fare_etb || 0).toFixed(2);
  const pickupName = tripData?.pickup_address || 'Your location';
  const dropoffName = tripData?.dropoff_address || destination?.name || 'Destination';

  return (
    <View style={styles.root}>
      {/* ── Full-screen map ── */}
      <RideMap mapRef={mapRef} style={StyleSheet.absoluteFill}>
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
              live: true,
            }}
          />
        )}
        <RoutePolyline coordinates={routeCoords} dashed />
      </RideMap>

      {/* ── Gradient overlay ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,103,79,0.15)', 'rgba(0,103,79,0.65)', colors.primary]}
        locations={[0, 0.28, 0.58, 1]}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* ── Top badge: "Driver is on the way!" ── */}
      <View style={[styles.topBadge, { top: insets.top + 16 }]}>
        <Car size={13} color={colors.white} />
        <Text style={styles.topBadgeText}>Driver is on the way!</Text>
      </View>

      {/* ── Slide-up bottom sheet ── */}
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: Math.max(insets.bottom, 16) + 8, transform: [{ translateY: sheetAnim }] },
        ]}
      >
        {/* ── Driver card ── */}
        <View style={styles.driverCard}>
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image
                source={{ uri: `${avatarUrl}?bust=${avatarBust}` }}
                style={styles.avatar}
                onError={() => {
                  console.log('[Avatar] Failed to load:', avatarUrl);
                }}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarEmoji}>👤</Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>

          {/* Name + rating + vehicle */}
          <View style={styles.driverMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.driverName} numberOfLines={1}>{driverNameFull}</Text>
              <Text style={styles.nameSeparator}>·</Text>
              <Text style={styles.vehicleHeader} numberOfLines={1}>{carMake} {carModel}</Text>
            </View>
            <View style={styles.ratingRow}>
              <Star size={11} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating.toFixed(1)}</Text>
              <Text style={styles.vehiclePlate}>{carPlate}</Text>
            </View>
          </View>

          {/* Call button */}
          <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
            <Phone size={18} color="#22C55E" />
          </TouchableOpacity>
        </View>

        {/* ── ETA + progress bar ── */}
        <View style={styles.etaCard}>
          <View style={styles.etaRow}>
            <Clock size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.etaText}>
              {etaMin != null ? `Arriving in ${etaMin} minute${etaMin !== 1 ? 's' : ''}` : 'Calculating…'}
            </Text>
            {distKm != null && (
              <Text style={styles.distText}>{distKm.toFixed(1)} km away</Text>
            )}
          </View>
          <ETAProgressBar
            distanceKm={distKm ?? 0}
            initialDistanceKm={initialDistRef.current}
          />
        </View>

        {/* ── Trip details (pickup → destination + fare) ── */}
        <View style={styles.tripCard}>
          <View style={styles.tripRow}>
            <View style={[styles.tripDot, { backgroundColor: colors.success }]} />
            <Text style={styles.tripText} numberOfLines={1}>{pickupName}</Text>
          </View>
          <View style={styles.tripConnector}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.tripDash} />
            ))}
          </View>
          <View style={styles.tripRow}>
            <View style={[styles.tripDot, { backgroundColor: colors.success }]} />
            <Text style={styles.tripText} numberOfLines={1}>{dropoffName}</Text>
          </View>
          {fare !== '0.00' && (
            <View style={styles.tripFareRow}>
              <DollarSign size={11} color="rgba(255,255,255,0.7)" />
              <Text style={styles.tripFareText}>ETB {fare}</Text>
              <View style={styles.tripPayChip}>
                <Text style={styles.tripPayText}>Cash</Text>
              </View>
            </View>
          )}
        </View>

        {/* ── Share trip + SOS ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleShareTrip} activeOpacity={0.85}>
            <Share2 size={14} color={colors.white} />
            <Text style={styles.actionBtnText}>Share Trip</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.sosBtn]} onPress={handleSOS} activeOpacity={0.85}>
            <Phone size={14} color={colors.white} />
            <Text style={[styles.actionBtnText, styles.sosBtnText]}>9040</Text>
          </TouchableOpacity>
        </View>

        {/* ── Cancel ── */}
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  gradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%',
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
  },
  topBadgeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.3,
  },

  // Sheet
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 10,
  },

  // Driver card
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    ...shadow.md,
    borderRadius: borderRadius.xl,
    padding: 16,
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  avatarFallback: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 28 },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: colors.white,
  },
  driverMeta: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  driverName: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#111827',
  },
  nameSeparator: {
    marginHorizontal: 6, fontSize: fontSize.lg, color: '#9CA3AF',
  },
  vehicleHeader: {
    fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#4B5563',
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#374151' },
  vehiclePlate: {
    marginLeft: 8,
    fontSize: fontSize.xs, color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  callBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#DCFCE7', // nice light green
    justifyContent: 'center', alignItems: 'center',
  },

  // ETA card
  etaCard: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  etaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  etaText: {
    flex: 1,
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.white,
  },
  distText: {
    fontSize: fontSize.xs, color: 'rgba(255,255,255,0.75)', fontWeight: fontWeight.medium,
  },

  // Action row
  actionRow: {
    flexDirection: 'row', gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  actionBtnText: {
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.white, letterSpacing: 0.2,
  },
  sosBtn: {
    backgroundColor: '#F59E0B', // Amber/Yellow
    borderColor: 'rgba(255,255,255,0.4)',
    flex: 0.5,
  },
  sosBtnText: { color: colors.white, fontWeight: fontWeight.bold },

  // Trip details card
  tripCard: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tripRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  tripDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  tripText: {
    flex: 1, fontSize: fontSize.sm,
    color: colors.white, fontWeight: fontWeight.medium,
  },
  tripConnector: {
    flexDirection: 'column', alignItems: 'flex-start',
    paddingLeft: 4, gap: 3, marginVertical: 4,
  },
  tripDash: {
    width: 1.5, height: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },
  tripFareRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)',
  },
  tripFareText: {
    flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.white,
  },
  tripPayChip: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tripPayText: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: 'rgba(255,255,255,0.85)',
  },

  // Cancel
  cancelBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  cancelText: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.white, letterSpacing: 0.2,
  },
});
