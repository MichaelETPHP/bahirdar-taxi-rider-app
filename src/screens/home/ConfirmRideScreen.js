import React, { useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import RideMap from '../../components/map/RideMap';
import PickupMarker from '../../components/map/PickupMarker';
import DestMarker from '../../components/map/DestMarker';
import RoutePolyline from '../../components/map/RoutePolyline';
import AppButton from '../../components/common/AppButton';
import LocationPinButton from '../../components/ui/LocationPinButton';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useLocationStore from '../../store/locationStore';
import useRideStore from '../../store/rideStore';
import useAuthStore from '../../store/authStore';
import useRoute from '../../hooks/useRoute';
import { haversineDistance, estimateDuration } from '../../utils/distanceUtils';
import { createTrip } from '../../services/tripService';
import { connectSocket, joinRiderRoom } from '../../services/socketService';

const ADDIS_ABABA_COORDS = { latitude: 9.0192, longitude: 38.7525 };

/**
 * Maps any vehicle category display name → valid backend enum value.
 * Backend only accepts: economy | comfort | business
 */
const CATEGORY_ENUM_MAP = {
  economy:   'economy',
  standard:  'economy',
  basic:     'economy',
  regular:   'economy',
  minibus:   'economy',
  comfort:   'comfort',
  premium:   'comfort',
  plus:      'comfort',
  business:  'business',
  luxury:    'business',
  exec:      'business',
  executive: 'business',
  vip:       'business',
};

function toCategoryEnum(name = '') {
  return CATEGORY_ENUM_MAP[name.trim().toLowerCase()] || 'economy';
}

export default function ConfirmRideScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef(null);
  const [loading, setLoading] = useState(false);

  const { userCoords, pickup, destination } = useLocationStore();
  const { categories, selectedCategoryId, setTripData, setTripStatus, fareEstimates, routeInfo } = useRideStore();
  const { token, user } = useAuthStore();

  const displayCoords = userCoords ?? ADDIS_ABABA_COORDS;
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId) || null;

  const distKm = routeInfo?.distance_km
    || (userCoords && destination
      ? haversineDistance(userCoords.latitude, userCoords.longitude, destination.lat, destination.lng)
      : 5.2);
  const durMin = routeInfo?.duration_min || estimateDuration(distKm);

  // Prefer real server fare from /geo/fare-estimate, fall back to client calc
  const serverEstimate = selectedCategory
    ? fareEstimates.find((e) => e.vehicle_category?.toLowerCase() === selectedCategory.name?.toLowerCase())
    : null;

  const fare = serverEstimate
    ? Math.round(parseFloat(serverEstimate.estimated_fare_etb))
    : selectedCategory
      ? Math.max(
          parseFloat(selectedCategory.minimum_fare) || 0,
          Math.round(
            parseFloat(selectedCategory.base_fare) +
            distKm * parseFloat(selectedCategory.per_km_rate) +
            durMin * parseFloat(selectedCategory.per_minute_rate)
          )
        )
      : 0;

  const isLiveFare = serverEstimate != null;

  const { coordinates: routeCoords } = useRoute(
    userCoords,
    destination ? { latitude: destination.lat, longitude: destination.lng } : null
  );

  const handleRecenter = useCallback(() => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        { latitude: displayCoords.latitude, longitude: displayCoords.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 },
        500
      );
    }
  }, [displayCoords.latitude, displayCoords.longitude]);

  const handleConfirm = async () => {
    if (!destination || !selectedCategory) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);

    // ⚡ 1. Set OPTIMISTIC state immediately (no wait)
    const optimisticTripData = {
      id: `pending-${Date.now()}`,  // Temporary ID until backend responds
      status: 'searching',
      pickup_address: pickup?.name || pickup?.address || 'Current Location',
      dropoff_address: destination.name || destination.address || 'Destination',
      pickup_lat: displayCoords.latitude,
      pickup_lng: displayCoords.longitude,
      dropoff_lat: destination.lat,
      dropoff_lng: destination.lng,
      vehicle_category: toCategoryEnum(selectedCategory.name),
      payment_method: 'cash',
      estimated_fare_etb: fare,
      distance_km: distKm,
      duration_min: durMin,
    };

    // ⚡ 2. Update state and navigate INSTANTLY
    setTripData(optimisticTripData);
    setTripStatus('searching');
    navigation.replace('Searching');
    setLoading(false);

    // ⚡ 3. Create trip in BACKGROUND (user already on SearchingScreen)
    try {
      // Connect socket in parallel with trip creation
      connectSocket(token);
      joinRiderRoom(user?.id);

      // POST /trips request (now in background)
      const res = await createTrip(
        {
          pickup_lat: displayCoords.latitude,
          pickup_lng: displayCoords.longitude,
          pickup_address: pickup?.name || pickup?.address || 'Current Location',
          dropoff_lat: destination.lat,
          dropoff_lng: destination.lng,
          dropoff_address: destination.name || destination.address || 'Destination',
          vehicle_category: toCategoryEnum(selectedCategory.name),
          payment_method: 'cash',
        },
        token
      );

      // ⚡ 4. Update UI with REAL response from backend
      const trip = res?.data ?? res;
      const tripFare = parseFloat(trip?.total_fare_etb ?? trip?.estimated_fare_etb) || fare;

      setTripData({
        ...trip,
        estimated_fare_etb: tripFare,
        distance_km: trip?.estimated_distance_km ?? trip?.distance_km ?? distKm,
        duration_min: trip?.estimated_duration_min ?? trip?.duration_min ?? durMin,
      });
    } catch (err) {
      // ⚠️ Error occurred in background — show alert but don't navigate away
      const code = err.code || '';
      const status = err.status;
      let title = 'Error Confirming Trip';
      let msg = err.message || 'Could not confirm trip. Please try again.';

      if (status === 401) {
        title = 'Session Expired';
        msg = 'Please log in again.';
      } else if (status === 403) {
        title = 'Access Denied';
      } else if (status === 409 || code === 'ACTIVE_TRIP_EXISTS') {
        title = 'Active Trip';
        msg = 'You already have an active trip. Please complete or cancel it first.';
      } else if (status === 422 && code === 'OUTSIDE_SERVICE_AREA') {
        title = 'Outside Service Area';
        msg = 'Your pickup location is outside the Addis Ababa service area.';
      }

      // Show error alert while still on SearchingScreen
      Alert.alert(title, msg, [
        {
          text: 'Go Back',
          onPress: () => navigation.goBack(),
        },
      ]);
    }
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <View style={styles.mapContainer}>
        <RideMap mapRef={mapRef}>
          {userCoords && <PickupMarker coordinate={userCoords} title={pickup?.name || 'Current Location'} />}
          {destination && (
            <DestMarker coordinate={{ latitude: destination.lat, longitude: destination.lng }} title={destination?.name || 'Destination'} />
          )}
          <RoutePolyline coordinates={routeCoords} />
        </RideMap>

        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}
        >
          <FontAwesome5 name="arrow-left" size={20} color={colors.textPrimary} solid />
        </TouchableOpacity>

        <LocationPinButton style={[styles.pinBtn, { top: insets.top + 12 }]} onPress={handleRecenter} />
      </View>

      {/* Footer */}
      <View style={[styles.footerCard, { paddingBottom: Math.max(16, insets.bottom) + 16 }]}>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Pickup</Text>
            <Text style={styles.tableValue} numberOfLines={1}>
              {pickup?.name || 'Current Location'}
            </Text>
          </View>
          <View style={styles.tableDivider} />
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Destination</Text>
            <Text style={styles.tableValue} numberOfLines={1}>
              {destination?.name || '—'}
            </Text>
          </View>
          <View style={styles.tableDivider} />
          <View style={styles.tableRow}>
            <Text style={styles.tableLabel}>Vehicle</Text>
            <Text style={styles.tableValue}>{selectedCategory?.name || '—'}</Text>
          </View>
          <View style={styles.tableDivider} />
          <View style={styles.tableRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.tableLabel}>Estimated Fare</Text>
              {isLiveFare && (
                <View style={styles.liveTag}>
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={styles.priceValue}>ETB {fare.toFixed(2)}</Text>
          </View>
        </View>

        <AppButton
          title={loading ? 'Confirming…' : `Confirm ${selectedCategory?.name || 'Ride'}`}
          onPress={handleConfirm}
          disabled={loading || !destination || !selectedCategory}
          loading={loading}
          style={styles.confirmBtn}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundAlt },
  mapContainer: { ...StyleSheet.absoluteFillObject },
  backBtn: {
    position: 'absolute', left: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center', alignItems: 'center',
    zIndex: 10, ...shadow.md,
  },
  pinBtn: { position: 'absolute', right: 16, zIndex: 10 },
  footerCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius['2xl'], borderTopRightRadius: borderRadius['2xl'],
    paddingTop: 16, paddingHorizontal: 20,
    borderTopWidth: 1, borderTopColor: colors.border,
    minHeight: '42%',
    ...shadow.lg,
    elevation: 18,
  },
  table: {
    marginBottom: 16,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 12,
  },
  tableLabel: { fontSize: fontSize.md, color: colors.textSecondary, fontWeight: fontWeight.medium },
  tableValue: {
    fontSize: fontSize.md, color: colors.textPrimary, fontWeight: fontWeight.semibold,
    flex: 1, textAlign: 'right', marginLeft: 12,
  },
  tableDivider: { height: 1, backgroundColor: colors.border },
  priceValue: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.primary },
  confirmBtn: {
    minHeight: 48,
    paddingVertical: 10,
    marginTop: 6,
  },
  liveTag: {
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#16A34A',
    letterSpacing: 0.5,
  },
});
