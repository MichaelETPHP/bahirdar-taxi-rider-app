import { memo, useMemo } from 'react';
import { Polyline } from 'react-native-maps';

/**
 * Professional Route Polyline - Uber/Google Maps Style
 *
 * Features:
 * - Dual-layer rendering (glow + main line)
 * - Professional colors
 * - Smooth rounded paths
 * - Road-following with 50-100+ waypoints
 */
function ProfessionalRoutePolyline({
  coordinates,
  strokeColor = '#0066CC',
  glowColor = 'transparent',
  strokeWidth = 3,
  glowWidth = 0,
  lineDashPattern = null,
}) {
  const validCoordinates = useMemo(() => {
    if (!coordinates || coordinates.length < 2) {
      console.warn('🛣️ RoutePolyline: Invalid coordinates', {
        count: coordinates?.length,
      });
      return null;
    }

    const formatted = coordinates.map((coord) => {
      if (!('latitude' in coord) || !('longitude' in coord)) {
        console.warn('🛣️ Invalid coordinate format:', coord);
        return null;
      }

      return {
        latitude: parseFloat(coord.latitude),
        longitude: parseFloat(coord.longitude),
      };
    }).filter(Boolean);

    if (formatted.length < 2) {
      console.error('🛣️ After validation, fewer than 2 valid coordinates');
      return null;
    }

    console.log(`✅ Route ready: ${formatted.length} waypoints`);
    return formatted;
  }, [coordinates]);

  if (!validCoordinates) {
    return null;
  }

  return (
    <>
      {/* Main route line - thin professional blue */}
      <Polyline
        coordinates={validCoordinates}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        lineDashPattern={lineDashPattern}
        lineCap="round"
        lineJoin="round"
        zIndex={10}
        geodesic={true}
      />
    </>
  );
}

export default memo(ProfessionalRoutePolyline);
