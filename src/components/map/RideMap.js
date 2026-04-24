import React, { memo } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

// Addis Ababa city center
const ADDIS_ABABA = {
  latitude:      9.0320,
  longitude:     38.7469,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

function RideMap({
  children,
  mapRef,
  initialRegion,
  style,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  mapPadding,
}) {
  const handleMapError = (err) => {
    console.error('🗺️  MapView Error:', err);
  };

  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={initialRegion || ADDIS_ABABA}
      showsUserLocation={true}
      followsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      showsTraffic={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      scrollEnabled={true}
      zoomEnabled={true}
      pitchEnabled={false}
      rotateEnabled={false}
      mapPadding={mapPadding}
      onPress={onPress}
      onRegionChange={onRegionChange}
      onRegionChangeComplete={onRegionChangeComplete}
      onError={handleMapError}
      mapType="standard"
    >
      {children}
    </MapView>
  );
}

export default memo(RideMap);

const styles = StyleSheet.create({
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
