import * as AppleAuthentication from 'expo-apple-authentication';

/**
 * iOS-only — expo-apple-authentication resolves isAvailableAsync() to false
 * on Android (no native module there), so the caller can just hide/disable
 * the button rather than needing a Platform.OS check of its own.
 */
export async function isAppleSignInAvailable() {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Resolves to { identityToken, fullName } on success, or null if the user
 * cancelled the system sheet — callers only need to surface an error for
 * everything else. `fullName` is a joined "Given Family" string and is only
 * ever non-empty on this Apple ID's very first authorization on this app —
 * every later sign-in gets fullName: null from Apple itself, by design.
 */
export async function signInWithApple() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple did not return an identity token.');
    }

    const fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      identityToken: credential.identityToken,
      fullName: fullName || null,
    };
  } catch (err) {
    if (err.code === 'ERR_REQUEST_CANCELED') return null;
    throw err;
  }
}

export function appleSignInErrorMessage(error) {
  return error?.message || 'Apple sign-in failed.';
}
