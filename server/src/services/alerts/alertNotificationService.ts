import crypto from 'crypto';
import { prisma } from '../../utils/prisma';
import { alertConfig } from './alertConfig';

export type NotifyAction = 'NEW' | 'UPDATED';

function endpointHash(endpoint: string): string {
  return crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

function pushConfigured(): boolean {
  return !!(
    alertConfig.vapidPublicKey &&
    alertConfig.vapidPrivateKey &&
    alertConfig.vapidSubject
  );
}

let vapidInitWarned = false;

async function sendWebPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object): Promise<boolean> {
  if (!pushConfigured()) {
    if (!vapidInitWarned) {
      vapidInitWarned = true;
      console.warn('[push] VAPID keys not configured — browser notifications disabled (app functions normally).');
    }
    return false;
  }
  try {
    const webpush = await import('web-push');
    const wp = (webpush as any).default ?? webpush;
    wp.setVapidDetails(alertConfig.vapidSubject, alertConfig.vapidPublicKey, alertConfig.vapidPrivateKey);
    await wp.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
    return true;
  } catch (e) {
    const msg = (e as Error).message || '';
    // 404/410 = endpoint gone; caller prunes it.
    if (/404|410/i.test(msg)) {
      await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => undefined);
    }
    console.warn('[push] send failed:', msg.slice(0, 200));
    return false;
  }
}

export function districtsForAlert(alert: { district?: string | null; state?: string | null; affectedAreas?: string | null }): string[] {
  const out = new Set<string>();
  if (alert.district) {
    for (const part of String(alert.district).split(/[,;|]/)) {
      const t = part.trim();
      if (t && t.toLowerCase() !== 'unknown') out.add(t);
    }
  }
  if (alert.state) out.add(String(alert.state).trim());
  try {
    const areas = alert.affectedAreas ? JSON.parse(alert.affectedAreas) : null;
    if (Array.isArray(areas)) {
      for (const z of areas.slice(0, 5)) {
        if (typeof z === 'string' && z.trim() && !/^unknown$/i.test(z.trim()) && !/LGD/i.test(z)) {
          out.add(z.trim());
        }
      }
    }
  } catch { /* ignore malformed JSON */ }
  return [...out].filter(Boolean);
}

/**
 * Notify district subscribers about a NEW or UPDATED official warning.
 * Best-effort: never throws, never blocks ingestion. Exactly-once per
 * (source, sourceAlertId, endpoint, action) via AlertNotificationLog.
 * Every notification states JeevanGrid is RELAYING an official warning.
 */
export async function notifyOfficialAlert(
  alert: {
    source: string;
    sourceAlertId: string;
    title: string;
    headline?: string | null;
    severity?: string | null;
    hazardType?: string | null;
    authority?: string | null;
    district?: string | null;
    state?: string | null;
    affectedAreas?: string | null;
    expiresAt?: Date | null;
    sourceUrl?: string | null;
  },
  action: NotifyAction
): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;
  try {
    if (!alert.sourceAlertId) return { sent, skipped };
    const districts = districtsForAlert(alert);
    if (!districts.length) return { sent, skipped };

    const subs = await prisma.pushSubscription.findMany({
      where: { district: { in: districts } },
      take: 500,
    }).catch(() => []);
    if (!subs.length) return { sent, skipped };

    const expiresIST = alert.expiresAt
      ? new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
          hour: '2-digit', minute: '2-digit', hour12: false,
        }).format(new Date(alert.expiresAt)) + ' IST'
      : 'see official bulletin';

    for (const sub of subs) {
      const hash = endpointHash(sub.endpoint);
      try {
        await prisma.alertNotificationLog.create({
          data: {
            source: alert.source,
            sourceAlertId: alert.sourceAlertId,
            endpointHash: hash,
            action,
          },
        });
      } catch {
        skipped += 1; // already notified for this alert × endpoint × action
        continue;
      }
      const primary = districts[0];
      const ok = await sendWebPush(
        sub,
        {
          title: 'Official Disaster Alert (relayed by JeevanGrid)',
          body:
            `${alert.severity || 'Advisory'}: ${alert.headline || alert.title} — ${primary}. ` +
            `Source: ${alert.authority || alert.source}. Valid until ${expiresIST}. ` +
            `JeevanGrid is relaying this official warning; it did not issue it.`,
          tag: `${alert.source}:${alert.sourceAlertId}:${action}`,
          data: {
            url: `/alerts?sourceAlertId=${encodeURIComponent(alert.sourceAlertId)}`,
            source: alert.source,
            sourceAlertId: alert.sourceAlertId,
            action,
          },
        }
      );
      if (ok) sent += 1;
      else skipped += 1;
    }
  } catch (e) {
    console.warn('[push] notify failed (non-fatal):', (e as Error).message.slice(0, 200));
  }
  return { sent, skipped };
}
