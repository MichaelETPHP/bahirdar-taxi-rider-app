import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Clock, MapPin, ChevronRight } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';
import { getSearchHistory } from '../../services/searchHistoryService';
import { extractNeighborhoodName } from '../../services/addressParserService';

export default function RecentTrips({ onSelectPlace, limit = 5 }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await getSearchHistory();
      setHistory(data.slice(0, limit));
    } catch (err) {
      console.error('[RecentTrips] Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlace = (place) => {
    onSelectPlace?.(place);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (history.length === 0) {
    return null;
  }

  const renderTrip = ({ item }) => {
    const readableName = extractNeighborhoodName(item.address, item.lat, item.lng);

    return (
      <TouchableOpacity
        style={styles.tripItem}
        onPress={() => handleSelectPlace(item)}
        activeOpacity={0.7}
      >
        <View style={styles.tripIcon}>
          <Clock size={16} color={colors.textSecondary} />
        </View>
        <View style={styles.tripContent}>
          <Text style={styles.tripName} numberOfLines={1}>{item.name || readableName}</Text>
          <Text style={styles.tripAddress} numberOfLines={1}>{item.address}</Text>
        </View>
        <ChevronRight size={16} color={colors.border} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Clock size={16} color={colors.textSecondary} />
        <Text style={styles.headerText}>Recent Destinations</Text>
      </View>
      <FlatList
        data={history}
        renderItem={renderTrip}
        keyExtractor={(item, index) => item?.placeId ?? item?.id ?? `trip-${index}`}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  headerText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 0,
  },
});
