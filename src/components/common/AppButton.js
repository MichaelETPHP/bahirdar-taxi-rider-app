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

import { LinearGradient } from 'expo-linear-gradient';

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
  shimmer = false,
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pressOverlayOpacity = useRef(new Animated.Value(0)).current;
  const shimmerPos = useRef(new Animated.Value(-1.5)).current;

  React.useEffect(() => {
    if (shimmer && !disabled && !loading) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerPos, {
            toValue: 1.5,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [shimmer, disabled, loading]);

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
    variant === 'danger' && styles.danger,
    disabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    variant === 'primary' && styles.labelPrimary,
    variant === 'outline' && styles.labelOutline,
    variant === 'ghost' && styles.labelGhost,
    variant === 'danger' && styles.labelDanger,
    disabled && styles.labelDisabled,
    textStyle,
  ];

  const shimmerTranslateX = shimmerPos.interpolate({
    inputRange: [-1.5, 1.5],
    outputRange: [-300, 300],
  });

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
            (variant === 'primary' || variant === 'danger') ? styles.pressOverlayPrimary : styles.pressOverlaySecondary,
            { opacity: pressOverlayOpacity },
          ]}
        />

        {shimmer && !disabled && !loading && (
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ translateX: shimmerTranslateX }, { skewX: '-25deg' }] },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.25)', 'rgba(255,255,255,0.0)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

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
    borderRadius: 180,
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
  danger: {
    backgroundColor: '#EF4444',
    ...shadow.md,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 5,
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
    borderRadius: 180,
  },
  pressOverlayPrimary: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pressOverlaySecondary: {
    backgroundColor: 'rgba(0,103,79,0.10)',
  },
  label: {
    fontSize: fontSize.xl,
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
  labelDanger: {
    color: colors.white,
  },
  labelDisabled: {
    color: colors.textSecondary,
  },
});
