import Constants from 'expo-constants';

export const env = {
  apiUrl:
    Constants.expoConfig?.extra?.apiUrl ||
    process.env.EXPO_PUBLIC_API_URL || '',

  socketUrl:
    Constants.expoConfig?.extra?.socketUrl ||
    process.env.EXPO_PUBLIC_SOCKET_URL || '',

  googleMapsKey:
    Constants.expoConfig?.extra?.googleMapsKey ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',

  osrmAddisUrl:
    Constants.expoConfig?.extra?.osrmAddisUrl ||
    process.env.EXPO_PUBLIC_OSRM_ADDIS_URL || '',

  osrmBahirdarUrl:
    Constants.expoConfig?.extra?.osrmBahirdarUrl ||
    process.env.EXPO_PUBLIC_OSRM_BAHIRDAR_URL || '',
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
