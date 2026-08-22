import Constants from 'expo-constants';

const LIVE_API_URL = 'https://taxiapi.zmichael.click/api/v1';
const LIVE_SOCKET_URL = 'https://taxiapi.zmichael.click';
const LIVE_OSRM_ADDIS_URL = 'https://taxiapi.zmichael.click/osrm/addis';
const LIVE_OSRM_BAHIRDAR_URL = 'https://taxiapi.zmichael.click/osrm/bahirdar';

const isLocalUrl = (value = '') =>
  /^(https?:\/\/)?(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(value);

const productionUrl = (value, fallback) => {
  if (__DEV__) return value || fallback;
  return value && !isLocalUrl(value) ? value : fallback;
};

const rawApiUrl =
  Constants.expoConfig?.extra?.apiUrl ||
  process.env.EXPO_PUBLIC_API_URL || '';

const rawSocketUrl =
  Constants.expoConfig?.extra?.socketUrl ||
  process.env.EXPO_PUBLIC_SOCKET_URL || '';

const rawOsrmAddisUrl =
  Constants.expoConfig?.extra?.osrmAddisUrl ||
  process.env.EXPO_PUBLIC_OSRM_ADDIS_URL || '';

const rawOsrmBahirdarUrl =
  Constants.expoConfig?.extra?.osrmBahirdarUrl ||
  process.env.EXPO_PUBLIC_OSRM_BAHIRDAR_URL || '';

export const env = {
  apiUrl: productionUrl(rawApiUrl, LIVE_API_URL),

  socketUrl: productionUrl(rawSocketUrl, LIVE_SOCKET_URL),

  googleMapsKey:
    Constants.expoConfig?.extra?.googleMapsKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  osrmAddisUrl: productionUrl(rawOsrmAddisUrl, LIVE_OSRM_ADDIS_URL),

  osrmBahirdarUrl: productionUrl(rawOsrmBahirdarUrl, LIVE_OSRM_BAHIRDAR_URL),

  // extra.* first, same reasoning as googleMapsKey above — a real release
  // build (createBundleReleaseJsAndAssets) has twice produced a JS bundle
  // missing these three specific values via the raw process.env.EXPO_PUBLIC_*
  // path alone, despite the vars being correctly exported in the build
  // shell. app.config.js's `extra` block is resolved once at prebuild time
  // and baked into the native Constants blob, immune to that.
  stripePublishableKey:
    Constants.expoConfig?.extra?.stripePublishableKey ||
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',

  googleWebClientId:
    Constants.expoConfig?.extra?.googleWebClientId ||
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',

  googleIosClientId:
    Constants.expoConfig?.extra?.googleIosClientId ||
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
};

if (__DEV__) {
  console.log('=== ENV LOADED ===');
  console.log('API URL:', env.apiUrl);
  console.log('Socket URL:', env.socketUrl);
  console.log('Maps Key:', env.googleMapsKey ? '✅ loaded' : '❌ MISSING');
  console.log('OSRM Addis:', env.osrmAddisUrl);
  console.log('OSRM Bahirdar:', env.osrmBahirdarUrl);
  console.log('==================');
}
