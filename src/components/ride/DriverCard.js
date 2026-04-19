import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FontAwesome5 } from '@expo/vector-icons';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';

const DEFAULT_DRIVER_PROFILE = require('../../../assets/Driver-profile.png');

export default function DriverCard({ driver, compact = false, style }) {
  const { t } = useTranslation();

  if (!driver) return null;

  const handleCall = () => {
    Alert.alert(t('common.comingSoon'), 'Call feature coming soon!');
  };

  const handleChat = () => {
    Alert.alert(t('common.comingSoon'), 'Chat feature coming soon!');
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact, style]}>
      <Avatar uri={driver.avatar || DEFAULT_DRIVER_PROFILE} initials={driver.initials} size={compact ? 44 : 56} />

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{driver.name}</Text>
          {driver.isVerified && (
            <Badge label="Verified" variant="verified" style={styles.badge} />
          )}
        </View>
        <View style={styles.metaRow}>
          <FontAwesome5 name="star" size={12} color={colors.primary} solid />
          <Text style={styles.rating}>{driver.rating}</Text>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.trips}>{driver.totalTrips} trips</Text>
        </View>
        <Text style={styles.car} numberOfLines={1}>
          {driver.carModel} · {driver.carColor} · {driver.licensePlate}
        </Text>
      </View>

      {!compact && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
            <FontAwesome5 name="phone" size={18} color={colors.white} solid />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handleChat}>
            <FontAwesome5 name="comment" size={18} color={colors.primary} solid />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardCompact: {},
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  badge: {},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  rating: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  dot: {
    color: colors.textSecondary,
  },
  trips: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  car: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.sm,
  },
  actionBtnOutline: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
});
