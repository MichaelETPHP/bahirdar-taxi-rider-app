import { memo, useCallback, useEffect, useRef } from 'react';
import { Platform, View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

import RideTypeCard from './RideTypeCard';
import RideTypeCardSkeleton from './RideTypeCardSkeleton';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useLocationStore from '../../store/locationStore';
import { getFareEstimateForCategory } from '../../utils/fareEstimates';
import { colors } from '../../constants/colors';
import { fontSize } from '../../constants/typography';

const AnimatedScroll = Animated.createAnimatedComponent(GHScrollView);

const ITEM_HEIGHT = 92;
const VISIBLE     = 3;
const DRUM_HEIGHT = ITEM_HEIGHT * VISIBLE;

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
  const scrollY         = useRef(new Animated.Value(0)).current;
  const lastSnapIdx     = useRef(0);
  const lastHapticIdx   = useRef(-1);
  const initialized     = useRef(false);

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

  // Initial scroll to selected item once layout is ready
  useEffect(() => {
    if (!categoriesLoaded || !categories.length || initialized.current) return;
    initialized.current = true;
    const idx = Math.max(0, categories.findIndex(c => c.id === selectedCategoryId));
    lastSnapIdx.current   = idx;
    lastHapticIdx.current = idx;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: false });
    }, 80);
  }, [categoriesLoaded, categories, selectedCategoryId]);

  // Scroll to item when selection changes externally (e.g. store reset)
  useEffect(() => {
    if (!categoriesLoaded || !categories.length) return;
    const idx = Math.max(0, categories.findIndex(c => c.id === selectedCategoryId));
    if (idx !== lastSnapIdx.current) {
      lastSnapIdx.current = idx;
      scrollRef.current?.scrollTo({ y: idx * ITEM_HEIGHT, animated: true });
    }
  }, [selectedCategoryId, categories, categoriesLoaded]);

  const handleScrollEnd = useCallback((e) => {
    const y   = e.nativeEvent.contentOffset.y;
    const idx = Math.max(0, Math.min(Math.round(y / ITEM_HEIGHT), categories.length - 1));
    if (idx !== lastSnapIdx.current) {
      lastSnapIdx.current = idx;
      selectCategory(categories[idx].id);
    }
  }, [categories, selectCategory]);

  const scrollHandler = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (e) => {
        const rawIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
        const idx    = Math.max(0, Math.min(rawIdx, categories.length - 1));
        if (idx !== lastHapticIdx.current) {
          lastHapticIdx.current = idx;
          Haptics.selectionAsync();
        }
      },
    },
  );

  // Per-item drum-wheel scale and opacity derived from shared scrollY
  const getItemStyle = useCallback((index) => {
    const c = index * ITEM_HEIGHT;
    return {
      scale: scrollY.interpolate({
        inputRange:  [c - 2*ITEM_HEIGHT, c - ITEM_HEIGHT, c, c + ITEM_HEIGHT, c + 2*ITEM_HEIGHT],
        outputRange: [0.80, 0.90, 1.00, 0.90, 0.80],
        extrapolate: 'clamp',
      }),
      opacity: scrollY.interpolate({
        inputRange:  [c - 2*ITEM_HEIGHT, c - ITEM_HEIGHT, c, c + ITEM_HEIGHT, c + 2*ITEM_HEIGHT],
        outputRange: [0.22, 0.58, 1.00, 0.58, 0.22],
        extrapolate: 'clamp',
      }),
    };
  }, [scrollY]);

  const lang    = i18n.language === 'am' ? 'am' : 'en';
  const distKm  = routeInfo?.distance_km  || distanceKm;
  const durMin  = routeInfo?.duration_min || durationMin;
  const surge   = routeInfo?.surge_multiplier ?? 1;

  if (!categoriesLoaded) {
    return (
      <View style={styles.drum}>
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

      <View style={styles.drum}>
        <View style={styles.centerBand} pointerEvents="none" />
        {/* Top fade overlay */}
        <LinearGradient
          colors={[colors.white, 'transparent']}
          style={[styles.fade, styles.fadeTop]}
          pointerEvents="none"
        />
        {/* Bottom fade overlay */}
        <LinearGradient
          colors={['transparent', colors.white]}
          style={[styles.fade, styles.fadeBottom]}
          pointerEvents="none"
        />
        {/* Selection zone lines */}
        <View style={[styles.zoneLine, { top: ITEM_HEIGHT - 0.5 }]}   pointerEvents="none" />
        <View style={[styles.zoneLine, { top: ITEM_HEIGHT * 1.5 - 0.5 }]} pointerEvents="none" />

        <AnimatedScroll
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          snapToAlignment="start"
          disableIntervalMomentum
          decelerationRate={Platform.OS === 'ios' ? 'fast' : 0.99}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
          nestedScrollEnabled
          directionalLockEnabled
          scrollEventThrottle={16}
          removeClippedSubviews={false}
          onScroll={scrollHandler}
          onMomentumScrollEnd={handleScrollEnd}
          onScrollEndDrag={handleScrollEnd}
        >
          {categories.map((cat, index) => {
            const est            = getFareEstimateForCategory(fareEstimates, cat, index);
            const { scale, opacity } = getItemStyle(index);
            return (
              <Animated.View
                key={cat.id.toString()}
                style={[styles.item, { transform: [{ scale }], opacity }]}
              >
                <RideTypeCard
                  category={cat}
                  selected={selectedCategoryId === cat.id}
                  onPress={() => {
                    const tIdx = categories.findIndex(c => c.id === cat.id);
                    if (tIdx >= 0) {
                      scrollRef.current?.scrollTo({ y: tIdx * ITEM_HEIGHT, animated: true });
                    }
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
              </Animated.View>
            );
          })}
        </AnimatedScroll>
      </View>
    </View>
  );
}

export default memo(RideTypeSelector);

const styles = StyleSheet.create({
  drum: {
    height: DRUM_HEIGHT,
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
    paddingTop:    ITEM_HEIGHT,
    paddingBottom: ITEM_HEIGHT,
  },
  item: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT * 0.9,
    zIndex: 10,
  },
  fadeTop: {
    top: 0,
  },
  fadeBottom: {
    bottom: 0,
  },
  centerBand: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: ITEM_HEIGHT,
    height: ITEM_HEIGHT,
    borderRadius: 16,
    backgroundColor: 'rgba(0,103,79,0.05)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,103,79,0.10)',
    zIndex: 9,
  },
  zoneLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(0,103,79,0.10)',
    zIndex: 11,
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
