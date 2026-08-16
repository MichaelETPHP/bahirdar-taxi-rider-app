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
import { ArrowDownToLine, ArrowLeft } from 'lucide-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import SuccessBanner from '../../components/common/SuccessBanner';
import useAuthStore from '../../store/authStore';
import { fetchWithdrawEligibleAmount, requestWithdrawal } from '../../services/walletService';

const QUICK_FRACTIONS = [0.25, 0.5, 1];

// Same sanitizer as WalletTopUpScreen — strips anything that isn't a digit
// or a dot (blocks negatives entirely), collapses extra dots, caps decimals.
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

// Doesn't need to be cryptographically random — just unique per distinct
// withdrawal attempt, so the backend can tell "the same tap, retried" apart
// from "a genuinely new request".
function generateIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function WalletWithdrawScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const balance = Number(useAuthStore((s) => s.user?.walletBalance) ?? 0);

  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [eligibleAmount, setEligibleAmount] = useState(null); // null = still loading
  const [eligibleError, setEligibleError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [successVisible, setSuccessVisible] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  // Stable across retries of the SAME logical attempt (e.g. a client-side
  // timeout followed by tapping again) — only regenerated when the amount
  // actually changes, since that's unambiguously a different intended
  // withdrawal. This is what lets the backend dedupe a retried tap instead
  // of processing it as a brand new withdrawal.
  const idempotencyKeyRef = useRef(generateIdempotencyKey());
  const keyedAmountRef = useRef(null);

  useEffect(() => {
    fetchWithdrawEligibleAmount()
      .then((res) => setEligibleAmount(Number(res?.data?.eligible_amount_etb) || 0))
      .catch(() => {
        // Fail closed, not open — if we can't confirm what's eligible, don't
        // let the rider submit a request that's likely to just get rejected.
        setEligibleAmount(0);
        setEligibleError(true);
      });
  }, []);

  useEffect(() => {
    if (submitting) {
      overlayOpacity.setValue(0);
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [submitting, overlayOpacity]);

  const loadingEligibility = eligibleAmount === null;
  // The real ceiling is whichever is stricter — the balance itself, or how
  // much of it is still young enough for Stripe to refund.
  const availableToWithdraw = loadingEligibility ? 0 : Math.min(balance, eligibleAmount);

  const amount = parseFloat(amountInput) || 0;
  const isValidAmount = amount > 0 && amount <= availableToWithdraw;
  const buttonDisabled = !isValidAmount || submitting || loadingEligibility;

  let helperText = `Available to withdraw: ${availableToWithdraw.toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB`;
  if (loadingEligibility) {
    helperText = 'Checking how much you can withdraw…';
  } else if (amount > 0 && amount > availableToWithdraw) {
    helperText = availableToWithdraw > 0
      ? `Only ${availableToWithdraw.toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB is available to withdraw right now`
      : 'Nothing is currently eligible for withdrawal';
  }
  const showHelperAsError = amount > 0 && amount > availableToWithdraw;

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleQuickFraction = (fraction) => {
    if (availableToWithdraw <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const value = Math.floor(availableToWithdraw * fraction);
    setAmountInput(String(value));
  };

  const handleWithdraw = async () => {
    if (buttonDisabled) return;
    setSubmitting(true);

    if (keyedAmountRef.current !== amount) {
      idempotencyKeyRef.current = generateIdempotencyKey();
      keyedAmountRef.current = amount;
    }

    try {
      const res = await requestWithdrawal(amount, idempotencyKeyRef.current);
      const data = res?.data ?? {};

      if (data.status === 'processing') {
        // A duplicate of a request that's still running server-side (the
        // idempotency key matched an in-flight attempt) — not a failure,
        // just not resolved yet. Don't treat as success or error.
        Alert.alert(
          'Still processing',
          'Your withdrawal is still being processed. Check Transaction Details in a moment.'
        );
        return;
      }
      if (data.status === 'failed') {
        throw new Error('The refund could not be processed. Please try again.');
      }

      // The balance already moved server-side — pull the fresh figure so the
      // wallet card shows the right number the instant we navigate back.
      await useAuthStore.getState().loadProfile();

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const refundedEtb = Number(data.refunded_amount_etb ?? amount);
      setSuccessMessage(
        data.partial
          ? `${refundedEtb.toLocaleString('en-US')} ETB refunded to your card — the rest was returned to your wallet`
          : `${refundedEtb.toLocaleString('en-US')} ETB refunded to your card`
      );
      setSuccessVisible(true);
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Withdrawal failed', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
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
            <Text style={styles.headerTitle}>Withdraw</Text>
            <View style={styles.backButton} />
          </View>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.amountBlock}>
              <View style={styles.amountRow}>
                <TextInput
                  value={amountInput}
                  onChangeText={(t) => setAmountInput(sanitizeAmountInput(t))}
                  placeholder="0"
                  placeholderTextColor={colors.border}
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                  maxLength={9}
                  editable={!loadingEligibility}
                />
                <Text style={styles.amountSuffix}>ETB</Text>
              </View>
              <Text style={[styles.amountHelper, showHelperAsError && styles.amountHelperError]}>
                {helperText}
              </Text>
            </View>

            <View style={styles.chipRow}>
              {QUICK_FRACTIONS.map((fraction) => {
                const value = Math.floor(availableToWithdraw * fraction);
                const active = amount === value && value > 0;
                return (
                  <Pressable
                    key={fraction}
                    onPress={() => handleQuickFraction(fraction)}
                    disabled={loadingEligibility || availableToWithdraw <= 0}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.chipPressed,
                      (loadingEligibility || availableToWithdraw <= 0) && styles.disabled,
                    ]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {fraction === 1 ? 'All' : `${fraction * 100}%`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {eligibleError && (
              <Text style={styles.eligibilityErrorText}>
                Couldn't check your withdrawal limit — pull to refresh and try again.
              </Text>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Withdraw to card"
              onPress={handleWithdraw}
              disabled={buttonDisabled}
              style={({ pressed }) => [
                styles.withdrawButton,
                buttonDisabled && styles.disabled,
                pressed && !buttonDisabled && styles.withdrawButtonPressed,
              ]}
            >
              <ArrowDownToLine size={20} color={colors.white} strokeWidth={2} />
              <Text style={styles.withdrawButtonText}>Withdraw to Card</Text>
            </Pressable>

            <Text style={styles.footnote}>
              Refunded to the same card(s) you topped up with. Usually arrives within 5–10 business days.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {submitting && (
        <Animated.View style={[styles.loadingOverlay, { opacity: overlayOpacity }]} pointerEvents="none">
          <View style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.textPrimary} />
            <Text style={styles.loadingText}>Processing withdrawal…</Text>
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
    alignItems: 'baseline',
  },
  amountInput: {
    minWidth: 60,
    fontSize: 56,
    lineHeight: 64,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -1,
    padding: 0,
    textAlign: 'right',
  },
  amountSuffix: {
    marginLeft: 8,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  amountHelper: {
    marginTop: 10,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  amountHelperError: {
    color: colors.error,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  chipText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.white,
  },
  eligibilityErrorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  withdrawButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.textPrimary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  withdrawButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  withdrawButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  disabled: {
    opacity: 0.4,
  },
  footnote: {
    marginTop: 16,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
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
