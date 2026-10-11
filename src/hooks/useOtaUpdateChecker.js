import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Updates from 'expo-updates';

export default function useOtaUpdateChecker(enabled = true) {
  useEffect(() => {
    if (!enabled || __DEV__ || !Updates.isEnabled) return undefined;

    let disposed = false;
    let checking = false;
    let lastAttempt = 0;

    const checkForUpdate = async () => {
      if (disposed || checking || AppState.currentState !== 'active' || Date.now() - lastAttempt < 60_000) return;
      checking = true;
      lastAttempt = Date.now();
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!disposed && result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // Keep the last known-good bundle and retry on foreground or reconnect.
      } finally {
        checking = false;
      }
    };

    void checkForUpdate();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkForUpdate();
    });
    const network = NetInfo.addEventListener((state) => {
      if (state.isInternetReachable === true) void checkForUpdate();
    });

    return () => {
      disposed = true;
      appState.remove();
      network();
    };
  }, [enabled]);
}
