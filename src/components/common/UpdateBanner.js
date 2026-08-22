import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RefreshCw, X } from 'lucide-react-native';
import * as Updates from 'expo-updates';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight, fontFamilySemiBold } from '../../constants/typography';

/**
 * Appears only when expo-updates has already silently downloaded a new
 * OTA bundle in the background (isUpdatePending) — never a routine "check
 * for updates?" prompt, never shown otherwise. Bottom-anchored (the top slot
 * is SessionExpiredBanner's), stays up until tapped or dismissed rather than
 * auto-hiding, since disappearing on its own would cost the rider their only
 * chance to grab it until the next cold start.
 */
export default function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const visible = isUpdatePending && !dismissed;

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

  const applyUpdate = async () => {
    setRestarting(true);
    try {
      await Updates.reloadAsync();
    } catch (_) {
      setRestarting(false);
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.wrap,
        { bottom: insets.bottom + 16, opacity, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        onPress={applyUpdate}
        disabled={restarting}
        style={({ pressed }) => [styles.pill, pressed && { transform: [{ scale: 0.97 }] }]}
      >
        <RefreshCw size={18} color={colors.success} strokeWidth={2.25} />
        <Text style={styles.text} numberOfLines={1}>
          {restarting ? 'Restarting…' : 'App updated ✓ — tap to refresh'}
        </Text>
        {!restarting && (
          <Pressable onPress={dismiss} hitSlop={10} style={styles.dismiss}>
            <X size={15} color="#9CA3AF" strokeWidth={2.25} />
          </Pressable>
        )}
      </Pressable>
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
