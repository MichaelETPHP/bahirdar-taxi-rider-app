import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Animated,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import AppInput from '../../components/common/AppInput';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import { Globe, ChevronDown, Car, CheckCircle, History, Ban, Share2, Users, Music } from 'lucide-react-native';

import {
  formatPhone,
  validateEthiopianPhone,
  hasInvalidEthiopianPhonePrefix,
  toInternationalPhone,
} from '../../utils/formatters';
import useAuthStore from '../../store/authStore';
import TermsConditionsModal from '../../components/auth/TermsConditionsModal';
import { registerRider, sendOtp } from '../../services/authService';
import { changeLanguage } from '../../i18n';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ETHIOPIA_FLAG_URI = 'https://flagcdn.com/w80/et.png';
const RECENT_PHONE_KEY = 'bahirdar_recent_phone';

function toLocalEthiopianDigits(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && (digits.startsWith('09') || digits.startsWith('07'))) return digits;
  // +251 9XXXXXXXX / +251 7XXXXXXXX
  if (digits.length === 12 && digits.startsWith('251') && (digits[3] === '9' || digits[3] === '7')) {
    return `0${digits.slice(3)}`;
  }
  // 00251 9XXXXXXXX / 00251 7XXXXXXXX
  if (digits.length >= 14 && digits.startsWith('00251') && (digits[5] === '9' || digits[5] === '7')) {
    return `0${digits.slice(5, 14)}`;
  }
  // User/OS may return 9XXXXXXXX or 7XXXXXXXX without leading 0
  if (digits.length === 9 && (digits[0] === '9' || digits[0] === '7')) {
    return `0${digits}`;
  }
  return '';
}

export default function PhoneEntryScreen({ navigation }) {
  const { t, i18n } = useTranslation();

  // Add inside your component — first line
  // useEffect(() => {
  //   Alert.alert(
  //     'Debug Info',
  //     `API: ${process.env.EXPO_PUBLIC_API_URL}\n` +
  //     `Socket: ${process.env.EXPO_PUBLIC_SOCKET_URL}\n` +
  //     `ClearText: check android config`
  //   );
  // }, []);

  const insets = useSafeAreaInsets();
  const handleLanguageToggle = () => {
    changeLanguage(i18n.language === 'en' ? 'am' : 'en');
  };
  const [phone, setPhone] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [recentPhone, setRecentPhone] = useState('');
  const [testApiLoading, setTestApiLoading] = useState(false);
  const [testApiSuccess, setTestApiSuccess] = useState(null);
  const phoneInputRef = useRef(null);
  const setStorePhone = useAuthStore((s) => s.setPhone);
  const storedPhone = useAuthStore((s) => s.phone);
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const prevValid = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const fromStorage = await AsyncStorage.getItem(RECENT_PHONE_KEY);
        const fromStore = storedPhone || '';
        const candidate = toLocalEthiopianDigits(fromStore) || toLocalEthiopianDigits(fromStorage);
        if (!candidate) return;
        setRecentPhone(candidate);
        if (!phone) setPhone(formatPhone(candidate));
      } catch {
        // ignore storage issues
      }
    })();
  }, []);

  const handlePhoneChange = (text) => {
    let digits = text.replace(/\D/g, '');
    // Normalize international and SIM/autofill formats to local 09XXXXXXXX / 07XXXXXXXX.
    const normalized = toLocalEthiopianDigits(digits);
    if (normalized) {
      digits = normalized;
    } else {
      // Auto-add leading 0 when user types 9XXXXXXXX or 7XXXXXXXX
      if (digits.length > 0 && digits[0] !== '0' && (digits[0] === '9' || digits[0] === '7')) {
        digits = `0${digits}`;
      }
      digits = digits.slice(0, 10);
    }
    setPhone(formatPhone(digits));
    if (inlineError) setInlineError('');
  };

  const rawDigits = phone.replace(/\D/g, '');
  const isValid = validateEthiopianPhone(rawDigits);
  const hasPrefixError = hasInvalidEthiopianPhonePrefix(rawDigits);

  useEffect(() => {
    if (isValid && !prevValid.current) {
      prevValid.current = true;
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: 1,
          tension: 100,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (!isValid) {
      prevValid.current = false;
    }
  }, [isValid]);

  const handleTestAPI = async () => {
    const testUrl = 'https://taxiapi.zmichael.click/health';
    console.log('[TEST API] Starting request to:', testUrl);
    setTestApiLoading(true);
    setTestApiSuccess(null);
    try {
      console.log('[TEST API] Sending request...');
      const res = await fetch(testUrl);
      console.log('[TEST API] Response status:', res.status);
      const data = await res.json();
      console.log('[TEST API] Response data:', data);
      setTestApiSuccess(true);
      Alert.alert('✅ SUCCESS', JSON.stringify(data, null, 2));
    } catch (err) {
      setTestApiSuccess(false);
      console.error('[TEST API] ERROR:', {
        message: err.message,
        code: err.code,
        name: err.name,
        stack: err.stack,
      });
      Alert.alert('❌ FAILED', `${err.message}\n\nURL: ${testUrl}\n\nCheck console for details`);
    } finally {
      setTestApiLoading(false);
    }
  };

  const handleCheckPress = async () => {
    if (!isValid || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setLoading(true);
    setInlineError('');
    const intlPhone = toInternationalPhone(rawDigits);
    AsyncStorage.setItem(RECENT_PHONE_KEY, intlPhone).catch(() => {});
    try {
      // Try registering — 201 = new user (OTP auto-sent), 409 = existing user
      await registerRider(intlPhone);
      setStorePhone(intlPhone);
      navigation.navigate('OTP', { isNewUser: true });
    } catch (err) {
      if (err.code === 'ACCOUNT_SUSPENDED') {
        setInlineError('Your account is suspended.\nPlease contact support.');
      } else if (err.status === 409 || err.message?.includes('already registered')) {
        // Existing user — send OTP then skip ProfileSetup
        try {
          await sendOtp(intlPhone);
          setStorePhone(intlPhone);
          navigation.navigate('OTP', { isNewUser: false });
        } catch (otpErr) {
          if (otpErr.code === 'ACCOUNT_SUSPENDED') {
            setInlineError('Your account is suspended.\nPlease contact support.');
          } else {
            setInlineError('Could not send OTP.\nPlease try again.');
          }
        }
      } else if (!err.status) {
        setInlineError('No internet connection.\nPlease check your connection.');
      } else {
        setInlineError('Something went wrong.\nPlease try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.gradientContainer}>
        <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="emeraldGradient" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={colors.primaryDark} stopOpacity="1" />
              <Stop offset="0.5" stopColor={colors.primary} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.primaryLight} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#emeraldGradient)" />
        </Svg>
      </View>
      {/* Language selector — top right, always below status bar */}
      <TouchableOpacity
        style={[styles.langBtn, { top: insets.top + 10 }]}
        onPress={handleLanguageToggle}
        activeOpacity={0.8}
      >
        <Globe size={12} color="rgba(255,255,255,0.9)" />
        <Text style={styles.langBtnText}>{i18n.language === 'en' ? 'EN' : 'አማ'}</Text>
        <ChevronDown size={9} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <View style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
          enabled={Platform.OS === 'ios'}
        >
          <View style={styles.column}>
          <ScrollView
            style={styles.scrollFill}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={false}
            showsVerticalScrollIndicator={false}
          >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <View style={styles.scrollInner}>
            <View style={styles.centerWrapper}>
              <View style={styles.container}>
                <View style={styles.content}>
                  <View style={styles.logoWrapper}>
                    <View style={styles.logoCircle}>
                      <Car size={40} color="white" />
                    </View>
                  </View>
                  <Text style={styles.heading}>{t('auth.welcome')}</Text>
                  <Text style={styles.sub}>{t('auth.welcomeSub')}</Text>

                  <View style={styles.loginCard}>
                    <View style={[styles.phoneInput, inputFocused && styles.phoneInputFocused, isValid && styles.phoneInputValid, hasPrefixError && styles.phoneInputError]}>
                      <TouchableOpacity
                        style={styles.countryCodeSection}
                        onPress={() => phoneInputRef.current?.focus()}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{ uri: ETHIOPIA_FLAG_URI }}
                          style={styles.ethiopiaFlagImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.code}>+251</Text>
                      </TouchableOpacity>
                      <View style={styles.divider} />
                      <AppInput
                        placeholder={t('auth.phonePlaceholder')}
                        placeholderTextColor={colors.inputPlaceholder}
                        value={phone}
                        onChangeText={handlePhoneChange}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                        autoCapitalize="none"
                        embedded
                        style={styles.phoneInputInner}
                        inputStyle={[styles.phoneInputText, isValid && styles.phoneInputTextValid]}
                        inputRef={phoneInputRef}
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                      />
                      <TouchableOpacity
                        onPress={handleCheckPress}
                        disabled={!isValid || loading}
                        activeOpacity={0.7}
                        style={styles.checkButtonInline}
                      >
                        <Animated.View style={[styles.checkCircle, { transform: [{ scale: bounceAnim }] }]}>
                          {loading ? (
                            <ActivityIndicator size={22} color={colors.primary} />
                          ) : isValid ? (
                            <CheckCircle size={30} color={colors.primary} />
                          ) : (
                            <View style={styles.emptyCircle} />
                          )}
                        </Animated.View>
                      </TouchableOpacity>
                    </View>
                    {hasPrefixError && (
                      <Text style={styles.phoneError}>{`😠 ${t('auth.phonePrefixError')}`}</Text>
                    )}
                    {!phone && !!recentPhone && (
                      <TouchableOpacity
                        style={styles.recentPhoneChip}
                        onPress={() => setPhone(formatPhone(recentPhone))}
                        activeOpacity={0.8}
                      >
                        <History size={12} color={colors.primary} />
                        <Text style={styles.recentPhoneText}>{`Use recent: ${formatPhone(recentPhone)}`}</Text>
                      </TouchableOpacity>
                    )}
                    {!!inlineError && (
                      <View style={styles.suspendedBanner}>
                        <Ban size={13} color={colors.error} style={{ marginRight: 7 }} />
                        <Text style={styles.suspendedText}>{inlineError}</Text>
                      </View>
                    )}

                    {/* Temporary Test API Button — COMMENTED OUT FOR PRODUCTION */}
                    {/* <TouchableOpacity
                      onPress={handleTestAPI}
                      disabled={testApiLoading}
                      style={[
                        styles.testApiBtn,
                        testApiLoading && styles.testApiBtnLoading,
                        testApiSuccess === true && styles.testApiBtnSuccess,
                        testApiSuccess === false && styles.testApiBtnError,
                      ]}
                      activeOpacity={testApiLoading ? 1 : 0.7}
                    >
                      {testApiLoading ? (
                        <ActivityIndicator size={14} color={colors.white} />
                      ) : testApiSuccess === true ? (
                        <CheckCircle size={14} color={colors.white} />
                      ) : testApiSuccess === false ? (
                        <AlertCircle size={14} color={colors.white} />
                      ) : (
                        <Wifi size={14} color={colors.white} />
                      )}
                      <Text style={styles.testApiBtnText}>
                        {testApiLoading ? 'Testing...' : testApiSuccess === true ? '✓ Connected' : testApiSuccess === false ? '✗ Failed' : 'Test API Connection'}
                      </Text>
                    </TouchableOpacity> */}
                  </View>
                </View>
              </View>
            </View>
            </View>
          </TouchableWithoutFeedback>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <View style={styles.socialIcons}>
              <Users size={18} color={colors.white} />
              <Share2 size={18} color={colors.white} />
              <Music size={18} color={colors.white} />
            </View>
            <TouchableOpacity
              onPress={() => setTermsModalVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.terms}>{t('auth.terms')}</Text>
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      <TermsConditionsModal
        visible={termsModalVisible}
        onClose={() => setTermsModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  gradientContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  flex: { flex: 1, backgroundColor: 'transparent' },
  /** Must use flex (not absoluteFill) so KeyboardAvoidingView can measure layout on iOS. */
  keyboardAvoid: {
    flex: 1,
    width: '100%',
  },
  column: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollFill: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  scrollInner: {
    flexGrow: 1,
    minHeight: 200,
  },
  centerWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 400,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 0,
  },
  logoWrapper: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  heading: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginBottom: 4,
    textAlign: 'center',
  },
  sub: {
    fontSize: fontSize.sm,
    color: colors.white,
    marginBottom: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  loginCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    ...shadow.sm,
  },
  phoneInput: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 54,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 27,
    backgroundColor: colors.white,
    paddingHorizontal: 6,
  },
  phoneInputFocused: {
    borderColor: '#C0C0C0',
    backgroundColor: '#F5F5F5',
  },
  phoneInputValid: {
    borderColor: '#C0C0C0',
    backgroundColor: '#F5F5F5',
  },
  phoneInputError: {
    borderColor: colors.error,
    backgroundColor: colors.white,
  },
  phoneError: {
    fontSize: fontSize.xs,
    color: colors.error,
    marginTop: 8,
    textAlign: 'center',
    alignSelf: 'center',
  },
  countryCodeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 5,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: colors.border,
  },
  ethiopiaFlagImage: {
    width: 18,
    height: 13,
    borderRadius: 2,
  },
  code: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  phoneInputInner: {
    marginBottom: 0,
    flex: 1,
    height: 54,
  },
  phoneInputText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  phoneInputTextValid: {
    color: '#111111',
    fontWeight: fontWeight.semibold,
  },
  checkButtonInline: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircle: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCircle: {
    width: 30,
    height: 30,
  },
  footer: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  socialIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  terms: {
    fontSize: fontSize.xs,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 18,
    textDecorationLine: 'underline',
  },
  suspendedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    width: '100%',
  },
  recentPhoneChip: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
  },
  recentPhoneText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },
  suspendedText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.error,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  langBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  langBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.white,
    letterSpacing: 0.4,
  },
  testApiBtn: {
    marginTop: 15,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  testApiBtnLoading: {
    backgroundColor: '#FFC107',
    opacity: 0.8,
  },
  testApiBtnSuccess: {
    backgroundColor: '#4CAF50',
  },
  testApiBtnError: {
    backgroundColor: '#F44336',
  },
  testApiBtnText: {
    color: colors.white,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.sm,
  },
});
