/**
 * Address Parser Service
 * Converts full addresses to readable neighborhood names
 */

// Common neighborhoods in Addis Ababa
const ADDIS_NEIGHBORHOODS = [
  'Bole', 'Kera', 'Piazza', 'Nifas Silk-Lafto', 'Gulale', 'Kazanchis',
  'Yeka', 'Arada', 'Addis Ketema', 'Kolfe Keranio', 'Lideta', 'Kirkos',
  'Akaki Kality', 'Gullele', 'Lemi Kura', 'Finfinne', 'Gerji', 'Belu',
  'Lebu', 'Highland', 'CMC', 'Dembel Square', 'Medhanialem', 'Sarbet',
  'Bamhauer', 'Ayat', 'Kebena', 'Nolawi', 'Olympia', 'Tulu Dimtu',
];

// Common neighborhoods in Bahir Dar
const BAHIRDAR_NEIGHBORHOODS = [
  'Lake Tana', 'Piazza', 'Kebena', 'Sheger', 'Welelo', 'Bahir Dar Town',
  'Tis Abay', 'Alatish', 'Belay Zeleke', 'Seid', 'Meshenti', 'Peda Campus',
  'Addis Alem', 'Dega Damot', 'Sheger Square', 'Shore Road', 'Ginbot 20',
];

/**
 * Extract readable neighborhood from full address
 * Returns neighborhood name, or city+coords as fallback
 */
export function extractNeighborhoodName(address, lat, lng) {
  if (!address) {
    return `Location (${lat?.toFixed(2)}°, ${lng?.toFixed(2)}°)`;
  }

  // If address is already formatted as fallback (e.g., "Addis Ababa (8.95°, 38.78°)"), return as is
  if (address.includes('°')) {
    return address;
  }

  const addressLower = address.toLowerCase();

  // Check for known neighborhoods
  const allNeighborhoods = [...ADDIS_NEIGHBORHOODS, ...BAHIRDAR_NEIGHBORHOODS];
  for (const neighborhood of allNeighborhoods) {
    if (addressLower.includes(neighborhood.toLowerCase())) {
      return neighborhood;
    }
  }

  // Try to extract from address components
  const parts = address.split(',').map(p => p.trim());

  // Return first meaningful part (usually the street/neighborhood)
  if (parts.length > 0) {
    const firstPart = parts[0];
    // If first part looks like coordinates or code, try next part
    if (firstPart.match(/[A-Z0-9]{3,}\+[A-Z0-9]{2,}/)) {
      if (parts.length > 1) {
        return parts[1];
      }
    }
    return firstPart;
  }

  // Final fallback
  return 'Current Location';
}

/**
 * Get short address (readable format)
 * Shows neighborhood + city
 */
export function getShortAddress(address, lat, lng) {
  if (!address) {
    return detectCityName(lat, lng);
  }

  const neighborhood = extractNeighborhoodName(address, lat, lng);
  const city = detectCityName(lat, lng);

  // If neighborhood is already the full address, just return it
  if (address.includes(neighborhood)) {
    return neighborhood;
  }

  // Return neighborhood + city
  return `${neighborhood}, ${city}`;
}

/**
 * Detect city name from coordinates
 */
export function detectCityName(lat, lng) {
  if (!lat || !lng) return 'Ethiopia';

  const ADDIS_CENTER = { lat: 9.0192, lng: 38.7469 };
  const BAHIRDAR_CENTER = { lat: 11.5955, lng: 37.3944 };

  const distToAddis = Math.hypot(lat - ADDIS_CENTER.lat, lng - ADDIS_CENTER.lng);
  const distToBahirdar = Math.hypot(lat - BAHIRDAR_CENTER.lat, lng - BAHIRDAR_CENTER.lng);

  if (distToAddis < 0.5) {
    return 'Addis Ababa';
  } else if (distToBahirdar < 0.5) {
    return 'Bahir Dar';
  }

  return 'Ethiopia';
}

/**
 * Format address for display in LocationBar
 * Shows just the neighborhood name for clean UI
 */
export function formatLocationBarAddress(address, lat, lng) {
  return extractNeighborhoodName(address, lat, lng);
}
