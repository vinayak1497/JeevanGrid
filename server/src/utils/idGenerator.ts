import crypto from 'crypto';

/**
 * References are intentionally non-sequential and non-guessable. They are
 * user-facing identifiers only; database primary keys remain UUIDs / generated
 * values. Ambiguous characters (I, O, 0, 1) are excluded for phone read-outs.
 */
const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomToken(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SAFE_ALPHABET[crypto.randomInt(0, SAFE_ALPHABET.length)];
  }
  return out;
}

export function generateEmergencyReportId(now = new Date()): string {
  return `JG-${now.getUTCFullYear()}-${randomToken(6)}`;
}

export function generateIncidentReference(now = new Date()): string {
  return `JG-${now.getUTCFullYear()}-${randomToken(6)}`;
}

/** Stable client-side key for retrying one queued submission. */
export function newIdempotencyKey(prefix = 'report'): string {
  return `${prefix}-${Date.now().toString(36)}-${randomToken(10)}`;
}
