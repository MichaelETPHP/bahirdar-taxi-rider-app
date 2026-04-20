import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { shadow } from '../../constants/layout';

export default function LocationPinButton({ onPress, style }) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress} activeOpacity={0.8}>
      <MapPin size={20} color={colors.primary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    backgroundColor: colors.white,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.md,
  },
});
