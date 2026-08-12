import React, { useMemo } from 'react';
import Svg, { Circle } from 'react-native-svg';

// Coarse continent bounding regions on a 200×100 viewBox (roughly matching
// real longitude/latitude proportions — 200 = -180..180°, 100 = +90..-90°).
// This is a stylized card texture, not a reference map, so approximate
// placement reads fine at a glance and doesn't need cartographic precision.
const CONTINENTS = [
  { x: 18,  y: 16, w: 46, h: 40, density: 46 },  // North America
  { x: 52,  y: 56, w: 30, h: 38, density: 30 },  // South America
  { x: 94,  y: 14, w: 28, h: 24, density: 24 },  // Europe
  { x: 94,  y: 38, w: 34, h: 46, density: 40 },  // Africa
  { x: 122, y: 8,  w: 66, h: 46, density: 62 },  // Asia
  { x: 158, y: 68, w: 30, h: 22, density: 20 },  // Australia
];

// Deterministic pseudo-random so the dot cloud doesn't reshuffle on re-render.
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export default function DottedWorldMap({ color = 'rgba(255,255,255,0.16)', dotSize = 1.5 }) {
  const dots = useMemo(() => {
    const rand = seededRandom(42);
    const out = [];
    CONTINENTS.forEach((c) => {
      for (let i = 0; i < c.density; i++) {
        out.push({ x: c.x + rand() * c.w, y: c.y + rand() * c.h });
      }
    });
    return out;
  }, []);

  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 200 100"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      pointerEvents="none"
    >
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={dotSize} fill={color} />
      ))}
    </Svg>
  );
}
