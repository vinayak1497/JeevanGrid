import { prisma } from '../../utils/prisma';
import { alertConfig } from './alertConfig';
import { ensureSourceStates, updateSourceState } from './alertSourceRegistry';
import { normalizeCapInfo, type CapInfo, type NormalizedAlertDraft } from './alertNormalizationService';
import { decideDedup, writeAuditLog } from './alertDeduplicationService';
import { expireStaleAlerts } from './alertExpirationService';
import { fetchSachetFeed, fetchCapDetail, isCapDetailUrl, capFetchConcurrency } from './sources/sachetSource';
import { fetchImdWarnings } from './sources/imdSource';
import { fetchCwcWarnings } from './sources/cwcSource';
import { fetchIncoisWarnings } from './sources/incoisSource';
import { notifyOfficialAlert } from './alertNotificationService';
import type { SourceFetchResult } from './sources/types';

const SOURCE_AUTHORITY: Record<string, string> = {
  SACHET: 'NDMA SACHET',
  IMD: 'India Meteorological Department',
  CWC: 'Central Water Commission',
  INCOIS: 'Indian National Centre for Ocean Information Services',
};

export interface SyncSummary {
  source: string;
  outcome: SourceFetchResult['outcome'];
  fetched: number;
  accepted: number;
  rejected: number;
  error?: string;
  responseTimeMs: number;
  notModified?: boolean;
}

export interface SyncOptions {
  /** Force full CAP re-enrichment even for already-stored alerts (backfill). */
  force?: boolean;
}

/**
 * Fetch full CAP XML detail for SACHET RSS items that need it.
 * Steady-state cheap: alerts already stored WITH CAP detail (eventType present)
 * are not re-fetched — only their lastCheckedAt is refreshed. New or still-thin
 * rows get full enrichment with bounded concurrency (never hammers the source).
 */
async function enrichSachetItems(
  rssItems: CapInfo[],
  force: boolean
): Promise<Array<{ rss: CapInfo; cap: CapInfo | null }>> {
  const stableIds = rssItems.map((r) => (r.guid || r.identifier || '').trim()).filter(Boolean);
  const existing = stableIds.length
    ? await prisma.disasterAlert.findMany({
        where: { source: 'SACHET', sourceAlertId: { in: stableIds } },
        select: { sourceAlertId: true, eventType: true },
      }).catch(() => [])
    : [];
  const enrichedByKey = new Map((existing ?? []).map((e) => [e.sourceAlertId as string, !!e.eventType]));

  const out: Array<{ rss: CapInfo; cap: CapInfo | null }> = rssItems.map((rss) => ({ rss, cap: null }));
  // Items needing a CAP fetch: force, unknown, or known-but-thin — and only when
  // the feed actually links a CAP document.
  const needFetch = out.filter(({ rss }) => {
    if (!isCapDetailUrl(rss.web)) return false;
    if (force) return true;
    const key = (rss.guid || rss.identifier || '').trim();
    return enrichedByKey.get(key) !== true;
  });

  for (let i = 0; i < needFetch.length; i += capFetchConcurrency) {
    const batch = needFetch.slice(i, i + capFetchConcurrency);
    await Promise.all(
      batch.map(async (entry) => {
        entry.cap = await fetchCapDetail(entry.rss.web as string);
      })
    );
  }
  return out;
}

async function persistFetchResult(result: SourceFetchResult, opts: SyncOptions = {}): Promise<SyncSummary> {
  const now = new Date();
  let accepted = 0;
  let rejected = 0;

  if (result.outcome === 'NOT_MODIFIED') {
    await updateSourceState(result.source, {
      status: 'HEALTHY',
      lastAttemptAt: now,
      lastSuccessAt: result.lastSuccessAt ?? now,
      responseTimeMs: result.responseTimeMs,
      lastError: null,
      etag: result.etag ?? undefined,
      lastModified: result.lastModified ?? undefined,
    });
    return {
      source: result.source, outcome: result.outcome, fetched: 0,
      accepted: 0, rejected: 0, responseTimeMs: result.responseTimeMs, notModified: true,
    };
  }

  if (result.outcome === 'CONFIGURATION_REQUIRED') {
    await updateSourceState(result.source, {
      status: 'CONFIGURATION_REQUIRED',
      lastAttemptAt: now,
      lastError: result.error ?? 'configuration required',
      responseTimeMs: result.responseTimeMs,
      recordsFetched: result.recordsFetched,
      recordsAccepted: 0,
      recordsRejected: 0,
    });
    return {
      source: result.source, outcome: result.outcome, fetched: result.recordsFetched,
      accepted: 0, rejected: 0, error: result.error, responseTimeMs: result.responseTimeMs,
    };
  }

  if (result.outcome === 'UNAVAILABLE') {
    await updateSourceState(result.source, {
      status: 'UNAVAILABLE',
      lastAttemptAt: now,
      lastError: result.error ?? 'source unavailable',
      responseTimeMs: result.responseTimeMs,
      recordsFetched: result.recordsFetched,
      recordsAccepted: 0,
      recordsRejected: 0,
    });
    return {
      source: result.source, outcome: result.outcome, fetched: result.recordsFetched,
      accepted: 0, rejected: 0, error: result.error, responseTimeMs: result.responseTimeMs,
    };
  }

  // outcome OK — enrich (SACHET CAP XML), normalize, dedup, upsert. Fail closed per item.
  const sachetItems =
    result.source === 'SACHET' ? await enrichSachetItems(result.items, opts.force === true) : null;
  const workItems: Array<{ rss: CapInfo; cap: CapInfo | null }> = sachetItems
    ? sachetItems
    : result.items.map((rss) => ({ rss, cap: null }));

  for (const { rss, cap } of workItems) {
    // Stable dedup key: the RSS guid (alert series). The CAP document carries a
    // versioned identifier (…_9, …_65…) that changes on every upstream Update —
    // keying on it would create a duplicate row per version.
    const stableId = (rss.guid || rss.identifier || '').trim();
    const merged: CapInfo = cap
      ? {
          ...cap,
          identifier: stableId || cap.identifier,
          guid: rss.guid ?? cap.identifier,
          web: cap.web ?? rss.web,
          author: cap.author ?? rss.author,
          references: [cap.references, cap.identifier].filter(Boolean).join(' | ') || rss.references,
        }
      : rss;
    const draft = normalizeCapInfo(merged, {
      source: result.source,
      authority: SOURCE_AUTHORITY[result.source] ?? result.source,
    });
    if (!draft) {
      rejected += 1;
      await writeAuditLog({
        action: 'REJECTED', source: result.source,
        sourceAlertId: merged.identifier ?? null,
        reason: 'missing identifier or issue timestamp (provenance incomplete)',
        metadata: JSON.stringify({ guid: merged.guid ?? null }).slice(0, 2000),
      });
      continue;
    }
    try {
      const decision = await decideDedup(draft.source, draft.sourceAlertId, draft.issuedAt, draft.msgType);
      if (decision.action === 'SKIP' && !opts.force) {
        // Still refresh lastCheckedAt so liveness reflects re-confirmation.
        if (decision.existingId) {
          await prisma.disasterAlert.update({
            where: { id: decision.existingId },
            data: { lastCheckedAt: now },
          }).catch(() => undefined);
        }
        continue;
      }
      if (decision.action === 'CANCEL' && decision.existingId) {
        await prisma.disasterAlert.update({
          where: { id: decision.existingId },
          data: { status: 'CANCELLED', isLive: false, lastCheckedAt: now },
        });
        await writeAuditLog({
          action: 'CANCELLED', source: draft.source, sourceAlertId: draft.sourceAlertId,
          alertId: decision.existingId, reason: 'upstream CAP Cancel',
        });
        accepted += 1;
        continue;
      }
      if (decision.action === 'UPDATE' && decision.existingId) {
        await prisma.disasterAlert.update({
          where: { id: decision.existingId },
          data: { ...draft, ingestedAt: undefined },
        });
        await writeAuditLog({
          action: 'UPDATED', source: draft.source, sourceAlertId: draft.sourceAlertId,
          alertId: decision.existingId, reason: decision.reason,
        });
        // Notify subscribed districts of the upstream update (best-effort).
        notifyOfficialAlert(
          {
            source: draft.source,
            sourceAlertId: draft.sourceAlertId,
            title: draft.title,
            headline: (draft as any).headline ?? null,
            severity: (draft as any).severity ?? null,
            hazardType: (draft as any).hazardType ?? null,
            authority: (draft as any).authority ?? null,
            district: (draft as any).district ?? null,
            state: (draft as any).state ?? null,
            affectedAreas: (draft as any).affectedAreas ?? null,
            expiresAt: (draft as any).expiresAt ?? null,
            sourceUrl: (draft as any).sourceUrl ?? null,
          },
          'UPDATED'
        ).catch(() => undefined);
        accepted += 1;
        continue;
      }
      // Force/backfill path: same upstream version re-seen, but the stored row
      // is still thin (RSS-only, no CAP event detail) — refresh it in place.
      if (decision.action === 'SKIP' && opts.force && decision.existingId && draft.eventType) {
        const existing = await prisma.disasterAlert.findUnique({ where: { id: decision.existingId } });
        if (existing && !existing.eventType) {
          await prisma.disasterAlert.update({
            where: { id: decision.existingId },
            data: { ...draft, ingestedAt: undefined },
          });
          await writeAuditLog({
            action: 'UPDATED', source: draft.source, sourceAlertId: draft.sourceAlertId,
            alertId: decision.existingId, reason: 'force backfill: CAP enrichment of thin row',
          });
          accepted += 1;
          continue;
        }
        await prisma.disasterAlert.update({
          where: { id: decision.existingId },
          data: { lastCheckedAt: now },
        }).catch(() => undefined);
        continue;
      }
      const created = await prisma.disasterAlert.create({ data: draft });
      await writeAuditLog({
        action: 'CREATED', source: draft.source, sourceAlertId: draft.sourceAlertId,
        alertId: created.id, reason: decision.reason,
      });
      // Notify subscribed districts of the new official warning (best-effort).
      notifyOfficialAlert(
        {
          source: draft.source,
          sourceAlertId: draft.sourceAlertId,
          title: draft.title,
          headline: (draft as any).headline ?? null,
          severity: (draft as any).severity ?? null,
          hazardType: (draft as any).hazardType ?? null,
          authority: (draft as any).authority ?? null,
          district: (draft as any).district ?? null,
          state: (draft as any).state ?? null,
          affectedAreas: (draft as any).affectedAreas ?? null,
          expiresAt: (draft as any).expiresAt ?? null,
          sourceUrl: (draft as any).sourceUrl ?? null,
        },
        'NEW'
      ).catch(() => undefined);
      accepted += 1;
    } catch (e) {
      rejected += 1;
      await writeAuditLog({
        action: 'REJECTED', source: draft.source, sourceAlertId: draft.sourceAlertId,
        reason: `persist failed: ${(e as Error).message}`.slice(0, 500),
      });
    }
  }

  const healthy = result.error ? 'DEGRADED' : accepted > 0 || result.recordsFetched === 0 ? 'HEALTHY' : 'HEALTHY';
  console.log(
    `[${result.source}] persist: outcome=${result.outcome} fetched=${result.recordsFetched} ` +
    `inserted/updated/cancelled=${accepted} rejected=${rejected}` +
    (result.error ? ` error=${result.error.slice(0, 160)}` : '')
  );
  await updateSourceState(result.source, {
    status: healthy,
    lastAttemptAt: now,
    lastSuccessAt: result.lastSuccessAt ?? now,
    lastDataAt: accepted > 0 ? now : undefined,
    lastError: result.error ?? null,
    responseTimeMs: result.responseTimeMs,
    recordsFetched: result.recordsFetched,
    recordsAccepted: accepted,
    recordsRejected: rejected,
    etag: result.etag ?? undefined,
    lastModified: result.lastModified ?? undefined,
  });

  return {
    source: result.source, outcome: result.outcome, fetched: result.recordsFetched,
    accepted, rejected, error: result.error, responseTimeMs: result.responseTimeMs,
  };
}

export async function syncSource(source: string, opts: SyncOptions = {}): Promise<SyncSummary> {
  await ensureSourceStates().catch(() => undefined);
  const s = source.toUpperCase();
  if (s === 'SACHET') {
    if (opts.force) {
      // Bypass the ETag cache for a deliberate backfill: fetch the feed fresh.
      await prisma.alertFeedCache.delete({ where: { sourceName: 'SACHET' } }).catch(() => undefined);
      await prisma.alertSourceState.update({ where: { name: 'SACHET' }, data: { etag: null } }).catch(() => undefined);
    }
    return persistFetchResult(await fetchSachetFeed(), opts);
  }
  if (s === 'IMD') return persistFetchResult(await fetchImdWarnings(), opts);
  if (s === 'CWC') return persistFetchResult(await fetchCwcWarnings(), opts);
  if (s === 'INCOIS') return persistFetchResult(await fetchIncoisWarnings(), opts);
  throw new Error(`unknown alert source '${source}'`);
}

/** Run expiry sweep + sync every enabled source. Never throws. */
export async function syncAllSources(opts: SyncOptions = {}): Promise<{ syncedAt: string; results: SyncSummary[]; expired: number }> {
  const expired = await expireStaleAlerts(new Date()).catch(() => 0);
  const enabled: string[] = [];
  if (alertConfig.sachetEnabled) enabled.push('SACHET');
  if (alertConfig.imdEnabled) enabled.push('IMD');
  if (alertConfig.cwcEnabled) enabled.push('CWC');
  if (alertConfig.incoisEnabled) enabled.push('INCOIS');

  const results: SyncSummary[] = [];
  for (const source of enabled) {
    try {
      results.push(await syncSource(source, opts));
    } catch (e) {
      results.push({
        source, outcome: 'UNAVAILABLE', fetched: 0, accepted: 0, rejected: 0,
        error: (e as Error).message, responseTimeMs: 0,
      });
    }
  }
  // Sources left disabled still get a registry row so the UI can say
  // "unavailable" instead of pretending everything is healthy.
  await ensureSourceStates().catch(() => undefined);
  return { syncedAt: new Date().toISOString(), results, expired };
}
