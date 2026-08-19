import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LogOut } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight, fontFamilySemiBold } from '../../constants/typography';
import useSessionBannerStore from '../../store/sessionBannerStore';

const VISIBLE_MS = 3200;

// Same slide-down pill as SuccessBanner (spring in, ease-in-cubic out) — kept
// visually consistent with it on purpose, just swapped to a warning tint.
// Replaces the old native Alert.alert('Session Expired', ...): that was a
// hard blocking modal that could pop up over the splash/login screen before
// the rider had done anything, which read as broken rather than informative.
// This is purely informational now — logoutAlert.js clears the session and
// the navigator swaps to Login underneath on its own; there's nothing left
// to confirm, so nothing should block on a tap.
export default function SessionExpiredBanner() {
  const insets = useSafeAreaInsets();
  const { visible, message, hide } = useSessionBannerStore();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    const dismiss = Animated.parallel([
      Animated.timing(translateY, {
        toValue: -80,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => dismiss.start(() => hide()), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible, translateY, opacity, hide]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          top: insets.top + 10,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.pill}>
        <LogOut size={18} color={colors.warning} strokeWidth={2.25} />
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
      </View>
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
    paddingHorizontal: 18,
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
});
