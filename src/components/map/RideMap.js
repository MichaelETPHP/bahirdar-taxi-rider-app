import React from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';

// Bahir Dar city center
const BAHIR_DAR = {
  latitude:      11.5936,
  longitude:     37.3906,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function RideMap({
  children,
  mapRef,
  initialRegion,
  style,
  onPress,
  onRegionChange,
  onRegionChangeComplete,
  mapPadding,
}) {
  return (
    <MapView
      ref={mapRef}
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      initialRegion={initialRegion || BAHIR_DAR}
      showsUserLocation={false}
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
      mapType="standard"
    >
      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
