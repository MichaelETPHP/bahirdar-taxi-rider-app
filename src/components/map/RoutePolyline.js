import React from 'react';
import { Polyline } from 'react-native-maps';
import { colors } from '../../constants/colors';

export default function RoutePolyline({ coordinates, dashed = false }) {
  if (!coordinates || coordinates.length < 2) return null;

  return (
    <>
      {/* White outline for contrast against map tiles */}
      <Polyline
        coordinates={coordinates}
        strokeColor="rgba(255,255,255,0.9)"
        strokeWidth={7}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      {/* Primary emerald route line */}
      <Polyline
        coordinates={coordinates}
        strokeColor={colors.primary}
        strokeWidth={4}
        lineDashPattern={dashed ? [8, 6] : null}
        lineCap="round"
        lineJoin="round"
        zIndex={2}
      />
    </>
  );
}
