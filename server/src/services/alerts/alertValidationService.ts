import { alertConfig, isApprovedOfficialSource } from './alertConfig';

export interface OfficialEligibilityInput {
  source: string | null | undefined;
  sourceType: string | null | undefined;
  sourceAlertId: string | null | undefined;
  sourceUrl: string | null | undefined;
  sourceReference: string | null | undefined;
  issuedAt: Date | string | null | undefined;
  expiresAt: Date | string | null | undefined;
  status: string | null | undefined;
  isVerified: boolean | null | undefined;
  isDemoData: boolean | null | undefined;
  rawPayload?: string | null | undefined;
}

export interface EligibilityResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Fail-closed gate for the "ACTIVE OFFICIAL WARNINGS" shelf.
 * An alert is displayable as an official warning ONLY if every check passes.
 */
export function validateOfficialEligibility(
  alert: OfficialEligibilityInput,
  now: Date = new Date()
): EligibilityResult {
  const reasons: string[] = [];

  if ((alert.sourceType || '').toUpperCase() !== 'OFFICIAL') {
    reasons.push(`sourceType must be OFFICIAL, got '${alert.sourceType}'`);
  }
  if (!isApprovedOfficialSource(alert.source || '')) {
    reasons.push(`source '${alert.source}' is not an approved authoritative source`);
  }
  if (alert.isVerified !== true) {
    reasons.push('alert is not verified');
  }
  if (alert.isDemoData === true) {
    reasons.push('demo data can never be an official warning');
  }
  if (!alert.sourceAlertId || String(alert.sourceAlertId).trim() === '') {
    reasons.push('missing sourceAlertId (upstream provenance)');
  }
  if (
    (!alert.sourceUrl || String(alert.sourceUrl).trim() === '') &&
    (!alert.sourceReference || String(alert.sourceReference).trim() === '')
  ) {
    reasons.push('missing sourceUrl/sourceReference (original bulletin link)');
  }
  const issued = alert.issuedAt ? new Date(alert.issuedAt) : null;
  if (!issued || Number.isNaN(issued.getTime())) {
    reasons.push('missing or invalid issuedAt (source issue time)');
  }
  const status = (alert.status || '').toUpperCase();
  if (status === 'CANCELLED') reasons.push('alert was cancelled upstream');
  else if (status === 'EXPIRED') reasons.push('alert is expired');
  else if (status === 'PENDING_VERIFICATION') reasons.push('alert is pending verification');
  else if (status !== 'ACTIVE' && status !== 'UPDATED') {
    reasons.push(`status '${alert.status}' is not displayable`);
  }
  if (alert.expiresAt) {
    const exp = new Date(alert.expiresAt);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= now.getTime()) {
      reasons.push('alert past its source expiry time');
    }
  }
  // Freshness of the *source sync* is enforced at query time via lastCheckedAt
  // (see alertIngestionService); a missing raw payload alone is a rejection
  // because we could not reconstruct source → DB → UI.
  if (!alert.rawPayload || String(alert.rawPayload).trim() === '') {
    reasons.push('missing raw source payload (provenance not preserved)');
  }

  return { ok: reasons.length === 0, reasons };
}

/** Backend expiry predicate. Never rely on frontend filtering alone. */
export function isExpired(expiresAt: Date | string | null | undefined, now: Date = new Date()): boolean {
  if (!expiresAt) return false; // no expiry provided → handled by freshness windows, not assumed active forever
  const exp = new Date(expiresAt);
  if (Number.isNaN(exp.getTime())) return false;
  return exp.getTime() <= now.getTime();
}

/**
 * Freshness: an alert counts as LIVE only when its source confirmed it recently.
 * lastCheckedAt older than the source window → STALE (must not be labelled LIVE).
 */
export function livenessForAlert(
  lastCheckedAt: Date | string | null | undefined,
  source: string,
  now: Date = new Date()
): { live: boolean; stale: boolean; checkedAgoMs: number | null } {
  if (!lastCheckedAt) return { live: false, stale: true, checkedAgoMs: null };
  const checked = new Date(lastCheckedAt);
  if (Number.isNaN(checked.getTime())) return { live: false, stale: true, checkedAgoMs: null };
  const ago = now.getTime() - checked.getTime();
  const windowMin = alertConfig.freshnessWindowMinutes[source?.toUpperCase()] ?? 180;
  const stale = ago > windowMin * 60 * 1000;
  return { live: !stale, stale, checkedAgoMs: ago };
}

/**
 * CRITICAL guard: raw weather observations (Open-Meteo etc.) must NEVER be
 * classified as an IMD warning. Only a genuine IMD-issued warning payload —
 * with an upstream warning identifier and issue time — may proceed.
 */
export function assertImdWarningPayload(payload: {
  sourceAlertId?: string | null;
  issuedAt?: string | Date | null;
  authority?: string | null;
  isWeatherObservation?: boolean;
}): { ok: boolean; reason?: string } {
  if (payload.isWeatherObservation) {
    return { ok: false, reason: 'weather observation is not an IMD warning' };
  }
  if (!payload.sourceAlertId) {
    return { ok: false, reason: 'IMD warning requires an upstream warning identifier' };
  }
  if (!payload.issuedAt || Number.isNaN(new Date(payload.issuedAt).getTime())) {
    return { ok: false, reason: 'IMD warning requires a source issue timestamp' };
  }
  return { ok: true };
}

/** JeevanGrid intelligence / community reports must never pass the official gate. */
export function assertNotOfficialImpersonation(sourceType: string | null | undefined): {
  ok: boolean;
  reason?: string;
} {
  const t = (sourceType || '').toUpperCase();
  if (t === 'INTELLIGENCE') return { ok: false, reason: 'JeevanGrid risk intelligence is not an official warning' };
  if (t === 'COMMUNITY') return { ok: false, reason: 'community report is not an official warning' };
  return { ok: true };
}
