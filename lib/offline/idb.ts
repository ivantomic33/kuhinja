/**
 * Minimal IndexedDB helpers for offline write queue + dead-letter store.
 * No external dependency — uses the browser IDB API directly.
 */

/** IndexedDB database for the offline sync queue. */
export const SYNC_QUEUE_DB_NAME = "treuplate-offline";
const DB_VERSION = 2;
const STORE_QUEUE = "sync_queue";
const STORE_DEAD = "dead_letter";

export const MAX_SYNC_ATTEMPTS = 5;
export const DEAD_LETTERS_CHANGED = "treuplate:dead-letters-changed";

type QueueMeta = {
  attempts: number;
  last_error: string | null;
};

export type ChecklistRunStart = {
  id: string;
  venue_id: string;
  template_id: string;
  user_id: string;
  started_at: string;
};

export type ChecklistItemDeltaPayload = {
  run_id: string;
  item_id: string;
  checked: boolean;
  venue_id?: string;
  template_id?: string;
  user_id?: string;
  /** Ensure run row exists before item upsert when offline-created. */
  ensure_run?: {
    id: string;
    venue_id: string;
    template_id: string;
    user_id: string;
    status: "active" | "completed";
    started_at: string;
    completed_at: string | null;
  };
};

/** Offline waste capture — unit cost from cache at enqueue time (P8 F5). */
export type WasteEntryPayload = {
  client_id: string;
  workspace_id: string;
  user_id: string;
  ingredient_id: string | null;
  recipe_id: string | null;
  quantity: number;
  unit: string;
  reason: string;
  note: string | null;
  adjust_stock: boolean;
  /** Cached unit cost at discard time — never recomputed on device. */
  unit_cost_snapshot: number;
  name_snapshot: string;
};

export type SyncQueueOp =
  | ({
      id: string;
      kind: "checklist_run_start";
      createdAt: number;
      payload: ChecklistRunStart;
    } & QueueMeta)
  | ({
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
    } & QueueMeta)
  | ({
      id: string;
      kind: "checklist_run_update";
      createdAt: number;
      payload: {
        id: string;
        status?: "active" | "completed";
        checked_item_ids?: string[];
        completed_at?: string | null;
      };
    } & QueueMeta)
  | ({
      id: string;
      kind: "checklist_item_upsert";
      createdAt: number;
      payload: ChecklistItemDeltaPayload;
    } & QueueMeta)
  | ({
      id: string;
      kind: "waste_entry";
      createdAt: number;
      payload: WasteEntryPayload;
    } & QueueMeta);

export type DeadLetterOp = SyncQueueOp & {
  deadAt: number;
  last_error: string;
  attempts: number;
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
      if (!db.objectStoreNames.contains(STORE_DEAD)) {
        const dead = db.createObjectStore(STORE_DEAD, { keyPath: "id" });
        dead.createIndex("deadAt", "deadAt", { unique: false });
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

function commit(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

let lastQueuedAt = 0;

export async function enqueueSyncOp(
  op: (SyncQueueOp extends infer Op
    ? Op extends SyncQueueOp ? Omit<Op, "id" | "createdAt" | keyof QueueMeta> : never
    : never) & {
    id?: string;
    createdAt?: number;
    attempts?: number;
    last_error?: string | null;
  }
): Promise<SyncQueueOp> {
  const createdAt = op.createdAt ?? Math.max(Date.now(), lastQueuedAt + 1);
  lastQueuedAt = Math.max(createdAt, lastQueuedAt);
  const full = {
    ...op,
    id: op.id ?? crypto.randomUUID(),
    createdAt,
    attempts: op.attempts ?? 0,
    last_error: op.last_error ?? null,
  } as SyncQueueOp;

  const db = await openDb();
  try {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).put(full);
    await commit(tx);
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
    return (rows as SyncQueueOp[]).map((row) => ({
      ...row,
      attempts: row.attempts ?? 0,
      last_error: row.last_error ?? null,
    }));
  } finally {
    db.close();
  }
}

export async function updateSyncOp(op: SyncQueueOp): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).put(op);
    await commit(tx);
  } finally {
    db.close();
  }
}

export async function removeSyncOp(id: string): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_QUEUE, "readwrite");
    tx.objectStore(STORE_QUEUE).delete(id);
    await commit(tx);
  } finally {
    db.close();
  }
}

export async function moveToDeadLetter(
  op: SyncQueueOp,
  errorMessage: string
): Promise<DeadLetterOp> {
  const dead: DeadLetterOp = {
    ...op,
    attempts: Math.max(op.attempts ?? 0, MAX_SYNC_ATTEMPTS),
    last_error: errorMessage,
    deadAt: Date.now(),
  };

  const db = await openDb();
  try {
    const tx = db.transaction([STORE_QUEUE, STORE_DEAD], "readwrite");
    tx.objectStore(STORE_DEAD).put(dead);
    tx.objectStore(STORE_QUEUE).delete(op.id);
    await commit(tx);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(DEAD_LETTERS_CHANGED));
    return dead;
  } finally {
    db.close();
  }
}

export async function listDeadLetters(): Promise<DeadLetterOp[]> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_DEAD, "readonly");
    const rows = await reqToPromise(
      tx.objectStore(STORE_DEAD).index("deadAt").getAll()
    );
    return (rows as DeadLetterOp[]) ?? [];
  } finally {
    db.close();
  }
}

export async function clearDeadLetters(): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_DEAD, "readwrite");
    tx.objectStore(STORE_DEAD).clear();
    await commit(tx);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(DEAD_LETTERS_CHANGED));
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
