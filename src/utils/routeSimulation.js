/**
 * Fallback route shape for when OSRM/the backend can't produce a real
 * road-following path (only 0-2 points back) — a bare straight line looks
 * broken, cutting straight through blocks and buildings. This builds a
 * gentle curve between the two points instead, so the map still reads as
 * a plausible route. It is NOT real road geometry — purely a visual
 * stand-in, computed synchronously so it's ready the instant the real
 * route lookup comes back empty, with no visible delay or flicker.
 */

const CURVE_POINTS = 28;
// How far the curve bows off the straight line, as a fraction of the
// straight-line distance — enough to read as "not a straight line" on a
// map at normal zoom, without arcing so far it looks unrealistic.
const BOW_FRACTION = 0.14;
const MAX_BOW_DEGREES = 0.006; // caps the bow on long trips (~650m)

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function buildSimulatedCurve(origin, destination) {
  const lat1 = origin.latitude, lng1 = origin.longitude;
  const lat2 = destination.latitude, lng2 = destination.longitude;

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  // Longitude degrees compress with latitude — correct so distances and
  // the perpendicular offset both reflect real-world proportions, not
  // raw degree deltas.
  const latCorrection = Math.cos(toRad(midLat)) || 1;

  // a/b: the origin→destination vector in a metric where 1 unit of
  // latitude and 1 unit of (corrected) longitude are the same real
  // distance — this is what makes the 90°-rotation below an actual
  // perpendicular on the map, not just in raw degree-space.
  const a = dLat;
  const b = dLng * latCorrection;
  const straightLineDeg = Math.sqrt(a * a + b * b) || 1e-9;

  const bow = Math.min(straightLineDeg * BOW_FRACTION, MAX_BOW_DEGREES);

  // Rotate (a, b) by 90° and normalize — a smooth, continuous function of
  // the two coordinates. Always bows to the same side of the direction of
  // travel (never a data-dependent flip), so nearby-but-different GPS
  // fixes for a live-updating pickup point produce nearly-identical
  // curves instead of the curve randomly flipping side to side, which is
  // what a hash-based/random side choice caused before.
  const perpLat = -b / straightLineDeg;
  const perpLng = (a / straightLineDeg) / latCorrection;

  const controlLat = midLat + perpLat * bow;
  const controlLng = midLng + perpLng * bow;

  const points = [];
  for (let i = 0; i <= CURVE_POINTS; i++) {
    const t = i / CURVE_POINTS;
    const oneMinusT = 1 - t;
    // Quadratic Bézier: P0, control point, P1.
    const latitude =
      oneMinusT * oneMinusT * lat1 + 2 * oneMinusT * t * controlLat + t * t * lat2;
    const longitude =
      oneMinusT * oneMinusT * lng1 + 2 * oneMinusT * t * controlLng + t * t * lng2;
    points.push({ latitude, longitude });
  }
  return points;
}
