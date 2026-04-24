import { useState, useEffect } from 'react';
import { searchPlaces, getPlaceDetails } from '../services/location.service';

/**
 * useSearch hook for destination search with debounce
 */
export const useSearch = (currentLat, currentLng) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);

  // Debounce search — wait 300ms after user stops typing
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(query, currentLat, currentLng);
        setSuggestions(results);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, currentLat, currentLng]);

  const selectPlace = async (place) => {
    try {
      setSearching(true);
      const details = await getPlaceDetails(place.placeId);
      if (details) {
        setSelected(details);
        setQuery(place.description || details.address);
        setSuggestions([]);
      }
    } catch (err) {
      console.error('Select place error:', err);
    } finally {
      setSearching(false);
    }
  };

  return { query, setQuery, suggestions, searching, selected, selectPlace };
};
