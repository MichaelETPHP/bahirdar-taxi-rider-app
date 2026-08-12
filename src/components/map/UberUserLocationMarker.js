import React from 'react';
import { Marker, Circle } from 'react-native-maps';

// Deliberately a native pin, not a custom child View — confirmed on iOS that
// custom Marker children (pulse-ring/avatar-photo version) silently fail to
// render on this project's react-native-maps 1.29.0 + New Architecture setup,
// even with the Fabric legacy-component interop registered in
// react-native.config.js. Native pins render through a different path and
// are unaffected. Revisit the custom-view design only after that's resolved
// upstream or a newer react-native-maps version fixes it.
//
// The "you are here" halo below is a `Circle`, not a Marker child — it's a
// separate native map overlay, not nested inside the Marker, so it isn't
// affected by that bug and renders reliably on both platforms. It's a
// static double-ring rather than an animated pulse: `Circle`'s radius is a
// native geographic prop, not a style transform, so animating it smoothly
// would mean re-rendering the native overlay on every frame — real cost for
// a decorative effect. A static halo reads as "you are here" just as
// clearly without that risk.
function UberUserLocationMarker({ coordinate, title }) {
  if (!coordinate) return null;

  return (
    <>
      <Circle
        center={coordinate}
        radius={45}
        fillColor="rgba(47, 112, 199, 0.10)"
        strokeColor="rgba(47, 112, 199, 0.28)"
        strokeWidth={1}
        zIndex={1}
      />
      <Circle
        center={coordinate}
        radius={22}
        fillColor="rgba(47, 112, 199, 0.18)"
        strokeColor="rgba(47, 112, 199, 0.4)"
        strokeWidth={1}
        zIndex={2}
      />
      <Marker coordinate={coordinate} title={title} pinColor="#2F70C7" zIndex={3} />
    </>
  );
}

export default React.memo(UberUserLocationMarker);
