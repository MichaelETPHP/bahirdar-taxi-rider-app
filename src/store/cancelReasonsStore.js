import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

// Cancel reasons are admin-defined config, not activity data — they almost
// never change, so unlike trip history this uses a long TTL (24h) rather
// than event-driven invalidation. Persisted so a cold app launch still
// shows the cached list instantly, before any network round-trip.
const TTL_MS = 24 * 60 * 60 * 1000;

const useCancelReasonsStore = create(
  persist(
    (set, get) => ({
      reasons: [],
      fetchedAt: null,

      setReasons: (reasons) => set({ reasons, fetchedAt: Date.now() }),

      isStale: () => {
        const { fetchedAt } = get();
        if (!fetchedAt) return true;
        return Date.now() - fetchedAt >= TTL_MS;
      },
    }),
    {
      name: 'bahirdar-ride-cancel-reasons-v1',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

export default useCancelReasonsStore;
