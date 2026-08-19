import { Alert } from 'react-native';

/**
 * Decoupled Logout Alert.
 * Does NOT import authStore.
 */

// Several API calls can fail with 401 around the same moment (e.g. profile +
// wallet + active-trip all in flight together at app launch with a stale
// token) — each one independently reaching this module used to pop its own
// native Alert, stacking duplicate "Session Expired" dialogs the user had to
// dismiss one by one. This tracks whichever alert is currently on screen so
// every call while one is already showing just waits on that SAME promise
// instead of spawning another dialog.
let _activeSessionAlert = null;

export async function showSessionExpiredAlert(onLogout) {
  if (_activeSessionAlert) return _activeSessionAlert;

  _activeSessionAlert = new Promise((resolve) => {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again.',
      [
        {
          text: 'Log In',
          onPress: async () => {
            if (onLogout) await onLogout();
            _activeSessionAlert = null;
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
  return _activeSessionAlert;
}

export async function showForcedLogoutAlert(onLogout) {
  if (_activeSessionAlert) return _activeSessionAlert;

  _activeSessionAlert = new Promise((resolve) => {
    Alert.alert(
      'Signed Out',
      'Your account was signed in on another device. You have been logged out.',
      [
        {
          text: 'OK',
          onPress: async () => {
            if (onLogout) await onLogout();
            _activeSessionAlert = null;
            resolve(true);
          },
        },
      ],
      { cancelable: false },
    );
  });
  return _activeSessionAlert;
}

export function showAuthErrorAlert(message = 'Authentication failed', onLogout) {
  Alert.alert(
    'Authentication Error',
    message,
    [
      {
        text: 'Try Again',
        onPress: () => {},
      },
      {
        text: 'Log Out',
        onPress: async () => {
          if (onLogout) await onLogout();
        },
        style: 'destructive',
      },
    ]
  );
}
