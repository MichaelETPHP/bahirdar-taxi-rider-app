import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, RefreshControl, View, Text, StyleSheet } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getFareEstimateForCategory } from '../../utils/fareEstimates';
import { colors } from '../../constants/colors';
import { fontSize } from '../../constants/typography';
import RideTypeCard from './RideTypeCard';
import RideTypeCardSkeleton from './RideTypeCardSkeleton';
import { useTranslation } from 'react-i18next';

// Mirrors HomeScreen's own `stickyButton` footprint exactly (paddingTop 14 +
// button height 52 + borderTopWidth 1, see styles.stickyButton/confirmBtn
// there) plus a small breathing-room gap before it — this is the actual
// height of the floating "Select Category" bar that overlays the bottom of
// this list, not a guess.
const STICKY_BUTTON_FOOTPRINT = 14 + 52 + 1 + 12;

function RideTypeSelector({ distanceKm, durationMin }) {
  const { i18n } = useTranslation();
  const insets = useSafeAreaInsets();

  const categories          = useRideStore((s) => s.categories);
  const categoriesLoaded    = useRideStore((s) => s.categoriesLoaded);
  const selectedCategoryId  = useRideStore((s) => s.selectedCategoryId);
  const fareEstimates       = useRideStore((s) => s.fareEstimates);
  const fareEstimateLoading = useRideStore((s) => s.fareEstimateLoading);
  const routeInfo           = useRideStore((s) => s.routeInfo);
  const loadCategories      = useRideStore((s) => s.loadCategories);
  const selectCategory      = useRideStore((s) => s.selectCategory);
  const loadFareEstimates   = useRideStore((s) => s.loadFareEstimates);

  const token       = useAuthStore((s) => s.token);
  const userCoords  = useLocationStore((s) => s.userCoords);
  const destination = useLocationStore((s) => s.destination);

  const setMapScrollEnabled = useRideStore((s) => s.setMapScrollEnabled);

  const lastEstimateKey = useRef(null);
  const scrollRef       = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  // Android only: react-native-maps' native view competes with this RNGH
  // ScrollView for the same touch and, unlike iOS, wins — the list looks
  // "stuck" and the map pans instead. A per-touch freeze (onTouchStart/
  // onTouchEnd) doesn't fix this: RNGH's ScrollView intercepts touches
  // through its own native gesture system on Android, so RN's plain touch
  // events don't reliably fire on it, and even when they do, the map's
  // gesture detector has usually already claimed the touch by the time a
  // JS callback crosses back to native. Freezing for the component's whole
  // mounted lifetime — before any touch can happen — has no such race.
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    setMapScrollEnabled(false);
    return () => setMapScrollEnabled(true);
  }, [setMapScrollEnabled]);

  useEffect(() => {
    loadCategories();
    const iv = setInterval(loadCategories, 30000);
    return () => clearInterval(iv);
  }, [loadCategories]);

  // Manual pull, on top of the existing 30s background poll above — lets the
  // rider force an immediate refresh (e.g. right after a price change)
  // instead of waiting on the interval.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const tasks = [loadCategories()];
      if (userCoords && destination) {
        tasks.push(loadFareEstimates(
          userCoords.latitude, userCoords.longitude,
          destination.lat,     destination.lng,
          token,
        ));
      }
      await Promise.all(tasks);
    } finally {
      setRefreshing(false);
    }
  }, [loadCategories, loadFareEstimates, userCoords, destination, token]);

  useEffect(() => {
    if (!userCoords || !destination) return;
    const key = `${userCoords.latitude},${userCoords.longitude}|${destination.lat},${destination.lng}`;
    if (key === lastEstimateKey.current) return;
    lastEstimateKey.current = key;
    loadFareEstimates(
      userCoords.latitude, userCoords.longitude,
      destination.lat,     destination.lng,
      token,
    );
  }, [userCoords?.latitude, userCoords?.longitude, destination?.lat, destination?.lng, token, loadFareEstimates]);

  const lang    = i18n.language === 'am' ? 'am' : 'en';
  const distKm  = routeInfo?.distance_km  || distanceKm;
  const durMin  = routeInfo?.duration_min || durationMin;
  const surge   = routeInfo?.surge_multiplier ?? 1;

  // Matches HomeScreen's own sticky-button padding formula exactly
  // (`Math.max(10, insets.bottom) + 6`) so the clearance is calibrated per
  // device instead of one hardcoded guess — was 110px flat, overshooting by
  // 15-30px on most Android devices and anything without a home indicator,
  // which read as unexplained empty space at the end of the scroll.
  const scrollContentStyle = useMemo(() => ([
    styles.scrollContent,
    { paddingBottom: STICKY_BUTTON_FOOTPRINT + Math.max(10, insets.bottom) + 6 },
  ]), [insets.bottom]);

  if (!categoriesLoaded) {
    return (
      <View style={styles.listContainer}>
        <RideTypeCardSkeleton />
        <RideTypeCardSkeleton />
        <RideTypeCardSkeleton />
      </View>
    );
  }

  if (!categories.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No vehicle types available</Text>
      </View>
    );
  }

  const farePending = Boolean(destination && fareEstimateLoading && fareEstimates.length === 0);

  return (
    <View>
      {surge > 1 && (
        <View style={styles.surgeBanner}>
          <Text style={styles.surgeText}>⚡ {surge}× surge pricing active</Text>
        </View>
      )}

      <View style={styles.listContainer}>
        <GHScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={scrollContentStyle}
          showsVerticalScrollIndicator={true}
          bounces={true}
          nestedScrollEnabled
          // Android only: the RNGH ScrollView + RefreshControl combo here
          // left the spinner stuck on screen after a refresh finished. The
          // 30s background poll in the effect above already keeps this list
          // fresh, so the simplest safe fix is no pull gesture on Android
          // at all rather than chasing that native glitch.
          refreshControl={
            Platform.OS === 'android' ? undefined : (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            )
          }
        >
          {categories.map((cat, index) => {
            const est = getFareEstimateForCategory(fareEstimates, cat, index);
            return (
              <View
                key={cat.id.toString()}
                style={styles.item}
              >
                <RideTypeCard
                  category={cat}
                  selected={selectedCategoryId === cat.id}
                  onPress={() => {
                    selectCategory(cat.id);
                  }}
                  distanceKm={distKm}
                  durationMin={durMin}
                  serverFare={farePending ? undefined : est?.fare}
                  serverBreakdown={est?.breakdown}
                  arrivalEta={est?.eta}
                  surge={surge}
                  fareLoading={farePending}
                  lang={lang}
                />
              </View>
            );
          })}
        </GHScrollView>
      </View>
    </View>
  );
}

export default memo(RideTypeSelector);

const styles = StyleSheet.create({
  listContainer: {
    // maxHeight, not a fixed height — a short category list (e.g. 2-3
    // items) should shrink to fit its content instead of leaving a fixed
    // 276px box with visible empty space trailing after the last card. Only
    // caps and scrolls once content actually exceeds this height.
    maxHeight: 276,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.05)',
  },
  scroll: {
    maxHeight: 276,
  },
  scrollContent: {
    paddingTop: 8,
    // paddingBottom is set dynamically via scrollContentStyle above.
    paddingHorizontal: 8,
  },
  item: {
    paddingVertical: 6,
  },
  empty: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  surgeBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  surgeText: {
    fontSize: fontSize.xs,
    color: '#92400E',
    fontWeight: '600',
  },
});
