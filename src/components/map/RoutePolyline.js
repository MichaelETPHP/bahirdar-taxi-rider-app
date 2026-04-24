import React from 'react';
import { Polyline } from 'react-native-maps';
import { colors } from '../../constants/colors';

export default function RoutePolyline({ coordinates, dashed = false }) {
  if (!coordinates || coordinates.length < 2) return null;

  return (
    <>
      {/* White outline for high contrast */}
      <Polyline
        coordinates={coordinates}
        strokeColor="rgba(255,255,255,0.9)"
        strokeWidth={8}
        lineCap="round"
        lineJoin="round"
        zIndex={1}
      />
      {/* Premium Blue route line (Modern Google Maps style) */}
      <Polyline
        coordinates={coordinates}
        strokeColor="#2563EB"
        strokeWidth={5}
        lineDashPattern={dashed ? [8, 6] : null}
        lineCap="round"
        lineJoin="round"
        zIndex={2}
      />
    </>
  );
}
