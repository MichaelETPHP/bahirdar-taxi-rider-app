import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors } from '../../constants/colors';

const TRANSACTION_ROW_COUNT = 3;

/**
 * Shown only on the wallet screen's first load (before the balance and
 * transaction list have ever resolved) — matches RideTypeCardSkeleton's
 * pulse pattern (single shared opacity loop, not one animation per block)
 * so it stays consistent with the rest of the app and cheap to run.
 */
export default function WalletScreenSkeleton() {
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
    <Animated.View style={{ opacity }}>
      <View style={styles.card} />

      <View style={styles.sectionHeader}>
        <View style={styles.sectionTitle} />
        <View style={styles.sectionLink} />
      </View>

      {Array.from({ length: TRANSACTION_ROW_COUNT }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.rowIcon} />
          <View style={styles.rowText}>
            <View style={styles.rowTitle} />
            <View style={styles.rowDate} />
          </View>
          <View style={styles.rowAmount} />
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 216,
    borderRadius: 20,
    backgroundColor: colors.border,
  },
  sectionHeader: {
    marginTop: 38,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    width: 150,
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  sectionLink: {
    width: 44,
    height: 16,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowTitle: {
    width: '45%',
    height: 13,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  rowDate: {
    width: '30%',
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  rowAmount: {
    width: 64,
    height: 14,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
});
