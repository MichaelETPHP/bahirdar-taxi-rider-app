import {
  GoogleSignin,
  isErrorWithCode,
  isCancelledResponse,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';

export function isGoogleSignInConfigured() {
  return WEB_CLIENT_ID.length > 0;
}

export function configureGoogleSignIn() {
  if (!isGoogleSignInConfigured()) return;
  GoogleSignin.configure({
    webClientId: WEB_CLIENT_ID,
    // iOS has no equivalent of Android's Play-Services-backed client lookup —
    // the native SDK requires its own client ID or it throws at configure()-time.
    iosClientId: IOS_CLIENT_ID || undefined,
    offlineAccess: false,
  });
}

/**
 * Resolves to { idToken, name, email, photo } on success, or null if the
 * user backed out of the picker — callers only need to surface an error for
 * everything else.
 */
export async function signInWithGoogle() {
  if (!isGoogleSignInConfigured()) {
    throw new Error('Google Sign-In is not configured yet.');
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  if (isCancelledResponse(response) || !isSuccessResponse(response)) {
    return null;
  }

  const { idToken, user } = response.data;
  if (!idToken) {
    throw new Error('Google did not return an ID token.');
  }

  return {
    idToken,
    name: user.name || [user.givenName, user.familyName].filter(Boolean).join(' '),
    email: user.email || '',
    photo: user.photo || '',
  };
}

export function googleSignInErrorMessage(error) {
  if (isErrorWithCode(error)) {
    switch (error.code) {
      case statusCodes.IN_PROGRESS:
        return 'A Google sign-in is already in progress.';
      case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
        return 'Google Play Services is not available on this device.';
      default:
        return error.message || 'Google sign-in failed.';
    }
  }
  return error?.message || 'Google sign-in failed.';
}
