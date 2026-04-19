import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Alert, Easing, Vibration,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getSocket, disconnectSocket } from '../../services/socketService';
import { cancelTrip, getTrip } from '../../services/tripService';
import { parseTripPollResponse } from '../../utils/tripLifecycle';
import RideMap from '../../components/map/RideMap';
import PickupMarker from '../../components/map/PickupMarker';
import DestMarker from '../../components/map/DestMarker';
import RoutePolyline from '../../components/map/RoutePolyline';
import useRoute from '../../hooks/useRoute';
import useSoundHaptics from '../../hooks/useSoundHaptics';
import Button from '../../components/design-system/Button';

const POLL_INTERVAL = 5000;

// Dot loading animation — three dots that bounce in sequence
function SearchDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: -8, duration: 360, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(dot, { toValue: 0, duration: 360, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
          Animated.delay((2 - i) * 180 + 200),
        ])
      )
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={dotStyles.row}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[dotStyles.dot, { transform: [{ translateY: dot }] }]} />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.8)' },
});

// Pulse ring component
function PulseRing({ delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 2.6, duration: 1600, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
          Animated.timing(opacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      style={[
        pulseStyles.ring,
        { transform: [{ scale }], opacity },
      ]}
    />
  );
}

const pulseStyles = StyleSheet.create({
  ring: {
    position: 'absolute',
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.primary,
  },
});

export default function SearchingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);

  const { playMatchFeedback, playActionHaptic, playErrorFeedback } = useSoundHaptics();

  // Vibrate every 3 seconds while searching — stops when screen unmounts
  useEffect(() => {
    // Subtle buzz during search
    const id = setInterval(() => playActionHaptic(), 3000);
    return () => {
      clearInterval(id);
    };
  }, []);

  // One-shot spin for the car icon when cancel is pressed
  const spinAnim = useRef(new Animated.Value(0)).current;
  const hasSpun = useRef(false);

  const triggerSpin = () => {
    if (hasSpun.current) return;
    hasSpun.current = true;
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  };

  const spinDeg = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const {
    tripId, tripData, setDriver, setTripStatus, setFinalFare, resetTrip, mergeTripData,
    fareEstimates, selectedCategoryId, categories,
  } = useRideStore();
  const { token } = useAuthStore();
  const { userCoords, destination, clearAll: clearLocation } = useLocationStore();

  const pollRef = useRef(null);
  const handledRef = useRef(false);

  // Route
  const pickupCoords = userCoords
    ?? (tripData?.pickup_lat ? { latitude: tripData.pickup_lat, longitude: tripData.pickup_lng } : null);
  const dropoffCoords = destination
    ? { latitude: destination.lat, longitude: destination.lng }
    : (tripData?.dropoff_lat ? { latitude: tripData.dropoff_lat, longitude: tripData.dropoff_lng } : null);

  const { coordinates: routeCoords } = useRoute(pickupCoords, dropoffCoords);

  // Fit map to route once loaded
  useEffect(() => {
    if (routeCoords.length < 2 || !mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(routeCoords, {
        edgePadding: { top: 100, right: 60, bottom: 340, left: 60 },
        animated: true,
      });
    }, 600);
  }, [routeCoords.length]);

  const navigate = useCallback((screen) => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearInterval(pollRef.current);
    navigation.replace(screen);
  }, [navigation]);

  const goBack = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    clearInterval(pollRef.current);
    disconnectSocket();
    resetTrip();
    clearLocation();
    navigation.replace('Home');
  }, [navigation, resetTrip, clearLocation]);

  // ── Socket events ──────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMatched = ({ driver }) => {
      playMatchFeedback(); // Tactile and Audio feedback for the win!
      setDriver(driver);
      setTripStatus('matched');
      navigate('DriverMatched');
    };
    const onNoDrivers = () => {
      playErrorFeedback();
      Alert.alert('No Drivers Found', 'No drivers available right now. Please try again.', [
        { text: 'OK', onPress: goBack },
      ]);
    };
    const onCancelled = ({ reason }) => {
      Alert.alert('Trip Cancelled', reason || 'This trip was cancelled.', [
        { text: 'OK', onPress: goBack },
      ]);
    };

    socket.on('trip:matched', onMatched);
    socket.on('trip:no_drivers', onNoDrivers);
    socket.on('trip:cancelled', onCancelled);

    return () => {
      socket.off('trip:matched', onMatched);
      socket.off('trip:no_drivers', onNoDrivers);
      socket.off('trip:cancelled', onCancelled);
    };
  }, [navigate, goBack, setDriver, setTripStatus]);

  // ── Fallback poll ──────────────────────────────────────
  useEffect(() => {
    if (!tripId || !token) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await getTrip(tripId, token);
        const { status: s, trip, driver } = parseTripPollResponse(res);
        if (!s || handledRef.current) return;
        if (trip && typeof trip === 'object') mergeTripData(trip);
        if (s === 'matched' && driver) {
          playMatchFeedback();
          setDriver(driver);
          setTripStatus('matched');
          navigate('DriverMatched');
        } else if (s === 'driver_arrived') {
          playMatchFeedback(); // Alert on arrival too
          setTripStatus('driver_arrived');
          navigate('DriverArrived');
        } else if (s === 'in_progress') {
          setTripStatus('in_progress');
          navigate('TripActive');
        } else if (s === 'completed') {
          if (trip && typeof trip === 'object') {
            setFinalFare({
              amount: parseFloat(trip.final_fare_etb ?? trip.estimated_fare_etb ?? 0),
              distanceKm: parseFloat(trip.distance_km ?? 0),
              durationMin: parseFloat(trip.duration_min ?? 0),
            });
          }
          setTripStatus('completed');
          navigate('TripComplete');
        } else if (s === 'cancelled') {
          Alert.alert('Cancelled', 'Trip was cancelled.', [{ text: 'OK', onPress: goBack }]);
        }
      } catch (_) {}
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [tripId, token, navigate, goBack, setDriver, setTripStatus, setFinalFare, mergeTripData]);

  const handleCancel = () => {
    triggerSpin();
    Alert.alert('Cancel Trip', 'Are you sure you want to cancel?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel', style: 'destructive',
        onPress: async () => {
          try { if (tripId) await cancelTrip(tripId, 'Changed my mind', token); } catch (_) {}
          goBack();
        },
      },
    ]);
  };

  // Fare priority: 1) server trip fare  2) fareEstimates for selected category  3) 0
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const matchedEstimate = fareEstimates.find(
    (e) => e.vehicle_category?.toLowerCase() === (tripData?.vehicle_category || selectedCategory?.name || '').toLowerCase()
  );
  const fareRaw = parseFloat(tripData?.estimated_fare_etb) || parseFloat(matchedEstimate?.estimated_fare_etb) || 0;
  const fare = fareRaw.toFixed(2);
  const category = tripData?.vehicle_category
    ? tripData.vehicle_category.charAt(0).toUpperCase() + tripData.vehicle_category.slice(1)
    : 'Economy';

  return (
    <View style={styles.root}>
      {/* ── Full-screen map ── */}
      <RideMap mapRef={mapRef} style={StyleSheet.absoluteFill}>
        {pickupCoords && <PickupMarker coordinate={pickupCoords} title={tripData?.pickup_address || 'Your location'} />}
        {dropoffCoords && <DestMarker coordinate={dropoffCoords} title={tripData?.dropoff_address || destination?.name || 'Destination'} />}
        <RoutePolyline coordinates={routeCoords} />
      </RideMap>

      {/* ── Emerald gradient overlay (bottom two-thirds) ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,103,79,0.18)', 'rgba(0,103,79,0.72)', colors.primary]}
        locations={[0, 0.3, 0.62, 1]}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* ── Searching indicator (top of overlay) ── */}
      <View style={[styles.searchingBadge, { top: insets.top + 16 }]}>
        <View style={styles.pulseWrap}>
          <PulseRing delay={0} />
          <PulseRing delay={600} />
          <Animated.View style={[styles.pulseCore, { transform: [{ rotate: spinDeg }] }]}>
            <FontAwesome5 name="car" size={14} color={colors.white} solid />
          </Animated.View>
        </View>
        <View>
          <Text style={styles.badgeTitle}>Finding your driver</Text>
          <SearchDots />
        </View>
      </View>

      {/* ── Bottom sheet ── */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        {/* Price pill */}
        <View style={styles.pricePill}>
          <Text style={styles.priceLabel}>Estimated Fare</Text>
          <Text style={styles.priceAmount}>ETB {fare}</Text>
        </View>

        {/* Route summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.white }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {tripData?.pickup_address || 'Your location'}
            </Text>
          </View>

          <View style={styles.routeConnector}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={styles.connectorDash} />
            ))}
          </View>

          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: '#F87171' }]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {tripData?.dropoff_address || destination?.name || 'Destination'}
            </Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <FontAwesome5 name="car-side" size={11} color="rgba(255,255,255,0.8)" solid />
            <Text style={styles.metaText}>{category}</Text>
          </View>
          <View style={styles.metaChip}>
            <FontAwesome5 name="money-bill-wave" size={11} color="rgba(255,255,255,0.8)" solid />
            <Text style={styles.metaText}>Cash</Text>
          </View>
        </View>

        {/* Cancel */}
        <Button 
          label="Cancel Trip" 
          variant="outline" 
          onPress={handleCancel}
          labelClassName="text-red-300"
          className="border-red-500/50 bg-red-500/10"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  gradient: {
    position: 'absolute',
    left: 0, right: 0,
    bottom: 0,
    height: '65%',
  },

  // Searching badge — top left floating pill
  searchingBadge: {
    position: 'absolute',
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 50,
    backdropFilter: 'blur(10px)',
  },
  pulseWrap: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
  },
  pulseCore: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    ...shadow.sm,
  },
  badgeTitle: {
    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
    color: colors.white,
  },

  // Bottom sheet — sits on top of gradient
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  // Price pill — prominent at top of sheet
  pricePill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 20,
    paddingVertical: 14,
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: fontWeight.medium,
  },
  priceAmount: {
    fontSize: fontSize['4xl'],
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: -0.5,
  },

  // Route card
  routeCard: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  routeDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  routeText: {
    flex: 1, fontSize: fontSize.sm,
    color: colors.white, fontWeight: fontWeight.medium,
  },
  routeConnector: {
    flexDirection: 'column', alignItems: 'flex-start',
    paddingLeft: 4, gap: 3, marginVertical: 5,
  },
  connectorDash: {
    width: 1.5, height: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginLeft: 4,
  },

  // Meta chips
  metaRow: {
    flexDirection: 'row', gap: 8, marginBottom: 14,
  },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  metaText: {
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'capitalize',
  },

  // Cancel
  cancelBtn: {
    backgroundColor: 'rgba(239,68,68,0.22)',
    borderWidth: 1.5,
    borderColor: 'rgba(239,68,68,0.55)',
    borderRadius: borderRadius.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: fontSize.md, fontWeight: fontWeight.semibold,
    color: '#FFADAD',
  },
});
