import { X, Star, Clock } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import TripCardSkeletonList from '../../components/ride/TripCardSkeleton';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import { getTripHistory } from '../../services/tripService';
import { formatDate, formatTime } from '../../utils/formatters';

// ── Completed trip card ──────────────────────────────────────────────────────
const CompletedCard = React.memo(({ item }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View>
        <Text style={styles.dateText}>{formatDate(item.date)}</Text>
        <Text style={styles.timeText}>{formatTime(item.time)}</Text>
      </View>
      <Text style={styles.fare}>ETB {item.fareETB}</Text>
    </View>

    <View style={styles.route}>
      <View style={styles.routeRow}>
        <View style={styles.dotGreen} />
        <Text style={styles.routeText} numberOfLines={1}>{item.pickup}</Text>
      </View>
      <View style={styles.routeConnector} />
      <View style={styles.routeRow}>
        <View style={styles.dotBlack} />
        <Text style={styles.routeText} numberOfLines={1}>{item.destination}</Text>
      </View>
    </View>

    <View style={styles.cardFooter}>
      <Text style={styles.metaText}>{item.distanceKm} km · {item.durationMin} min</Text>
      {item.userRating !== '-' && (
        <View style={styles.ratingBadge}>
          <Star size={12} color="#F5A623" />
          <Text style={styles.ratingText}>{item.userRating}/5</Text>
        </View>
      )}
    </View>
  </View>
));

// ── Cancelled trip card ──────────────────────────────────────────────────────
const CancelledCard = React.memo(({ item }) => {
  const byDriver = item.cancelledBy === 'driver';
  const bySystem = item.cancelledBy === 'system';

  const cancelledByText =
    byDriver ? 'Driver'
    : bySystem ? 'System'
    : 'You';
  const badgeLabel = `By ${cancelledByText}`;
  const reasonText = item.cancelReason || 'No reason';

  return (
    <View style={[styles.card, styles.cancelledCard, byDriver && styles.cancelledCardDriver]}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.dateText}>{formatDate(item.date)}</Text>
          <Text style={styles.timeText}>{formatTime(item.time)}</Text>
        </View>
        <View style={[
          styles.cancelledBadge,
          byDriver && styles.cancelledBadgeDriver,
          bySystem && styles.cancelledBadgeSystem,
        ]}>
          <Text style={[
            styles.cancelledBadgeText,
            byDriver && styles.cancelledBadgeTextDriver,
            bySystem && styles.cancelledBadgeTextSystem,
          ]}>
            {badgeLabel}
          </Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.route}>
        <View style={styles.routeRow}>
          <View style={styles.dotGreen} />
          <Text style={styles.routeText} numberOfLines={1}>{item.pickup}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <View style={styles.dotBlack} />
          <Text style={styles.routeText} numberOfLines={1}>{item.destination}</Text>
        </View>
      </View>

      <View style={[styles.cancelReasonBox, byDriver && styles.cancelReasonBoxDriver]}>
        <View style={styles.cancelLine}>
          <Text style={[styles.cancelledByText, byDriver && styles.cancelledByTextDriver]}>
            Cancelled by
          </Text>
          <Text style={[styles.cancelReasonText, byDriver && styles.cancelReasonTextDriver]} numberOfLines={1}>
            {cancelledByText}
          </Text>
        </View>
        <View style={styles.cancelLine}>
          <Text style={[styles.cancelledByText, byDriver && styles.cancelledByTextDriver]}>
            Reason
          </Text>
          <Text style={[styles.cancelReasonText, byDriver && styles.cancelReasonTextDriver]} numberOfLines={1}>
            {reasonText}
          </Text>
        </View>
      </View>
    </View>
  );
});

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = ['Completed', 'Cancelled'];

export default function RideHistoryScreen({ navigation }) {
  const token = useAuthStore((state) => state.token);
  const { t } = useTranslation();

  const [allTrips, setAllTrips]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const [limit, setLimit]           = useState(20);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState(0); // 0 = Completed, 1 = Cancelled

  const completedTrips = allTrips.filter((t) => t.status === 'completed');
  const cancelledTrips = allTrips.filter((t) => t.status === 'cancelled');
  const displayTrips   = activeTab === 0 ? completedTrips : cancelledTrips;

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleTabPress = (idx) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(idx);
  };

  const loadTrips = useCallback(async (currentLimit = 20, isInitial = true) => {
    if (!token) { setAllTrips([]); setLoading(false); return; }
    if (isInitial) setLoading(true);
    try {
      const data = await getTripHistory(token, { limit: currentLimit });
      setAllTrips(data);
      setHasMore(data.length >= currentLimit);
    } catch {
      setAllTrips([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLimit(20);
      setHasMore(true);
      loadTrips(20, true);
    }, [loadTrips])
  );

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextLimit = limit + 20;
    try {
      const data = await getTripHistory(token, { limit: nextLimit });
      setAllTrips(data);
      setLimit(nextLimit);
      setHasMore(data.length >= nextLimit);
    } catch { /* non-fatal */ }
    finally { setLoadingMore(false); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setLimit(20);
    setHasMore(true);
    await loadTrips(20, false);
    setRefreshing(false);
  };

  const renderItem = useCallback(({ item }) =>
    activeTab === 0
      ? <CompletedCard item={item} />
      : <CancelledCard item={item} />,
  [activeTab]);

  const renderFooter = () =>
    loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    ) : null;

  const renderEmpty = () => {
    if (loading) return null;
    const msg = activeTab === 0 ? 'No completed trips yet' : 'No cancelled trips';
    return (
      <View style={styles.emptyContainer}>
        <Clock size={44} color={colors.textSecondary} style={{ opacity: 0.4, marginBottom: 12 }} />
        <Text style={styles.emptyText}>{msg}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title', 'Ride History')}</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {TABS.map((label, idx) => {
          const count = idx === 0 ? completedTrips.length : cancelledTrips.length;
          const isActive = activeTab === idx;
          return (
            <TouchableOpacity
              key={label}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabPress(idx)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {label}
              </Text>
              {!loading && count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      {loading && allTrips.length === 0 ? (
        <TripCardSkeletonList count={5} />
      ) : (
        <FlatList
          key={activeTab}
          data={displayTrips}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={5}
          removeClippedSubviews
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onRefresh={handleRefresh}
          refreshing={refreshing}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundAlt },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.white,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.textPrimary },

  // ── Tabs ──
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary,
  },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeActive: {
    backgroundColor: colors.primaryLight || '#E6F9F0',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: colors.primary,
  },

  // ── List ──
  list: { padding: 16, gap: 12 },

  // ── Shared card ──
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: 16,
    ...shadow.sm,
  },
  cancelledCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.error,
  },
  cancelledCardDriver: {
    borderLeftColor: '#D97706',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dateText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  timeText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  fare: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },

  // ── Route ──
  route: {},
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 3 },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dotBlack: { width: 8, height: 8, borderRadius: 2, backgroundColor: colors.textPrimary },
  routeConnector: { width: 2, height: 8, backgroundColor: colors.border, marginLeft: 3 },
  routeText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },

  // ── Completed footer ──
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  metaText: { fontSize: fontSize.xs, color: colors.textSecondary },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  ratingText: { fontSize: fontSize.xs, color: '#B45309', fontWeight: fontWeight.semibold },

  // ── Cancelled badge ──
  cancelledBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.pill,
  },
  cancelledBadgeText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.error,
  },

  // ── Cancel reason box ──
  cancelReasonBox: {
    marginTop: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 5,
  },
  cancelReasonBoxDriver: {
    backgroundColor: '#FFFBEB',
  },
  cancelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelledByText: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.error,
    textTransform: 'uppercase',
  },
  cancelledByTextDriver: {
    color: '#D97706',
  },
  cancelReasonText: {
    flex: 1,
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: '#7F1D1D',
    textAlign: 'right',
  },
  cancelReasonTextDriver: {
    color: '#92400E',
  },

  // ── Cancelled badge variants ──
  cancelledBadgeDriver: {
    backgroundColor: '#FFF7ED',
  },
  cancelledBadgeSystem: {
    backgroundColor: '#F3F4F6',
  },
  cancelledBadgeTextDriver: {
    color: '#D97706',
  },
  cancelledBadgeTextSystem: {
    color: '#6B7280',
  },

  // ── Misc ──
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
  emptyContainer: { flex: 1, paddingVertical: 80, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semibold },
});
