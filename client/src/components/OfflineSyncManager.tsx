import React, { useCallback, useEffect, useState } from 'react';
import {
  QUEUE_EVENT,
  flushOfflineQueue,
  getQueueSummary,
  isOnline,
  retentionSweep,
} from '../utils/offlineQueue';

/**
 * Offline-first status and queue flusher. Shows whether queued reports have
 * actually reached the server, and never calls a queued report "sent".
 */
export const OfflineSyncManager: React.FC = () => {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastDataAt, setLastDataAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const summary = await getQueueSummary();
      setPending(summary.pending);
      setFailed(summary.failed);
    } catch {
      /* IndexedDB unavailable — nothing to show */
    }
    try {
      setLastDataAt(localStorage.getItem('jeevangrid.lastDataAt'));
    } catch {
      /* ignore */
    }
  }, []);

  const flush = useCallback(async (includeFailed = false) => {
    if (!isOnline()) return;
    setSyncing(true);
    setMessage(null);
    try {
      const result = await flushOfflineQueue({ includeFailed });
      if (result.attempted > 0) {
        setMessage(
          result.failed === 0
            ? `${result.synced} queued report${result.synced === 1 ? '' : 's'} reached JeevanGrid.`
            : `${result.synced} synced, ${result.failed} still queued or failed. Open the report page for details.`
        );
      }
    } catch (e) {
      setMessage((e as Error).message.slice(0, 180));
    } finally {
      setSyncing(false);
      await refresh();
      setTimeout(() => setMessage(null), 9000);
    }
  }, [refresh]);

  useEffect(() => {
    // Register the offline/push service worker (push handlers are preserved).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    retentionSweep().catch(() => undefined);
    refresh();
    if (isOnline()) flush(false);

    const onOnline = () => {
      setOnline(true);
      flush(false);
    };
    const onOffline = () => setOnline(false);
    const onQueue = () => refresh();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener(QUEUE_EVENT, onQueue);
    const timer = window.setInterval(() => {
      refresh();
      if (isOnline()) flush(false);
    }, 60_000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener(QUEUE_EVENT, onQueue);
      window.clearInterval(timer);
    };
  }, [flush, refresh]);

  if (online && pending === 0 && failed === 0 && !message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-[300] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-xs text-on-surface shadow-xl flex flex-wrap items-center justify-between gap-3"
      style={{
        // Sits above the assistant orb so the two never collide, and clears
        // the home indicator on phones.
        bottom: 'calc(5.75rem + env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className={`material-symbols-outlined text-[18px] ${online ? 'text-primary' : 'text-error'}`}
          aria-hidden="true"
        >
          {online ? (failed > 0 ? 'sync_problem' : 'cloud_sync') : 'cloud_off'}
        </span>
        <div>
          <div className="font-bold">
            {!online
              ? `Offline mode — ${pending + failed} report${pending + failed === 1 ? '' : 's'} queued on this device`
              : pending > 0
                ? `${pending} report${pending === 1 ? '' : 's'} waiting to sync`
                : failed > 0
                  ? `${failed} report${failed === 1 ? '' : 's'} failed to sync`
                  : 'Offline queue synced'}
          </div>
          <div className="text-on-surface-variant">
            {message ||
              (!online
                ? 'Reports are saved locally, not yet received by JeevanGrid. Do not close the browser tab.'
                : failed > 0
                  ? 'Retry sends the same idempotency key, so the server will not create duplicates.'
                  : 'Pending reports have not reached the server until this message says synced.')}
            {lastDataAt && (
              <span className="block text-[10px] mt-0.5">
                Last data received: {new Date(lastDataAt).toLocaleString()} — cached data is not live.
              </span>
            )}
          </div>
        </div>
      </div>
      {(pending > 0 || failed > 0) && online && (
        <button
          type="button"
          onClick={() => flush(true)}
          disabled={syncing}
          className="min-h-[44px] rounded-xl bg-primary px-4 text-xs font-bold text-on-primary disabled:opacity-50"
        >
          {syncing ? 'Syncing…' : 'Retry now'}
        </button>
      )}
    </div>
  );
};
