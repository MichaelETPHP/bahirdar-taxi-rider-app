import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Animated, BackHandler, Linking, TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Route, Clock, Star, Phone } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { submitRating } from '../../services/tripService';

const TAGS = [
  { slug: 'on_time',        label: 'On time' },
  { slug: 'friendly',       label: 'Friendly' },
  { slug: 'clean_car',      label: 'Clean car' },
  { slug: 'safe_driving',   label: 'Safe driving' },
  { slug: 'knew_the_route', label: 'Knew the route' },
];

export default function TripCompleteScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { tripId, tripData, driver, finalFare, fareAdjustment, clearFareAdjustment, reset } = useRideStore();
  const pickupAddress  = tripData?.pickup_address  || null;
  const dropoffAddress = tripData?.dropoff_address || null;
  const { token }  = useAuthStore();
  const { clearDestination, clearStops } = useLocationStore();

  const [stars,       setStars]       = useState(0);
  const [selectedTags, setSelectedTags] = useState([]);
  const [comment,     setComment]     = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitted,   setSubmitted]   = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false, headerLeft: () => null });
  }, [navigation]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

  // Auto-navigate after 25s
  useEffect(() => {
    const timer = setTimeout(finishFlow, 25000);
    return () => clearTimeout(timer);
  }, []);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, speed: 10, bounciness: 16, useNativeDriver: true }).start();
  }, []);

  const fare       = finalFare?.amount || tripData?.final_fare_etb || tripData?.total_fare_etb || fareAdjustment?.finalFare || 0;
  const distKm     = finalFare?.distanceKm || tripData?.distance_km || 0;
  const durMin     = finalFare?.durationMin || tripData?.duration_min || 0;
  const isWalletPaid = tripData?.payment_method === 'wallet';

  const toggleTag = (slug) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]
    );
  };

  const handleStarPress = (n) => {
    if (submitted || submitting) return;
    setStars(n);
  };

  const handleSubmit = async () => {
    if (submitting || submitted || stars === 0) return;
    setSubmitting(true);
    try {
      if (tripId) {
        await submitRating(
          tripId,
          {
            score:   stars,          // ← correct field name the API expects
            comment: comment.trim() || undefined,
            tags:    selectedTags.length ? selectedTags : undefined,
          },
          token,
        );
      }
      setSubmitted(true);
      setTimeout(finishFlow, 1200);
    } catch (_) {
      // Never trap the rider — just proceed
      finishFlow();
    } finally {
      setSubmitting(false);
    }
  };

  const finishFlow = () => {
    clearFareAdjustment();
    reset();
    clearDestination();
    clearStops();
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Checkmark */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
        <Check size={24} color={colors.white} />
      </Animated.View>

      <Text style={styles.title}>Trip Completed!</Text>
      <Text style={styles.subtitle}>Thanks for riding with Bahiran Ride</Text>

      {/* Route card */}
      {(pickupAddress || dropoffAddress) && (
        <View style={styles.card}>
          <View style={styles.routeRow}>
            <View style={styles.dotGreen} />
            <Text style={styles.routeText} numberOfLines={2}>{pickupAddress || 'Pickup'}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={styles.dotBlue} />
            <Text style={styles.routeText} numberOfLines={2}>{dropoffAddress || 'Destination'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Paid</Text>
            <Text style={styles.totalValue}>ETB {parseFloat(fare).toFixed(2)}</Text>
          </View>
          {isWalletPaid && (
            <View style={styles.walletPaidRow}>
              <Check size={13} color="#22C55E" />
              <Text style={styles.walletPaidText}>Paid from your wallet — nothing owed in cash</Text>
            </View>
          )}
        </View>
      )}

      {/* Stats */}
      <View style={[styles.card, styles.statsRow]}>
        <View style={styles.stat}>
          <Route size={18} color={colors.primary} />
          <Text style={styles.statValue}>{parseFloat(distKm).toFixed(1)} km</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Clock size={18} color={colors.primary} />
          <Text style={styles.statValue}>{Math.round(durMin)} min</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </View>
      </View>

      {/* ── Rating card ── */}
      <View style={styles.card}>
        <Text style={styles.ratingTitle}>Rate your driver</Text>
        <Text style={styles.ratingDriver}>{driver?.name || 'Your driver'}</Text>

        {/* Stars */}
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => handleStarPress(n)}
              activeOpacity={0.7}
              disabled={submitting || submitted}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Star
                size={36}
                color={n <= stars ? '#F59E0B' : '#D1D5DB'}
                fill={n <= stars ? '#F59E0B' : 'none'}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Star label */}
        {stars > 0 && (
          <Text style={styles.starLabel}>
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][stars]}
          </Text>
        )}

        {/* Quick tags — shown after star selection */}
        {stars > 0 && (
          <View style={styles.tagsSection}>
            <Text style={styles.tagsTitle}>What went well?</Text>
            <View style={styles.tagsWrap}>
              {TAGS.map((tag) => {
                const active = selectedTags.includes(tag.slug);
                return (
                  <TouchableOpacity
                    key={tag.slug}
                    onPress={() => toggleTag(tag.slug)}
                    style={[styles.tag, active && styles.tagActive]}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.tagText, active && styles.tagTextActive]}>
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Comment */}
        {stars > 0 && (
          <TextInput
            style={styles.commentInput}
            placeholder="Add a comment (optional)..."
            placeholderTextColor={colors.textSecondary}
            value={comment}
            onChangeText={setComment}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
        )}

        {/* Submit */}
        {stars > 0 && !submitted && (
          <TouchableOpacity
            style={[styles.submitBtn, (submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitText}>Submit Rating</Text>
            }
          </TouchableOpacity>
        )}

        {submitted && (
          <View style={styles.thankYou}>
            <Check size={16} color={colors.primary} />
            <Text style={styles.thankYouText}>Thanks for your rating!</Text>
          </View>
        )}
      </View>

      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={finishFlow} activeOpacity={0.7}>
        <Text style={styles.skipText}>{submitted ? 'Done' : 'Skip'}</Text>
      </TouchableOpacity>

      {/* Support */}
      <View style={styles.supportFooter}>
        <Text style={styles.supportLabel}>Need help with this trip?</Text>
        <TouchableOpacity style={styles.supportBtn} onPress={() => Linking.openURL('tel:9040')} activeOpacity={0.7}>
          <Phone size={16} color={colors.primary} />
          <Text style={styles.supportText}>Call Support 9040</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.white },
  container: { alignItems: 'center', paddingHorizontal: 20 },

  checkCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, ...shadow.lg,
  },
  title:    { fontSize: 20, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 },

  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: 16, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 14 },

  routeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 4 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', marginTop: 5, flexShrink: 0 },
  dotBlue:  { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 5, flexShrink: 0 },
  routeText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, fontWeight: fontWeight.medium, lineHeight: 20 },
  routeLine: { width: 1, height: 12, backgroundColor: colors.border, marginLeft: 4, marginVertical: 2 },
  divider:   { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  totalRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:{ fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  totalValue:{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  walletPaidRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
    backgroundColor: 'rgba(34,197,94,0.08)', paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: 'rgba(34,197,94,0.18)',
  },
  walletPaidText: { fontSize: fontSize.xs, color: '#16A34A', fontWeight: fontWeight.bold, flexShrink: 1 },

  stat:       { flex: 1, alignItems: 'center', gap: 6 },
  statDivider:{ width: 1, height: 32, backgroundColor: colors.border, marginHorizontal: 12 },
  statValue:  { fontSize: 18, fontWeight: fontWeight.bold, color: colors.textPrimary },
  statLabel:  { fontSize: fontSize.xs, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Rating
  ratingTitle:  { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, textAlign: 'center', marginBottom: 2 },
  ratingDriver: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: 14 },
  starsRow:     { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 8 },
  starLabel:    { textAlign: 'center', fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#F59E0B', marginBottom: 14 },

  // Tags
  tagsSection: { width: '100%', marginBottom: 14 },
  tagsTitle:   { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  tagsWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: borderRadius.pill,
    borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  tagActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}15` },
  tagText:       { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  tagTextActive: { color: colors.primary, fontWeight: fontWeight.bold },

  // Comment
  commentInput: {
    width: '100%',
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: 12, fontSize: fontSize.sm,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundAlt,
    minHeight: 72, textAlignVertical: 'top',
    marginBottom: 14,
  },

  // Submit
  submitBtn: {
    width: '100%', backgroundColor: colors.primary,
    borderRadius: borderRadius.button,
    height: 50, justifyContent: 'center', alignItems: 'center',
    ...shadow.md,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.white },

  thankYou: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  thankYouText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },

  skipBtn:  { paddingVertical: 12, paddingHorizontal: 24 },
  skipText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },

  supportFooter: { marginTop: 8, alignItems: 'center', gap: 4 },
  supportLabel:  { fontSize: fontSize.xs, color: colors.textSecondary },
  supportBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.pill,
    borderWidth: 1, borderColor: colors.border,
  },
  supportText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.primary },
});
