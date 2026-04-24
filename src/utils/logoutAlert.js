import { Alert } from 'react-native';
import useAuthStore from '../store/authStore';

/**
 * Show logout alert when session expires or auth fails
 */
export async function showSessionExpiredAlert() {
  return new Promise((resolve) => {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again.',
      [
        {
          text: 'Log In',
          onPress: async () => {
            await useAuthStore.getState().logout();
            resolve(true);
          },
        },
      ],
      { cancelable: false }
    );
  });
}

/**
 * Show error alert for auth failures
 */
export function showAuthErrorAlert(message = 'Authentication failed') {
  Alert.alert(
    'Authentication Error',
    message,
    [
      {
        text: 'Try Again',
        onPress: () => {
          // User can retry login
        },
      },
      {
        text: 'Log Out',
        onPress: async () => {
          await useAuthStore.getState().logout();
        },
        style: 'destructive',
      },
    ]
  );
}
