import { memo, useRef, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

// Addis Ababa city center
const ADDIS_ABABA = {
  latitude:      9.0320,
  longitude:     38.7469,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Professional map styling (Uber/Yango aesthetic)
const PROFESSIONAL_MAP_STYLE = [
  // Hide clutter
  {
    featureType: 'poi',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  // Road styling
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [
      { color: '#fbfbfb' },
      { lightness: 3 },
    ],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [
      { color: '#ffffff' },
      { lightness: 2 },
    ],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [
      { color: '#f8f8f8' },
      { lightness: 1 },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [
      { color: '#efefef' },
      { lightness: 0 },
    ],
  },
  // Water
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [
      { color: '#e8f4f8' },
      { saturation: -20 },
      { lightness: 5 },
    ],
  },
  {
    featureType: 'water',
    elementType: 'labels.text',
    stylers: [{ visibility: 'off' }],
  },
  // Landscape
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [
      { color: '#f5f5f5' },
      { saturation: -30 },
    ],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [
      { color: '#f0f0f0' },
      { saturation: -20 },
    ],
  },
  // Administrative boundaries
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [
      { color: '#e5e5e5' },
      { weight: 1.5 },
    ],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [
      { color: '#eeeeee' },
      { weight: 0.8 },
    ],
  },
];

import useRideStore from '../../store/rideStore';

function RideMap({
  children,
  mapRef: providedRef,
  initialRegion,
  style,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  mapPadding,
}) {
  const internalRef = useRef(null);
  const mapViewRef  = providedRef || internalRef;

  useEffect(() => {
    const apply = (enabled) => {
      mapViewRef.current?.setNativeProps({
        scrollEnabled: enabled,
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
  }, [mapViewRef]);

  const handleMapError = (err) => {
    console.error('🗺️  MapView Error:', err);
  };

  return (
    <MapView
      ref={mapViewRef}
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={initialRegion || ADDIS_ABABA}
      // Use default Google Maps standard style
      customMapStyle={[]}
      showsUserLocation={false}
      followsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      showsTraffic={false}
      showsBuildings={false}
      showsIndoors={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      scrollEnabled={true}
      zoomEnabled={true}
      panEnabled={true}
      pitchEnabled={false}
      rotateEnabled={false}
      mapPadding={mapPadding}
      onPress={onPress}
      onRegionChange={onRegionChange}
      onRegionChangeComplete={onRegionChangeComplete}
      onError={handleMapError}
      mapType="standard"
      cacheEnabled={false}
      loadingEnabled={true}
      loadingIndicatorColor="#00674F"
    >
      {children}
    </MapView>
  );
}

export default memo(RideMap);

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
