import { alertConfig } from './alertConfig';
import { ensureSourceStates } from './alertSourceRegistry';
import { syncAllSources } from './alertIngestionService';
import { expireStaleAlerts } from './alertExpirationService';

let timer: NodeJS.Timeout | null = null;
let expiryTimer: NodeJS.Timeout | null = null;
let running = false;

/**
 * Backend ingestion worker. Runs inside the API process (Render / Railway /
 * Fly all keep the process alive) so ingestion never depends on a browser.
 * - SACHET poll every SACHET_POLL_MINUTES (default 10, min 5).
 * - Expiry sweep hourly + before every official read.
 */
export function startAlertScheduler() {
  if (timer) return;
  ensureSourceStates()
    .then(() => expireStaleAlerts().catch(() => 0))
    .then(() => {
      // Initial sync in background; server boot must not block on government feeds.
      syncAllSources()
        .then((r) => console.log(`[alerts] initial sync: ${JSON.stringify(r.results.map((x) => `${x.source}:${x.outcome}`))}`))
        .catch((e) => console.warn('[alerts] initial sync failed:', (e as Error).message));
    })
    .catch((e) => console.warn('[alerts] scheduler init failed:', (e as Error).message));

  const intervalMs = alertConfig.sachetPollMinutes * 60 * 1000;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await syncAllSources();
      console.log(`[alerts] sync ${r.syncedAt}: ${r.results.map((x) => `${x.source}:${x.outcome}(+${x.accepted})`).join(' ')} expired=${r.expired}`);
    } catch (e) {
      console.warn('[alerts] scheduled sync failed:', (e as Error).message);
    } finally {
      running = false;
    }
    timer?.refresh?.();
  }, intervalMs);
  // Avoid keeping CI/test processes alive.
  (timer as unknown as { unref?: () => void }).unref?.();

  expiryTimer = setInterval(() => {
    expireStaleAlerts().catch(() => undefined);
  }, 60 * 60 * 1000);
  (expiryTimer as unknown as { unref?: () => void }).unref?.();

  console.log(`[alerts] scheduler started (SACHET poll every ${alertConfig.sachetPollMinutes} min)`);
}

export function stopAlertScheduler() {
  if (timer) clearInterval(timer);
  if (expiryTimer) clearInterval(expiryTimer);
  timer = null;
  expiryTimer = null;
}
