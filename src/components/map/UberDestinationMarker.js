import React from 'react';
import { Marker, Circle } from 'react-native-maps';
import { colors } from '../../constants/colors';

// Deliberately a native pin, not a custom child View — same fix as
// UberUserLocationMarker (see its own comment for the full explanation):
// on this project's react-native-maps 1.29.0 + New Architecture setup,
// a <Marker> whose child is a custom View (this used to render a
// pulse-ring + red circle + icon + label) silently renders nothing on
// iOS — Android tolerated it, which is why this only ever broke on iOS.
// Native pins go through a different rendering path and are unaffected.
//
// The halo is a `Circle`, not a Marker child, for the same reason it
// works on the pickup marker — it's a separate native map overlay, so
// it isn't touched by that bug and renders reliably on both platforms.
function UberDestinationMarker({ coordinate, title, onPress }) {
  if (!coordinate) return null;

  return (
    <>
      <Circle
        center={coordinate}
        radius={30}
        fillColor="rgba(239, 68, 68, 0.12)"
        strokeColor="rgba(239, 68, 68, 0.35)"
        strokeWidth={1}
        zIndex={498}
      />
      <Marker
        coordinate={coordinate}
        title={title}
        pinColor={colors.mapDestination}
        onPress={onPress}
        zIndex={499}
      />
    </>
  );
}

export default React.memo(UberDestinationMarker);
