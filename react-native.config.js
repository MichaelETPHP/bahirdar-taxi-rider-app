// react-native-maps' custom Marker children (AIRMapMarker and friends) need
// to be registered here to render under the New Architecture (Fabric) —
// without this, custom marker views silently fail to render while the map
// itself renders fine, since the map doesn't go through this interop layer.
// See react-native-maps/README.md "React Native Configuration for Fabric".
const AIR_MAP_LEGACY_COMPONENTS = [
  'AIRMap',
  'AIRMapCallout',
  'AIRMapCalloutSubview',
  'AIRMapCircle',
  'AIRMapHeatmap',
  'AIRMapLocalTile',
  'AIRMapMarker',
  'AIRMapOverlay',
  'AIRMapPolygon',
  'AIRMapPolyline',
  'AIRMapUrlTile',
  'AIRMapWMSTile',
];

module.exports = {
  project: {
    android: {
      unstable_reactLegacyComponentNames: AIR_MAP_LEGACY_COMPONENTS,
    },
    ios: {
      unstable_reactLegacyComponentNames: AIR_MAP_LEGACY_COMPONENTS,
    },
  },
};
