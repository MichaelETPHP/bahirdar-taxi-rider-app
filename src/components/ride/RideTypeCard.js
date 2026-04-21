import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Car, Van, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';

// Map API icon slugs → Lucide components
const ICON_MAP = {
  'car-sedan':  Car,
  'car':        Car,
  'car-side':   Car,
  'car-suv':    Car,
  'shuttle-van': Van,
  'van':        Van,
  'minivan':    Van,
  'motorcycle': Car,
  'taxi':       Car,
};

// Color palette cycling for categories based on display_order
const PALETTE = [
  { color: '#00674F', bgColor: '#E6F4F1' },
  { color: '#0369A1', bgColor: '#E0F2FE' },
  { color: '#7C3AED', bgColor: '#EDE9FE' },
  { color: '#B45309', bgColor: '#FEF3C7' },
];

function calcFare(category, distanceKm, durationMin) {
  const base    = parseFloat(category.base_fare)       || 0;
  const perKm   = parseFloat(category.per_km_rate)     || 0;
  const perMin  = parseFloat(category.per_minute_rate) || 0;
  const minFare = parseFloat(category.minimum_fare)    || 0;
  const total   = base + distanceKm * perKm + durationMin * perMin;
  return Math.max(minFare, Math.round(total));
}

export default function RideTypeCard({ category, selected, onPress, distanceKm = 5, durationMin = 14, serverFare, fareLoading = false, lang = 'en' }) {
  const palette = PALETTE[(category.display_order - 1) % PALETTE.length] || PALETTE[0];
  const IconComponent = ICON_MAP[category.icon] || Car;
  const label = lang === 'am' && category.name_am ? category.name_am : category.name;
  const desc  = lang === 'am' && category.description_am ? category.description_am : category.description;
  // Prefer real server fare, fall back to client-side estimate
  const fare  = serverFare != null ? parseFloat(serverFare) : calcFare(category, distanceKm, durationMin);

  // ── Mirror Flash (Shimmer) & Wiggle Logic ──
  const shimmerPos = useRef(new Animated.Value(-1.5)).current;
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (selected) {
      // Shimmer loop
      const shimmerLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerPos, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
          Animated.delay(2200),
        ])
      );
      
      // Wiggle loop (Enhanced Intensity)
      const wiggleLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(wiggleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(wiggleAnim, { toValue: -1, duration: 400, useNativeDriver: true }),
          Animated.timing(wiggleAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.delay(1800),
        ])
      );
      
      Animated.parallel([shimmerLoop, wiggleLoop]).start();
      
      return () => {
        shimmerLoop.stop();
        wiggleLoop.stop();
      };
    } else {
      shimmerPos.setValue(-1.5);
      wiggleAnim.setValue(0);
    }
  }, [selected]);

  const shimmerTranslateX = shimmerPos.interpolate({
    inputRange: [-1.5, 1.5],
    outputRange: [-450, 450],
  });

  const wiggleRotate = wiggleAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });

  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={handlePress}
        activeOpacity={1}
      >
        {/* Mirror Flash Shimmer Overlay */}
        {selected && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: shimmerTranslateX }, { skewX: '-25deg' }] },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.0)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}
        {/* Left: icon with wiggle */}
        <Animated.View 
          style={[
            styles.iconCircle, 
            { 
              backgroundColor: selected ? palette.bgColor : '#F3F4F6',
              transform: [{ rotate: wiggleRotate }]
            }
          ]}
        >
          <IconComponent size={22} color={selected ? palette.color : colors.textSecondary} />
        </Animated.View>

        {/* Center: info */}
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

        {/* Right: price + radio */}
        <View style={styles.right}>
          {fareLoading ? (
            <View style={styles.priceLoading}>
              <View style={styles.priceSkeleton} />
            </View>
          ) : (
            <View style={styles.priceWrap}>
              <Text style={styles.price}>{typeof fare === 'number' ? fare.toFixed(2) : fare} ብር</Text>
              {serverFare != null && (
                <View style={styles.liveTag}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
          )}
          <View style={[styles.radio, selected && { borderColor: palette.color, backgroundColor: palette.bgColor }]}>
            {selected && <View style={[styles.radioDot, { backgroundColor: palette.color }]} />}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#000000',
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
    marginTop: 4,
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
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
