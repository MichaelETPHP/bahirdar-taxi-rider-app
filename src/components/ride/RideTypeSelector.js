import { memo, useCallback, useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getFareEstimateForCategory } from '../../utils/fareEstimates';
import { colors } from '../../constants/colors';
import { fontSize } from '../../constants/typography';
import RideTypeCard from './RideTypeCard';
import RideTypeCardSkeleton from './RideTypeCardSkeleton';
import { useTranslation } from 'react-i18next';

function RideTypeSelector({ distanceKm, durationMin }) {
  const { i18n } = useTranslation();

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

  const lastEstimateKey = useRef(null);
  const scrollRef       = useRef(null);

  useEffect(() => {
    loadCategories();
    const iv = setInterval(loadCategories, 30000);
    return () => clearInterval(iv);
  }, [loadCategories]);

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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
          bounces={true}
          nestedScrollEnabled
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
    height: 276,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.05)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 110,
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
