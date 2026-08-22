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
 */
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ringFromBackgroundPush } from './callKeepService';

export const BACKGROUND_CALL_TASK = 'BACKGROUND_CALL_TASK';

// Diagnostic only — proves definitively whether this task fires at all when
// the app is fully killed, independent of anything downstream (ringing,
// CallKeep, etc). Read this back on the NEXT app open (see App.js) rather
// than guessing from symptoms. Not user-facing, never surfaced in the UI.
const TASK_FIRED_LOG_KEY = 'bahiran:debug:backgroundCallTaskFiredAt';
async function logTaskFired(reason) {
  try {
    await AsyncStorage.setItem(TASK_FIRED_LOG_KEY, JSON.stringify({ at: Date.now(), reason }));
  } catch (_) {}
}

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
  // Logged first, before anything else can possibly throw or early-return —
  // this line alone is what next app-open checks to know the task genuinely
  // ran, regardless of what happens after.
  await logTaskFired(error ? `error: ${error.message}` : 'invoked');

  if (error) {
    console.warn('[BackgroundCall] task error:', error);
    return;
  }
  const payload = extractCallData(data);
  if (payload?.type !== 'incoming_call') return;

  const tripId = payload.trip_id;
  if (!tripId) return;

  try {
    await ringFromBackgroundPush({
      tripId,
      peerName: payload.caller_name || 'Bahiran Ride',
      peerRole: payload.caller_role || 'admin',
    });
  } catch (err) {
    console.warn('[BackgroundCall] ringFromBackgroundPush failed:', err);
  }
});

/** Diagnostic only — see logTaskFired() above. Call once at app boot. Clears
 * itself either way (one-shot read, not a persistent status). */
export async function readAndClearTaskFiredDebugFlag() {
  try {
    const raw = await AsyncStorage.getItem(TASK_FIRED_LOG_KEY);
    await AsyncStorage.removeItem(TASK_FIRED_LOG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export async function registerBackgroundCallTask() {
  try {
    await Notifications.registerTaskAsync(BACKGROUND_CALL_TASK);
  } catch (err) {
    // Non-fatal — the live in-app/foreground call path still works either
    // way; this only extends coverage to backgrounded/killed apps.
    console.warn('[BackgroundCall] registerTaskAsync failed:', err);
  }
}
