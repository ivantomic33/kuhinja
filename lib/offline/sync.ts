import { flushChecklistSyncQueue } from "@/lib/offline/checklist-sync";
import { flushWasteSyncQueue } from "@/lib/offline/waste-sync";

export type OfflineSyncResult = {
  checklistOps: number;
  wasteOps: number;
};

/** Flush all offline write queues when connectivity returns. */
export async function syncOfflineQueues(): Promise<OfflineSyncResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { checklistOps: 0, wasteOps: 0 };
  }

  const [checklistOps, wasteOps] = await Promise.all([
    flushChecklistSyncQueue(),
    flushWasteSyncQueue(),
  ]);
  return { checklistOps, wasteOps };
}

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
