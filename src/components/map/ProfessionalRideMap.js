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
  {
    "elementType": "geometry",
    "stylers": [
      { "color": "#f5f5f5" }
    ]
  },
  {
    "featureType": "road",
    "elementType": "geometry",
    "stylers": [
      { "color": "#ffffff" }
    ]
  },
  {
    "featureType": "water",
    "elementType": "geometry",
    "stylers": [
      { "color": "#c9c9c9" }
    ]
  },
  {
    "featureType": "landscape",
    "elementType": "geometry",
    "stylers": [
      { "color": "#f5f5f5" }
    ]
  }
];

const ADDIS_ABABA = {
  latitude: 9.0320,
  longitude: 38.7469,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

import useRideStore from '../../store/rideStore';

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
  scrollEnabled = true,
}) {
  // Always call useRef; only fall back to it when no external ref was passed.
  // Previous code did `mapRef || useRef(null)` — a Rules-of-Hooks violation.
  const internalRef = useRef(null);
  const mapViewRef  = mapRef || internalRef;
  const [mapReady, setMapReady] = useState(false);

  // Push the map's scroll-enabled state directly to the native view via
  // setNativeProps, bypassing React's render cycle. Going through props
  // adds 2–4 frames of latency on Android; by the time the prop reaches
  // the SurfaceView the gesture recogniser has already accepted the touch.
  // setNativeProps takes effect on the next bridge flush, fast enough that
  // the lock applies before the MapView starts panning.
  useEffect(() => {
    const apply = (enabled) => {
      mapViewRef.current?.setNativeProps({
        scrollEnabled: scrollEnabled && enabled,
      });
    };
    let prev = useRideStore.getState().isMapScrollEnabled;
    apply(prev);
    return useRideStore.subscribe((state) => {
      if (state.isMapScrollEnabled !== prev) {
        prev = state.isMapScrollEnabled;
        apply(prev);
      }
    });
  }, [scrollEnabled, mapReady]);

  const handleMapPress = (event) => {
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
        // Using standard Google Maps style with all location names visible
        customMapStyle={[]} 
        // Managed via setNativeProps for performance; default to provided prop
        scrollEnabled={scrollEnabled}
        zoomEnabled={true}
        zoomTapEnabled={true}
        panEnabled={true}
        rotateEnabled={false}
        pitchEnabled={false}
        moveOnMarkerPress={false}
        // Performance
        cacheEnabled={false}
        loadingEnabled={true}
        loadingIndicatorColor="#00674F"
        // Styling
        toolbarEnabled={false}
        showsUserLocation={true}
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
