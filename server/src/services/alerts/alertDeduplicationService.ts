import { prisma } from '../../utils/prisma';

/**
 * Deduplication strategy: UNIQUE (source, sourceAlertId).
 * - Same key + newer upstream timestamp → UPDATE existing row (no duplicate).
 * - Same key + same/older timestamp → SKIP.
 * - Upstream msgType=Cancel → mark CANCELLED (never delete; audit trail matters).
 */

export interface DedupDecision {
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'CANCEL';
  existingId?: string;
  reason: string;
}

export async function decideDedup(
  source: string,
  sourceAlertId: string,
  upstreamIssuedAt: Date,
  msgType?: string | null
): Promise<DedupDecision> {
  const existing = await prisma.disasterAlert.findUnique({
    where: { source_sourceAlertId: { source, sourceAlertId } },
  });
  if (!existing) {
    if ((msgType || '').toLowerCase() === 'cancel') {
      return { action: 'SKIP', reason: 'cancel for unknown alert — nothing to cancel' };
    }
    return { action: 'CREATE', reason: 'first sighting of (source, sourceAlertId)' };
  }
  if ((msgType || '').toLowerCase() === 'cancel') {
    if (existing.status === 'CANCELLED') return { action: 'SKIP', existingId: existing.id, reason: 'already cancelled' };
    return { action: 'CANCEL', existingId: existing.id, reason: 'upstream cancellation' };
  }
  const existingTime = new Date(existing.issuedAt).getTime();
  if (upstreamIssuedAt.getTime() > existingTime) {
    return { action: 'UPDATE', existingId: existing.id, reason: 'newer upstream issue time' };
  }
  return { action: 'SKIP', existingId: existing.id, reason: 'duplicate or stale re-delivery' };
}

export async function writeAuditLog(entry: {
  action: string;
  source: string;
  sourceAlertId?: string | null;
  alertId?: string | null;
  reason?: string | null;
  metadata?: string | null;
}) {
  try {
    await prisma.alertAuditLog.create({ data: { ...entry } });
  } catch (e) {
    console.warn('Alert audit log write failed:', (e as Error).message);
  }
}
