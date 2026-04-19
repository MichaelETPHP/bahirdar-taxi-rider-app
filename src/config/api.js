import { env } from './env';

export const GOOGLE_MAPS_KEY = env.googleMapsKey;
export const API_BASE_URL = env.apiUrl;
export const SOCKET_URL = env.socketUrl ||
  (env.apiUrl ? env.apiUrl.replace('/api/v1', '') : '');

if (__DEV__) {
  console.log('[API] Base URL:', API_BASE_URL);
  console.log('[API] Socket URL:', SOCKET_URL);
}
