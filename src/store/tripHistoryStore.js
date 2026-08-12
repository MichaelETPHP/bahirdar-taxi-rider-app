import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// How long a cached trip-history list is trusted before RecentTrips.js
// refetches in the background — kept short since trip completion also
// invalidates it directly (see rideStore.setTripStatus), this TTL only
// covers edge cases (e.g. a trip completed from another device/session).
const TTL_MS = 10 * 60 * 1000;

const useTripHistoryStore = create(
  persist(
    (set, get) => ({
      recentTrips: [],
      fetchedAt: null,
      userId: null,
      // Trip ids the rider swiped away from the "recent" list on Home.
      // The trip itself still exists (this only hides it from suggestions),
      // so it's kept separate from recentTrips and persisted independently.
      dismissedTripIds: [],

      setRecentTrips: (trips, userId) => set({ recentTrips: trips, fetchedAt: Date.now(), userId }),

      dismissTrip: (id) => set((state) => (
        state.dismissedTripIds.includes(id)
          ? state
          : { dismissedTripIds: [...state.dismissedTripIds, id] }
      )),

      // Called the moment a trip completes so the freshly-finished trip
      // shows up immediately next time RecentTrips mounts, instead of
      // waiting out the TTL.
      invalidate: () => set({ fetchedAt: null }),

      isFresh: (userId) => {
        const { fetchedAt, userId: cachedUserId } = get();
        if (!fetchedAt || !userId || cachedUserId !== userId) return false;
        return Date.now() - fetchedAt < TTL_MS;
      },
    }),
    {
      name: 'bahirdar-ride-trip-history-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useTripHistoryStore;
