import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { UrlTile } from 'react-native-maps';
import { gebetaTileUrl } from '../../services/gebetaMaps';

/** iOS: Apple Maps satellite + labels. Android: Gebeta raster tiles over mapType none. */
const useIosSatelliteBase = Platform.OS === 'ios';

// Addis Ababa city center — OSRM + Gebeta data covers Addis only
const ADDIS_ABABA = {
  latitude:      9.0192,
  longitude:     38.7525,
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
      style={[styles.map, style]}
      initialRegion={initialRegion || ADDIS_ABABA}
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
      mapType={useIosSatelliteBase ? 'hybrid' : 'none'}
    >
      {!useIosSatelliteBase && (
        <UrlTile
          urlTemplate={gebetaTileUrl()}
          maximumZ={19}
          flipY={false}
          zIndex={1}
          shouldReplaceMapContent
        />
      )}
      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
