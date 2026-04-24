/**
 * Search History Service
 * Saves and retrieves user's search history for quick access
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 20; // Keep last 20 searches

export async function saveSearchPlace(place) {
  try {
    if (!place || !place.placeId) {
      console.warn('⚠️  Invalid place for history');
      return;
    }

    const history = await getSearchHistory();

    // Remove duplicates (if same place was searched before, move it to top)
    const filtered = history.filter(p => p.placeId !== place.placeId);

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
