import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, BackHandler, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Route, Clock, DollarSign, Star, AlertTriangle, Shield, Phone, MapPin, Navigation } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { submitRating } from '../../services/tripService';

export default function TripCompleteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { tripId, tripData, driver, finalFare, fareAdjustment, clearFareAdjustment, reset } = useRideStore();
  const pickupAddress = tripData?.pickup_address || null;
  const dropoffAddress = tripData?.dropoff_address || null;
  const { token } = useAuthStore();
  const { clearDestination, clearStops } = useLocationStore();

  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Disable back button and swipe
  React.useLayoutEffect(() => {
    navigation.setOptions({
      gestureEnabled: false,
      headerLeft: () => null, // Remove back button if any
    });
  }, [navigation]);

  useEffect(() => {
    const backAction = () => {
      // Return true to prevent default back behavior
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      backAction,
    );

    return () => backHandler.remove();
  }, []);

  const fare = finalFare?.amount
    || tripData?.final_fare_etb
    || tripData?.total_fare_etb
    || tripData?.estimated_fare_etb
    || fareAdjustment?.finalFare
    || 0;
  const confirmedFare = fareAdjustment?.confirmedFare || fare;
  const adjustment = fareAdjustment?.adjustment ?? 0;
  const pricingModel = fareAdjustment?.pricingModel ?? 'upfront';
  const distKm = finalFare?.distanceKm || tripData?.distance_km || 0;
  const durMin = finalFare?.durationMin || tripData?.duration_min || 0;

  // ── Automatic navigation timer ─────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      finishFlow();
    }, 20000); // 20 seconds

    return () => clearTimeout(timer);
  }, []);

  // ── Checkmark animation ─────────────────────────────
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, speed: 10, bounciness: 16, useNativeDriver: true }).start();
  }, []);

  const handleSubmit = async (selectedStars) => {
    setStars(selectedStars);
    setSubmitting(true);

    // Small delay to allow user to see their selection (simulates "thinking")
    await new Promise(resolve => setTimeout(resolve, 800));

    try {
      if (tripId) {
        await submitRating(tripId, { rating: selectedStars }, token);
      }
    } catch (_) {
      // Mock success even if network fails
    }
    finishFlow();
  };

  const finishFlow = () => {
    clearFareAdjustment();
    reset();
    clearDestination();
    clearStops();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      {/* Checkmark */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
        <Check size={22} color={colors.white} />
      </Animated.View>

      <Text style={styles.title}>Trip Completed!</Text>
      <Text style={styles.subtitle}>Thanks for riding with Bahiran Ride</Text>

      {/* Route summary card */}
      {(pickupAddress || dropoffAddress) && (
        <View style={styles.routeCard}>
          <View style={styles.routeRow}>
            <View style={styles.routeDotGreen} />
            <Text style={styles.routeText} numberOfLines={2}>{pickupAddress || 'Pickup'}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.routeDotBlue} />
            <Text style={styles.routeText} numberOfLines={2}>{dropoffAddress || 'Destination'}</Text>
          </View>
          <View style={styles.routeDivider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>ETB {parseFloat(fare).toFixed(2)}</Text>
          </View>
        </View>
      )}

      {/* Trip Summary Stats */}
      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Route size={20} color={colors.primary} />
            <Text style={styles.statValue}>{parseFloat(distKm).toFixed(1)} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Clock size={20} color={colors.primary} />
            <Text style={styles.statValue}>{Math.round(durMin)} min</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>

        </View>
      </View>

      {/* Rating */}
      <View style={styles.ratingCard}>
        <Text style={styles.ratingTitle}>Rate your trip</Text>
        <Text style={styles.ratingDriver}>{driver?.name || 'Your driver'}</Text>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity key={n} onPress={() => handleSubmit(n)} activeOpacity={0.7} disabled={submitting}>
              <Star
                size={24}
                color={n <= stars ? '#F59E0B' : colors.border}
                fill={n <= stars ? '#F59E0B' : 'none'}
              />
            </TouchableOpacity>
          ))}
        </View>
        {submitting && <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />}


      </View>

      <TouchableOpacity style={styles.skipBtn} onPress={finishFlow} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Support Footer */}
      <View style={styles.supportFooter}>
        <Text style={styles.supportLabel}>Need help with this trip?</Text>
        <TouchableOpacity
          style={styles.supportBtn}
          onPress={() => Linking.openURL('tel:9040')}
          activeOpacity={0.7}
        >
          <Phone size={16} color={colors.primary} />
          <Text style={styles.supportText}>Call Support 9040</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  checkCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 12, ...shadow.lg,
  },
  title: {
    fontSize: 18, fontWeight: fontWeight.bold,
    color: colors.textPrimary, marginBottom: 2, textAlign: 'center',
  },
  subtitle: {
    fontSize: 12, color: colors.textSecondary,
    textAlign: 'center', marginBottom: 12,
  },
  routeCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  routeDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', marginTop: 4, flexShrink: 0 },
  routeDotBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 4, flexShrink: 0 },
  routeText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.medium, lineHeight: 20 },
  routeLine: { width: 1, height: 12, backgroundColor: colors.border, marginLeft: 4, marginVertical: 2 },
  routeDivider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  totalValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  statsCard: {
    width: '100%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  statRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: 12 },
  statValue: { fontSize: 18, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  ratingCard: {
    width: '100%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    padding: 8, marginBottom: 12,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 2,
  },
  ratingDriver: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 6 },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  commentInput: {
    width: '100%',
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 12, fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 80, textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitBtn: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    height: 50, justifyContent: 'center', alignItems: 'center',
    ...shadow.md,
  },
  submitText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.white },
  skipBtn: { paddingVertical: 12 },
  skipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  supportFooter: {
    marginTop: 16,
    alignItems: 'center',
    gap: 4,
  },
  supportLabel: {
    fontSize: fontSize.xs,
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
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  receiptCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: borderRadius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  receiptUpfront: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  receiptText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  receiptHybrid: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    alignItems: 'flex-start',
  },
  receiptHybridTitle: {
    fontSize: fontSize.sm,
    color: '#92400E',
    fontWeight: fontWeight.bold,
    marginBottom: 4,
  },
  receiptHybridRow: {
    fontSize: fontSize.xs,
    color: '#78350F',
    fontFamily: 'Courier',
  },
  receiptHybridTotal: {
    fontSize: fontSize.sm,
    color: '#92400E',
    fontWeight: fontWeight.bold,
    fontFamily: 'Courier',
    marginTop: 4,
  },
});
