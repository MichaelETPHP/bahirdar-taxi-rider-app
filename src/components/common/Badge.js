import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';

const variantMap = {
  verified: { bg: '#E6F4F1', text: colors.primary },
  online: { bg: '#DCFCE7', text: '#16A34A' },
  offline: { bg: '#F3F4F6', text: colors.textSecondary },
  error: { bg: '#FEE2E2', text: colors.error },
};

export default function Badge({ label, variant = 'verified', style }) {
  const v = variantMap[variant] || variantMap.verified;
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
});
