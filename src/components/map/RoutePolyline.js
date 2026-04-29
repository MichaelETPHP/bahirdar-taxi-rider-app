import { useMemo } from 'react';
import { Polyline } from 'react-native-maps';
import { colors } from '../../constants/colors';

/**
 * Premium Route Polyline - Professional styling like Yango/Uber
 *
 * Features:
 * - Dual-layer effect: white glow + vibrant blue route
 * - Road-snapped geometry with 50-100+ waypoints
 * - Proper coordinate format: [latitude, longitude]
 * - Smooth rounded line caps and joins
 * - Professional color palette: blue (#3B82F6) with white halo
 */
export default function RoutePolyline({
  coordinates,
  dashed = false,
  strokeWidth = 2,
  glowWidth = 4,
  strokeColor = '#3B82F6',
  glowColor = 'rgba(255, 255, 255, 0.85)',
}) {
  // Validate and log route data
  const validCoordinates = useMemo(() => {
    if (!coordinates || coordinates.length < 2) {
      console.warn('🛣️  RoutePolyline: Invalid coordinates', {
        count: coordinates?.length,
        type: typeof coordinates,
      });
      return null;
    }

    // Ensure proper format
    const formatted = coordinates.map((coord, idx) => {
      const hasLat = 'latitude' in coord;
      const hasLng = 'longitude' in coord;

      if (!hasLat || !hasLng) {
        console.warn(`🛣️  RoutePolyline: Invalid coordinate at index ${idx}:`, coord);
        return null;
      }

      return {
        latitude: parseFloat(coord.latitude),
        longitude: parseFloat(coord.longitude),
      };
    }).filter(Boolean);

    if (formatted.length < 2) {
      console.error('🛣️  RoutePolyline: After validation, fewer than 2 valid coordinates');
      return null;
    }

    console.log(`✅ RoutePolyline ready: ${formatted.length} waypoints for road-following route`);
    return formatted;
  }, [coordinates]);

  if (!validCoordinates) {
    return null;
  }

  // Debug check: road-following routes should have many points
  if (validCoordinates.length < 5) {
    console.warn(`[Route] Only ${validCoordinates.length} points — may look like straight line`);
    console.warn('[Route] Check OSRM is using overview=full');
  }

  return (
    <>
      {/*
        Layer 1: White outer "glow" / halo
        Purpose: High visibility on any map background (buildings, forests, water)
        Provides contrast and professional appearance like Google Maps
      */}
      <Polyline
        coordinates={validCoordinates}
        strokeColor={glowColor}
        strokeWidth={glowWidth}
        lineCap="round"
        lineJoin="round"
        zIndex={10}
        geodesic={true}
      />

      {/*
        Layer 2: Primary route line
        Purpose: Vibrant blue line that follows actual roads
        Matches Yango/Uber aesthetic: clean, modern, professional

        Note: With OSRM geometry (50-100 waypoints), this creates a smooth,
        road-following line instead of direct straight line between endpoints.
      */}
      <Polyline
        coordinates={validCoordinates}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        lineDashPattern={dashed ? [10, 8] : null}
        lineCap="round"
        lineJoin="round"
        zIndex={11}
        geodesic={true}
      />
    </>
  );
}
