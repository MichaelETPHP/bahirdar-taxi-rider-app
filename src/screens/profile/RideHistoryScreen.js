import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import { mockTrips } from '../../data/mockTrips';
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
            <FontAwesome5 name="star" size={14} color="#F5A623" solid />
            <Text style={styles.ratingText}>{item.userRating}/5</Text>
          </View>
        </View>
      </View>
    </View>
));

export default function RideHistoryScreen({ navigation }) {
  const handleBackPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const { t } = useTranslation();

  const renderTrip = useCallback(({ item }) => <TripCard item={item} />, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={22} color={colors.textPrimary} solid />
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
      </View>

      <FlatList
        data={mockTrips}
        keyExtractor={(item) => item.id}
        renderItem={renderTrip}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={true}
      />
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
});
