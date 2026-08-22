import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, X } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import useRideStore from '../../store/rideStore';
import useCallStore from '../../store/callStore';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight, fontFamilySemiBold } from '../../constants/typography';

/**
 * Informational only. The instant it's actually safe to restart (no ride, no
 * call in progress), App.js takes over with UpdatingScreen — a mandatory,
 * full-screen countdown that applies the update with no tap needed. This
 * pill exists purely for the window *before* that: it tells the rider an
 * update is downloaded and waiting, without pretending they can do anything
 * about the timing themselves. Dismissible, because seeing it once is enough
 * — the eventual apply isn't affected either way.
 */
export default function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const rideStatus = useRideStore((s) => s.status);
  const callStatus = useCallStore((s) => s.status);
  const isSafeToRestart = rideStatus === 'idle' && callStatus === 'idle';

  const [dismissed, setDismissed] = useState(false);

  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Only ever shown for the unsafe window — once safe, UpdatingScreen covers
  // the whole app anyway, so there's nothing for this pill to add.
  const visible = isUpdatePending && !isSafeToRestart && !dismissed;

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [visible, translateY, opacity]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 80, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => setDismissed(true));
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { bottom: insets.bottom + 16, opacity, transform: [{ translateY }] },
      ]}
    >
      <Animated.View style={styles.pill}>
        <RefreshCw size={18} color={colors.success} strokeWidth={2.25} />
        <Text style={styles.text} numberOfLines={1}>
          App updated ✓ — will apply when your trip ends
        </Text>
        <Pressable onPress={dismiss} hitSlop={10} style={styles.dismiss}>
          <X size={15} color="#9CA3AF" strokeWidth={2.25} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    maxWidth: '100%',
    backgroundColor: colors.white,
    borderRadius: 999,
    paddingVertical: 12,
    paddingLeft: 18,
    paddingRight: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 10,
  },
  text: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  dismiss: {
    marginLeft: 2,
    padding: 3,
  },
});
