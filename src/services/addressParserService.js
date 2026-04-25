/**
 * Address Parser Service
 * Converts full addresses to readable neighborhood names
 */

// Common neighborhoods in Addis Ababa
const ADDIS_NEIGHBORHOODS = [
  'Bole', 'Kera', 'Piazza', 'Nifas Silk-Lafto', 'Gulale', 'Kazanchis',
  'Yeka', 'Arada', 'Addis Ketema', 'Kolfe Keranio', 'Lideta', 'Kirkos',
  'Akaki Kality', 'Gullele', 'Lemi Kura', 'Finfinne', 'Gerji', 'Belu',
  'Lebu', 'Highland', 'CMC', 'Dembel', 'Medhanialem', 'Sarbet',
  'Bamhauer', 'Ayat', 'Kebena', 'Nolawi', 'Olympia', 'Tulu Dimtu',
  'Megenagna', 'Mexico', 'Haya Hulet', 'Summit', 'Gotera', 'Saris',
  'Jemo', 'Lafto', 'Tuludimtu', 'Torhailoch', 'Wingate', 'Shiromeda',
  'Ferensay', 'Shola', 'Piasa', 'Piassa', 'Urael', 'Atlas', 'Meskel Square',
];

// Common neighborhoods in Bahir Dar
const BAHIRDAR_NEIGHBORHOODS = [
  'Lake Tana', 'Piazza', 'Kebena', 'Sheger', 'Welelo', 'Bahir Dar Town',
  'Tis Abay', 'Alatish', 'Belay Zeleke', 'Seid', 'Meshenti', 'Peda',
  'Addis Alem', 'Dega Damot', 'Sheger Square', 'Shore Road', 'Ginbot 20',
  'Fasilo', 'Zenzelma', 'Tana', 'Biyem', 'Shimbit', 'Gidayer', 'St. George',
  'Papyrus', 'Kuriftu', 'Avanti', 'Dib Anbessa', 'Main Campus',
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
  if (address.includes('°') && address.includes('(')) {
    return address;
  }

  const addressLower = address.toLowerCase();

  // 1. Check for specific neighborhood matches in the list
  const allNeighborhoods = [...ADDIS_NEIGHBORHOODS, ...BAHIRDAR_NEIGHBORHOODS];
  for (const neighborhood of allNeighborhoods) {
    if (addressLower.includes(neighborhood.toLowerCase())) {
      return neighborhood;
    }
  }

  // 2. Extract from address components (comma separated)
  const parts = address.split(',').map(p => p.trim());

  if (parts.length > 0) {
    // If the first part is a plus code or generic, skip it
    let candidate = parts[0];
    
    // Check if candidate is a Plus Code (e.g., "2PCX+V6 Addis Ababa")
    if (candidate.match(/[A-Z0-9]{4,}\+[A-Z0-9]{2,}/)) {
      if (parts.length > 1) {
        candidate = parts[1];
      }
    }

    // If candidate is just "Addis Ababa" or "Bahir Dar", try to find something better in parts[1]
    const genericNames = ['addis ababa', 'bahir dar', 'ethiopia', 'unnamed road'];
    if (genericNames.includes(candidate.toLowerCase()) && parts.length > 1) {
      candidate = parts[1];
    }

    return candidate;
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
