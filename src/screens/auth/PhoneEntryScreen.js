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
  Linking,
  InputAccessoryView,
} from 'react-native';
import { secureStorage } from '../../lib/secureStorage';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import PhoneInput, { isValidNumber as isValidPhoneNumberForCountry } from 'react-native-phone-number-input';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import { Globe, ChevronDown, Car, CarTaxiFront, CheckCircle, History, Ban, Share2, Users, Music, Key } from 'lucide-react-native';
import { FacebookIcon, InstagramIcon, TiktokIcon, TelegramIcon } from '../../components/common/BrandIcons';
import GoogleLogo from '../../components/icons/GoogleLogo';
import AppleLogo from '../../components/icons/AppleLogo';
import { isGoogleSignInConfigured, signInWithGoogle, googleSignInErrorMessage } from '../../lib/googleAuth';
import { isAppleSignInAvailable, signInWithApple, appleSignInErrorMessage } from '../../lib/appleAuth';

import {
  formatPhone,
  validateEthiopianPhone,
  hasInvalidEthiopianPhonePrefix,
  toInternationalPhone,
} from '../../utils/formatters';
import useAuthStore from '../../store/authStore';
import TermsConditionsModal from '../../components/auth/TermsConditionsModal';
import SendCodeSheet from '../../components/auth/SendCodeSheet';
import { registerRider, sendOtp, verifyOtp, checkPhoneExistence, googleLogin, appleLogin } from '../../services/authService';
import Constants from 'expo-constants';
import { changeLanguage } from '../../i18n';
import AppButton from '../../components/common/AppButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
const RECENT_PHONE_KEY = 'bahirdar_recent_phone';
const AUTH_DEVICE_ID =
  Constants?.installationId ||
  Constants?.deviceId ||
  `auth-device-${Platform.OS}`;
const PHONE_INPUT_HEIGHT = 60;
const PHONE_INPUT_RADIUS = 18;
const MAX_E164_DIGITS = 15;

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

function formatRoleConflictMessage(existingRole, requestedRole = 'rider') {
  const role = existingRole === 'driver' || existingRole === 'rider' ? existingRole : requestedRole;
  if (role === requestedRole) {
    return `You are already registered as a ${role}.\nPlease login instead.`;
  }
  return `This phone number is already registered as a ${role}.\nPlease login as a ${role} instead.`;
}

function extractExistingRole(error) {
  const details = error?.response?.data?.error?.details;
  if (Array.isArray(details)) {
    const match = details.find((item) => item?.existing_role);
    if (match?.existing_role) return String(match.existing_role);
  }
  const response = error?.response?.data?.error || error?.response?.data || {};
  if (response.registered_role) return String(response.registered_role);
  if (response.existing_role) return String(response.existing_role);
  const message = String(response.message || error?.message || '').toLowerCase();
  if (message.includes('registered as a driver')) return 'driver';
  if (message.includes('registered as a rider')) return 'rider';
  return null;
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
  const [selectedCountry, setSelectedCountry] = useState('ET');
  const [selectedCallingCode, setSelectedCallingCode] = useState('251');
  const [intlFormattedPhone, setIntlFormattedPhone] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [sendCodeSheetVisible, setSendCodeSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [recentPhone, setRecentPhone] = useState('');
  const [testApiLoading, setTestApiLoading] = useState(false);
  const [testApiSuccess, setTestApiSuccess] = useState(null);
  const phoneInputRef = useRef(null);
  const setStorePhone = useAuthStore((s) => s.setPhone);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const storedPhone = useAuthStore((s) => s.phone);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  // True the instant any one of the three sign-in methods is mid-flight —
  // used to disable the OTHER two while one is running, so a customer can
  // never fire two different login attempts at once (e.g. tap Google, then
  // tap Apple before the first one resolves).
  const isAuthBusy = loading || googleLoading || appleLoading;
  const bounceAnim = useRef(new Animated.Value(1)).current;
  const prevValid = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const fromStorage = await secureStorage.getItem(RECENT_PHONE_KEY);
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

  // Android has no Apple Sign-In at all — isAppleSignInAvailable() resolves
  // false there, so the button hides itself instead of erroring on tap.
  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const handleFocus = () => {
    setInputFocused(true);
  };

  const handleBlur = () => {
    setInputFocused(false);
    setPhoneTouched(true);
  };

  const isEthiopia = selectedCountry === 'ET';

  const handlePhoneChange = (text) => {
    // International entries use digits only and are capped to the E.164 limit.
    if (!isEthiopia) {
      const original = String(text || '').trim();
      let digits = original.replace(/\D/g, '');

      if (original.startsWith('+') && selectedCallingCode && digits.startsWith(selectedCallingCode)) {
        digits = digits.slice(selectedCallingCode.length);
      } else if (selectedCallingCode && digits.startsWith(`00${selectedCallingCode}`)) {
        digits = digits.slice(selectedCallingCode.length + 2);
      }

      const trunkPrefixAllowance = digits.startsWith('0') ? 1 : 0;
      const maxNationalDigits = Math.max(
        4,
        MAX_E164_DIGITS - selectedCallingCode.length + trunkPrefixAllowance
      );
      const limitedDigits = digits.slice(0, maxNationalDigits);

      setPhone(limitedDigits);
      setIntlFormattedPhone(
        limitedDigits
          ? `+${selectedCallingCode}${limitedDigits.replace(/^0/, '')}`
          : ''
      );
      if (inlineError) setInlineError('');
      if (supportPhone) setSupportPhone('');
      return;
    }
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
    setIntlFormattedPhone(digits ? toInternationalPhone(digits) : '');
    if (inlineError) setInlineError('');
    if (supportPhone) setSupportPhone('');
  };

  // Country picker changed — start the field fresh rather than reinterpreting
  // a half-typed number under a different country's rules.
  const handleCountryChange = (country) => {
    setSelectedCountry(country.cca2);
    setSelectedCallingCode(String(country.callingCode?.[0] || ''));
    setPhone('');
    setIntlFormattedPhone('');
    setInlineError('');
    setPhoneTouched(false);
  };

  const rawDigits = phone.replace(/\D/g, '');
  // Ethiopia keeps its mobile-prefix rules. Every other selection is checked
  // against that country's actual numbering metadata.
  const isValid = isEthiopia
    ? validateEthiopianPhone(rawDigits)
    : isValidPhoneNumberForCountry(rawDigits, selectedCountry);
  const hasPrefixError = isEthiopia && hasInvalidEthiopianPhonePrefix(rawDigits);
  const hasPhoneFormatError =
    phoneTouched && !inputFocused && rawDigits.length > 0 && !isValid && !hasPrefixError;

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

  // Opens the "Send to..." sheet — SMS / WhatsApp / Edit. Replaces the old
  // behavior of sending the OTP straight from the Sign in tap. Non-Ethiopia
  // numbers still open the sheet — they just only see the WhatsApp option,
  // since the backend can't SMS-verify them yet.
  const openSendCodeSheet = () => {
    if (!isValid || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setSendCodeSheetVisible(true);
  };

  const handleWhatsAppCode = () => {
    // TODO: WhatsApp OTP (needs WhatsApp Business API) — not wired yet
    console.log('WhatsApp code pressed');
    setSendCodeSheetVisible(false);
    Alert.alert(t('common.comingSoon'));
  };

  const handleEditPhone = () => {
    setSendCodeSheetVisible(false);
    setTimeout(() => phoneInputRef.current?.focus(), 300);
  };

  // Full login on its own — no phone/OTP step follows. The idToken is
  // verified server-side (never trust the client's claim of who signed in);
  // the backend finds-or-creates the rider by google_id and returns the same
  // token/user shape phone OTP verification does.
  const handleGoogleLogin = async () => {
    if (googleLoading || loading) return;
    if (!isGoogleSignInConfigured()) {
      Alert.alert(t('common.comingSoon'));
      return;
    }
    setGoogleLoading(true);
    try {
      const profile = await signInWithGoogle();
      if (!profile) return; // user backed out of the picker

      const res = await googleLogin(profile.idToken, {
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

      if (user.phone) setStorePhone(user.phone);
      await setTokens(accessToken, refreshToken, expiresIn || 3600, mappedUser);
      await loadProfile();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const displayName = user?.fullName || user?.full_name;
      if (!displayName) {
        navigation.replace('ProfileSetup');
      } else {
        setAuthenticated(true, false);
      }
    } catch (err) {
      Alert.alert('Google Sign-In', googleSignInErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  };

  // Same shape as handleGoogleLogin — the identityToken is verified
  // server-side, the backend finds-or-creates the rider by apple_id and
  // returns the same token/user shape phone OTP verification does.
  const handleAppleLogin = async () => {
    if (appleLoading || loading) return;
    setAppleLoading(true);
    try {
      const credential = await signInWithApple();
      if (!credential) return; // user cancelled the system sheet

      const res = await appleLogin(credential.identityToken, credential.fullName, {
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

      if (user.phone) setStorePhone(user.phone);
      await setTokens(accessToken, refreshToken, expiresIn || 3600, mappedUser);
      await loadProfile();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const displayName = user?.fullName || user?.full_name;
      if (!displayName) {
        navigation.replace('ProfileSetup');
      } else {
        setAuthenticated(true, false);
      }
    } catch (err) {
      Alert.alert('Apple Sign-In', appleSignInErrorMessage(err));
    } finally {
      setAppleLoading(false);
    }
  };

  // Unchanged from the old "Sign in" flow — only its entry point moved
  // behind the sheet's "Send code by SMS" option. SMS is Ethiopia-only
  // (backend can't normalise/send to other countries yet); the sheet hides
  // this option for other countries, but guard here too since it calls real
  // backend endpoints.
  const handleSendSmsCode = async () => {
    if (!isValid || !isEthiopia || loading) return;
    setSendCodeSheetVisible(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setLoading(true);
    setInlineError('');
    const intlPhone = toInternationalPhone(rawDigits);
    secureStorage.setItem(RECENT_PHONE_KEY, intlPhone).catch(() => { });

    try {
      // Step 1: Save phone and check existence
      setStorePhone(intlPhone);
      console.log('[PhoneEntry] Checking phone existence:', intlPhone);
      
      const checkRes = await checkPhoneExistence(intlPhone, 'rider');
      const { exists } = checkRes.data;
      
      if (!exists) {
        if (checkRes.data?.message || checkRes.data?.registered_role) {
          setInlineError(checkRes.data.message || formatRoleConflictMessage(checkRes.data.registered_role, 'rider'));
          setSupportPhone('');
          return;
        }
        console.log('[PhoneEntry] User does not exist. Attempting to register rider...');
        await registerRider(intlPhone);
        console.log('[PhoneEntry] Rider registered - OTP sent');
      } else {
        if (checkRes.data?.can_login === false) {
          setInlineError(checkRes.data.message || 'Your account is suspended. Please contact support.');
          setSupportPhone(checkRes.data?.support_phone || '+251 916182957');
          return;
        }
        console.log('[PhoneEntry] User exists. Sending OTP...');
        await sendOtp(intlPhone);
        console.log('[PhoneEntry] OTP sent successfully');
      }

      // Step 2: Navigate to OTP screen for verification
      navigation.navigate('OTP', { isNewUser: !exists });
    } catch (err) {
      console.error('[PhoneEntry] Auth error:', err);
      const existingRole = extractExistingRole(err);
      const code = err?.response?.data?.error?.code || err?.code;
      const message = err?.response?.data?.error?.message || err?.message || '';
      const serverSupportPhone = err?.response?.data?.error?.support_phone || err?.response?.data?.support_phone || '';
      const msg =
        (code === 'CONFLICT' || String(message).toLowerCase().includes('already registered'))
          ? formatRoleConflictMessage(existingRole, 'rider')
          : message || 'Something went wrong. Please try again.';
      setInlineError(msg);
      setSupportPhone(serverSupportPhone);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={styles.gradientContainer}>
        <Image 
          source={require('../../../assets/bg-pattern.png')}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, position: 'absolute' }}
          resizeMode="cover"
        />
        <View style={StyleSheet.absoluteFill}>
          <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
            <Defs>
              <LinearGradient id="emeraldGradient" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor={colors.primaryDark} stopOpacity="0.9" />
                <Stop offset="0.5" stopColor={colors.primary} stopOpacity="0.85" />
                <Stop offset="1" stopColor={colors.primaryLight} stopOpacity="0.8" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#emeraldGradient)" />
          </Svg>
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} style={styles.flex} accessible={false}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
                  <View style={styles.centerWrapper}>
                    <View style={styles.container}>
                      <View style={styles.content}>
                        <View style={styles.logoWrapper}>
                          <View style={[styles.logoCircle, { backgroundColor: colors.white }]}>
                            <Image 
                              source={require('../../../assets/icon.png')}
                              style={styles.logoImage}
                              resizeMode="contain"
                            />
                          </View>
                        </View>
                        <Text style={styles.heading}>{t('auth.welcome')}</Text>
                        <Text style={styles.sub}>{t('auth.welcomeSub')}</Text>

                        <View style={styles.loginCard}>
                          <View style={styles.phoneInput}>
                            <View style={styles.phoneInputPositioner}>
                              <PhoneInput
                                defaultCode="ET"
                                value={phone}
                                layout="second"
                                onChangeText={handlePhoneChange}
                                onChangeCountry={handleCountryChange}
                                renderDropdownImage={<ChevronDown size={12} color={colors.textSecondary} />}
                                containerStyle={styles.phoneInputLibContainer}
                                flagButtonStyle={styles.phoneInputLibFlagButton}
                                textContainerStyle={[
                                  styles.phoneInputLibTextContainer,
                                  inputFocused && styles.phoneInputLibTextContainerFocused,
                                  (hasPrefixError || hasPhoneFormatError) && styles.phoneInputError,
                                ]}
                                codeTextStyle={styles.code}
                                textInputStyle={[styles.phoneInputText, (isValid || inputFocused) && styles.phoneInputTextActive]}
                                textInputProps={{
                                  ref: phoneInputRef,
                                  placeholder: isEthiopia
                                    ? t('auth.phonePlaceholder')
                                    : t('auth.phoneInternationalPlaceholder'),
                                  placeholderTextColor: colors.inputPlaceholder,
                                  returnKeyType: 'done',
                                  onSubmitEditing: () => {
                                    phoneInputRef.current?.blur();
                                    Keyboard.dismiss();
                                  },
                                  inputAccessoryViewID: 'doneButton',
                                  autoComplete: 'tel',
                                  textContentType: 'telephoneNumber',
                                  autoCapitalize: 'none',
                                  includeFontPadding: false,
                                  maxFontSizeMultiplier: 1.15,
                                  maxLength: isEthiopia ? 12 : MAX_E164_DIGITS,
                                  value: phone,
                                  onFocus: handleFocus,
                                  onBlur: handleBlur,
                                }}
                              />
                              {/* The picker library's own flag glyph renders blank on a lot of
                                  Android builds (emoji-font coverage) and its image-flag fallback
                                  depends on a remote fetch that isn't reliable either. Overlaying
                                  our own flagcdn image — the same source this screen used before
                                  the picker existed — sits on top of the library's flag slot;
                                  pointerEvents="none" lets the tap pass through to the real
                                  (invisible) button underneath, so the picker still opens exactly
                                  as before. */}
                              <Image
                                source={{ uri: `https://flagcdn.com/w80/${selectedCountry.toLowerCase()}.png` }}
                                style={styles.flagOverlay}
                                resizeMode="contain"
                                pointerEvents="none"
                              />
                            </View>
                            <TouchableOpacity
                              onPress={openSendCodeSheet}
                              disabled={!isValid || loading}
                              activeOpacity={0.7}
                              style={styles.checkButtonInline}
                            >
                              <Animated.View style={[styles.checkCircle, { transform: [{ scale: bounceAnim }] }]}>
                                {loading ? (
                                  <ActivityIndicator size={22} color={colors.primary} />
                                ) : isValid ? (
                                  <CheckCircle size={32} color={colors.primary} />
                                ) : (
                                  <View style={styles.emptyCircle} />
                                )}
                              </Animated.View>
                            </TouchableOpacity>
                          </View>

                          {hasPrefixError && (
                            <View style={styles.phoneErrorRow}>
                              <AlertTriangle size={13} color={colors.error} strokeWidth={2} />
                              <Text style={styles.phoneError}>{t('auth.phonePrefixError')}</Text>
                            </View>
                          )}
                          {hasPhoneFormatError && (
                            <View style={styles.phoneErrorRow}>
                              <AlertTriangle size={13} color={colors.error} strokeWidth={2} />
                              <Text style={styles.phoneError}>{t('auth.phoneInvalid')}</Text>
                            </View>
                          )}
                          {isEthiopia && !phone && !!recentPhone && (
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
                              <View style={styles.suspendedCopy}>
                                <Text style={styles.suspendedText}>{inlineError}</Text>
                                {!!supportPhone && (
                                  <TouchableOpacity
                                    onPress={() => Linking.openURL(`tel:${supportPhone.replace(/[^\d+]/g, '')}`)}
                                    activeOpacity={0.75}
                                  >
                                    <Text style={styles.supportPhoneLink}>{supportPhone}</Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          )}

                          <View style={styles.dividerHorizontal} />

                          <AppButton
                            title={t('auth.signIn', 'Sign in')}
                            onPress={openSendCodeSheet}
                            disabled={!isValid || isAuthBusy}
                            loading={loading}
                            shimmer={true}
                            icon={
                              <View style={styles.signInIconBadge}>
                                <Key size={15} color={colors.white} strokeWidth={2.75} />
                              </View>
                            }
                            style={{
                              width: '110%', // Make it wider than the container
                              marginTop: 12,
                              height: 58,
                              borderRadius: 999,
                            }}
                          />

                          <View style={styles.socialDividerRow}>
                            <View style={styles.socialDividerLine} />
                            <Text style={styles.socialDividerText}>{t('auth.orContinueWith')}</Text>
                            <View style={styles.socialDividerLine} />
                          </View>

                          <View style={styles.socialButtonRow}>
                            <TouchableOpacity
                              style={[styles.socialCircleButton, isAuthBusy && !googleLoading && styles.socialCircleButtonDisabled]}
                              onPress={handleGoogleLogin}
                              disabled={isAuthBusy}
                              activeOpacity={0.8}
                            >
                              {googleLoading ? (
                                <ActivityIndicator size="small" color={colors.textSecondary} />
                              ) : (
                                <GoogleLogo size={22} />
                              )}
                            </TouchableOpacity>
                            {appleAvailable ? (
                              <TouchableOpacity
                                style={[styles.socialCircleButton, isAuthBusy && !appleLoading && styles.socialCircleButtonDisabled]}
                                onPress={handleAppleLogin}
                                disabled={isAuthBusy}
                                activeOpacity={0.8}
                              >
                                {appleLoading ? (
                                  <ActivityIndicator size="small" color={colors.textSecondary} />
                                ) : (
                                  <AppleLogo size={22} />
                                )}
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </View>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>

            {/* Footer moved OUTSIDE of KeyboardAvoidingView so it stays put */}
            <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
              <View style={styles.socialIcons}>
                <TouchableOpacity onPress={() => Linking.openURL('https://facebook.com')} style={styles.socialBtn}>
                  <FacebookIcon size={18} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL('https://t.me')} style={styles.socialBtn}>
                  <TelegramIcon size={18} color={colors.white} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => Linking.openURL('https://instagram.com')} style={styles.socialBtn}>
                  <InstagramIcon size={18} color={colors.white} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => setTermsModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.terms}>{t('auth.terms')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TermsConditionsModal
            visible={termsModalVisible}
            onClose={() => setTermsModalVisible(false)}
          />
          <SendCodeSheet
            visible={sendCodeSheetVisible}
            phone={isEthiopia ? rawDigits : intlFormattedPhone}
            isEthiopia={isEthiopia}
            onClose={() => setSendCodeSheetVisible(false)}
            onSendSms={handleSendSmsCode}
            onSendWhatsapp={handleWhatsAppCode}
            onEditPhone={handleEditPhone}
          />
        </SafeAreaView>
      </TouchableWithoutFeedback>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID="doneButton">
          <View style={styles.accessory}>
            <TouchableOpacity onPress={Keyboard.dismiss} style={styles.accessoryBtn}>
              <Text style={styles.accessoryText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </View>
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
    marginBottom: 20,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  heading: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.white,
    marginBottom: 6,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 24,
    lineHeight: 22,
    textAlign: 'center',
  },
  loginCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 16, // Reduced from 24 to make internal elements wider
    alignItems: 'center',
    ...shadow.lg,
  },
  phoneInput: {
    width: '100%',
    height: PHONE_INPUT_HEIGHT,
  },
  phoneInputError: {
    borderColor: colors.error,
  },
  phoneError: {
    fontSize: fontSize.xs,
    color: colors.error,
    textAlign: 'center',
    fontWeight: fontWeight.medium,
  },
  phoneErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  // Keep the country selector and number field as two distinct rounded zones.
  phoneInputLibContainer: {
    width: '100%',
    backgroundColor: 'transparent',
    height: PHONE_INPUT_HEIGHT,
  },
  phoneInputPositioner: {
    flex: 1,
    height: PHONE_INPUT_HEIGHT,
  },
  phoneInputLibFlagButton: {
    width: 112,
    minWidth: 112,
    maxWidth: 112,
    height: PHONE_INPUT_HEIGHT,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 36,
    paddingRight: 10,
    marginRight: 10,
    borderRadius: PHONE_INPUT_RADIUS,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
  },
  flagOverlay: {
    position: 'absolute',
    left: 14,
    top: '50%',
    marginTop: -9,
    width: 26,
    height: 18,
    borderRadius: 3,
    zIndex: 2,
  },
  phoneInputLibTextContainer: {
    flex: 1,
    height: PHONE_INPUT_HEIGHT,
    minHeight: PHONE_INPUT_HEIGHT,
    maxHeight: PHONE_INPUT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: colors.backgroundAlt,
    paddingVertical: 0,
    paddingLeft: 18,
    paddingRight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: PHONE_INPUT_RADIUS,
  },
  phoneInputLibTextContainerFocused: {
    borderColor: colors.primary,
  },
  code: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginLeft: 0,
    marginRight: 2,
  },
  phoneInputText: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    paddingHorizontal: 0,
    paddingVertical: 0,
    margin: 0,
    height: PHONE_INPUT_HEIGHT - 2,
    textAlignVertical: 'center', // Android: TextInput default vertical align is top, not center
  },
  phoneInputTextActive: {
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },
  dividerHorizontal: {
    width: '100%',
    height: 1.5,
    backgroundColor: '#F1F5F9',
    marginTop: 24,
    marginBottom: 12,
  },
  signInIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    gap: 10,
  },
  socialDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  socialDividerText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  socialButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
    gap: 20,
  },
  socialCircleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  // Applied to whichever social button ISN'T the one currently signing in —
  // dims it so it visibly reads as "unavailable right now", not just silently
  // unresponsive to a tap.
  socialCircleButtonDisabled: {
    opacity: 0.4,
  },
  checkButtonInline: {
    position: 'absolute',
    right: 10,
    top: (PHONE_INPUT_HEIGHT - 36) / 2,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkCircle: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCircle: {
    width: 36,
    height: 36,
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
    gap: 16,
    marginBottom: 12,
  },
  socialBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  terms: {
    fontSize: fontSize.xs,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 18,
    textDecorationLine: 'underline',
    opacity: 0.8,
  },
  suspendedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 12,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderBottomWidth: 1, // Only bottom border for a flat look
    borderTopWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    gap: 8,
  },
  suspendedCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  recentPhoneChip: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(0,103,79,0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
  },
  recentPhoneText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  suspendedText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: colors.error,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
  },
  supportPhoneLink: {
    fontSize: fontSize.xs,
    color: colors.primary,
    lineHeight: 18,
    fontWeight: fontWeight.bold,
    textDecorationLine: 'underline',
  },
  langBtn: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(37, 99, 235, 0.8)', // Stronger Vibrant Blue
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: borderRadius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  langBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.5,
  },
  accessory: {
    width: '100%',
    height: 44,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
  },
  accessoryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  accessoryText: {
    color: colors.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
