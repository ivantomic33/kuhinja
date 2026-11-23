/**
 * Wipe all client-side user data on sign-out / account delete.
 * Kitchen tablets are shared — the next session must not see prior data,
 * including when the device is offline.
 */
import type { QueryClient } from "@tanstack/react-query";
import { clearOfflineCache, OFFLINE_CACHE_DB_NAME } from "@/lib/offline/cache";
import { clearSyncQueue, SYNC_QUEUE_DB_NAME } from "@/lib/offline/idb";
import { resetBrowserClient } from "@/lib/supabase/client";

const USER_IDB_NAMES = [OFFLINE_CACHE_DB_NAME, SYNC_QUEUE_DB_NAME] as const;
const RECIPE_FOOD_COST_ALERT_KEY = "treuplate.recipe-food-cost-alert";

function deleteDatabase(name: string): Promise<void> {
  if (typeof indexedDB === "undefined") return Promise.resolve();

  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Delete every Cache Storage bucket (SW runtime + precache). */
export async function clearCacheStorage(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  } catch {
    // Best-effort on restricted contexts.
  }
}

/** Drop known user IndexedDB databases entirely. */
export async function clearUserIndexedDb(): Promise<void> {
  try {
    await clearOfflineCache();
  } catch {
    // continue
  }
  try {
    await clearSyncQueue();
  } catch {
    // continue
  }
  await Promise.all(USER_IDB_NAMES.map((name) => deleteDatabase(name)));
}

/**
 * Full client wipe used before redirecting to login.
 * Safe to call multiple times; never throws to the UI.
 */
export async function clearClientUserState(
  queryClient?: QueryClient | null,
  { preserveSession = false }: { preserveSession?: boolean } = {},
): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    queryClient?.clear();
  } catch {
    // ignore
  }

  // The sign-out server action needs the cookie to pass authenticated middleware.
  if (!preserveSession) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut({ scope: "local" });
    } catch {
      // Continue clearing local data.
    }
  }

  try {
    resetBrowserClient();
  } catch {
    // ignore
  }

  await Promise.all([clearCacheStorage(), clearUserIndexedDb()]);

  // Ephemeral UI flags that can reference the prior session's data views.
  try {
    sessionStorage.removeItem(RECIPE_FOOD_COST_ALERT_KEY);
  } catch {
    // ignore
  }
}
