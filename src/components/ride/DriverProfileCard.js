import React, { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Animated, Easing } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Phone, Star, AlertTriangle, Globe } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import { formatEthiopianPhone } from '../../utils/phoneFormatter';
import useAuthStore from '../../store/authStore';
import useRideStore from '../../store/rideStore';
import { startOutgoingCall } from '../../services/callEngine';

/** Pulsing ring that invites a tap — same visual language as the live-driver
 * marker's GPS ripple, reused here so "this is live/actionable" reads
 * consistently across the app. */
function CallRingPulse() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.8, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(scale,   { toValue: 1,   duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.callRing, { opacity, transform: [{ scale }] }]}
    />
  );
}

export default function DriverProfileCard({ driver, avatarUrl, rating, onCall, hideCallButton = false, hideSOSButton = false }) {
  const [avatarError, setAvatarError] = React.useState(false);
  React.useEffect(() => { setAvatarError(false); }, [avatarUrl]);
  const driverNameFull = driver?.name || driver?.full_name || driver?.fullName || 'Driver';
  const carMake = driver?.vehicle?.make || '';
  const carModel = driver?.vehicle?.model || driver?.vehicle_model || driver?.vehicle_category || driver?.car_type || '';
  const carColor = driver?.vehicle?.color || '';
  const carPlate = driver?.vehicle?.plateNumber || driver?.plate_number || driver?.plateNumber || driver?.vehicle?.plate_number || '—';
  const phone = formatEthiopianPhone(driver?.phone);
  const displayRating = typeof rating === 'number' ? rating.toFixed(1) : '5.0';
  const speaksEnglish = driver?.speaks_english === true || driver?.speaksEnglish === true;

  // Google-only accounts have no Ethiopian phone number, so a tel: call is
  // impossible for them — same signal the backend uses everywhere else to
  // identify a diaspora rider.
  const riderUser = useAuthStore((s) => s.user);
  const isDiasporaRider = !riderUser?.phone;
  const tripId = useRideStore((s) => s.tripId);
  const showCallBtn = !hideCallButton && !isDiasporaRider;
  const showSOSBtn = !hideSOSButton;

  const handleInAppCall = () => {
    if (!tripId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    startOutgoingCall({ tripId, peerName: driverNameFull, peerRole: 'driver', peerAvatarUrl: avatarUrl });
  };

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

  // Press feedback (scale 0.96) for the three tappable actions — the SOS
  // button composes this with its own ambient pulse (two `scale` transforms
  // on the same node apply multiplicatively, so both read correctly).
  const callPressScale = useRef(new Animated.Value(1)).current;
  const inAppCallPressScale = useRef(new Animated.Value(1)).current;
  const sosPressScale = useRef(new Animated.Value(1)).current;

  const pressIn = (anim) => Animated.spring(anim, { toValue: 0.96, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
  const pressOut = (anim) => Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();

  return (
    <View style={styles.card}>
      {/* Top Row: Avatar & Basic Info */}
      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          {avatarUrl && !avatarError ? (
            <Image
              source={{ uri: avatarUrl }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          <View style={styles.onlineDot} />
        </View>
        
        <View style={styles.metaCol}>
          <View style={styles.nameRatingRow}>
            <Text style={styles.driverName} numberOfLines={1}>{driverNameFull}</Text>
            <View style={styles.ratingBadge}>
              <Star size={10} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.ratingText}>{displayRating}</Text>
            </View>
          </View>

          {speaksEnglish && (
            <View style={styles.langBadge}>
              <Globe size={10} color="#0369A1" />
              <Text style={styles.langBadgeText}>English</Text>
            </View>
          )}

          {/* Actual registered phone number — formatted, never masked, and
              always dials the same number driver.phone holds. Shown for
              every rider, diaspora included — the blue in-app call button
              is an addition alongside it, not a replacement. */}
          <TouchableOpacity
            style={styles.phoneRow}
            onPress={() => phone && phone !== '—' && Linking.openURL(`tel:${driver?.phone}`)}
            activeOpacity={0.7}
            disabled={!phone || phone === '—'}
            accessibilityRole="button"
            accessibilityLabel={`Call ${driverNameFull} at ${phone}`}
          >
            <Phone size={12} color={colors.primary} />
            <Text style={styles.phoneTextClickable}>{phone}</Text>
          </TouchableOpacity>
        </View>

        {isDiasporaRider && (
          <Animated.View style={{ transform: [{ scale: inAppCallPressScale }] }}>
            <TouchableOpacity
              style={styles.inAppCallBtn}
              onPress={handleInAppCall}
              onPressIn={() => pressIn(inAppCallPressScale)}
              onPressOut={() => pressOut(inAppCallPressScale)}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Call driver in-app"
            >
              <CallRingPulse />
              <Phone size={17} color={colors.white} fill={colors.white} />
            </TouchableOpacity>
          </Animated.View>
        )}
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

      {/* Bottom Row: Actions — the tel: call pill is useless for a diaspora
          rider (no SIM to dial from), so it's replaced by the in-app call
          button up in the name row instead of being shown here too. SOS is
          opt-out (hideSOSButton) for screens that place their own SOS
          affordance elsewhere (e.g. DriverMatchedScreen, next to Cancel Trip). */}
      {(showCallBtn || showSOSBtn) && (
        <View style={styles.actionRow}>
          {showCallBtn && (
            <Animated.View style={{ flex: 1, transform: [{ scale: callPressScale }] }}>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={onCall}
                onPressIn={() => pressIn(callPressScale)}
                onPressOut={() => pressOut(callPressScale)}
                activeOpacity={0.85}
              >
                <Phone size={18} color={colors.white} />
                <Text style={styles.callBtnText}>Call Driver</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
          {showSOSBtn && (
            <Animated.View
              style={[
                !showCallBtn && { flex: 1 },
                { transform: [{ scale: pulseAnim }, { scale: sosPressScale }] },
              ]}
            >
              <TouchableOpacity
                style={[styles.sosBtn, !showCallBtn && { paddingVertical: 11, width: '100%' }]}
                onPress={handleSOS}
                onPressIn={() => pressIn(sosPressScale)}
                onPressOut={() => pressOut(sosPressScale)}
                activeOpacity={0.85}
              >
                <AlertTriangle size={15} color={colors.white} />
                <Text style={styles.sosBtnText}>SOS 9040</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      )}
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
  nameRatingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6,
  },
  driverName: {
    fontSize: 18, fontWeight: fontWeight.bold, color: '#0F172A', flexShrink: 1,
  },
  langBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    marginBottom: 9,
  },
  langBadgeText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#0369A1' },
  inAppCallBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryDark,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
    marginLeft: 10,
    ...shadow.sm,
  },
  callRing: {
    position: 'absolute',
    top: 0, left: 0,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.primaryDark,
  },
  ratingBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 4,
  },
  ratingText: {
    fontSize: 11, fontWeight: fontWeight.bold, color: '#B45309',
  },
  phoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
  },
  phoneTextClickable: {
    fontSize: 13.5, color: '#1E293B', fontWeight: fontWeight.bold, letterSpacing: 0.3,
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.26,
    shadowRadius: 6,
    elevation: 5,
  },
  sosBtnText: {
    color: colors.white, fontSize: 13.5, fontWeight: fontWeight.bold, letterSpacing: 0.3,
  },
});
