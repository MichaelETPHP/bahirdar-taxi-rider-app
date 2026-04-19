import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { borderRadius } from '../../constants/layout';
import { fontSize, fontWeight } from '../../constants/typography';

const OTP_LENGTH = 4;

export default function OTPInput({ value = '', onChange, hasError = false }) {
  const inputRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const digits = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);

  React.useEffect(() => {
    if (hasError) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [hasError]);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => {
          const cleaned = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
          if (cleaned.length !== value.length) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
          onChange(cleaned);
        }}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        autoFocus
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
      />
      {digits.map((digit, index) => {
        const isFocused = index === value.length && index < OTP_LENGTH;
        const isFilled = index < value.length;
        return (
          <View
            key={index}
            style={[
              styles.box,
              isFocused && styles.boxFocused,
              isFilled && styles.boxFilled,
              hasError && styles.boxError,
            ]}
            onStartShouldSetResponder={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              inputRef.current?.focus();
              return true;
            }}
          >
            {isFilled && <Animated.Text style={styles.digit}>{digit}</Animated.Text>}
            {isFocused && <View style={styles.cursor} />}
          </View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  box: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  boxFocused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  boxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  boxError: {
    borderColor: colors.error,
  },
  digit: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  cursor: {
    width: 2,
    height: 24,
    backgroundColor: colors.primary,
  },
});
