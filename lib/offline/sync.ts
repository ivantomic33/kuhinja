import { flushChecklistSyncQueue } from "@/lib/offline/checklist-sync";

export type OfflineSyncResult = {
  checklistOps: number;
};

/** Flush all offline write queues when connectivity returns. */
export async function syncOfflineQueues(): Promise<OfflineSyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { checklistOps: 0 };
  }

  const checklistOps = await flushChecklistSyncQueue();
  return { checklistOps };
}

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
