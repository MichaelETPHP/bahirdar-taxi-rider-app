import React from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  CreditCard,
  Eye,
  EyeOff,
  History,
  Plus,
} from 'lucide-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import useAuthStore from '../../store/authStore';
import TransactionHistorySheet from '../../components/wallet/TransactionHistorySheet';
import DottedWorldMap from '../../components/wallet/DottedWorldMap';

const COMING_SOON_MESSAGE = 'Coming soon';
const BALANCE_HIDDEN_STORAGE_KEY = 'walletBalanceHidden';
const MASKED_BALANCE = '•••••';

export default function WalletScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const balance = Number(user?.walletBalance ?? 0);
  const [transactionsVisible, setTransactionsVisible] = React.useState(false);
  const [balanceHidden, setBalanceHidden] = React.useState(false);
  const balanceOpacity = React.useRef(new Animated.Value(1)).current;

  // Refresh every time the screen gains focus — catches balance changes from
  // a top-up or a trip payment that happened while this screen wasn't visible.
  useFocusEffect(
    React.useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // Restore the hide/show preference so it doesn't reset every time the
  // wallet is opened — a privacy choice, not a per-session one.
  React.useEffect(() => {
    AsyncStorage.getItem(BALANCE_HIDDEN_STORAGE_KEY).then((v) => {
      if (v === '1') setBalanceHidden(true);
    });
  }, []);

  const handleToggleBalanceVisibility = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Brief dip-and-return rather than an instant swap — the amount and the
    // dots are different content, not a continuous value, so a hard cut
    // would read as a flash; this bridges the two states.
    Animated.sequence([
      Animated.timing(balanceOpacity, { toValue: 0.15, duration: 100, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(balanceOpacity, { toValue: 1, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
    setBalanceHidden((prev) => {
      const next = !prev;
      AsyncStorage.setItem(BALANCE_HIDDEN_STORAGE_KEY, next ? '1' : '0').catch(() => {});
      return next;
    });
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleTopUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WalletTopUp');
  };

  const handleComingSoon = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(COMING_SOON_MESSAGE, 'This wallet feature is being prepared.');
  };

  const handleOpenTransactions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransactionsVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <ArrowLeft size={22} color={colors.textPrimary} strokeWidth={2} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="About wallet"
              hitSlop={8}
              onPress={handleComingSoon}
              style={({ pressed }) => pressed && styles.textPressed}
            >
              <Text style={styles.aboutText}>About wallet</Text>
            </Pressable>
          </View>

          <Text style={styles.screenTitle}>Wallet</Text>

          <View style={styles.balanceCardShadow}>
            <LinearGradient
              colors={['#0A1428', '#0F2A52', '#153E78']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <DottedWorldMap />

              <View>
                <Text style={styles.brandText}>BAHIRAN ETHIOPIA</Text>
                <View style={styles.balanceRow}>
                  <Animated.Text style={[styles.balanceText, { opacity: balanceOpacity }]}>
                    {balanceHidden
                      ? MASKED_BALANCE
                      : `${balance.toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB`}
                  </Animated.Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={balanceHidden ? 'Show balance' : 'Hide balance'}
                    hitSlop={12}
                    onPress={handleToggleBalanceVisibility}
                    style={({ pressed }) => [styles.eyeButton, pressed && styles.eyeButtonPressed]}
                  >
                    {balanceHidden ? (
                      <EyeOff size={18} color="rgba(255,255,255,0.75)" strokeWidth={2} />
                    ) : (
                      <Eye size={18} color="rgba(255,255,255,0.75)" strokeWidth={2} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Top up wallet"
                onPress={handleTopUp}
                style={({ pressed }) => [styles.topUpAction, pressed && styles.cardPressed]}
              >
                <Plus size={32} color="rgba(255,255,255,0.85)" strokeWidth={1.6} />
                <Text style={styles.topUpText}>Top up</Text>
              </Pressable>
            </LinearGradient>
          </View>

          <View style={styles.menu}>
            <WalletRow
              icon={CreditCard}
              label="Payment methods"
              onPress={handleComingSoon}
            />
            <WalletRow
              icon={History}
              label="Transactions"
              onPress={handleOpenTransactions}
              last
            />
          </View>
        </View>
      </ScrollView>

      <TransactionHistorySheet
        visible={transactionsVisible}
        onClose={() => setTransactionsVisible(false)}
      />
    </SafeAreaView>
  );
}

function WalletRow({ icon: Icon, label, trailing, onPress, last = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.menuRowBorder,
        pressed && styles.menuRowPressed,
      ]}
    >
      <Icon size={27} color={colors.textPrimary} strokeWidth={2} />
      <Text style={styles.menuLabel}>{label}</Text>
      {!!trailing && <Text style={styles.menuTrailing}>{trailing}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 28,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  headerRow: {
    minHeight: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    backgroundColor: colors.backgroundAlt,
  },
  textPressed: {
    opacity: 0.6,
  },
  aboutText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  screenTitle: {
    marginTop: 24,
    marginBottom: 28,
    fontSize: fontSize['6xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    letterSpacing: -0.8,
  },
  balanceCardShadow: {
    borderRadius: 20,
    shadowColor: '#0A1428',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  balanceCard: {
    height: 216,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 22,
    borderRadius: 20,
    overflow: 'hidden',
  },
  brandText: {
    marginBottom: 14,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 1.6,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceText: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: -0.7,
  },
  eyeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  eyeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    transform: [{ scale: 0.94 }],
  },
  topUpAction: {
    alignSelf: 'flex-start',
    minWidth: 90,
  },
  cardPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  topUpText: {
    marginTop: 5,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  menu: {
    marginTop: 38,
  },
  menuRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 4,
  },
  menuRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  menuRowPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.99 }],
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.25,
  },
  menuTrailing: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    color: colors.textSecondary,
  },
});
