import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  BackHandler,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Car, Clock3, Flag, MapPin, Phone } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import {
  getActiveTrip,
  getTrip,
} from '../../services/tripService';
import { parseTripPollResponse, TRIP_STATUS_POLL_MS } from '../../utils/tripLifecycle';
import { formatEthiopianPhone } from '../../utils/phoneFormatter';
import { disconnectSocket } from '../../services/socketService';

function getResumeRoute(status) {
  switch (status) {
    case 'searching':
      return 'Searching';
    case 'matched':
      return 'DriverMatched';
    case 'driver_arrived':
      return 'DriverArrived';
    case 'in_progress':
      return 'TripActive';
    default:
      return 'Home';
  }
}

function getStatusMeta(status) {
  switch (status) {
    case 'searching':
      return {
        title: 'Finding your driver',
        body: 'Your request is still live. Resume the search to keep tracking this trip.',
        cta: 'Resume Search',
      };
    case 'matched':
      return {
        title: 'Driver is on the way',
        body: 'A driver already accepted this ride. Continue to see live arrival updates.',
        cta: 'Continue Trip',
      };
    case 'driver_arrived':
      return {
        title: 'Driver is waiting for you',
        body: 'Your driver has arrived at the pickup point and is waiting.',
        cta: 'Open Arrival View',
      };
    case 'in_progress':
      return {
        title: 'Trip is in progress',
        body: 'This ride is already underway. Re-open it to see the current trip details.',
        cta: 'Open Active Trip',
      };
    default:
      return {
        title: 'Active trip found',
        body: 'You already have an unfinished trip in the system.',
        cta: 'Open Trip',
      };
  }
}

export default function ActiveTripResumeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const pollRef = useRef(null);
  const {
    tripId,
    tripData,
    tripStatus,
    driver,
    hydrateActiveTrip,
    mergeTripData,
    setDriver,
    setTripStatus,
    setFinalFare,
    resetTrip,
  } = useRideStore();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const syncTrip = useCallback(async (showSpinner = false) => {
    if (!token) return false;
    if (showSpinner) setRefreshing(true);
    try {
      const res = tripId ? await getTrip(tripId, token) : await getActiveTrip(token);
      const root = res?.data ?? res;
      const hasActive = tripId ? !!root : !!root?.trip || !!root?.id || !!root?.status;

      if (!hasActive) {
        resetTrip();
        disconnectSocket();
        navigation.replace('Home');
        return false;
      }

      const { status, trip, driver: nextDriver } = parseTripPollResponse(root);
      if (!trip || !status) {
        resetTrip();
        navigation.replace('Home');
        return false;
      }

      if (status === 'completed') {
        hydrateActiveTrip({ trip, status, driver: nextDriver });
        setFinalFare({
          amount: parseFloat(trip.final_fare_etb ?? trip.total_fare_etb ?? trip.estimated_fare_etb ?? 0),
          distanceKm: parseFloat(trip.actual_distance_km ?? trip.distance_km ?? 0),
          durationMin: parseFloat(trip.actual_duration_min ?? trip.duration_min ?? 0),
        });
        navigation.replace('TripComplete');
        return true;
      }

      if (status === 'cancelled' || status === 'no_drivers_found') {
        resetTrip();
        disconnectSocket();
        navigation.replace('Home');
        return false;
      }

      mergeTripData(trip);
      hydrateActiveTrip({ trip, status, driver: nextDriver });
      if (nextDriver) setDriver(nextDriver);
      setTripStatus(status);
      return true;
    } catch (_) {
      return false;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, tripId, resetTrip, navigation, hydrateActiveTrip, mergeTripData, setDriver, setTripStatus, setFinalFare]);

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => true);
    syncTrip(true);
    return () => {
      backHandler.remove();
      clearInterval(pollRef.current);
    };
  }, [navigation, syncTrip]);

  useEffect(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      syncTrip(false);
    }, TRIP_STATUS_POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [syncTrip]);

  const statusMeta = useMemo(() => getStatusMeta(tripStatus), [tripStatus]);
  const carLine = [
    driver?.vehicle?.make,
    driver?.vehicle?.model,
    driver?.vehicle?.color,
    driver?.vehicle?.plateNumber || driver?.vehicle?.plate_number,
  ].filter(Boolean).join(' · ');
  const phone = formatEthiopianPhone(driver?.phone);

  const handleContinue = () => {
    navigation.replace(getResumeRoute(tripStatus));
  };

  const handleCall = () => {
    if (phone && phone !== '—' && driver?.phone) {
      Linking.openURL(`tel:${driver.phone}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Restoring your active trip…</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerIcon}>
          <Car size={18} color={colors.white} />
        </View>
        <Text style={styles.headerText}>Active Trip</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>{statusMeta.title}</Text>
          <Text style={styles.heroBody}>{statusMeta.body}</Text>

          <View style={styles.heroPillRow}>
            <View style={styles.heroPill}>
              <Clock3 size={14} color={colors.primary} />
              <Text style={styles.heroPillText}>{String(tripStatus || '').replace(/_/g, ' ')}</Text>
            </View>
            {!!tripData?.vehicle_category && (
              <View style={styles.heroPill}>
                <Car size={14} color={colors.primary} />
                <Text style={styles.heroPillText}>{tripData.vehicle_category}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Details</Text>

          <View style={styles.row}>
            <MapPin size={14} color={colors.success} />
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>Pickup</Text>
              <Text style={styles.rowValue}>{tripData?.pickup_address || 'Pickup location'}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Flag size={14} color={colors.mapDestination} />
            <View style={styles.rowTextWrap}>
              <Text style={styles.rowLabel}>Destination</Text>
              <Text style={styles.rowValue}>{tripData?.dropoff_address || 'Destination'}</Text>
            </View>
          </View>

          <View style={styles.metaGrid}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Fare</Text>
              <Text style={styles.metaValue}>ETB {Math.round(parseFloat(tripData?.total_fare_etb ?? tripData?.estimated_fare_etb ?? 0) || 0)}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>Trip ID</Text>
              <Text style={styles.metaValue}>{String(tripId || '').slice(0, 8).toUpperCase() || '—'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Driver</Text>
          <Text style={styles.driverName}>{driver?.name || driver?.full_name || 'Driver details pending'}</Text>
          <Text style={styles.driverMeta}>{carLine || 'Vehicle details will appear here'}</Text>
          {phone && phone !== '—' ? (
            <TouchableOpacity style={styles.callButton} onPress={handleCall} activeOpacity={0.8}>
              <Phone size={14} color={colors.primary} />
              <Text style={styles.callText}>{phone}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(14, insets.bottom) + 6 }]}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleContinue}
          activeOpacity={0.9}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>{statusMeta.cta}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    backgroundColor: '#F6F8FB',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  root: {
    flex: 1,
    backgroundColor: '#F6F8FB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingBottom: 18,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    gap: 14,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 20,
    ...shadow.lg,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  heroBody: {
    marginTop: 8,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.86)',
  },
  heroPillRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.pill,
  },
  heroPillText: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.white,
    textTransform: 'capitalize',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 18,
    ...shadow.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  rowValue: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
    lineHeight: 20,
  },
  metaGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  metaCell: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
  },
  metaLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  metaValue: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },
  driverName: {
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    fontWeight: fontWeight.bold,
  },
  driverMeta: {
    marginTop: 6,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  callButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.pill,
  },
  callText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.bold,
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 10,
  },
  primaryButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.md,
  },
  primaryButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
});
