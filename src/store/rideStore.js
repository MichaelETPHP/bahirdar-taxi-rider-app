import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fetchVehicleCategories } from '../services/authService';
import { getFareEstimate } from '../services/tripService';

const useRideStore = create(
  persist(
    (set, get) => ({
  // ── Vehicle categories ──────────────────────────────
  selectedRideType: 'economy',
  categories: [],
  categoriesLoading: false,
  categoriesLoaded: false,
  selectedCategoryId: null,

  // ── Fare estimates from /geo/fare-estimate ──────────
  // Array of { vehicle_category, estimated_fare_etb, cancellation_fee_etb }
  fareEstimates: [],
  fareEstimateLoading: false,
  routeInfo: null, // { distance_km, duration_min, surge_multiplier }

  selectRideType: (rideType) => set({ selectedRideType: rideType }),
  selectCategory: (categoryId) => set({ selectedCategoryId: categoryId }),

  loadFareEstimates: async (fromLat, fromLng, toLat, toLng, token) => {
    if (!fromLat || !fromLng || !toLat || !toLng) return;
    set({ fareEstimateLoading: true });
    try {
      const res = await getFareEstimate(fromLat, fromLng, toLat, toLng, token);
      const data = res?.data ?? res;
      set({
        fareEstimates: data?.estimates ?? [],
        routeInfo: {
          distance_km:      data?.distance_km ?? 0,
          duration_min:     data?.duration_min ?? 0,
          surge_multiplier: data?.surge_multiplier ?? 1,
        },
      });
    } catch (_) {
      // silently fail — cards fall back to client calc
    } finally {
      set({ fareEstimateLoading: false });
    }
  },

  loadCategories: async () => {
    const hasData = get().categories.length > 0;
    
    // If we have data, we don't show the loading spinner (Silent Refetch)
    // If no data, we show the initial loader
    if (!hasData) {
      set({ categoriesLoading: true });
    }

    try {
      const res = await fetchVehicleCategories();
      const cats = res?.data?.categories;
      if (cats && cats.length > 0) {
        set((s) => {
          const keep =
            s.selectedCategoryId != null && cats.some((c) => c.id === s.selectedCategoryId);
          return {
            categories: cats,
            categoriesLoaded: true,
            categoriesLoading: false,
            selectedCategoryId: keep ? s.selectedCategoryId : cats[0].id,
          };
        });
      } else {
        set({ categoriesLoading: false });
      }
    } catch (_) {
      set({ categoriesLoading: false });
    }
  },

  // ── Active trip ─────────────────────────────────────
  tripId: null,
  tripData: null,          // full trip object from POST /trips response
  tripStatus: 'idle',      // idle | searching | matched | driver_arrived | in_progress | completed | cancelled
  tripStartTime: null,
  finalFare: null,

  // ── Matched driver ───────────────────────────────────
  driver: null,            // { id, name, phone, photoUrl, rating, totalTrips, distanceKm, etaMinutes, vehicle }
  driverLocation: null,    // { lat, lng, heading, speed_kmh }

  setTripData: (trip) => {
    if (!trip?.id) {
      console.error('setTripData called with trip missing id:', trip);
      throw new Error('Trip must have an id');
    }
    set({ tripId: trip.id, tripData: trip });
  },

  mergeTripData: (partial) =>
    set((s) => (partial && s.tripData ? { tripData: { ...s.tripData, ...partial } } : {})),

  setDriver: (driver) => set({ driver }),

  setDriverLocation: (loc) => set({ driverLocation: loc }),

  setTripStatus: (status) => set({ tripStatus: status }),

  setFinalFare: (fare) => set({ finalFare: fare }),

  resetTrip: () =>
    set({
      tripId: null,
      tripData: null,
      tripStatus: 'idle',
      tripStartTime: null,
      finalFare: null,
      driver: null,
      driverLocation: null,
      fareEstimates: [],
      routeInfo: null,
    }),

  // ── Legacy helpers (kept for backwards compat) ───────
  status: 'idle',
  assignedDriver: null,
  estimatedFare: null,
  estimatedETA: null,

  startSearch: () => set({ status: 'searching', tripStatus: 'searching' }),

  assignDriver: (driver, fare, eta) =>
    set({ status: 'matched', tripStatus: 'matched', assignedDriver: driver, estimatedFare: fare, estimatedETA: eta }),

  startTrip: () => set({ status: 'active', tripStatus: 'in_progress', tripStartTime: Date.now() }),

  completeTrip: () => set({ status: 'complete', tripStatus: 'completed' }),

  cancelRide: () =>
    set({ status: 'idle', tripStatus: 'idle', assignedDriver: null, estimatedFare: null, estimatedETA: null }),

  reset: () =>
    set({
      selectedRideType: 'economy',
      status: 'idle',
      tripStatus: 'idle',
      assignedDriver: null,
      estimatedFare: null,
      estimatedETA: null,
      tripStartTime: null,
      tripId: null,
      tripData: null,
      driver: null,
      driverLocation: null,
      finalFare: null,
      fareEstimates: [],
      routeInfo: null,
    }),
}),
    {
      name: 'bahirdar-ride-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedCategoryId: state.selectedCategoryId,
        selectedRideType: state.selectedRideType,
        categories: state.categories,
        categoriesLoaded: state.categoriesLoaded,
      }),
    }
  )
);

export default useRideStore;
