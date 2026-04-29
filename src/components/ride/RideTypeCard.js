import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Car, Van, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';

const ICON_MAP = {
  'car-sedan':   Car,
  'car':         Car,
  'car-side':    Car,
  'car-suv':     Car,
  'shuttle-van': Van,
  'van':         Van,
  'minivan':     Van,
  'motorcycle':  Car,
  'taxi':        Car,
};

const PALETTE = [
  { color: '#00674F', bgColor: '#E6F4F1' },
  { color: '#0369A1', bgColor: '#E0F2FE' },
  { color: '#7C3AED', bgColor: '#EDE9FE' },
  { color: '#B45309', bgColor: '#FEF3C7' },
];

const CLASSIC_IMAGE = { uri: 'https://www.pngplay.com/wp-content/uploads/8/Uber-PNG-Photos.png' };

const SHIMMER_TRANSLATE = { inputRange: [-1.5, 1.5], outputRange: [-450, 450] };
const WIGGLE_ROTATE     = { inputRange: [-1, 1],     outputRange: ['-15deg', '15deg'] };

const SHIMMER_GRADIENT_COLORS = [
  'transparent',
  'rgba(255,255,255,0.0)',
  'rgba(255,255,255,0.3)',
  'rgba(255,255,255,0.0)',
  'transparent',
];

const isClassicLike = (name) => {
  const n = name?.toLowerCase();
  return !!n && (n.includes('classic') || n.includes('standard'));
};

const calcFare = (category, distanceKm, durationMin) => {
  const base    = parseFloat(category.base_fare)       || 0;
  const perKm   = parseFloat(category.per_km_rate)     || 0;
  const perMin  = parseFloat(category.per_minute_rate) || 0;
  const minFare = parseFloat(category.minimum_fare)    || 0;
  const total   = base + distanceKm * perKm + durationMin * perMin;
  return Math.max(minFare, Math.round(total));
};

function RideTypeCard({
  category,
  selected,
  onPress,
  distanceKm = 5,
  durationMin = 14,
  serverFare,
  fareLoading = false,
  lang = 'en',
}) {


  const palette = useMemo(
    () => PALETTE[(category.display_order - 1) % PALETTE.length] || PALETTE[0],
    [category.display_order],
  );
  const IconComponent = ICON_MAP[category.icon] || Car;
  const useImageIcon  = isClassicLike(category.name);
  const label = lang === 'am' && category.name_am        ? category.name_am        : category.name;
  const desc  = lang === 'am' && category.description_am ? category.description_am : category.description;
  const fare  = serverFare != null ? parseFloat(serverFare) : calcFare(category, distanceKm, durationMin);

  const shimmerPos = useRef(new Animated.Value(-1.5)).current;
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!selected) {
      shimmerPos.setValue(-1.5);
      wiggleAnim.setValue(0);
      return undefined;
    }
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerPos, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
        Animated.delay(2200),
      ]),
    );
    const wiggleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, { toValue: 1,  duration: 200, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: -1, duration: 400, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: 0,  duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
      ]),
    );
    Animated.parallel([shimmerLoop, wiggleLoop]).start();
    return () => {
      shimmerLoop.stop();
      wiggleLoop.stop();
    };
  }, [selected, shimmerPos, wiggleAnim]);

  const shimmerTranslateX = shimmerPos.interpolate(SHIMMER_TRANSLATE);
  const wiggleRotate      = wiggleAnim.interpolate(WIGGLE_ROTATE);

  const handlePress = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress]);



  const iconCircleStyle = useMemo(() => ([
    styles.iconCircle,
    {
      backgroundColor: useImageIcon ? 'transparent' : (selected ? palette.bgColor : '#F3F4F6'),
      transform: [{ rotate: wiggleRotate }],
    },
  ]), [useImageIcon, selected, palette.bgColor, wiggleRotate]);

  const shimmerStyle = useMemo(() => ([
    StyleSheet.absoluteFill,
    { transform: [{ translateX: shimmerTranslateX }, { skewX: '-25deg' }] },
  ]), [shimmerTranslateX]);

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {selected && (
          <Animated.View pointerEvents="none" style={shimmerStyle}>
            <LinearGradient
              colors={SHIMMER_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        <Animated.View style={iconCircleStyle}>
          {useImageIcon ? (
            <Image source={CLASSIC_IMAGE} style={styles.categoryImage} contentFit="contain" />
          ) : (
            <IconComponent size={22} color={selected ? palette.color : colors.textSecondary} />
          )}
        </Animated.View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.label}>{label}</Text>
            {selected && (
              <View style={[styles.badge, { backgroundColor: palette.color }]}>
                <Text style={styles.badgeText}>Selected</Text>
              </View>
            )}
          </View>
          <Text style={styles.description} numberOfLines={1}>{desc}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Users size={10} color={colors.textSecondary} />
              <Text style={styles.meta}>{category.capacity} seats</Text>
            </View>
            <View style={styles.metaItem}>
              <Car size={10} color={colors.textSecondary} />
              <Text style={styles.meta}>{category.per_km_rate} ብር/km</Text>
            </View>
          </View>
        </View>

        <View style={styles.right}>
          {fareLoading ? (
            <View style={styles.priceLoading}>
              <View style={styles.priceSkeleton} />
            </View>
          ) : (
            <View style={styles.priceWrap}>
              <Text style={styles.price}>{typeof fare === 'number' ? Math.round(fare) : fare} ብር</Text>
              {serverFare != null && (
                <View style={styles.liveTag}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={[styles.radio, selected && { borderColor: palette.color, backgroundColor: palette.bgColor }]}>
          {selected && <View style={[styles.radioDot, { backgroundColor: palette.color }]} />}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// `onPress` is intentionally excluded: the parent re-creates an arrow closure
// on every render, but it always resolves to selectCategory(category.id) — a
// stable action. Comparing it would force every card to re-render on every
// scroll tick of the parent, defeating windowing.
function areEqual(prev, next) {
  return (
    prev.selected    === next.selected    &&
    prev.serverFare  === next.serverFare  &&
    prev.fareLoading === next.fareLoading &&
    prev.distanceKm  === next.distanceKm  &&
    prev.durationMin === next.durationMin &&
    prev.lang        === next.lang        &&
    prev.category    === next.category
  );
}

export default memo(RideTypeCard, areEqual);

const styles = StyleSheet.create({
  wrapper: {
    marginRight: 12,
  },
  card: {
    width: 300,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 12,
    ...shadow.sm,
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
  },
  categoryImage: {
    width: 130,
    height: 70,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.2,
  },
  badge: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: colors.white,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 0,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  priceWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  price: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    textAlign: 'right',
  },
  liveTag: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liveText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
  priceLoading: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 28,
  },
  priceSkeleton: {
    width: 64,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  radio: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
