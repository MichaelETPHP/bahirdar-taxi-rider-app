/**
 * Device-integrity policy — INSA: root/emulator detection (rider app).
 * Pure module, mirrors BahirdarDriver/security/integrityPolicy.ts.
 * The rider app has no wallet UI (cash rides only), so the policy gates
 * login and reports detections — walletAccess applies if wallet UI ships.
 */

/**
 * INSA policy (2026-07-20): a compromised device must never reach the app.
 * 'high' — rooted/jailbroken, hook framework, or emulator (production build)
 *          → whole app blocked behind a red warning screen, login unreachable,
 *          any lingering session force-logged-out within one minute.
 * 'low'  — debugger attached or fake-GPS app: warning only, app usable.
 */
export function computeRiskLevel(flags) {
  const compromised = flags.isJailBroken || flags.isRooted;
  if (flags.isEmulator || compromised || flags.hookDetected) return 'high';
  if (flags.isDebuggedMode || flags.mockLocationEnabled) return 'low';
  return 'none';
}

const HIGH_RISK_LOGOUT_GRACE_MS = 60 * 1000;

export function policyForRisk(level) {
  switch (level) {
    case 'high':
      return { appAccess: 'blocked', walletAccess: 'blocked', showWarningBanner: true, reportToApi: true, forceLogoutAfterMs: HIGH_RISK_LOGOUT_GRACE_MS };
    case 'low':
      return { appAccess: 'allowed', walletAccess: 'guarded', showWarningBanner: true, reportToApi: true, forceLogoutAfterMs: null };
    default:
      return { appAccess: 'allowed', walletAccess: 'full', showWarningBanner: false, reportToApi: false, forceLogoutAfterMs: null };
  }
}
