import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Animated, Alert, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Circle, MapPin, Route, Clock, DollarSign, Star } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { submitRating } from '../../services/tripService';

export default function TripCompleteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { tripId, tripData, driver, finalFare, reset } = useRideStore();
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

  const fare = finalFare?.amount || tripData?.estimated_fare_etb || 0;
  const distKm = finalFare?.distanceKm || tripData?.distance_km || 0;
  const durMin = finalFare?.durationMin || tripData?.duration_min || 0;

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
    reset();
    clearDestination();
    clearStops();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* Checkmark */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
        <Check size={36} color={colors.white} />
      </Animated.View>

      <Text style={styles.title}>Trip Completed!</Text>
      <Text style={styles.subtitle}>Thanks for riding with BahirdarRide</Text>

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
                size={40}
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.white },
  container: { alignItems: 'center', paddingHorizontal: 24 },
  checkCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20, ...shadow.lg,
  },
  title: {
    fontSize: 24, fontWeight: fontWeight.bold,
    color: colors.textPrimary, marginBottom: 6, textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm, color: colors.textSecondary,
    textAlign: 'center', marginBottom: 28,
  },
  statsCard: {
    width: '100%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    padding: 24, marginBottom: 24,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  statRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 6 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border, marginHorizontal: 20 },
  statValue: { fontSize: 20, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  ratingCard: {
    width: '100%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 4,
  },
  ratingDriver: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
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
});
