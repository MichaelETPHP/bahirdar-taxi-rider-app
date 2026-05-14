import { useCallback } from 'react';
import useRideStore from '../store/rideStore';
import { mockDrivers } from '../data/mockDrivers';

export default function useRideFlow() {
  const { status, startSearch, assignDriver, startTrip, completeTrip, cancelRide, reset } =
    useRideStore();

  const beginSearch = useCallback(() => {
    startSearch();

    setTimeout(() => {
      const randomDriver = mockDrivers[Math.floor(Math.random() * mockDrivers.length)];

      let fare = null;
      let eta = randomDriver.etaMinutes;

      assignDriver(randomDriver, fare, eta);
    }, 4000);
  }, [startSearch, assignDriver]);

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
