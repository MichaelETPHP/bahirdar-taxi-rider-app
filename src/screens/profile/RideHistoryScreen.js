import { X, Star, Check, Phone, Car, Clock, DollarSign, Share2, AlertTriangle, User } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
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

const TripCard = React.memo(({ item }) => (
    <View style={styles.tripCard}>
      <View style={styles.tripHeader}>
        <View style={styles.tripDate}>
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
      <View style={styles.tripFooter}>
        <Text style={styles.metaText}>{item.distanceKm} km · {item.durationMin} min</Text>
        <View style={styles.ratingBadge}>
          <View style={styles.ratingRow}>
            <Star size={14} color="#F5A623" />
            <Text style={styles.ratingText}>{item.userRating}/5</Text>
          </View>
        </View>
      </View>
    </View>
));

export default function RideHistoryScreen({ navigation }) {
  const token = useAuthStore((state) => state.token);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(5);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const { t } = useTranslation();

  const loadTrips = useCallback(async (currentLimit = 5, isInitial = true) => {
    if (!token) {
      setTrips([]);
      setLoading(false);
      return;
    }

    if (isInitial) {
      setLoading(true);
    }

    try {
      const data = await getTripHistory(token, { limit: currentLimit });
      setTrips(data);
      if (data.length < currentLimit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err) {
      console.error('[RideHistory] Failed to load trip history:', err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLimit(5);
      setHasMore(true);
      loadTrips(5, true);
    }, [loadTrips])
  );

  const handleLoadMore = async () => {
    if (loading || loadingMore || !hasMore || trips.length < 5) return;

    setLoadingMore(true);
    const nextLimit = limit + 5;
    try {
      const data = await getTripHistory(token, { limit: nextLimit });
      setTrips(data);
      setLimit(nextLimit);
      if (data.length < nextLimit) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('[RideHistory] Failed to load more trips:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setLimit(5);
    setHasMore(true);
    await loadTrips(5, false);
    setRefreshing(false);
  };

  const renderTrip = useCallback(({ item }) => <TripCard item={item} />, []);

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Clock size={48} color={colors.textSecondary} style={{ opacity: 0.5, marginBottom: 12 }} />
        <Text style={styles.emptyText}>{t('history.noTrips', 'No trip history yet')}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
          <X size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
      </View>

      {loading && trips.length === 0 ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={3}
          removeClippedSubviews={true}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.2}
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
  list: { padding: 16, gap: 12 },
  tripCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: 16,
    ...shadow.sm,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  tripDate: {},
  dateText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  timeText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  fare: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.primary },
  route: {},
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  dotBlack: { width: 8, height: 8, borderRadius: 2, backgroundColor: colors.textPrimary },
  routeConnector: { width: 2, height: 8, backgroundColor: colors.border, marginLeft: 3 },
  routeText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary },
  tripFooter: {
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
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.pill,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.semibold,
  },
});
