"use client";

import { useEffect, useRef } from "react";
import { syncOfflineQueues } from "@/lib/offline/sync";

/** Listens for connectivity and flushes offline write queues. */
export function OfflineSync() {
  const syncingRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (syncingRef.current) return;
      if (!navigator.onLine) return;
      syncingRef.current = true;
      try {
        await syncOfflineQueues();
      } catch {
        // Retry on next online event.
      } finally {
        syncingRef.current = false;
      }
    };

    void run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, []);

  return null;
}
