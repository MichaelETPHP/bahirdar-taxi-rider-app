import * as Location from 'expo-location';

export async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function requestBackgroundLocationPermission() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

export async function checkLocationPermission() {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
}

export default {
  requestLocationPermission,
  requestBackgroundLocationPermission,
  checkLocationPermission,
};
