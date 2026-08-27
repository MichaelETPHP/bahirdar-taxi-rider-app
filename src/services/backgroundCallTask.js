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

  // Both run regardless of order: the full-screen notification is what gets
  // the phone to actually pop up over the lock screen; ringFromBackgroundPush
  // updates the live call store directly for the case where this task is
  // running in the SAME JS context as an already-alive app (Android doesn't
  // always spin up a fresh headless engine — see callKeepService.js).
  await Promise.all([
    showFullScreenCallNotification({ tripId, peerName }),
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
