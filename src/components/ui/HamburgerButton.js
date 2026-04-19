import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { shadow } from '../../constants/layout';

export default function HamburgerButton({ onPress, style, isOpen = false }) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress} activeOpacity={0.8}>
      <FontAwesome5 name={isOpen ? 'times' : 'bars'} size={22} color={colors.primary} solid />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.md,
  },
});
