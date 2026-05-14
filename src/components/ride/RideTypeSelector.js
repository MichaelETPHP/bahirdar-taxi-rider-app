import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

import * as Haptics from 'expo-haptics';

import { useTranslation } from 'react-i18next';
import RideTypeCard from './RideTypeCard';
import RideTypeCardSkeleton from './RideTypeCardSkeleton';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getFareEstimateForCategory } from '../../utils/fareEstimates';
import { colors } from '../../constants/colors';
import { fontSize } from '../../constants/typography';

const SNAP_INTERVAL = 90;

const VISIBLE_ROWS = 2;

function RideTypeSelector({ distanceKm, durationMin }) {

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
  const lastHapticIndex = useRef(-1);

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

  const lang = i18n.language === 'am' ? 'am' : 'en';


  const realDistKm = routeInfo?.distance_km || distanceKm;
  const realDurMin = routeInfo?.duration_min || durationMin;
  const surge = routeInfo?.surge_multiplier ?? 1;

  const visibleCategories = useMemo(() => [...categories], [categories]);

  const handleSelect = useCallback((id) => selectCategory(id), [selectCategory]);

  const handleScrollSettle = useCallback((offsetY) => {
    const index = Math.max(0, Math.round(offsetY / SNAP_INTERVAL));
    if (index === lastHapticIndex.current) return;
    lastHapticIndex.current = index;
    Haptics.selectionAsync().catch(() => { });
  }, []);

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

      <View style={styles.pickerContainer}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
          alwaysBounceVertical
          bounces
          overScrollMode="always"
          snapToInterval={SNAP_INTERVAL}

          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate="fast"
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => handleScrollSettle(e.nativeEvent.contentOffset.y)}
          onScrollEndDrag={(e) => handleScrollSettle(e.nativeEvent.contentOffset.y)}
        >
          {visibleCategories.map((cat, index) => {
            const estimate = getFareEstimateForCategory(fareEstimates, cat, index);
            return (
              <View key={cat.id.toString()}>
                <View style={styles.cardWrapper}>
                  <RideTypeCard
                    category={cat}
                    selected={selectedCategoryId === cat.id}
                    onPress={() => handleSelect(cat.id)}
                    distanceKm={realDistKm}
                    durationMin={realDurMin}
                    serverFare={estimate?.fare}
                    serverBreakdown={estimate?.breakdown}
                    arrivalEta={estimate?.eta}
                    surge={surge}
                    fareLoading={false}
                    lang={lang}
                  />
                </View>
                {index < visibleCategories.length - 1 && <View style={{ height: 0 }} />}

              </View>
            );
          })}
        </ScrollView>
      </View>






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
  pickerContainer: {
    height: SNAP_INTERVAL * VISIBLE_ROWS,
    overflow: 'hidden',
  },


  cardWrapper: {
    height: SNAP_INTERVAL,
    justifyContent: 'center',
    paddingVertical: 0,
  },



});
