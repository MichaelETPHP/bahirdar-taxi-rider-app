import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { buttonHeight, borderRadius, shadow } from '../../constants/layout';
import { fontSize, fontWeight } from '../../constants/typography';

const pressSpringIn = { stiffness: 380, damping: 32, mass: 0.6, useNativeDriver: true };
const pressSpringOut = { stiffness: 260, damping: 26, mass: 0.55, useNativeDriver: true };

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressOverlayOpacity = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.985,
      ...pressSpringIn,
    }).start();
    Animated.timing(pressOverlayOpacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      ...pressSpringOut,
    }).start();
    Animated.timing(pressOverlayOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = async () => {
    if (disabled || loading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  const buttonStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'outline' && styles.outline,
    variant === 'ghost' && styles.ghost,
    disabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    variant === 'primary' && styles.labelPrimary,
    variant === 'outline' && styles.labelOutline,
    variant === 'ghost' && styles.labelGhost,
    disabled && styles.labelDisabled,
    textStyle,
  ];

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={buttonStyle}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled || loading}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pressOverlay,
            variant === 'primary' ? styles.pressOverlayPrimary : styles.pressOverlaySecondary,
            { opacity: pressOverlayOpacity },
          ]}
        />
        {loading ? (
          <ActivityIndicator
            color={variant === 'primary' ? colors.white : colors.primary}
            size="small"
          />
        ) : (
          <View style={styles.content}>
            {icon && <View style={styles.iconLeft}>{icon}</View>}
            <Text style={labelStyle}>{title}</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: buttonHeight,
    borderRadius: borderRadius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  primary: {
    backgroundColor: colors.primary,
    ...shadow.md,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  disabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconLeft: {
    marginRight: 8,
  },
  pressOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: borderRadius.pill,
  },
  pressOverlayPrimary: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pressOverlaySecondary: {
    backgroundColor: 'rgba(0,103,79,0.10)',
  },
  label: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.2,
  },
  labelPrimary: {
    color: colors.white,
  },
  labelOutline: {
    color: colors.primary,
  },
  labelGhost: {
    color: colors.primary,
  },
  labelDisabled: {
    color: colors.textSecondary,
  },
});
