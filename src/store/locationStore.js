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

      setUserCoords: (coords) => set({ userCoords: coords }),

      setPickup: (pickup) => set({ pickup }),

      setDestination: (destination) => set({ destination }),

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
          const filtered = state.recentDestinations.filter((l) => l.id !== location.id);
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
      }),
    }
  )
);

export default useLocationStore;
