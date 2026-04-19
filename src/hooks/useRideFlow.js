import { useCallback } from 'react';
import useRideStore from '../store/rideStore';
import useLocationStore from '../store/locationStore';
import { mockDrivers } from '../data/mockDrivers';
import { calculateFare } from '../utils/fareCalculator';
import { haversineDistance, estimateDuration } from '../utils/distanceUtils';

export default function useRideFlow() {
  const { status, selectedRideType, startSearch, assignDriver, startTrip, completeTrip, cancelRide, reset } =
    useRideStore();
  const { userCoords, destination } = useLocationStore();

  const beginSearch = useCallback(() => {
    startSearch();

    setTimeout(() => {
      const randomDriver = mockDrivers[Math.floor(Math.random() * mockDrivers.length)];

      let fare = { min: 35, max: 50 };
      let eta = randomDriver.etaMinutes;

      if (userCoords && destination) {
        const distKm = haversineDistance(
          userCoords.latitude,
          userCoords.longitude,
          destination.lat,
          destination.lng
        );
        const durMin = estimateDuration(distKm);
        fare = calculateFare(selectedRideType, distKm, durMin);
      }

      assignDriver(randomDriver, fare, eta);
    }, 4000);
  }, [startSearch, assignDriver, userCoords, destination, selectedRideType]);

  const beginTrip = useCallback(() => {
    startTrip();
  }, [startTrip]);

  const finishTrip = useCallback(() => {
    completeTrip();
  }, [completeTrip]);

  const cancel = useCallback(() => {
    cancelRide();
  }, [cancelRide]);

  const resetFlow = useCallback(() => {
    reset();
  }, [reset]);

  return { status, beginSearch, beginTrip, finishTrip, cancel, resetFlow };
}
