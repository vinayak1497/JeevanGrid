import { prisma } from '../../utils/prisma';
import { writeAuditLog } from './alertDeduplicationService';

/**
 * Backend-enforced expiration. Runs on a schedule AND before every
 * official-alert read (cheap sweep), so expiry never depends on the frontend.
 */
export async function expireStaleAlerts(now: Date = new Date()): Promise<number> {
  const stale = await prisma.disasterAlert.findMany({
    where: {
      status: { in: ['ACTIVE', 'UPDATED'] },
      expiresAt: { lte: now },
    },
    select: { id: true, source: true, sourceAlertId: true },
  });
  if (stale.length === 0) return 0;
  await prisma.disasterAlert.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { status: 'EXPIRED', isLive: false, lastCheckedAt: now },
  });
  for (const s of stale) {
    await writeAuditLog({
      action: 'EXPIRED',
      source: s.source,
      sourceAlertId: s.sourceAlertId,
      alertId: s.id,
      reason: 'source expiry time passed (backend sweep)',
    });
  }
  return stale.length;
}
