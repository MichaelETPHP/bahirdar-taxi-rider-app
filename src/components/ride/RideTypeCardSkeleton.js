import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../constants/colors';
import { borderRadius, shadow } from '../../constants/layout';

/** Matches RideTypeCard layout — whole card pulses together (one loading pass). */
export default function RideTypeCardSkeleton() {
  const opacity = useRef(new Animated.Value(0.38)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.62, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.38, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <View style={styles.wrapper}>
      <Animated.View style={[styles.card, { opacity }]}>
        <View style={styles.iconSkeleton} />
        <View style={styles.info}>
          <View style={styles.titleLine} />
          <View style={styles.descLine} />
          <View style={styles.metaRow}>
            <View style={styles.metaPill} />
            <View style={styles.metaPill} />
          </View>
        </View>
        <View style={styles.right}>
          <View style={styles.priceSkeleton} />
          <View style={styles.radioSkeleton} />
        </View>
      </Animated.View>
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 10,
    ...shadow.sm,
  },
  iconSkeleton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.border,
  },
  info: {
    flex: 1,
    gap: 5,
  },
  titleLine: {
    height: 14,
    width: '55%',
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  descLine: {
    height: 10,
    width: '78%',
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  metaPill: {
    height: 10,
    width: 64,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  priceSkeleton: {
    width: 68,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  radioSkeleton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
});
