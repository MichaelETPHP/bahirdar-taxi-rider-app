import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2 } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight, fontFamilySemiBold } from '../../constants/typography';

const DEFAULT_VISIBLE_MS = 2600;

// Generic "confirmation pill" banner — drop this in anywhere a brief
// success/confirmation message should slide down from the top and clear
// itself. WelcomeBanner wraps this with login-specific message logic;
// use SuccessBanner directly for any other one-off confirmation.
export default function SuccessBanner({ visible, message, duration = DEFAULT_VISIBLE_MS, onHide }) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    const hide = Animated.parallel([
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

    const timer = setTimeout(() => hide.start(() => onHide?.()), duration);
    return () => clearTimeout(timer);
  }, [visible, duration, translateY, opacity, onHide]);

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
        <CheckCircle2 size={18} color={colors.success} strokeWidth={2.25} />
        <Text style={styles.text} numberOfLines={1}>{message}</Text>
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
  },
});
