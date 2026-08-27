/**
 * Turns an admin/driver "call invite" push into a real ringing phone call
 * even when the app is backgrounded or fully killed — closing the gap where
 * a backgrounded rider only ever got a plain notification banner (see
 * callKeepService.js's file header for the fuller "why").
 *
 * `TaskManager.defineTask` MUST run at JS-bundle load time, before anything
 * else touches it — this file is imported at the very top of index.js for
 * exactly that reason. Registering the task itself (`registerBackgroundCallTask`)
 * is a separate, async step done later from App.js's normal init effect.
 *
 * Also posts a real full-screen call notification (see callNotification.js)
 * — this is what actually launches the app straight to the ring screen,
 * over the lock screen, WITHOUT the rider tapping anything first.
 */
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import { ringFromBackgroundPush } from './callKeepService';
import { showFullScreenCallNotification } from './callNotification';

export const BACKGROUND_CALL_TASK = 'BACKGROUND_CALL_TASK';

// The exact shape Android hands back for a data-only FCM message has moved
// around across expo-notifications versions — read defensively rather than
// assume one fixed path.
function extractCallData(taskData) {
  return (
    taskData?.notification?.request?.content?.data ??
    taskData?.notification?.data ??
    taskData?.data ??
    taskData ??
    {}
  );
}

TaskManager.defineTask(BACKGROUND_CALL_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[BackgroundCall] task error:', error);
    return;
  }
  const payload = extractCallData(data);
  if (payload?.type !== 'incoming_call') return;

  const tripId = payload.trip_id;
  if (!tripId) return;

  const peerName = payload.caller_name || 'Bahiran Ride';
  const peerRole = payload.caller_role || 'admin';

  // This task fires for EVERY data push, including when the app is already
  // open in the foreground — in that case the live socket path (callEngine.js)
  // is already showing the ring screen and playing the in-app ringtone
  // through expo-av. Posting the notification too, on top of that, meant
  // its own looping ring_ring sound and the app's own audio-focus request
  // were fighting over Android's audio system at the same moment — screen
  // correct, in-app ringtone silenced. The notification (and its
  // lock-screen auto-launch) is only useful/needed for the genuinely
  // backgrounded-or-killed case, so skip it whenever the app is already
  // visible; ringFromBackgroundPush's own status check below still no-ops
  // safely either way.
  const isForeground = AppState.currentState === 'active';
  await Promise.all([
    isForeground ? Promise.resolve() : showFullScreenCallNotification({ tripId, peerName }),
    ringFromBackgroundPush({ tripId, peerName, peerRole }).catch((err) => {
      console.warn('[BackgroundCall] ringFromBackgroundPush failed:', err);
    }),
  ]);
});

export async function registerBackgroundCallTask() {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_CALL_TASK);
  } catch (err) {
    // Non-fatal — the live in-app/foreground call path still works either
    // way; this only extends coverage to backgrounded/killed apps.
    console.warn('[BackgroundCall] registerTaskAsync failed:', err);
  }
}
