/**
 * notifee-backed full-screen call notification — pulled into its own module
 * (not backgroundCallTask.js or callKeepService.js) specifically so both of
 * those can use it without importing each other: backgroundCallTask.js posts
 * it when a call push arrives, callKeepService.js clears it once the call
 * stops being 'incoming' (answered/declined/ended/missed), and neither
 * needs to depend on the other to do that.
 */
import { Platform } from 'react-native';

const CALL_NOTIFICATION_CHANNEL_ID = 'call-invites-v1';

function callNotificationId(tripId) {
  return `call-${tripId}`;
}

// notifee constructs native bridges at import time the same way
// react-native-callkeep does (see callKeepService.js) — deferring the
// require() until actually needed avoids a hard crash on any installed
// build/OTA combo that predates this native module being linked.
function getNotifee() {
  if (Platform.OS !== 'android') return null;
  try {
    return require('@notifee/react-native');
  } catch (err) {
    console.warn('[CallNotification] @notifee/react-native not available:', err?.message ?? err);
    return null;
  }
}

/**
 * Posts a real Android full-screen call notification (category: CALL +
 * fullScreenAction) — this is what actually launches the app straight to
 * the ring screen, over the lock screen, WITHOUT the rider tapping anything
 * first. Needs android.permission.USE_FULL_SCREEN_INTENT (declared in
 * app.config.js); some OEMs (Samsung included) may still require the rider
 * to grant it once via Settings, which no code can bypass — that's OS
 * policy, not a bug here.
 */
export async function showFullScreenCallNotification({ tripId, peerName }) {
  const notifeeModule = getNotifee();
  if (!notifeeModule) return;
  try {
    const notifee = notifeeModule.default;
    const { AndroidCategory, AndroidImportance, AndroidVisibility } = notifeeModule;
    const channelId = await notifee.createChannel({
      id: CALL_NOTIFICATION_CHANNEL_ID,
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
      vibration: true,
      vibrationPattern: [0, 300, 200, 300],
    });

    await notifee.displayNotification({
      id: callNotificationId(tripId),
      title: `Incoming call — ${peerName}`,
      body: 'Tap to answer',
      android: {
        channelId,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        ongoing: true,
        autoCancel: false,
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  } catch (err) {
    console.warn('[CallNotification] showFullScreenCallNotification failed:', err?.message ?? err);
  }
}

/** Clears the full-screen call notification once the call is no longer
 * ringing — called from callKeepService.js's store subscription, the one
 * place that already tracks every way a call can stop being 'incoming'. */
export async function clearCallNotification(tripId) {
  const notifeeModule = getNotifee();
  if (!notifeeModule || !tripId) return;
  try {
    await notifeeModule.default.cancelNotification(callNotificationId(tripId));
  } catch (_) { /* already cleared, or never shown — fine either way */ }
}

// Registering a background event handler is required by notifee's own API
// (it warns otherwise) — the notification's launchActivity already opens the
// app on its own, so there's nothing further to do here; the app's normal
// call:invite/pending-invite handling takes over once it boots.
const notifeeModule = getNotifee();
if (notifeeModule) {
  try {
    notifeeModule.default.onBackgroundEvent(async () => {});
  } catch (_) { /* non-fatal */ }
}
