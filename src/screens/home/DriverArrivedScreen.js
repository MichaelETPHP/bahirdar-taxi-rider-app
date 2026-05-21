import { Check, Phone } from 'lucide-react-native';
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Linking, Alert, BackHandler
} from 'react-native';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import { getSocket, disconnectSocket } from '../../services/socketService';
import { getTrip } from '../../services/tripService';
import { parseTripPollResponse, TRIP_STATUS_POLL_MS } from '../../utils/tripLifecycle';
import { Image } from 'react-native';
import DriverProfileCard from '../../components/ride/DriverProfileCard';
import { normalizeAvatarUrl } from '../../utils/avatarUrl';

/**
 * Resolve avatar URL to absolute URL with proper protocol
 */

function resolveAvatarUrl(rawUrl) {
  return normalizeAvatarUrl(rawUrl);
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

  // ── Repeating Arrival Sound (every 5s) ────────────────
  useEffect(() => {
    let soundObj = null;

    const playHonk = async () => {
      try {
        if (soundObj) {
          await soundObj.unloadAsync();
        }
        const { sound } = await Audio.Sound.createAsync(
          require('../../../audio/trip_offer_honk.mp3')
        );
        soundObj = sound;
        await sound.playAsync();
      } catch (error) {
        // Silent fail for audio
      }
    };

    // Initial play
    playHonk();

    const interval = setInterval(playHonk, 5000);

    return () => {
      clearInterval(interval);
      if (soundObj) {
        soundObj.unloadAsync();
      }
    };
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
  const avatarUrl = resolveAvatarUrl(driver?.avatar_url || driver?.avatarUrl || driver?.photoUrl || driver?.photo_url || driver?.profile_image);


  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      {/* Animated checkmark */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
        <Check size={40} color={colors.white} />
      </Animated.View>

      <Text style={styles.title}>Your driver has arrived!</Text>
      <Text style={styles.subtitle}>
        {driverName} is waiting for you
      </Text>

      {/* Vehicle card */}
      <View style={{ width: '100%', marginBottom: 24 }}>
        <DriverProfileCard 
          driver={driver} 
          avatarUrl={avatarUrl} 
          rating={driver?.rating ? Number(driver.rating) : 5.0} 
          onCall={handleCall} 
        />
      </View>

      <Text style={styles.hint}>Waiting for the driver to start the trip…</Text>

      {/* Support Footer */}
      <View style={styles.supportFooter}>
        <Text style={styles.supportLabel}>Need help?</Text>
        <TouchableOpacity 
          style={styles.supportBtn} 
          onPress={() => Linking.openURL('tel:9040')}
          activeOpacity={0.7}
        >
          <Phone size={14} color={colors.primary} />
          <Text style={styles.supportText}>Call Support 9040</Text>
        </TouchableOpacity>
      </View>
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
  hint: {
    marginTop: 24, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center',
  },
  supportFooter: {
    position: 'absolute',
    bottom: 48,
    alignItems: 'center',
    gap: 6,
  },
  supportLabel: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  supportText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
});
