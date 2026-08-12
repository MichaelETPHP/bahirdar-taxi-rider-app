import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import GoogleLogo from '../icons/GoogleLogo';

// Google Pay's "white" button variant (Google Pay Brand Guidelines) — white
// fill, full-colour G mark (the "black" variant uses a monochrome G, which
// only applies on dark fills), thin neutral border per spec, no shadow.
export default function GooglePayButton({ onPress, disabled = false }) {
  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Pay with Google Pay"
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <GoogleLogo size={20} />
      <Text style={styles.text}>Pay</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#747775',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: {
    backgroundColor: '#F6F6F6',
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontSize: 19,
    fontWeight: '600',
    color: '#1F1F1F',
    marginTop: -1,
  },
});
