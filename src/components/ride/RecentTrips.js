import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, ChevronRight } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import { getSearchHistory } from '../../services/searchHistoryService';
import { extractNeighborhoodName } from '../../services/addressParserService';
import { getTripHistory } from '../../services/tripService';
import useAuthStore from '../../store/authStore';

export default function RecentTrips({ onSelectPlace }) {
  const token = useAuthStore((state) => state.token);
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [token]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [searches, trips] = await Promise.all([
        getSearchHistory(),
        token ? getTripHistory(token, { limit: 1 }).catch(() => []) : Promise.resolve([]),
      ]);

      const latestSearch = Array.isArray(searches) && searches.length > 0
        ? { type: 'search', title: 'Last Search', payload: searches[0] }
        : null;
      const latestTrip = Array.isArray(trips) && trips.length > 0
        ? { type: 'trip', title: 'Last Trip', payload: trips[0] }
        : null;

      setItem(latestSearch || latestTrip || null);
    } catch (err) {
      console.error('[RecentTrips] Failed to load history:', err);
      setItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlace = () => {
    if (!item) return;
    onSelectPlace?.(item);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!item) {
    return null;
  }

  const payload = item.payload;
  const readableName = item.type === 'search'
    ? extractNeighborhoodName(payload.address, payload.lat, payload.lng)
    : null;
  const primaryText = item.type === 'trip'
    ? payload.destination || 'Last trip'
    : (payload.name || readableName || 'Last search');
  const secondaryText = item.type === 'trip'
    ? payload.pickup || 'Trip history'
    : payload.address;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.tripItem}
        onPress={handleSelectPlace}
        activeOpacity={0.7}
      >
        <View style={styles.tripIcon}>
          <MapPin size={16} color={colors.primary} />
        </View>
        <View style={styles.tripContent}>
          <Text style={styles.tripName} numberOfLines={1}>{primaryText}</Text>
          {!!secondaryText && <Text style={styles.tripAddress} numberOfLines={1}>{secondaryText}</Text>}
        </View>
        <ChevronRight size={16} color={colors.border} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  tripIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tripContent: {
    flex: 1,
  },
  tripName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  tripAddress: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
