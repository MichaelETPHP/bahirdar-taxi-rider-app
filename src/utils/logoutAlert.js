import { Alert } from 'react-native';

/**
 * Decoupled Logout Alert.
 * Does NOT import authStore.
 */

export async function showSessionExpiredAlert(onLogout) {
  return new Promise((resolve) => {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again.',
      [
        {
          text: 'Log In',
          onPress: async () => {
            if (onLogout) await onLogout();
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
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
