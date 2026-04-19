import Constants from 'expo-constants';

// In Expo Go: process.env works
// In APK/production: only Constants.expoConfig.extra works
export const env = {
  apiUrl: Constants.expoConfig?.extra?.apiUrl ||
    process.env.EXPO_PUBLIC_API_URL || '',

  socketUrl: Constants.expoConfig?.extra?.socketUrl ||
    process.env.EXPO_PUBLIC_SOCKET_URL || '',

  googleMapsKey: Constants.expoConfig?.extra?.googleMapsKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
};

if (__DEV__) {
  console.log('[ENV] Source:', Constants.expoConfig ? 'Constants.expoConfig' : 'process.env');
  console.log('[ENV] Constants.expoConfig.extra:', Constants.expoConfig?.extra);
  console.log('[ENV] API URL:', env.apiUrl);
  console.log('[ENV] Socket URL:', env.socketUrl);
  console.log('[ENV] Google Maps Key loaded:', !!env.googleMapsKey);
}
