import React, { useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MapPin, XCircle } from 'lucide-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import useLocationStore from '../../store/locationStore';

function LocationBar({ onToPress, isInServiceArea = true }) {
  const { t } = useTranslation();
  const { destination, clearDestination } = useLocationStore();

  // "Watery swallow" press feedback on the Where-to bar: a liquid squish
  // (stretch wide / compress tall, like a droplet taking an impact) plus a
  // ring that expands from the center and dissolves, clipped to the pill by
  // the parent's overflow:hidden — reads as water absorbing the tap.
  const squishX = useRef(new Animated.Value(1)).current;
  const squishY = useRef(new Animated.Value(1)).current;
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;

  const handleWhereToPressIn = () => {
    Animated.parallel([
      Animated.spring(squishX, { toValue: 1.035, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(squishY, { toValue: 0.965, useNativeDriver: true, speed: 40, bounciness: 0 }),
    ]).start();
    rippleScale.setValue(0);
    rippleOpacity.setValue(0.4);
    Animated.parallel([
      Animated.timing(rippleScale, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rippleOpacity, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const handleWhereToPressOut = () => {
    // Release is snappier than press, per the same "fast where the system
    // responds" asymmetry as the squish itself.
    Animated.spring(squishX, { toValue: 1, useNativeDriver: true, friction: 4, tension: 160 }).start();
    Animated.spring(squishY, { toValue: 1, useNativeDriver: true, friction: 4, tension: 160 }).start();
  };

  return (
    <View
      style={[
        styles.whereToRow,
        isInServiceArea ? styles.whereToRowActive : styles.whereToRowDisabled,
      ]}
    >
      <View style={styles.clip}>
        <Animated.View
          style={[
            styles.ripple,
            {
              opacity: rippleOpacity,
              transform: [
                { scale: rippleScale.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.9] }) },
              ],
            },
          ]}
          pointerEvents="none"
        />
        <Pressable
          style={styles.pressable}
          onPress={isInServiceArea ? onToPress : undefined}
          onPressIn={isInServiceArea ? handleWhereToPressIn : undefined}
          onPressOut={isInServiceArea ? handleWhereToPressOut : undefined}
          disabled={!isInServiceArea}
        >
          <Animated.View
            style={[
              styles.input,
              { transform: [{ scaleX: squishX }, { scaleY: squishY }] },
            ]}
          >
            <MapPin
              size={18}
              color={isInServiceArea ? '#9CA3AF' : 'rgba(239,68,68,0.9)'}
              strokeWidth={2}
            />
            <Text
              style={[
                destination ? styles.whereToText : styles.whereToPlaceholder,
                !isInServiceArea && styles.outOfServiceText
              ]}
              numberOfLines={1}
            >
              {destination?.name || (isInServiceArea ? t('home.whereTo') : 'Out of Service')}
            </Text>
          </Animated.View>
        </Pressable>
      </View>
      {destination ? (
        <TouchableOpacity
          style={styles.inputAction}
          onPress={clearDestination}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <XCircle size={20} color="rgba(239,68,68,0.55)" />
        </TouchableOpacity>
      ) : (
        <View style={styles.inputAction} />
      )}
    </View>
  );
}

export default memo(LocationBar);

const styles = StyleSheet.create({
  whereToRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    borderRadius: 999,
  },
  whereToRowActive: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    shadowColor: '#0B3B2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  whereToRowDisabled: {
    backgroundColor: '#F2F7F5',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  clip: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 999,
  },
  ripple: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  pressable: {
    flex: 1,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    minHeight: 58,
  },
  inputAction: {
    width: 46,
    height: 58,
    justifyContent: 'center',
    alignItems: 'center',
  },
  whereToText: {
    fontSize: fontSize.lg,
    color: 'rgba(13, 27, 30, 0.72)',
    fontWeight: fontWeight.bold,
  },
  whereToPlaceholder: {
    fontSize: fontSize.lg,
    color: '#9CA3AF',
    fontWeight: fontWeight.regular,
  },
  outOfServiceText: {
    color: '#EF4444',
    fontWeight: '600',
  },
});
