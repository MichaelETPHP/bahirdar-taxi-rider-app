import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Animated, Alert,
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

  const fare = finalFare?.amount || tripData?.estimated_fare_etb || 0;
  const distKm = finalFare?.distanceKm || tripData?.distance_km || 0;
  const durMin = finalFare?.durationMin || tripData?.duration_min || 0;

  // ── Checkmark animation ─────────────────────────────
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, speed: 10, bounciness: 16, useNativeDriver: true }).start();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      if (tripId) {
        await submitRating(tripId, { rating: stars, comment: comment.trim() || undefined }, token);
      }
    } catch (_) {}
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

      {/* Receipt */}
      <View style={styles.receipt}>
        <View style={styles.receiptRow}>
          <Circle size={12} color={colors.primary} />
          <Text style={styles.receiptLabel}>From</Text>
          <Text style={styles.receiptValue} numberOfLines={1}>
            {tripData?.pickup_address || '—'}
          </Text>
        </View>
        <View style={styles.receiptDivider} />
        <View style={styles.receiptRow}>
          <MapPin size={12} color="#EF4444" />
          <Text style={styles.receiptLabel}>To</Text>
          <Text style={styles.receiptValue} numberOfLines={1}>
            {tripData?.dropoff_address || '—'}
          </Text>
        </View>
        <View style={styles.receiptSeparator} />
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Route size={14} color={colors.textSecondary} />
            <Text style={styles.statValue}>{parseFloat(distKm).toFixed(1)} km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Clock size={14} color={colors.textSecondary} />
            <Text style={styles.statValue}>{Math.round(durMin)} min</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <DollarSign size={14} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.primary }]}>
              ETB {parseFloat(fare).toFixed(2)}
            </Text>
            <Text style={styles.statLabel}>Cash</Text>
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
            <TouchableOpacity key={n} onPress={() => setStars(n)} activeOpacity={0.7}>
              <Star
                size={36}
                color={n <= stars ? '#F59E0B' : colors.border}
                fill={n <= stars ? '#F59E0B' : 'none'}
              />
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          style={styles.commentInput}
          placeholder="Leave a comment (optional)…"
          placeholderTextColor={colors.inputPlaceholder}
          value={comment}
          onChangeText={setComment}
          multiline
          numberOfLines={3}
          maxLength={300}
        />

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitText}>Submit Rating</Text>
          )}
        </TouchableOpacity>
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
  receipt: {
    width: '100%',
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  receiptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  receiptLabel: { fontSize: fontSize.xs, color: colors.textSecondary, width: 36 },
  receiptValue: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.medium },
  receiptDivider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  receiptSeparator: { height: 1, backgroundColor: colors.border, marginTop: 12, marginBottom: 16 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  statValue: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
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
