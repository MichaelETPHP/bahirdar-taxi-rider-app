import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

export default function FareSummary({ fare, distance, duration, rideType, style }) {
  const { t } = useTranslation();

  const rideLabels = { economy: t('home.economy'), comfort: t('home.comfort'), business: t('home.business') };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.row}>
        <Text style={styles.label}>{rideLabels[rideType] || rideType}</Text>
        <Text style={styles.fare}>
          {fare ? `ETB ${fare.min}–${fare.max}` : '–'}
        </Text>
      </View>
      {(distance || duration) && (
        <View style={styles.row}>
          <Text style={styles.meta}>
            {distance ? `${distance.toFixed(1)} km` : ''}
            {distance && duration ? ' · ' : ''}
            {duration ? `~${duration} min` : ''}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  fare: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  meta: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
