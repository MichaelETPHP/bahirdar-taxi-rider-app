import Constants from 'expo-constants';
import { env } from '../config/env';

/**
 * Diagnostic check for API key loading in production APK.
 * Call this at app startup to verify the key is available.
 */
export function diagnosticCheckApiKey() {
  const result = {
    constantsExtra: Constants.expoConfig?.extra?.googleMapsKey,
    envKey: env.googleMapsKey,
    isLoaded: !!env.googleMapsKey,
    source: Constants.expoConfig?.extra?.googleMapsKey ? 'Constants.expoConfig' : 'process.env',
    preview: env.googleMapsKey ? env.googleMapsKey.substring(0, 20) + '...' : 'NOT_LOADED',
  };

  if (__DEV__) {
    console.log('[DIAGNOSTIC] API Key Status:', result);
  }

  // Return object for UI display if needed
  return result;
}

/**
 * Full diagnostic report including environment, APIs, and configuration.
 */
export function fullDiagnosticReport() {
  const report = {
    platform: Constants.platform?.ios ? 'iOS' : 'Android',
    appVersion: Constants.expoConfig?.version,
    manifest: Constants.expoConfig ? 'embedded' : 'expo-go',
    apiKey: diagnosticCheckApiKey(),
    apis: {
      placesApi: 'Check Google Cloud Console',
      geocodingApi: 'Check Google Cloud Console',
      directionsApi: 'Check Google Cloud Console',
      mapsJsApi: 'Check Google Cloud Console',
    },
    billing: 'Check Google Cloud Console > Billing',
  };

  if (__DEV__) {
    console.log('[DIAGNOSTIC] Full Report:', report);
  }

  return report;
}
