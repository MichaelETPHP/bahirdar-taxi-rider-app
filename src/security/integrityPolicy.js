/**
 * Device-integrity policy — INSA: root/emulator detection (rider app).
 * Pure module, mirrors BahirdarDriver/security/integrityPolicy.ts.
 * The rider app has no wallet UI (cash rides only), so the policy gates
 * login and reports detections — walletAccess applies if wallet UI ships.
 */

export function computeRiskLevel(flags) {
  const compromised = flags.isJailBroken || flags.isRooted;
  if (compromised && flags.hookDetected) return 'high';
  if (compromised || flags.hookDetected || flags.isDebuggedMode) return 'low';
  return 'none';
}

const HIGH_RISK_LOGOUT_GRACE_MS = 5 * 60 * 1000;

export function policyForRisk(level) {
  switch (level) {
    case 'high':
      return { walletAccess: 'blocked', showWarningBanner: true, reportToApi: true, forceLogoutAfterMs: HIGH_RISK_LOGOUT_GRACE_MS };
    case 'low':
      return { walletAccess: 'guarded', showWarningBanner: true, reportToApi: true, forceLogoutAfterMs: null };
    default:
      return { walletAccess: 'full', showWarningBanner: false, reportToApi: false, forceLogoutAfterMs: null };
  }
}
