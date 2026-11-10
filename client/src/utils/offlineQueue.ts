import { apiFetch } from '../api/client';

/**
 * Feature 6 — offline queue (native IndexedDB, no new dependency).
 *
 * Every queued submission carries a client idempotency key. Re-sync after a
 * dropped response cannot create a duplicate on the server. Contacts are kept
 * only while the submission is pending/failed: synced items are purged after
 * 7 days, failed items after 30 days.
 */

export type QueueKind = 'emergency-report' | 'field-report';
export type QueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';

export interface QueueItem {
  id: string;
  kind: QueueKind;
  endpoint: string;
  body: Record<string, any>;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  status: QueueStatus;
  attempts: number;
  lastError?: string;
  syncedAt?: string;
  serverResponse?: any;
}

const DB_NAME = 'jeevangrid-offline';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';
const META_STORE = 'meta';
const SYNCED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const FAILED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const QUEUE_EVENT = 'jeevangrid:queue-changed';

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `jg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function dispatch(): void {
  try {
    window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
  } catch {
    /* non-browser */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser does not support IndexedDB. Offline queuing is unavailable.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        store.createIndex('status', 'status');
        store.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Could not open offline database.'));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result: T;
    fn(store)
      .then((value) => {
        result = value;
        tx.oncomplete = () => {
          db.close();
          resolve(result);
        };
      })
      .catch((e) => {
        db.close();
        reject(e);
      });
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueueSubmission(
  kind: QueueKind,
  endpoint: string,
  body: Record<string, any>
): Promise<QueueItem> {
  const now = new Date().toISOString();
  const idempotencyKey = body.idempotencyKey || newId();
  const item: QueueItem = {
    id: newId(),
    kind,
    endpoint,
    body: { ...body, idempotencyKey },
    idempotencyKey,
    createdAt: now,
    updatedAt: now,
    status: 'PENDING',
    attempts: 0,
  };
  await withStore(QUEUE_STORE, 'readwrite', (store) => requestToPromise(store.put(item)));
  dispatch();
  return item;
}

export async function listQueue(): Promise<QueueItem[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readonly');
    const req = tx.objectStore(QUEUE_STORE).getAll();
    req.onsuccess = () => {
      db.close();
      const items = (req.result || []) as QueueItem[];
      items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      resolve(items);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function updateQueueItem(id: string, patch: Partial<QueueItem>): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    const store = tx.objectStore(QUEUE_STORE);
    const get = store.get(id);
    get.onsuccess = () => {
      if (!get.result) return;
      store.put({ ...get.result, ...patch, updatedAt: new Date().toISOString() });
    };
    tx.oncomplete = () => {
      db.close();
      dispatch();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteQueueItem(id: string): Promise<void> {
  await withStore(QUEUE_STORE, 'readwrite', (store) => requestToPromise(store.delete(id)));
  dispatch();
}

export async function getQueueSummary(): Promise<{
  items: QueueItem[];
  pending: number;
  failed: number;
  synced: number;
}> {
  const items = await listQueue();
  return {
    items,
    pending: items.filter((i) => i.status === 'PENDING' || i.status === 'SYNCING').length,
    failed: items.filter((i) => i.status === 'FAILED').length,
    synced: items.filter((i) => i.status === 'SYNCED').length,
  };
}

export async function setMeta(key: string, value: any): Promise<void> {
  await withStore(META_STORE, 'readwrite', (store) => requestToPromise(store.put({ key, value })));
}

export async function getMeta<T = any>(key: string): Promise<T | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const req = tx.objectStore(META_STORE).get(key);
    req.onsuccess = () => {
      db.close();
      resolve((req.result?.value ?? null) as T);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

/** Deletes old synced/failed rows so queued personal data does not accumulate. */
export async function retentionSweep(): Promise<void> {
  const items = await listQueue();
  const now = Date.now();
  for (const item of items) {
    const age = now - new Date(item.updatedAt).getTime();
    if (item.status === 'SYNCED' && age > SYNCED_RETENTION_MS) await deleteQueueItem(item.id);
    if (item.status === 'FAILED' && age > FAILED_RETENTION_MS) await deleteQueueItem(item.id);
  }
}

export async function flushOfflineQueue(options: { includeFailed?: boolean } = {}): Promise<{
  attempted: number;
  synced: number;
  failed: number;
}> {
  const items = await listQueue();
  const eligible = items.filter(
    (i) => i.status === 'PENDING' || (options.includeFailed && i.status === 'FAILED')
  );
  let synced = 0;
  let failed = 0;
  for (const item of eligible) {
    await updateQueueItem(item.id, { status: 'SYNCING' });
    try {
      const response = await apiFetch(item.endpoint, {
        method: 'POST',
        body: JSON.stringify(item.body),
      });
      synced += 1;
      await updateQueueItem(item.id, {
        status: 'SYNCED',
        syncedAt: new Date().toISOString(),
        lastError: undefined,
        serverResponse: response,
      });
      await setMeta('lastSyncAt', new Date().toISOString());
    } catch (e) {
      failed += 1;
      await updateQueueItem(item.id, {
        status: 'FAILED',
        attempts: item.attempts + 1,
        lastError: (e as Error).message.slice(0, 300),
      });
    }
  }
  await retentionSweep();
  return { attempted: eligible.length, synced, failed };
}

export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}
