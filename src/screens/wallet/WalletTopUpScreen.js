import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, CreditCard } from 'lucide-react-native';
import { useStripe, usePlatformPay, PlatformPay } from '@stripe/stripe-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import ApplePayButton from '../../components/payments/ApplePayButton';
import GooglePayButton from '../../components/payments/GooglePayButton';
import SuccessBanner from '../../components/common/SuccessBanner';
import useAuthStore from '../../store/authStore';
import { createTopupIntent, fetchTopupRate } from '../../services/walletService';

const QUICK_AMOUNTS = [25, 50, 100, 200];

const MIN_AMOUNT_USD = 1;
const MAX_AMOUNT_USD = 500;

// Shown immediately while the real admin-configured rate loads from the
// backend (GET /payments/wallet/topup/rate) — never used to actually price
// a charge, only as a rough estimate for the first render.
const FALLBACK_USD_TO_ETB = 140;

// Stripe account's registered business country — required by both Apple Pay
// and Google Pay regardless of which currency is charged (USD here, since
// diaspora riders pay from abroad).
const MERCHANT_COUNTRY_CODE = 'US';

// Strips anything that isn't a digit or a dot (a minus sign never survives
// this, so a negative amount can't be typed at all) — then collapses any
// second/third dot and caps decimals at 2 places, so "12.34.56" can't happen either.
function sanitizeAmountInput(text) {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  if (dotIndex !== -1) {
    const whole = cleaned.slice(0, dotIndex);
    const decimals = cleaned.slice(dotIndex + 1).replace(/\./g, '').slice(0, 2);
    cleaned = `${whole}.${decimals}`;
  }
  return cleaned;
}

/**
 * Stripe confirms the charge on the phone instantly, but the wallet is only
 * actually credited a moment later — once the backend's Stripe webhook
 * arrives and processes it. Without this wait, navigating straight back to
 * the wallet card can show the OLD balance for a beat (or until the next
 * focus refresh). Polls the profile until the credit lands, capped so a slow
 * webhook can't strand the rider on this screen indefinitely.
 */
async function waitForWalletCredit(minExpectedBalance, { attempts = 8, intervalMs = 700 } = {}) {
  for (let i = 0; i < attempts; i++) {
    await useAuthStore.getState().loadProfile();
    const current = Number(useAuthStore.getState().user?.walletBalance ?? 0);
    if (current >= minExpectedBalance - 0.01) return true;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  return false;
}

export default function WalletTopUpScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { isPlatformPaySupported, confirmPlatformPayPayment } = usePlatformPay();

  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rate, setRate] = useState(FALLBACK_USD_TO_ETB);
  const [platformPaySupported, setPlatformPaySupported] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);
  // Separate from `submitting` on purpose: `submitting` disables the buttons
  // for the whole flow (so a rider can't double-tap), but the "Opening
  // payment…" overlay should only cover the brief network gap before the
  // native sheet takes over — not the entire time the rider is inside it.
  const [preparingPayment, setPreparingPayment] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState('Opening payment…');
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchTopupRate()
      .then((res) => {
        const value = res?.data?.usd_to_etb_rate;
        if (value) setRate(parseFloat(value));
      })
      .catch(() => {
        // Keep the fallback rate — top-up still works, the on-screen
        // estimate is just less precise until this succeeds.
      });
  }, []);

  useEffect(() => {
    isPlatformPaySupported()
      .then(setPlatformPaySupported)
      .catch(() => setPlatformPaySupported(false));
  }, [isPlatformPaySupported]);

  // Feedback that the tap registered — the gap between tapping a pay button
  // and the native PaymentSheet/Apple Pay/Google Pay sheet actually opening
  // isn't instant (a network round trip creates the PaymentIntent first), so
  // without this the button just looks unresponsive for a beat. Only the
  // entrance animates; on the way out the native sheet or an Alert already
  // has the rider's attention, so the overlay just unmounts with it.
  useEffect(() => {
    if (preparingPayment) {
      overlayOpacity.setValue(0);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [preparingPayment, overlayOpacity]);

  const amount = parseFloat(amountInput) || 0;
  const isValidAmount = amount >= MIN_AMOUNT_USD && amount <= MAX_AMOUNT_USD;
  const buttonsDisabled = !isValidAmount || submitting;
  const estimatedEtb = Math.round(amount * rate);

  // Only surface a validation message once the rider has actually typed
  // something out of range — an empty field just shows the neutral prompt,
  // not an error, since nothing has been "gotten wrong" yet.
  let helperText = 'Enter an amount in USD';
  if (amount > 0 && amount > MAX_AMOUNT_USD) {
    helperText = `Maximum top-up is $${MAX_AMOUNT_USD}`;
  } else if (amount > 0 && amount < MIN_AMOUNT_USD) {
    helperText = `Minimum top-up is $${MIN_AMOUNT_USD}`;
  } else if (amount > 0) {
    helperText = `≈ ${estimatedEtb.toLocaleString('en-US')} ETB will be added to your wallet`;
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleQuickAmount = (value) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmountInput(String(value));
  };

  // Tapping any payment method acts immediately — matching how the real
  // Apple Pay / Google Pay sheets behave (one tap opens payment, there's no
  // separate "select then confirm" step). The wallet is credited by the
  // backend's Stripe webhook once the charge actually clears, not here —
  // this only confirms the charge with Stripe.
  const handlePay = async (method) => {
    if (buttonsDisabled) return;
    setSubmitting(true);
    setOverlayMessage('Opening payment…');
    setPreparingPayment(true);
    const startingBalance = Number(useAuthStore.getState().user?.walletBalance ?? 0);
    try {
      const intentRes = await createTopupIntent(amount, method);
      const clientSecret = intentRes?.data?.client_secret;
      const creditedEtb  = intentRes?.data?.amount_etb ?? estimatedEtb;
      if (!clientSecret) throw new Error('Could not start payment. Please try again.');

      if (method === 'card') {
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: 'Bahiran Ride',
          paymentIntentClientSecret: clientSecret,
        });
        if (initError) throw new Error(initError.message);

        // The PaymentSheet is about to take over the screen — the "Opening
        // payment…" overlay has done its job and would otherwise sit behind
        // the sheet for the entire time the rider is filling in card details.
        setPreparingPayment(false);
        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code === 'Canceled') return;
          throw new Error(presentError.message);
        }
      } else {
        setPreparingPayment(false);
        const { error } = await confirmPlatformPayPayment(clientSecret, {
          applePay: {
            cartItems: [{
              label: 'Bahiran Ride Wallet Top-up',
              amount: amount.toFixed(2),
              paymentType: PlatformPay.PaymentType.Immediate,
            }],
            merchantCountryCode: MERCHANT_COUNTRY_CODE,
            currencyCode: 'USD',
          },
          googlePay: {
            testEnv: __DEV__,
            merchantName: 'Bahiran Ride',
            merchantCountryCode: MERCHANT_COUNTRY_CODE,
            currencyCode: 'USD',
          },
        });
        if (error) {
          if (error.code === 'Canceled') return;
          throw new Error(error.message);
        }
      }

      // Stripe has confirmed the charge, but the wallet balance itself only
      // updates once the backend's webhook processes it — wait for that to
      // actually land so the balance shown when we return is the real one,
      // not the pre-top-up figure.
      setOverlayMessage('Confirming top-up…');
      setPreparingPayment(true);
      await waitForWalletCredit(startingBalance + creditedEtb);
      setPreparingPayment(false);

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessMessage(`+${creditedEtb.toLocaleString('en-US')} ETB added to your wallet`);
      setSuccessVisible(true);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Top-up failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
      setPreparingPayment(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <ArrowLeft size={26} color={colors.textPrimary} strokeWidth={2} />
            </Pressable>
            <Text style={styles.headerTitle}>Top Up</Text>
            <View style={styles.backButton} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.amountBlock}>
              <View style={styles.amountRow}>
                <Text style={styles.amountPrefix}>$</Text>
                <TextInput
                  value={amountInput}
                  onChangeText={(t) => setAmountInput(sanitizeAmountInput(t))}
                  placeholder="0"
                  placeholderTextColor={colors.border}
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                  maxLength={6}
                />
              </View>
              <Text
                style={[
                  styles.amountHelper,
                  amount > 0 && !isValidAmount && styles.amountHelperError,
                ]}
              >
                {helperText}
              </Text>
            </View>

            <View style={styles.chipRow}>
              {QUICK_AMOUNTS.map((value) => {
                const active = amount === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => handleQuickAmount(value)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.cardPressed,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      ${value}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Pay with</Text>

            <View style={styles.payButtons}>
              {platformPaySupported && Platform.OS === 'ios' && (
                <View style={styles.payButtonSlot}>
                  <ApplePayButton onPress={() => handlePay('apple_pay')} disabled={buttonsDisabled} />
                </View>
              )}
              {platformPaySupported && Platform.OS === 'android' && (
                <View style={styles.payButtonSlot}>
                  <GooglePayButton onPress={() => handlePay('google_pay')} disabled={buttonsDisabled} />
                </View>
              )}
              <View style={styles.payButtonSlot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Pay with card"
                  onPress={() => handlePay('card')}
                  disabled={buttonsDisabled}
                  style={({ pressed }) => [
                    styles.cardButton,
                    buttonsDisabled && styles.disabled,
                    pressed && !buttonsDisabled && styles.cardButtonPressed,
                  ]}
                >
                  <CreditCard size={20} color={colors.textPrimary} strokeWidth={2} />
                  <Text style={styles.cardButtonText}>Card</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {preparingPayment && (
        <Animated.View style={[styles.loadingOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={styles.loadingText}>{overlayMessage}</Text>
          </View>
        </Animated.View>
      )}

      <SuccessBanner
        visible={successVisible}
        message={successMessage}
        onHide={() => {
          setSuccessVisible(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },
  headerRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },
  amountBlock: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountPrefix: {
    fontSize: 40,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginRight: 4,
  },
  amountInput: {
    minWidth: 40,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -1,
    padding: 0,
  },
  amountHelper: {
    marginTop: 10,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  amountHelperError: {
    color: colors.error,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 36,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  cardPressed: {
    opacity: 0.7,
  },
  chipText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.white,
  },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  payButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  payButtonSlot: {
    flex: 1,
  },
  cardButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  cardButtonPressed: {
    backgroundColor: colors.border,
    transform: [{ scale: 0.97 }],
  },
  cardButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  disabled: {
    opacity: 0.4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.white,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  loadingText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
});
