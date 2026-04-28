import { memo, useRef, useEffect, useState } from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, Marker } from 'react-native-maps';
import { MapPin, Navigation, Layers } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius } from '../../constants/layout';

/**
 * Professional Google Maps-Style Ride Map
 *
 * Features:
 * - Uber/Google Maps aesthetic with road lines visible
 * - Street name and location labels
 * - Professional color palette
 * - Smooth animations
 * - Touch-responsive gestures
 */

// Google Maps Professional Styling - Shows road lines and street names
const PROFESSIONAL_MAP_STYLE = [
  // Hide unnecessary clutter
  {
    elementType: 'labels.icon',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },

  // Road styling - Make roads clearly visible with proper hierarchy
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#ffffff' },
      { weight: 1 },
    ],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [
      { color: '#e5e5e5' },
      { weight: 0.5 },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#f8f8f8' },
    ],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#fafafa' },
    ],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#ffffff' },
    ],
  },

  // Road labels - Show street names clearly
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#616161' },
      { weight: 0.5 },
    ],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.stroke',
    stylers: [
      { color: '#ffffff' },
      { weight: 3 },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text',
    stylers: [
      { visibility: 'on' },
    ],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text',
    stylers: [
      { visibility: 'on' },
    ],
  },

  // Water
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#e8f4f8' },
    ],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#70a8d8' },
    ],
  },

  // Landscape
  {
    featureType: 'landscape',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#f3f3f3' },
    ],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.fill',
    stylers: [
      { color: '#efefef' },
    ],
  },

  // Transit
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },

  // Administrative boundaries
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [
      { color: '#e5e5e5' },
      { weight: 1 },
    ],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#999999' },
    ],
  },
  {
    featureType: 'administrative.province',
    elementType: 'labels.text.fill',
    stylers: [
      { color: '#aaaaaa' },
    ],
  },
];

const ADDIS_ABABA = {
  latitude: 9.0320,
  longitude: 38.7469,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

function ProfessionalRideMap({
  children,
  mapRef,
  initialRegion,
  style,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  mapPadding,
  showStreetNames = true,
  showRoadLines = true,
}) {
  const mapViewRef = mapRef || useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [centerLabel, setCenterLabel] = useState('');

  const handleMapPress = (event) => {
    const { coordinate } = event.nativeEvent;
    onPress?.(event);
  };

  const handleRegionChangeComplete = (region) => {
    onRegionChangeComplete?.(region);
  };

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapViewRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        initialRegion={initialRegion || ADDIS_ABABA}
        customMapStyle={[]}
        // Interaction settings — all gestures enabled for production APK
        scrollEnabled={true}
        zoomEnabled={true}
        zoomTapEnabled={true}
        panEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
        // Performance
        cacheEnabled={true}
        loadingEnabled={true}
        loadingIndicatorColor="#00674F"
        // Styling
        toolbarEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        // Callbacks
        onPress={handleMapPress}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={handleRegionChangeComplete}
        mapPadding={mapPadding}
        mapType="standard"
        onMapReady={() => setMapReady(true)}
      >
        {/* Render all markers and routes */}
        {children}
      </MapView>

      {/* Map overlay controls - Professional styling */}
      {/* Hidden per user request:
      <View style={styles.overlayContainer} pointerEvents="none">
        <Pressable
          style={styles.mapTypeButton}
          pointerEvents="auto"
          onPress={() => {
            // TODO: Toggle map type
          }}
        >
          <Layers size={18} color={colors.primary} />
        </Pressable>
      </View>
      */}
    </View>
  );
}

export default memo(ProfessionalRideMap);

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  overlayContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 5,
  },
  mapTypeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
});
