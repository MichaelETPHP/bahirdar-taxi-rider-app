import React, { memo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Menu, X } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { shadow } from '../../constants/layout';

function HamburgerButton({ onPress, style, isOpen = false }) {
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress} activeOpacity={0.8}>
      {isOpen ? (
        <X size={24} color="#000000" />
      ) : (
        <Menu size={24} color="#000000" />
      )}
    </TouchableOpacity>
  );
}

export default memo(HamburgerButton);

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
