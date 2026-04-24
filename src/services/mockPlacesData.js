/**
 * Mock Places Data - Fallback when Google API fails
 * Provides instant search results without needing API key
 */

export const ADDIS_ABABA_PLACES = [
  // Landmarks & Attractions
  { id: 'a1', name: 'National Museum of Ethiopia', address: 'Addis Ababa', lat: 9.0334, lng: 38.7469, category: 'landmark' },
  { id: 'a2', name: 'Holy Trinity Cathedral', address: 'Addis Ababa', lat: 9.0385, lng: 38.7513, category: 'landmark' },
  { id: 'a3', name: 'Addis Ababa City Hall', address: 'Piazza, Addis Ababa', lat: 9.0312, lng: 38.7469, category: 'landmark' },

  // Hotels & Lodging
  { id: 'a4', name: 'Sheraton Addis', address: 'Addis Ababa', lat: 9.0267, lng: 38.7577, category: 'hotel' },
  { id: 'a5', name: 'Hilton Addis Ababa', address: 'Menelik II Avenue', lat: 9.0192, lng: 38.7469, category: 'hotel' },
  { id: 'a6', name: 'Radisson Blu Hotel', address: 'Addis Ababa', lat: 9.0350, lng: 38.7450, category: 'hotel' },
  { id: 'a7', name: 'Desalegn Hotel', address: 'Bole Road, Addis Ababa', lat: 8.9918, lng: 38.7853, category: 'hotel' },

  // Shopping Malls
  { id: 'a8', name: 'Bole Olympia Mall', address: 'Bole, Addis Ababa', lat: 8.9900, lng: 38.7850, category: 'shopping' },
  { id: 'a9', name: 'Unity Mall', address: 'Kazanchis, Addis Ababa', lat: 9.0300, lng: 38.7750, category: 'shopping' },
  { id: 'a10', name: 'CMC Mall', address: 'Addis Ababa', lat: 9.0400, lng: 38.7550, category: 'shopping' },

  // Restaurants & Cafes
  { id: 'a11', name: 'Addis Red Sea Restaurant', address: 'Bole Road', lat: 8.9950, lng: 38.7900, category: 'restaurant' },
  { id: 'a12', name: 'Fasika Cafe', address: 'Piazza, Addis Ababa', lat: 9.0312, lng: 38.7469, category: 'restaurant' },
  { id: 'a13', name: 'Cosy Place Cafe', address: 'Bole, Addis Ababa', lat: 8.9920, lng: 38.7880, category: 'restaurant' },

  // Hospitals & Medical
  { id: 'a14', name: 'Addis Ababa Medical College', address: 'Addis Ababa', lat: 9.0400, lng: 38.7400, category: 'hospital' },
  { id: 'a15', name: 'St. Paul Hospital', address: 'Addis Ababa', lat: 9.0300, lng: 38.7600, category: 'hospital' },

  // Stadiums & Sports
  { id: 'a16', name: 'Addis Ababa Stadium', address: 'Addis Ababa', lat: 9.0150, lng: 38.7800, category: 'sports' },

  // Transportation
  { id: 'a17', name: 'Addis Ababa Bole Airport', address: 'Bole, Addis Ababa', lat: 9.0330, lng: 38.7994, category: 'transport' },
  { id: 'a18', name: 'Addis Ababa Bus Station', address: 'Addis Ababa', lat: 9.0200, lng: 38.7300, category: 'transport' },
];

export const BAHIR_DAR_PLACES = [
  // Landmarks & Attractions
  { id: 'b1', name: 'Lake Tana Pier', address: 'Bahir Dar', lat: 11.5994, lng: 37.3892, category: 'landmark' },
  { id: 'b2', name: 'Blue Nile Falls', address: 'Tis Abay, Bahir Dar', lat: 11.4851, lng: 37.5879, category: 'landmark' },
  { id: 'b3', name: 'St. George Church', address: 'Piazza, Bahir Dar', lat: 11.6054, lng: 37.3850, category: 'landmark' },
  { id: 'b4', name: 'Bahir Dar Museum', address: 'Bahir Dar', lat: 11.5936, lng: 37.3906, category: 'landmark' },

  // Hotels & Lodging
  { id: 'b5', name: 'Ghion Hotel', address: 'Shore Road, Bahir Dar', lat: 11.6012, lng: 37.3876, category: 'hotel' },
  { id: 'b6', name: 'Kuriftu Resort', address: 'Bahir Dar', lat: 11.6100, lng: 37.3800, category: 'hotel' },
  { id: 'b7', name: 'Tana Hotel', address: 'Bahir Dar', lat: 11.5950, lng: 37.3920, category: 'hotel' },
  { id: 'b8', name: 'Carina Hotel', address: 'Bahir Dar', lat: 11.5900, lng: 37.3850, category: 'hotel' },

  // Hospitals & Medical
  { id: 'b9', name: 'Felege Hiwot Hospital', address: 'Hospital Road, Bahir Dar', lat: 11.5912, lng: 37.3915, category: 'hospital' },
  { id: 'b10', name: 'Bahir Dar Health Center', address: 'Bahir Dar', lat: 11.5936, lng: 37.3906, category: 'hospital' },

  // Shopping
  { id: 'b11', name: 'Bahir Dar Market', address: 'Downtown Bahir Dar', lat: 11.5900, lng: 37.3800, category: 'shopping' },

  // Restaurants
  { id: 'b12', name: 'Shore Restaurant', address: 'Lake Tana, Bahir Dar', lat: 11.6000, lng: 37.3900, category: 'restaurant' },
  { id: 'b13', name: 'Blue Nile Cafe', address: 'Bahir Dar', lat: 11.5950, lng: 37.3850, category: 'restaurant' },

  // University
  { id: 'b14', name: 'Bahir Dar University', address: 'Peda Campus, Bahir Dar', lat: 11.5833, lng: 37.3833, category: 'education' },

  // Transportation
  { id: 'b15', name: 'Bahir Dar Airport', address: 'Ginbot 20, Bahir Dar', lat: 11.6033, lng: 37.3167, category: 'transport' },
];

/**
 * Search through mock places
 * Used when Google API fails
 */
export function searchMockPlaces(query, lat, lng) {
  if (!query || query.trim().length < 1) {
    return [];
  }

  const searchTerm = query.toLowerCase();

  // Determine which city to search based on coordinates
  let places = ADDIS_ABABA_PLACES;

  if (lat && lng) {
    // Check if closer to Bahir Dar
    const BAHIRDAR = { lat: 11.5955, lng: 37.3944 };
    const ADDIS = { lat: 9.0192, lng: 38.7469 };

    const distToBahirdar = Math.hypot(lat - BAHIRDAR.lat, lng - BAHIRDAR.lng);
    const distToAddis = Math.hypot(lat - ADDIS.lat, lng - ADDIS.lng);

    places = distToBahirdar < distToAddis ? BAHIR_DAR_PLACES : ADDIS_ABABA_PLACES;
  }

  // Search in name and address
  const results = places.filter(
    (place) =>
      place.name.toLowerCase().includes(searchTerm) ||
      place.address.toLowerCase().includes(searchTerm)
  );

  // Map to same format as Google API
  return results.map((place) => ({
    placeId: place.id,
    mainText: place.name,
    secondaryText: place.address,
    description: `${place.name}, ${place.address}`,
    lat: place.lat,
    lng: place.lng,
    category: place.category,
  }));
}

/**
 * Get all places for a category
 */
export function getPlacesByCategory(category, lat, lng) {
  // Determine city
  let places = ADDIS_ABABA_PLACES;

  if (lat && lng) {
    const BAHIRDAR = { lat: 11.5955, lng: 37.3944 };
    const ADDIS = { lat: 9.0192, lng: 38.7469 };

    const distToBahirdar = Math.hypot(lat - BAHIRDAR.lat, lng - BAHIRDAR.lng);
    const distToAddis = Math.hypot(lat - ADDIS.lat, lng - ADDIS.lng);

    places = distToBahirdar < distToAddis ? BAHIR_DAR_PLACES : ADDIS_ABABA_PLACES;
  }

  return places
    .filter((place) => place.category === category)
    .map((place) => ({
      placeId: place.id,
      mainText: place.name,
      secondaryText: place.address,
      description: `${place.name}, ${place.address}`,
      lat: place.lat,
      lng: place.lng,
      category: place.category,
    }));
}

/**
 * Get popular places for current city
 */
export function getPopularPlaces(lat, lng) {
  // Determine city
  let places = ADDIS_ABABA_PLACES;

  if (lat && lng) {
    const BAHIRDAR = { lat: 11.5955, lng: 37.3944 };
    const ADDIS = { lat: 9.0192, lng: 38.7469 };

    const distToBahirdar = Math.hypot(lat - BAHIRDAR.lat, lng - BAHIRDAR.lng);
    const distToAddis = Math.hypot(lat - ADDIS.lat, lng - ADDIS.lng);

    places = distToBahirdar < distToAddis ? BAHIR_DAR_PLACES : ADDIS_ABABA_PLACES;
  }

  return places
    .slice(0, 8)
    .map((place) => ({
      placeId: place.id,
      mainText: place.name,
      secondaryText: place.address,
      description: `${place.name}, ${place.address}`,
      lat: place.lat,
      lng: place.lng,
      category: place.category,
    }));
}
