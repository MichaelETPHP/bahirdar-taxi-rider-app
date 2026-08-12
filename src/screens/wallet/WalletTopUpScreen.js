import React, { useState } from 'react';
import {
  Alert,
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
import { ArrowLeft } from 'lucide-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import ApplePayButton from '../../components/payments/ApplePayButton';
import GooglePayButton from '../../components/payments/GooglePayButton';
import { topUpWallet } from '../../services/walletService';

const QUICK_AMOUNTS = [10, 25, 50, 100, 200];

// Placeholder only — real-time rate comes from the backend once Stripe is
// wired up. Shown so the diaspora user has a rough idea what they'll get,
// not treated as an authoritative quote anywhere in this screen.
const PLACEHOLDER_USD_TO_ETB = 130;

export default function WalletTopUpScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amount = parseFloat(amountInput) || 0;
  const isValidAmount = amount >= 1;
  const buttonsDisabled = !isValidAmount || submitting;
  const estimatedEtb = Math.round(amount * PLACEHOLDER_USD_TO_ETB);

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
  // separate "select then confirm" step). `method` decides which flow this
  // becomes once Stripe is wired: PaymentSheet for 'card', the native
  // Apple/Google Pay sheet for the other two.
  const handlePay = async (method) => {
    if (buttonsDisabled) return;
    setSubmitting(true);
    try {
      // MOCK charge — no real gateway yet. The backend credits the wallet
      // instantly and records the ledger entry; swap in a real Stripe
      // PaymentSheet/Apple Pay/Google Pay confirmation here once the
      // merchant account is ready — `method` and `estimatedEtb` are already
      // the exact values that flow needs.
      await topUpWallet(estimatedEtb, method);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Top-up successful',
        `${estimatedEtb.toLocaleString('en-US')} ETB has been added to your wallet.`,
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Top-up failed', err?.message || 'Something went wrong. Please try again.');
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
                  onChangeText={(t) => setAmountInput(t.replace(/[^0-9.]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={colors.border}
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                  maxLength={7}
                />
              </View>
              <Text style={styles.amountHelper}>
                {amount > 0
                  ? `≈ ${estimatedEtb.toLocaleString('en-US')} ETB will be added to your wallet`
                  : 'Enter an amount in USD'}
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
              <View style={styles.payButtonSlot}>
                <ApplePayButton onPress={() => handlePay('apple_pay')} disabled={buttonsDisabled} />
              </View>
              <View style={styles.payButtonSlot}>
                <GooglePayButton onPress={() => handlePay('google_pay')} disabled={buttonsDisabled} />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
});
