import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Linking, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import { getSocket, disconnectSocket } from '../../services/socketService';
import { getTrip } from '../../services/tripService';
import { parseTripPollResponse, TRIP_STATUS_POLL_MS } from '../../utils/tripLifecycle';
import { Image } from 'react-native';
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


export default function DriverArrivedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const pollRef = useRef(null);
  const handledRef = useRef(false);
  const { tripId, driver, setTripStatus, setFinalFare, resetTrip, mergeTripData } = useRideStore();
  const { token } = useAuthStore();

  const goHome = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearInterval(pollRef.current);
    disconnectSocket();
    resetTrip();
    navigation.replace('Home');
  }, [navigation, resetTrip]);

  const transitionToTrip = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearInterval(pollRef.current);
    setTripStatus('in_progress');
    navigation.replace('TripActive');
  }, [navigation, setTripStatus]);

  // ── Checkmark bounce animation ──────────────────────
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1, useNativeDriver: true, speed: 12, bounciness: 14,
    }).start();
  }, []);

  // ── Socket: trip:started (after PATCH /trips/:id/start on server) ──
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onStarted = () => transitionToTrip();

    socket.on('trip:started', onStarted);
    return () => socket.off('trip:started', onStarted);
  }, [transitionToTrip]);

  // ── Fallback poll: lifecycle PATCH may land before socket ───────────
  useEffect(() => {
    if (!tripId || !token) return;
    pollRef.current = setInterval(async () => {
      if (handledRef.current) return;
      try {
        const res = await getTrip(tripId, token);
        const { status, trip } = parseTripPollResponse(res);
        if (!status) return;
        if (trip && typeof trip === 'object') mergeTripData(trip);
        if (status === 'in_progress') {
          transitionToTrip();
        } else if (status === 'completed') {
          handledRef.current = true;
          clearInterval(pollRef.current);
          if (trip && typeof trip === 'object') {
            setFinalFare({
              amount: parseFloat(trip.final_fare_etb ?? trip.estimated_fare_etb ?? 0),
              distanceKm: parseFloat(trip.distance_km ?? 0),
              durationMin: parseFloat(trip.duration_min ?? 0),
            });
          }
          setTripStatus('completed');
          disconnectSocket();
          navigation.replace('TripComplete');
        } else if (status === 'cancelled') {
          Alert.alert('Trip Cancelled', 'This trip was cancelled.', [{ text: 'OK', onPress: goHome }]);
        }
      } catch (_) {}
    }, TRIP_STATUS_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [tripId, token, mergeTripData, setFinalFare, setTripStatus, transitionToTrip, navigation, goHome]);

  const handleCall = () => {
    const phone = driver?.phone;
    if (phone) Linking.openURL(`tel:${phone}`);
  };
  const driverName = driver?.name || driver?.full_name || driver?.fullName || 'Your driver';
  const driverFirstName = String(driverName).split(' ')[0] || 'Driver';
  const carMake = driver?.vehicle?.make || '';
  const carModel = driver?.vehicle?.model || driver?.vehicle_model || driver?.vehicle_category || driver?.car_type || 'Vehicle';
  const carColor = driver?.vehicle?.color || '';
  const carPlate = driver?.vehicle?.plateNumber || driver?.plate_number || driver?.plateNumber || '—';
  const vehicleLine = [carColor, carMake, carModel].filter(Boolean).join(' ');
  const avatarUrl = resolveAvatarUrl(driver?.avatar_url || driver?.avatarUrl || driver?.photoUrl || driver?.photo_url || driver?.profile_image);


  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      {/* Animated checkmark */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
        <FontAwesome5 name="check" size={40} color={colors.white} solid />
      </Animated.View>

      <Text style={styles.title}>Your driver has arrived!</Text>
      <Text style={styles.subtitle}>
        {driverFirstName || 'Your driver'} is waiting for you
      </Text>

      {/* Vehicle card */}
      <View style={styles.vehicleCard}>
        <View style={styles.vehicleRow}>
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
          <View style={styles.vehicleInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.driverFullName} numberOfLines={1}>{driverName}</Text>
              <Text style={styles.nameSeparator}>·</Text>
              <Text style={styles.vehicleModelHeader} numberOfLines={1}>{carMake} {carModel}</Text>
            </View>
            <Text style={styles.vehiclePlate}>{carPlate}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.85}>
        <FontAwesome5 name="phone" size={16} color={colors.white} solid style={{ marginRight: 8 }} />
        <Text style={styles.callText}>Call {driverFirstName || 'Driver'}</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>Waiting for the driver to start the trip…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.white,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  checkCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 28, ...shadow.lg,
  },
  title: {
    fontSize: 24, fontWeight: fontWeight.bold,
    color: colors.textPrimary, textAlign: 'center', marginBottom: 8,
  },
  subtitle: {
    fontSize: fontSize.md, color: colors.textSecondary,
    textAlign: 'center', marginBottom: 36,
  },
  vehicleCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: 18, marginBottom: 32,
    ...shadow.md,
  },
  vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: '#E5E7EB',
  },
  avatarFallback: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 30 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: colors.white,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  driverFullName: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold, color: '#111827',
  },
  nameSeparator: {
    marginHorizontal: 6, fontSize: fontSize.lg, color: '#9CA3AF',
  },
  vehicleModelHeader: {
    fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: '#4B5563',
  },
  vehiclePlate: {
    fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.bold, marginTop: 4,
  },
  callBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.pill,
    paddingHorizontal: 32, paddingVertical: 14,
    ...shadow.md,
  },
  callText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.white },
  hint: {
    marginTop: 24, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center',
  },
});
