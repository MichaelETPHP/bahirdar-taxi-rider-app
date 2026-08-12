/**
 * Search History Service
 * Saves and retrieves user's search history for quick access
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 20; // Keep last 20 searches

// Normalized name, used as a fallback dedup key alongside placeId. Google can
// return a different placeId for what's clearly the same real-world spot
// depending on how it was searched (POI name vs. exact address vs. a nearby
// road), so placeId alone under-deduplicates — two searches for "Bahir Dar
// Stadium" can resolve to different IDs but should still collapse to one
// history entry.
function nameKey(place) {
  return String(place?.name || '').trim().toLowerCase();
}

export async function saveSearchPlace(place) {
  try {
    if (!place || !place.placeId) {
      console.warn('⚠️  Invalid place for history');
      return;
    }

    const history = await getSearchHistory();
    const newNameKey = nameKey(place);

    // Remove duplicates (if the same place was searched before — by placeId
    // or by matching name — move it to top instead of listing it again)
    const filtered = history.filter((p) => {
      const samePlace = p.placeId === place.placeId;
      const sameName = newNameKey.length > 0 && nameKey(p) === newNameKey;
      return !samePlace && !sameName;
    });

    // Add new search at beginning
    const updated = [place, ...filtered].slice(0, MAX_HISTORY);

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    console.log('📍 Search saved to history:', place.name);
  } catch (error) {
    console.error('❌ Failed to save search history:', error.message);
  }
}

export async function getSearchHistory() {
  try {
    const data = await AsyncStorage.getItem(HISTORY_KEY);
    if (!data) {
      return [];
    }

    const history = JSON.parse(data);
    console.log('📍 Loaded', history.length, 'search history items');
    return history;
  } catch (error) {
    console.error('❌ Failed to load search history:', error.message);
    return [];
  }
}

export async function clearSearchHistory() {
  try {
    await AsyncStorage.removeItem(HISTORY_KEY);
    console.log('✅ Search history cleared');
  } catch (error) {
    console.error('❌ Failed to clear search history:', error.message);
  }
}

export async function removeFromHistory(placeId) {
  try {
    const history = await getSearchHistory();
    const updated = history.filter(p => p.placeId !== placeId);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    console.log('📍 Removed from history:', placeId);
  } catch (error) {
    console.error('❌ Failed to remove from history:', error.message);
  }
}
