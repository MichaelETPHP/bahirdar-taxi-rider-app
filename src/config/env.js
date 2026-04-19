import Constants from 'expo-constants';

export const env = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ||
    Constants.expoConfig?.extra?.apiUrl || '',

  socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL ||
    Constants.expoConfig?.extra?.socketUrl || '',

  gebetaKey: process.env.EXPO_PUBLIC_GEBETA_MAPS_API_KEY ||
    Constants.expoConfig?.extra?.gebetaMapsKey || '',
};

if (__DEV__) {
  console.log('[ENV] API:', env.apiUrl);
  console.log('[ENV] Socket:', env.socketUrl);
  console.log('[ENV] Gebeta loaded:', !!env.gebetaKey);
}