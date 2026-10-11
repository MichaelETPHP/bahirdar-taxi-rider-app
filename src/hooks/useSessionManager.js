import { useEffect } from 'react';
import { AppState } from 'react-native';
import useAuthStore from '../store/authStore';
import { getSessionStatus, updateLastActivity } from '../utils/sessionManager';

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
        const auth = useAuthStore.getState();
        if (!auth.isAuthenticated) return;

        try {
          const session = await getSessionStatus();
          if (session.status === 'no_session') {
            await useAuthStore.getState().logout({ revokeSession: false });
            return;
          }
          if (session.status === 'active') await updateLastActivity();
        } catch (error) {
          if (__DEV__) console.warn('[Auth] Session check deferred:', error?.message ?? error);
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
