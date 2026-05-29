import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Keyboard,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';

// ── Google Play / App Store test account ─────────────────────────────────────
// Phone: 0919333399  |  OTP: 1234
const TEST_ACCOUNT_PHONES = ['0919333399', '+251919333399'];
const isTestAccount = (phone) => TEST_ACCOUNT_PHONES.some(t => (phone || '').replace(/\s/g, '') === t);
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import OTPInput from '../../components/common/OTPInput';
import AppButton from '../../components/common/AppButton';
import { X, MessageCircle } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { formatPhoneDisplay } from '../../utils/formatters';
import useOTPTimer from '../../hooks/useOTPTimer';
import useAuthStore from '../../store/authStore';

const AUTH_DEVICE_ID =
  Constants?.installationId ||
  Constants?.deviceId ||
  `auth-device-${Platform.OS}`;
import { verifyOtp, sendOtp } from '../../services/authService';

const OTP_LENGTH = 4;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OTPScreen({ navigation, route }) {
  const isNewUser = route.params?.isNewUser ?? true;
  const { t } = useTranslation();
  const phone = useAuthStore((s) => s.phone);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const loadProfile = useAuthStore((s) => s.loadProfile);

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const { formattedTime, canResend, resend: resetTimer } = useOTPTimer();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const slideUpAndNavigate = (action) => {
    Keyboard.dismiss();
    Animated.timing(slideAnim, {
      toValue: -SCREEN_HEIGHT,
      duration: 380,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => action());
  };

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleVerify = async (code = otp) => {
    if (code.length < OTP_LENGTH || loading) return;
    setLoading(true);
    try {
      const res = await verifyOtp(phone, code, {
        device_id: AUTH_DEVICE_ID,
        platform: Platform.OS,
      });
      const { accessToken, refreshToken, user, expiresIn } = res.data;

      const mappedUser = {
        ...user,
        avatarUrl: user.avatar_url || user.avatarUrl,
        fullName: user.full_name || user.fullName,
        isVerified: true,
      };

      await setTokens(accessToken, refreshToken, expiresIn || 3600, mappedUser);
      await loadProfile();

      const displayName = user?.fullName || user?.full_name;
      if (!displayName) {
        slideUpAndNavigate(() => navigation.replace('ProfileSetup'));
      } else {
        slideUpAndNavigate(() => setAuthenticated(true, false));
      }
    } catch (err) {
      setHasError(true);
      setOtp('');
      // Remount OTPInput so the native keyboard buffer is fully cleared.
      // Without this, Android sends the old stale digits on the next attempt.
      setInputKey((k) => k + 1);
      if (err?.status === 429) {
        Alert.alert('Too many attempts', 'Please wait before trying again.');
      } else if (err?.status === 423) {
        Alert.alert('Account locked', 'Too many failed attempts. Please request a new code.');
      } else if (err?.status === 410) {
        Alert.alert('Code expired', 'Your verification code has expired. Please request a new one.');
      } else {
        Alert.alert('Verification Failed', err?.message || 'Invalid code. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOTPChange = (code) => {
    setOtp(code);
    setHasError(false);
    if (code.length === OTP_LENGTH) handleVerify(code);
  };

  const handleResend = async () => {
    if (!canResend || resending) return;
    setResending(true);
    try {
      await sendOtp(phone);
      resetTimer();
      setOtp('');
      setHasError(false);
    } catch (err) {
      if (err?.status === 429) {
        Alert.alert('Please wait', 'You can only request a new code once per minute.');
      } else {
        Alert.alert('Error', err?.message || 'Could not resend code. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <Animated.View style={[styles.animWrapper, { transform: [{ translateY: slideAnim }] }]}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          enabled={Platform.OS === 'ios'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} delayPressIn={0}>
            <View style={[styles.flex, styles.scroll]}>
              <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
                <X size={24} color={colors.textPrimary} />
              </TouchableOpacity>

              <View style={styles.content}>
                <View style={styles.iconCircle}>
                  <MessageCircle size={32} color={colors.primary} />
                </View>

                <Text style={styles.heading}>{t('auth.verifyTitle')}</Text>
                <Text style={styles.sub}>
                  {t('auth.verifySubtitle')}{' '}
                  <Text style={styles.phoneBold}>{formatPhoneDisplay(phone)}</Text>
                </Text>

                {/* Test account hint — visible only for the Play Store review number */}
                {isTestAccount(phone) && (
                  <View style={styles.testBanner}>
                    <Text style={styles.testBannerText}>
                      🧪 Test account — enter{' '}
                      <Text style={styles.testBannerCode}>1234</Text>
                    </Text>
                  </View>
                )}

                <View style={styles.otpWrapper}>
                  <OTPInput key={inputKey} value={otp} onChange={handleOTPChange} hasError={hasError} />
                </View>

                {hasError && (
                  <Text style={styles.errorText}>{t('auth.wrongCode')}</Text>
                )}

                <AppButton
                  title={t('auth.verifyTitle')}
                  onPress={() => handleVerify()}
                  loading={loading}
                  disabled={otp.length < OTP_LENGTH || loading}
                  style={styles.button}
                />

                <View style={styles.resendRow}>
                  <Text style={styles.resendLabel}>{t('auth.didntReceive')} </Text>
                  {canResend ? (
                    <TouchableOpacity
                      onPress={handleResend}
                      disabled={resending}
                      activeOpacity={0.6}
                    >
                      <Text style={[styles.resendLink, resending && styles.resendLinkDisabled]}>
                        {resending ? 'Sending...' : t('auth.resendNow')}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={styles.resendTimer}>
                      {t('auth.resendIn')} {formattedTime}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animWrapper: { flex: 1, backgroundColor: colors.white },
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: 12,
    marginLeft: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: { paddingHorizontal: 24, paddingTop: 24 },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  sub: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  phoneBold: { fontWeight: fontWeight.bold, color: colors.textPrimary },
  testBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFD54F',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 16,
  },
  testBannerText: {
    fontSize: 13,
    color: '#795548',
    fontWeight: '500',
  },
  testBannerCode: {
    fontWeight: '800',
    color: '#E65100',
    letterSpacing: 2,
  },
  otpWrapper: { marginBottom: 12 },
  errorText: { fontSize: fontSize.sm, color: colors.error, marginBottom: 12 },
  button: { marginTop: 8, marginBottom: 20 },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  resendTimer: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.medium },
  resendLink: { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
  resendLinkDisabled: { opacity: 0.45 },
});
