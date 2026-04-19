import { mockPricing } from '../data/mockPricing';

export function calculateFare(rideType, distanceKm, durationMin) {
  const pricing = mockPricing[rideType];
  if (!pricing) return { min: 0, max: 0 };

  const raw =
    (pricing.baseETB + distanceKm * pricing.perKmETB + durationMin * pricing.perMinETB) *
    pricing.surge;

  const roundedUp = Math.ceil(raw / 5) * 5;
  return {
    min: roundedUp,
    max: Math.ceil((roundedUp * 1.15) / 5) * 5,
  };
}

export function formatFareRange(fareObj) {
  return `ETB ${fareObj.min}–${fareObj.max}`;
}

export default calculateFare;
