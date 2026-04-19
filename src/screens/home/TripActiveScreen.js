import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import RideMap from '../../components/map/RideMap';
import DriverMarker from '../../components/map/DriverMarker';
import DestMarker from '../../components/map/DestMarker';
import RoutePolyline from '../../components/map/RoutePolyline';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getSocket, disconnectSocket } from '../../services/socketService';
import { getDriverLocation, getTrip } from '../../services/tripService';
import { parseTripPollResponse, TRIP_STATUS_POLL_MS } from '../../utils/tripLifecycle';
import useRoute from '../../hooks/useRoute';
import { Image, LinearGradient } from 'react-native';
import { API_BASE_URL } from '../../config/api';

/**
 * Resolve avatar URL to absolute URL with proper protocol
 */
function resolveAvatarUrl(rawUrl) {
  if (!rawUrl) return null;
  const normalized = String(rawUrl).trim();
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith('//')) return `https:${normalized}`;
  if (normalized.startsWith('data:image/')) return normalized;
  try {
    const origin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
    if (normalized.startsWith('/')) return `${origin}${normalized}`;
    return new URL(normalized, `${origin}/`).toString();
  } catch (e) {
    return null;
  }
}


const LOCATION_POLL_MS = 3000;

export default function TripActiveScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const locationPollRef = useRef(null);
  const tripStatusPollRef = useRef(null);
  const timerRef = useRef(null);
  const handledRef = useRef(false);

  const { tripId, tripData, driver, driverLocation, setDriverLocation, setTripStatus, setFinalFare, resetTrip, mergeTripData } = useRideStore();
  const { token } = useAuthStore();
  const { destination } = useLocationStore();

  const [elapsed, setElapsed] = useState(0); // seconds

  const navigate = useCallback((screen) => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearInterval(locationPollRef.current);
    clearInterval(tripStatusPollRef.current);
    clearInterval(timerRef.current);
    navigation.replace(screen);
  }, [navigation]);

  // ── Trip timer ──────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // ── Driver location poll ────────────────────────────
  useEffect(() => {
    if (!driver?.id || !token) return;
    locationPollRef.current = setInterval(async () => {
      try {
        const res = await getDriverLocation(driver.id, token);
        const d = res?.data;
        if (!d?.lat) return;
        setDriverLocation({ lat: d.lat, lng: d.lng, heading: d.heading ?? 0 });
      } catch (_) {}
    }, LOCATION_POLL_MS);
    return () => clearInterval(locationPollRef.current);
  }, [driver?.id, token, setDriverLocation]);

  // ── Fallback poll: PATCH /complete updates trip before socket ──────
  useEffect(() => {
    if (!tripId || !token) return;
    tripStatusPollRef.current = setInterval(async () => {
      if (handledRef.current) return;
      try {
        const res = await getTrip(tripId, token);
        const { status, trip } = parseTripPollResponse(res);
        if (!status) return;
        if (trip && typeof trip === 'object') mergeTripData(trip);
        if (status === 'completed') {
          const amount = parseFloat(
            trip?.final_fare_etb ?? trip?.estimated_fare_etb ?? tripData?.estimated_fare_etb ?? 0
          );
          const distanceKm = parseFloat(trip?.distance_km ?? 0);
          const durationMin = parseFloat(trip?.duration_min ?? 0);
          setFinalFare({ amount, distanceKm, durationMin });
          setTripStatus('completed');
          disconnectSocket();
          navigate('TripComplete');
        } else if (status === 'cancelled') {
          if (handledRef.current) return;
          handledRef.current = true;
          clearInterval(locationPollRef.current);
          clearInterval(tripStatusPollRef.current);
          clearInterval(timerRef.current);
          Alert.alert('Trip Cancelled', 'This trip was cancelled.', [
            {
              text: 'OK',
              onPress: () => {
                disconnectSocket();
                resetTrip();
                navigation.replace('Home');
              },
            },
          ]);
        }
      } catch (_) {}
    }, TRIP_STATUS_POLL_MS);
    return () => clearInterval(tripStatusPollRef.current);
  }, [tripId, token, mergeTripData, setFinalFare, setTripStatus, navigate, tripData?.estimated_fare_etb, resetTrip, navigation]);

  // ── Socket: trip:completed / trip:cancelled ─────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onCompleted = ({ finalFare, distanceKm, durationMin, distance, duration, fare_breakdown }) => {
      clearInterval(locationPollRef.current);
      clearInterval(tripStatusPollRef.current);
      clearInterval(timerRef.current);
      setFinalFare({
        amount: Number(finalFare ?? fare_breakdown?.total_etb ?? tripData?.final_fare_etb ?? 0),
        distanceKm: Number(distanceKm ?? distance ?? tripData?.actual_distance_km ?? 0),
        durationMin: Number(durationMin ?? duration ?? tripData?.actual_duration_min ?? 0),
      });
      setTripStatus('completed');
      disconnectSocket();
      navigate('TripComplete');
    };

    const onCancelled = ({ reason } = {}) => {
      if (handledRef.current) return;
      handledRef.current = true;
      clearInterval(locationPollRef.current);
      clearInterval(tripStatusPollRef.current);
      clearInterval(timerRef.current);
      Alert.alert('Trip Cancelled', reason || 'The trip was cancelled.', [
        {
          text: 'OK',
          onPress: () => {
            disconnectSocket();
            resetTrip();
            navigation.replace('Home');
          },
        },
      ]);
    };

    socket.on('trip:completed', onCompleted);
    socket.on('trip:cancelled', onCancelled);
    return () => {
      socket.off('trip:completed', onCompleted);
      socket.off('trip:cancelled', onCancelled);
    };
  }, [navigate, setFinalFare, setTripStatus, resetTrip, navigation]);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getArrivalTime = (mins) => {
    if (!mins || mins <= 0) return '--:--';
    const date = new Date();
    date.setMinutes(date.getMinutes() + mins);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const driverCoord = driverLocation
    ? { latitude: driverLocation.lat, longitude: driverLocation.lng }
    : null;

  const destCoord = destination
    ? { latitude: destination.lat, longitude: destination.lng }
    : null;

  // Road-following route from driver's live position → destination
  const { coordinates: routeCoords, distanceKm, durationMin } = useRoute(driverCoord, destCoord);

  const driverNameFull = driver?.name || driver?.full_name || driver?.fullName || 'Driver';
  const carMake = driver?.vehicle?.make || '';
  const carModel = driver?.vehicle?.model || driver?.vehicle_model || '';
  const carPlate = driver?.vehicle?.plateNumber || driver?.plate_number || driver?.plateNumber || '—';
  const avatarUrl = resolveAvatarUrl(driver?.avatar_url || driver?.avatarUrl || driver?.photoUrl || driver?.photo_url || driver?.profile_image);


  return (
    <View style={styles.container}>
      {/* Full screen map */}
      <View style={styles.mapWrap}>
        <RideMap mapRef={mapRef} initialRegion={driverCoord ? {
          latitude: driverCoord.latitude, longitude: driverCoord.longitude,
          latitudeDelta: 0.01, longitudeDelta: 0.01,
        } : undefined}>
          {destCoord && <DestMarker coordinate={destCoord} title={destination?.name} />}
          {driverCoord && driver && (
            <DriverMarker driver={{
              id: driver.id,
              lat: driverCoord.latitude,
              lng: driverCoord.longitude,
              heading: driverLocation?.heading ?? 0,
              live: true,
            }} />
          )}
          {routeCoords.length >= 2 && (
            <RoutePolyline coordinates={routeCoords} />
          )}
        </RideMap>
      </View>

      {/* Top info card */}
      <View style={[styles.topCard, { top: insets.top + 16 }]}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarEmoji}>🙂</Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>
        <View style={styles.driverMeta}>
          <View style={styles.nameRow}>
            <Text style={styles.driverName} numberOfLines={1}>{driverNameFull}</Text>
            <Text style={styles.nameSeparator}>·</Text>
            <Text style={styles.vehicleHeader} numberOfLines={1}>{carMake} {carModel}</Text>
          </View>
          <View style={styles.timerRow}>
            <FontAwesome5 name="clock" size={11} color={colors.textSecondary} solid />
            <Text style={styles.timerText}>{formatTime(elapsed)} elapsed</Text>
            <Text style={styles.plateText}>{carPlate}</Text>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.callCircleBtn} 
          onPress={() => driver?.phone && Linking.openURL(`tel:${driver.phone}`)}
        >
          <FontAwesome5 name="phone" size={16} color="#22C55E" solid />
        </TouchableOpacity>
      </View>

      {/* Bottom info panel (Live OSRM Estimation) */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(16, insets.bottom) + 8 }]}>
        <View style={styles.estimationRow}>
          <View style={styles.estItem}>
            <Text style={styles.estLabel}>EST. DISTANCE</Text>
            <Text style={styles.estValue}>{distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '-- km'}</Text>
          </View>
          <View style={styles.estDivider} />
          <View style={styles.estItem}>
            <Text style={styles.estLabel}>EST. ARRIVAL</Text>
            <Text style={styles.estValue}>
              {durationMin > 0 ? getArrivalTime(durationMin) : '--:--'}
            </Text>
            <Text style={styles.estSubValue}>
              {durationMin > 0 ? `(${Math.ceil(durationMin)} min)` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.destRow}>
          <View style={styles.destDot} />
          <Text style={styles.destText} numberOfLines={1}>
            Heading to {tripData?.dropoff_address || destination?.name || 'Destination'}
          </Text>
        </View>
        
        <View style={styles.fareRow}>
           <Text style={styles.fareLabel}>Estimated Fare</Text>
           <Text style={styles.fareValue}>ETB {parseFloat(tripData?.estimated_fare_etb || 0).toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  mapWrap: { flex: 1 },
  // Top driver profile card
  topCard: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    flexDirection: 'row', alignItems: 'center',
    padding: 12,
    ...shadow.md,
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  avatarFallback: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 24 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: colors.white,
  },
  driverMeta: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  driverName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#111827' },
  nameSeparator: { marginHorizontal: 4, color: '#9CA3AF' },
  vehicleHeader: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: '#4B5563' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timerText: { fontSize: fontSize.xs, color: colors.textSecondary },
  plateText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary, marginLeft: 4 },
  callCircleBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center', alignItems: 'center',
  },

  // Bottom info panel
  bottomBar: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20,
    ...shadow.lg,
  },
  estimationRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: '#F8FAFC', borderRadius: borderRadius.lg,
    paddingVertical: 12, marginBottom: 20,
  },
  estItem: { alignItems: 'center' },
  estLabel: { fontSize: 10, fontWeight: fontWeight.bold, color: '#94A3B8', letterSpacing: 0.5, marginBottom: 2 },
  estValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#1E293B' },
  estSubValue: { fontSize: 10, color: '#64748B', fontWeight: fontWeight.medium },
  estDivider: { width: 1, height: 32, backgroundColor: '#E2E8F0' },
  
  destRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  destDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1' },
  destText: { flex: 1, fontSize: fontSize.sm, color: '#475569', fontWeight: fontWeight.semibold },
  
  fareRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  fareLabel: { fontSize: fontSize.sm, color: '#94A3B8', fontWeight: fontWeight.medium },
  fareValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: '#111827' },
});
