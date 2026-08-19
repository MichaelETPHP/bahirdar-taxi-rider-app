import React from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
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
import { Image } from 'expo-image';
import {
  ArrowDownToLine,
  ArrowLeft,
  Eye,
  EyeOff,
  History,
  Plus,
} from 'lucide-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import useAuthStore from '../../store/authStore';
import { fetchWalletTransactions } from '../../services/walletService';
import { listenForWalletUpdate, removeWalletUpdateListener } from '../../services/socketService';
import TransactionHistorySheet, { TransactionRow } from '../../components/wallet/TransactionHistorySheet';
import AboutWalletModal from '../../components/wallet/AboutWalletModal';
import WalletScreenSkeleton from '../../components/wallet/WalletScreenSkeleton';

const BALANCE_HIDDEN_STORAGE_KEY = 'walletBalanceHidden';
const MASKED_BALANCE = '•••••';
const RECENT_TRANSACTIONS_LIMIT = 5;

export default function WalletScreen({ navigation }) {
  const user = useAuthStore((s) => s.user);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const token = useAuthStore((s) => s.token);
  const balance = Number(user?.walletBalance ?? 0);
  const [transactionsVisible, setTransactionsVisible] = React.useState(false);
  const [aboutVisible, setAboutVisible] = React.useState(false);
  const [balanceHidden, setBalanceHidden] = React.useState(false);
  const [recentTransactions, setRecentTransactions] = React.useState([]);
  const [recentLoading, setRecentLoading] = React.useState(false);
  // True only until the very first load resolves — after that, focus
  // refetches use the lighter recentLoading spinner instead of blanking the
  // screen back to skeleton.
  const [initialLoading, setInitialLoading] = React.useState(true);
  // Separate from initialLoading — pull-to-refresh deliberately re-shows the
  // skeleton every time (not just on first load), per how this screen is
  // meant to feel: pulling down means "start fresh", not "top up the same view".
  const [refreshSkeleton, setRefreshSkeleton] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const hasLoadedOnce = React.useRef(false);
  const balanceOpacity = React.useRef(new Animated.Value(1)).current;
  const showSkeleton = initialLoading || refreshSkeleton;

  const loadWalletData = React.useCallback(async () => {
    await Promise.all([
      loadProfile(),
      fetchWalletTransactions(token, { limit: RECENT_TRANSACTIONS_LIMIT })
        .then((res) => setRecentTransactions(Array.isArray(res?.data) ? res.data : []))
        .catch(() => setRecentTransactions([])),
    ]);
  }, [loadProfile, token]);

  // Refresh every time the screen gains focus — catches balance changes and
  // new transactions from a top-up or a trip payment that happened while
  // this screen wasn't visible.
  useFocusEffect(
    React.useCallback(() => {
      setRecentLoading(true);
      loadWalletData().finally(() => {
        setRecentLoading(false);
        if (!hasLoadedOnce.current) {
          hasLoadedOnce.current = true;
          setInitialLoading(false);
        }
      });
    }, [loadWalletData])
  );

  const handleRefresh = React.useCallback(async () => {
    setRefreshing(true);
    setRefreshSkeleton(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await loadWalletData();
    } finally {
      setRefreshing(false);
      setRefreshSkeleton(false);
    }
  }, [loadWalletData]);

  // Live transaction updates — the balance itself is already kept in sync
  // globally (RootNavigator listens once and writes into the auth store),
  // this only needs to prepend the new row into the on-screen preview list
  // so a top-up/withdrawal/trip charge shows up instantly, no pull needed.
  React.useEffect(() => {
    const onWalletUpdate = (data) => {
      if (!data?.transaction) return;
      setRecentTransactions((prev) => {
        if (prev.some((t) => t.id === data.transaction.id)) return prev;
        return [data.transaction, ...prev].slice(0, RECENT_TRANSACTIONS_LIMIT);
      });
    };
    listenForWalletUpdate(onWalletUpdate);
    return () => removeWalletUpdateListener(onWalletUpdate);
  }, []);

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

  const handleWithdraw = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('WalletWithdraw');
  };

  const handleOpenAbout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAboutVisible(true);
  };

  const handleOpenTransactions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTransactionsVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            title="Refreshing…"
            titleColor={colors.textSecondary}
          />
        }
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
              onPress={handleOpenAbout}
              style={({ pressed }) => pressed && styles.textPressed}
            >
              <Text style={styles.aboutText}>About wallet</Text>
            </Pressable>
          </View>

          <Text style={styles.screenTitle}>Wallet</Text>

          {showSkeleton ? (
            <WalletScreenSkeleton />
          ) : (
            <>
          <View style={styles.balanceCardShadow}>
            <LinearGradient
              colors={['#0A1428', '#0F2A52', '#153E78']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.balanceCard}
            >
              <Image
                source={require('../../../assets/world.png')}
                style={styles.worldMapBg}
                contentFit="cover"
                pointerEvents="none"
              />

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

              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Top up wallet"
                  onPress={handleTopUp}
                  style={({ pressed }) => [styles.topUpAction, pressed && styles.topUpActionPressed]}
                >
                  <Plus size={16} color={colors.textPrimary} strokeWidth={2.5} />
                  <Text style={styles.topUpText}>Top Up</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Withdraw from wallet"
                  onPress={handleWithdraw}
                  style={({ pressed }) => [styles.withdrawAction, pressed && styles.withdrawActionPressed]}
                >
                  <ArrowDownToLine size={16} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.withdrawText}>Withdraw</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <View style={styles.recentTitleRow}>
                <History size={19} color={colors.textPrimary} strokeWidth={2} />
                <Text style={styles.recentTitle}>Transaction Details</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="See all transactions"
                hitSlop={8}
                onPress={handleOpenTransactions}
                style={({ pressed }) => pressed && styles.textPressed}
              >
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>

            {recentLoading ? (
              <View style={styles.recentStateWrap}>
                <ActivityIndicator color={colors.textSecondary} />
              </View>
            ) : recentTransactions.length === 0 ? (
              <View style={styles.recentStateWrap}>
                <Text style={styles.recentEmptyText}>No transactions yet</Text>
              </View>
            ) : (
              <View style={styles.recentList}>
                {recentTransactions.map((item, idx) => (
                  <View key={item.id}>
                    <TransactionRow item={item} />
                    {idx < recentTransactions.length - 1 && <View style={styles.recentSeparator} />}
                  </View>
                ))}
              </View>
            )}
          </View>
            </>
          )}
        </View>
      </ScrollView>

      <TransactionHistorySheet
        visible={transactionsVisible}
        onClose={() => setTransactionsVisible(false)}
      />
      <AboutWalletModal
        visible={aboutVisible}
        onClose={() => setAboutVisible(false)}
      />
    </SafeAreaView>
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
  // Full-card background texture.
  worldMapBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.13,
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
  cardActions: {
    flexDirection: 'row',
    gap: 10,
  },
  topUpAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.white,
  },
  topUpActionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  topUpText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  // Outline style, on purpose — top-up is the primary action (solid), this
  // is secondary. Same pill shape keeps them reading as a matched pair.
  withdrawAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  withdrawActionPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  withdrawText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  recentSection: {
    marginTop: 38,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  recentTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    letterSpacing: -0.25,
  },
  seeAllText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  recentList: {
    marginTop: 4,
  },
  recentSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  recentStateWrap: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  recentEmptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
});
