import React, { useEffect, useRef, memo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import RideTypeCard from './RideTypeCard';
import RideTypeCardSkeleton from './RideTypeCardSkeleton';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { colors } from '../../constants/colors';
import { fontSize } from '../../constants/typography';

function RideTypeSelector({ distanceKm = 5, durationMin = 14, showAll = true }) {
  const { i18n } = useTranslation();
  const {
    categories, categoriesLoaded, selectedCategoryId,
    loadCategories, selectCategory,
    fareEstimates, fareEstimateLoading, routeInfo, loadFareEstimates,
  } = useRideStore();
  const { token } = useAuthStore();
  const { userCoords, destination } = useLocationStore();

  const lastEstimateKey = useRef(null);

  useEffect(() => {
    loadCategories();
  }, []);

  // Call fare-estimate whenever pickup + destination are available
  useEffect(() => {
    if (!userCoords || !destination) return;
    const key = `${userCoords.latitude},${userCoords.longitude}|${destination.lat},${destination.lng}`;
    if (key === lastEstimateKey.current) return;
    lastEstimateKey.current = key;
    loadFareEstimates(
      userCoords.latitude, userCoords.longitude,
      destination.lat, destination.lng,
      token
    );
  }, [userCoords?.latitude, userCoords?.longitude, destination?.lat, destination?.lng]);

  const lang = i18n.language === 'am' ? 'am' : 'en';

  // Build a map: category_name_lower → estimated_fare_etb
  const fareMap = {};
  fareEstimates.forEach((e) => {
    fareMap[e.vehicle_category?.toLowerCase()] = e.estimated_fare_etb;
  });

  // Use OSRM distance/duration if available, fall back to props
  const realDistKm  = routeInfo?.distance_km  || distanceKm;
  const realDurMin  = routeInfo?.duration_min  || durationMin;
  const surge       = routeInfo?.surge_multiplier ?? 1;

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

  const visibleCategories = showAll ? categories : categories.slice(0, 3);

  // One full-card skeleton pass for fares+route (no per-row price shimmer).
  const farePending = Boolean(destination && fareEstimateLoading);

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
      {visibleCategories.map((cat) => {
        const serverFare = fareMap[cat.name?.toLowerCase()];
        return (
          <RideTypeCard
            key={cat.id}
            category={cat}
            selected={selectedCategoryId === cat.id}
            onPress={() => selectCategory(cat.id)}
            distanceKm={realDistKm}
            durationMin={realDurMin}
            serverFare={serverFare}
            fareLoading={false}
            lang={lang}
          />
        );
      })}
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
});
