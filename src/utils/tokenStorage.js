import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCESS_KEY = 'rider_access_token';
const REFRESH_KEY = 'rider_refresh_token';

export async function saveTokens(accessToken, refreshToken) {
  const pairs = [];
  if (accessToken) pairs.push([ACCESS_KEY, accessToken]);
  if (refreshToken) pairs.push([REFRESH_KEY, refreshToken]);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}

export async function getTokens() {
  const [[, accessToken], [, refreshToken]] = await AsyncStorage.multiGet([
    ACCESS_KEY,
    REFRESH_KEY,
  ]);
  return { accessToken, refreshToken };
}

export async function clearTokens() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}
