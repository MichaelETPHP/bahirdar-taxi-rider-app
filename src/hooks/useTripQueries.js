import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as tripService from "../services/tripService";
import useAuthStore from "../store/authStore";

/**
 * Hook to get fare estimates for a route.
 */
export function useFareEstimate(pickup, destination) {
  const { token } = useAuthStore();
  
  return useQuery({
    queryKey: ["fare-estimate", pickup?.lat, destination?.lat],
    queryFn: () => 
      tripService.getFareEstimate(
        pickup.lat, 
        pickup.lng, 
        destination.lat, 
        destination.lng, 
        token
      ),
    enabled: !!pickup && !!destination && !!token,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Hook to fetch nearby drivers.
 */
export function useNearbyDrivers(coords, radiusKm = 5) {
  const { token } = useAuthStore();

  return useQuery({
    queryKey: ["drivers-nearby", coords?.latitude, coords?.longitude],
    queryFn: () => 
      tripService.getNearbyDrivers(
        coords.latitude, 
        coords.longitude, 
        radiusKm, 
        token
      ),
    enabled: !!coords && !!token,
    refetchInterval: 10000, // Refresh every 10s
  });
}

/**
 * Mutation hook to create a new trip.
 */
export function useCreateTrip() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body) => tripService.createTrip(body, token),
    onSuccess: (data) => {
      queryClient.setQueryData(["active-trip", data.id], data);
    },
  });
}

/**
 * Mutation hook to cancel a trip.
 */
export function useCancelTrip() {
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ tripId, reason }) => 
      tripService.cancelTrip(tripId, reason, token),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries(["active-trip", tripId]);
    },
  });
}
