import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FlatList } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import RideTypeCard from './RideTypeCard';
import RideTypeCardSkeleton from './RideTypeCardSkeleton';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { colors } from '../../constants/colors';
import { fontSize } from '../../constants/typography';

const CARD_WIDTH = 300;
const CARD_GAP = 12;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

function RideTypeSelector({ distanceKm = 5, durationMin = 14, showAll = true }) {
  const { i18n } = useTranslation();

  // Narrow slice selectors: unrelated store updates (e.g. driverLocation
  // ticking during a trip) won't re-render this list.
  const categories = useRideStore((s) => s.categories);
  const categoriesLoaded = useRideStore((s) => s.categoriesLoaded);
  const selectedCategoryId = useRideStore((s) => s.selectedCategoryId);
  const fareEstimates = useRideStore((s) => s.fareEstimates);
  const fareEstimateLoading = useRideStore((s) => s.fareEstimateLoading);
  const routeInfo = useRideStore((s) => s.routeInfo);
  const loadCategories = useRideStore((s) => s.loadCategories);
  const selectCategory = useRideStore((s) => s.selectCategory);
  const loadFareEstimates = useRideStore((s) => s.loadFareEstimates);
  const setMapScrollEnabled = useRideStore((s) => s.setMapScrollEnabled);

  const token = useAuthStore((s) => s.token);
  const userCoords = useLocationStore((s) => s.userCoords);
  const destination = useLocationStore((s) => s.destination);

  const lastEstimateKey = useRef(null);

  useEffect(() => {
    loadCategories();
    const interval = setInterval(loadCategories, 30000);
    return () => clearInterval(interval);
  }, [loadCategories]);

  useEffect(() => {
    if (!userCoords || !destination) return;
    const key = `${userCoords.latitude},${userCoords.longitude}|${destination.lat},${destination.lng}`;
    if (key === lastEstimateKey.current) return;
    lastEstimateKey.current = key;
    loadFareEstimates(
      userCoords.latitude, userCoords.longitude,
      destination.lat, destination.lng,
      token,
    );
  }, [userCoords?.latitude, userCoords?.longitude, destination?.lat, destination?.lng, token, loadFareEstimates]);

  // Preemptive lock: while the carousel is mounted, the map is locked.
  // This eliminates race conditions during horizontal swiping on Android.
  useEffect(() => {
    setMapScrollEnabled(false);
    return () => setMapScrollEnabled(true);
  }, [setMapScrollEnabled]);

  const lang = i18n.language === 'am' ? 'am' : 'en';

  const fareMap = useMemo(() => {
    const m = {};
    fareEstimates.forEach((e) => {
      m[e.vehicle_category?.toLowerCase()] = e.estimated_fare_etb;
    });
    return m;
  }, [fareEstimates]);

  const realDistKm = routeInfo?.distance_km || distanceKm;
  const realDurMin = routeInfo?.duration_min || durationMin;
  const surge = routeInfo?.surge_multiplier ?? 1;

  const visibleCategories = useMemo(
    () => (showAll ? categories : categories.slice(0, 3)),
    [categories, showAll],
  );

  const handleSelect = useCallback((id) => selectCategory(id), [selectCategory]);

  if (!categoriesLoaded) {
    return (
      <View style={styles.cardList}>
        <RideTypeCardSkeleton />
        <RideTypeCardSkeleton />
        <RideTypeCardSkeleton />
      </View>
    );
  }

  if (categories.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No vehicle types available</Text>
      </View>
    );
  }

  const farePending = Boolean(destination && fareEstimateLoading && fareEstimates.length === 0);
  if (farePending) {
    return (
      <View style={styles.cardList}>
        {visibleCategories.map((c) => (
          <RideTypeCardSkeleton key={`fare-loading-${c.id}`} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.cardList}>
      {surge > 1 && (
        <View style={styles.surgeBanner}>
          <Text style={styles.surgeText}>⚡ {surge}× surge pricing active</Text>
        </View>
      )}

      <FlatList
        data={visibleCategories}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP_INTERVAL}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        disableIntervalMomentum={true}
        nestedScrollEnabled={true}
        disallowInterruption={true}

        renderItem={({ item: cat }) => (
          <RideTypeCard
            category={cat}
            selected={selectedCategoryId === cat.id}
            onPress={() => handleSelect(cat.id)}
            distanceKm={realDistKm}
            durationMin={realDurMin}
            serverFare={fareMap[cat.name?.toLowerCase()]}
            fareLoading={false}
            lang={lang}
          />
        )}
        contentContainerStyle={styles.horizontalScroll}
      />
    </View>
  );
}

export default memo(RideTypeSelector);

const styles = StyleSheet.create({
  cardList: { paddingVertical: 2 },
  empty: { paddingVertical: 20, alignItems: 'center' },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary },
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
  horizontalScroll: {
    paddingRight: 20,
    paddingVertical: 10,
  },
});
