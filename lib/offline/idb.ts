/**
 * Minimal IndexedDB helpers for offline write queue.
 * No external dependency — uses the browser IDB API directly.
 */

/** IndexedDB database for the offline sync queue. */
export const SYNC_QUEUE_DB_NAME = "treuplate-offline";
const DB_VERSION = 1;
const STORE_QUEUE = "sync_queue";

export type SyncQueueOp =
  | {
      id: string;
      kind: "checklist_run_upsert";
      createdAt: number;
      payload: {
        id: string;
        venue_id: string;
        template_id: string;
        user_id: string;
        status: "active" | "completed";
        checked_item_ids: string[];
        started_at: string;
        completed_at: string | null;
      };
    }
  | {
      id: string;
      kind: "checklist_run_update";
      createdAt: number;
      payload: {
        id: string;
        status?: "active" | "completed";
        checked_item_ids?: string[];
        completed_at?: string | null;
      };
    };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(SYNC_QUEUE_DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const store = db.createObjectStore(STORE_QUEUE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB"));
  });
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export async function enqueueSyncOp(
  op: Omit<SyncQueueOp, "id" | "createdAt"> & {
    id?: string;
    createdAt?: number;
  }
): Promise<SyncQueueOp> {
  const full: SyncQueueOp = {
    ...op,
    id: op.id ?? crypto.randomUUID(),
    createdAt: op.createdAt ?? Date.now(),
  } as SyncQueueOp;

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    await reqToPromise(tx.objectStore(STORE_QUEUE).put(full));
    return full;
  } finally {
    db.close();
  }
}

export async function listSyncOps(): Promise<SyncQueueOp[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_QUEUE, "readonly");
    const rows = await reqToPromise(
      tx.objectStore(STORE_QUEUE).index("createdAt").getAll()
    );
    return (rows as SyncQueueOp[]) ?? [];
  } finally {
    db.close();
  }
}

export async function removeSyncOp(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    await reqToPromise(tx.objectStore(STORE_QUEUE).delete(id));
  } finally {
    db.close();
  }
}

export async function clearSyncQueue(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    await reqToPromise(tx.objectStore(STORE_QUEUE).clear());
  } finally {
    db.close();
  }
}
