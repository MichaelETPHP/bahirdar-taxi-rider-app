package expo.modules.lockscreencall

import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Lets this app's Activity draw itself over a locked screen — needed for
 * the CallKeep incoming-call ring, since a selfManaged ConnectionService
 * draws no UI of its own (see index.ts for the full story on why
 * RNCallKeep.backToForeground() doesn't cover this case).
 *
 * Uses Activity#setShowWhenLocked / #setTurnScreenOn (API 27+, the current
 * non-deprecated way to do this) instead of the WindowManager.LayoutParams
 * flags react-native-callkeep relies on, which Android deprecated in the
 * same API level and which Samsung's One UI is known to ignore in practice.
 *
 * Deliberately toggled on/off around each call rather than left on
 * permanently — this app shows trip and earnings data, and leaving these
 * flags set would let that leak over the lock screen at any other time,
 * not just during a call.
 */
class LockScreenCallModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LockScreenCall")

    // No early `return@Function` here — mixing that with a trailing block
    // expression confused the Function DSL's return-type inference (it
    // expects `Any?`, got a "Return type mismatch: expected 'Any?', actual
    // 'Unit'" build error). A single `if` with no early exit, matching
    // this project's existing floating-bubble module, avoids it.
    Function("showOverLockScreen") {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.runOnUiThread {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            activity.setShowWhenLocked(true)
            activity.setTurnScreenOn(true)
          }
        }
      }
    }

    Function("clearShowOverLockScreen") {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.runOnUiThread {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            activity.setShowWhenLocked(false)
            activity.setTurnScreenOn(false)
          }
        }
      }
    }
  }
}
