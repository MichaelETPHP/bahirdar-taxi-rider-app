import { useCallback } from 'react';
import useRideStore from '../store/rideStore';

export default function useRideFlow() {
  const { status, startSearch, assignDriver, startTrip, completeTrip, cancelRide, reset } =
    useRideStore();

  const beginSearch = useCallback(() => {
    startSearch();
  }, [startSearch]);

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
