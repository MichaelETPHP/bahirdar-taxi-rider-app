import { Alert } from 'react-native';
import useSessionBannerStore from '../store/sessionBannerStore';

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

// Both of these used to be a blocking Alert.alert({ cancelable: false })
// that could pop up over the splash/login screen the instant a stale stored
// token failed to refresh at app boot — before the rider had done anything,
// which read as the app being broken rather than informing them of
// anything. There's also nothing to actually confirm: onLogout() clears the
// session either way and the navigator swaps to Login on its own once
// isAuthenticated flips false.
//
// Order matters here: run the logout FIRST, then show the banner. Showing
// it before onLogout() finishes meant it could appear mid-transition —
// stacked over a still-changing splash/navigation state — before the rider
// had actually landed anywhere. Waiting until the account is truly logged
// out means the banner only ever confirms something that already happened,
// on top of the Login screen it now belongs to.
export async function showSessionExpiredAlert(onLogout) {
  if (_activeSessionAlert) return _activeSessionAlert;

  _activeSessionAlert = (async () => {
    if (onLogout) await onLogout();
    useSessionBannerStore.getState().show('Logged out');
    _activeSessionAlert = null;
    return true;
  })();
  return _activeSessionAlert;
}

export async function showForcedLogoutAlert(onLogout) {
  if (_activeSessionAlert) return _activeSessionAlert;

  _activeSessionAlert = (async () => {
    if (onLogout) await onLogout();
    useSessionBannerStore.getState().show('Logged out — signed in on another device');
    _activeSessionAlert = null;
    return true;
  })();
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
