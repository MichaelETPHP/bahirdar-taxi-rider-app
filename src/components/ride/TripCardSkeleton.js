import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../constants/colors';
import { borderRadius, shadow } from '../../constants/layout';

function TripCardSkeleton({ opacity }) {
  return (
    <Animated.View style={[styles.card, { opacity }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.dateBlock}>
          <View style={styles.dateLine} />
          <View style={styles.timeLine} />
        </View>
        <View style={styles.fareLine} />
      </View>

      {/* Route */}
      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={styles.dotGreen} />
          <View style={styles.routeTextLine} />
        </View>
        <View style={styles.connector} />
        <View style={styles.routeRow}>
          <View style={styles.dotBlack} />
          <View style={[styles.routeTextLine, { width: '65%' }]} />
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.metaLine} />
        <View style={styles.ratingBadge} />
      </View>
    </Animated.View>
  );
}

export default function TripCardSkeletonList({ count = 5 }) {
  const opacity = useRef(new Animated.Value(0.38)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.65, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.38, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <TripCardSkeleton key={i} opacity={opacity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: 16,
    ...shadow.sm,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateBlock: { gap: 6 },
  dateLine: {
    height: 13,
    width: 100,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  timeLine: {
    height: 10,
    width: 68,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  fareLine: {
    height: 18,
    width: 80,
    borderRadius: 6,
    backgroundColor: colors.border,
  },

  route: { gap: 0 },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotBlack: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  connector: {
    width: 2,
    height: 8,
    backgroundColor: colors.border,
    marginLeft: 3,
  },
  routeTextLine: {
    flex: 1,
    height: 11,
    borderRadius: 5,
    backgroundColor: colors.border,
    width: '80%',
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaLine: {
    height: 10,
    width: 110,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  ratingBadge: {
    height: 22,
    width: 58,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
});
