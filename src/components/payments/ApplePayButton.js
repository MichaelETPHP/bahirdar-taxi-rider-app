import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import AppleLogo from '../icons/AppleLogo';

// Apple's "black" button variant (Apple Pay Human Interface Guidelines) —
// solid black, white mark + wordmark, no shadow/elevation (Apple's own
// button is flat), minimum 44pt height honored with margin to spare.
export default function ApplePayButton({ onPress, disabled = false }) {
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Pay with Apple Pay"
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <AppleLogo size={20} color="#FFFFFF" />
      <Text style={styles.text}>Pay</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    backgroundColor: '#1a1a1a',
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 19,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: -1, // optical alignment against the Apple mark's baseline
  },
});
