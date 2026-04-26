import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking, Animated, Easing } from 'react-native';
import { Phone, Star, AlertTriangle } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';

export default function DriverProfileCard({ driver, avatarUrl, rating, onCall, hideCallButton = false }) {
  const driverNameFull = driver?.name || driver?.full_name || driver?.fullName || 'Driver';
  const carMake = driver?.vehicle?.make || '';
  const carModel = driver?.vehicle?.model || driver?.vehicle_model || driver?.vehicle_category || driver?.car_type || '';
  const carColor = driver?.vehicle?.color || '';
  const carPlate = driver?.vehicle?.plateNumber || driver?.plate_number || driver?.plateNumber || driver?.vehicle?.plate_number || '—';
  const phone = driver?.phone || 'No phone number';
  const displayRating = typeof rating === 'number' ? rating.toFixed(1) : '5.0';

  const handleSOS = () => {
    Linking.openURL('tel:9040');
  };

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.card}>
      {/* Top Row: Avatar & Basic Info */}
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>
        
        <View style={styles.metaCol}>
          <Text style={styles.driverName} numberOfLines={1}>{driverNameFull}</Text>
          <View style={styles.ratingPhoneRow}>
            <View style={styles.ratingBadge}>
              <Star size={10} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{displayRating}</Text>
            </View>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.phoneText}>{phone}</Text>
          </View>
        </View>
      </View>

      {/* Middle Row: Vehicle Details */}
      <View style={styles.vehicleBox}>
        <View style={styles.vCol}>
          <Text style={styles.vLabel}>VEHICLE</Text>
          <Text style={styles.vValue} numberOfLines={1}>
            {[carColor, carMake, carModel].filter(Boolean).join(' ') || 'Standard Vehicle'}
          </Text>
        </View>
        <View style={styles.vDivider} />
        <View style={styles.vColRight}>
          <Text style={styles.vLabel}>PLATE NUMBER</Text>
          <View style={styles.plateBadge}>
            <Text style={styles.plateBadgeText}>{carPlate}</Text>
          </View>
        </View>
      </View>

      {/* Bottom Row: Actions */}
      <View style={styles.actionRow}>
        {!hideCallButton && (
          <TouchableOpacity style={styles.callBtn} onPress={onCall} activeOpacity={0.8}>
            <Phone size={18} color={colors.white} />
            <Text style={styles.callBtnText}>Call Driver</Text>
          </TouchableOpacity>
        )}
        <Animated.View style={[hideCallButton && { flex: 1 }, { transform: [{ scale: pulseAnim }] }]}>
          <TouchableOpacity style={[styles.sosBtn, hideCallButton && { paddingVertical: 14, width: '100%' }]} onPress={handleSOS} activeOpacity={0.85}>
            <AlertTriangle size={18} color={colors.white} />
            <Text style={styles.sosBtnText}>SOS 9040</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: 16,
    ...shadow.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: '#F1F5F9',
  },
  avatarFallback: {
    backgroundColor: '#F8FAFC',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 28 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#22C55E',
    borderWidth: 2, borderColor: colors.white,
  },
  metaCol: { flex: 1, justifyContent: 'center' },
  driverName: {
    fontSize: 18, fontWeight: fontWeight.bold, color: '#0F172A', marginBottom: 4,
  },
  ratingPhoneRow: {
    flexDirection: 'row', alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4,
  },
  ratingText: {
    fontSize: 11, fontWeight: fontWeight.bold, color: '#B45309',
  },
  dot: { marginHorizontal: 6, color: '#CBD5E1', fontSize: 12 },
  phoneText: {
    fontSize: 13, color: '#64748B', fontWeight: fontWeight.medium,
  },
  vehicleBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: borderRadius.lg,
    padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9',
  },
  vCol: { flex: 1 },
  vColRight: { flex: 0.7, alignItems: 'flex-end' },
  vDivider: { width: 1, height: '100%', backgroundColor: '#E2E8F0', marginHorizontal: 12 },
  vLabel: {
    fontSize: 10, fontWeight: fontWeight.bold, color: '#94A3B8', letterSpacing: 0.5, marginBottom: 4,
  },
  vValue: {
    fontSize: 14, fontWeight: fontWeight.bold, color: '#334155', textTransform: 'capitalize',
  },
  plateBadge: {
    backgroundColor: '#E2E8F0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4,
  },
  plateBadgeText: {
    fontSize: 13, fontWeight: fontWeight.bold, color: '#0F172A', textTransform: 'uppercase', letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row', gap: 12,
  },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, ...shadow.sm,
  },
  callBtnText: {
    color: colors.white, fontSize: 15, fontWeight: fontWeight.bold,
  },
  sosBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16, 
    paddingVertical: 12,
    borderRadius: 12, 
    borderWidth: 2,
    borderColor: '#FEF2F2',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  sosBtnText: {
    color: colors.white, fontSize: 15, fontWeight: fontWeight.bold, letterSpacing: 0.5,
  },
});
