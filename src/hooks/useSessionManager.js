import { useEffect } from 'react';
import { AppState } from 'react-native';
import useAuthStore from '../store/authStore';

/**
 * Hook to manage session lifecycle
 * - Updates activity timestamp when app comes to foreground
 * - Validates session and auto-logout if expired
 * - Handles token refresh before expiry
 */
export function useSessionManager() {
  useEffect(() => {
    let appStateSubscription;

    const handleAppStateChange = async (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground - update activity and validate session
        const isAuthenticated = useAuthStore.getState().isAuthenticated;

        if (isAuthenticated) {
          await useAuthStore.getState().updateActivity();
          const isValid = await useAuthStore.getState().validateSession();

          if (!isValid) {
            console.log('Session expired - user logged out');
          }
        }
      }
    };

    appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (appStateSubscription) {
        appStateSubscription.remove();
      }
    };
  }, []);
}

export default useSessionManager;
