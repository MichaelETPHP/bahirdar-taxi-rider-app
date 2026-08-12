import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_RECENT = 4;
const MAX_STOPS = 2;

const useLocationStore = create(
  persist(
    (set) => ({
      userCoords: null,
      pickup: null,
      destination: null,
      stops: [],
      recentDestinations: [],
      savedPlaces: { home: null, work: null },

      setUserCoords: (coords) => set({ userCoords: coords }),

      setPickup: (pickup) => set({ pickup }),

      setDestination: (destination) => set({ destination }),

      setSavedPlace: (type, place) =>
        set((state) => ({
          savedPlaces: { ...state.savedPlaces, [type]: place },
        })),

      addStop: () =>
        set((state) => {
          if (state.stops.length >= MAX_STOPS) return state;
          return { stops: [...state.stops, null] };
        }),

      removeStop: (index) =>
        set((state) => {
          const next = [...state.stops];
          next.splice(index, 1);
          return { stops: next };
        }),

      setStop: (index, location) =>
        set((state) => {
          const next = [...state.stops];
          if (index >= 0 && index < next.length) next[index] = location;
          return { stops: next };
        }),

      addToRecentDestination: (location) =>
        set((state) => {
          // Dedup by id AND by normalized name — Google can return a
          // different place id for what's clearly the same real-world spot
          // depending on how it was searched, so id alone under-deduplicates
          // (see searchHistoryService.js, which has the same fix).
          const newNameKey = String(location?.name || '').trim().toLowerCase();
          const filtered = state.recentDestinations.filter((l) => {
            const sameId = l.id === location.id;
            const sameName = newNameKey.length > 0 && String(l?.name || '').trim().toLowerCase() === newNameKey;
            return !sameId && !sameName;
          });
          const updated = [location, ...filtered].slice(0, MAX_RECENT);
          return { recentDestinations: updated };
        }),

      clearDestination: () => set({ destination: null }),

      clearStops: () => set({ stops: [] }),

      clearAll: () =>
        set({
          userCoords: null,
          pickup: null,
          destination: null,
          stops: [],
          recentDestinations: [],
        }),
    }),
    {
      name: 'bahirdar-location-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        recentDestinations: state.recentDestinations,
        savedPlaces: state.savedPlaces,
      }),
    }
  )
);

export default useLocationStore;
