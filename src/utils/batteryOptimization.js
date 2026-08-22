/**
 * Requests exemption from Android's per-app battery optimization (Doze /
 * App Standby). Android throttles background execution — including FCM data
 * message handling — for apps it decides haven't been "recently used", which
 * is a well-documented, common cause of a killed app simply never waking for
 * an incoming-call push at all, independent of anything in this app's own
 * JS or backend. Real-device testing (Samsung, locked screen, app fully
 * killed) showed exactly this symptom.
 *
 * Android-only; iOS has no equivalent concept (background call delivery
 * there is PushKit's job, a separate, not-yet-built phase — see
 * callKeepService.js's file header).
 */
import { Platform, Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ASKED_KEY = 'bahiran:batteryOptimizationAsked';
const ANDROID_PACKAGE = 'com.bahirdar.rider';

/**
 * Shows a plain-language explanation BEFORE the system dialog — jumping
 * straight to an unexplained Android settings screen reads as suspicious/
 * confusing, same reasoning as the existing location-permission disclosure
 * flow elsewhere in this app. Asks at most once per install; if the rider
 * declines, this doesn't ask again (respects their choice rather than
 * nagging — they can still enable it manually in system settings later).
 */
export async function requestBatteryOptimizationExemptionOnce() {
  if (Platform.OS !== 'android') return;
  try {
    const alreadyAsked = await AsyncStorage.getItem(ASKED_KEY);
    if (alreadyAsked) return;
    await AsyncStorage.setItem(ASKED_KEY, '1');
  } catch (_) {
    return;
  }

  Alert.alert(
    'Keep calls reliable',
    "To make sure you don't miss calls from your driver or support when the app is closed, please allow Bahiran Ride to run in the background on the next screen.",
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => {
          IntentLauncher.startActivityAsync(
            IntentLauncher.ActivityAction.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            { data: `package:${ANDROID_PACKAGE}` }
          ).catch(() => {});
        },
      },
    ]
  );
}
