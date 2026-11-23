import { afterEach, describe, expect, it, vi } from "vitest";

const clearOfflineCache = vi.fn(async () => undefined);
const clearSyncQueue = vi.fn(async () => undefined);
const resetBrowserClient = vi.fn();
const signOut = vi.fn(async () => undefined);

vi.mock("@/lib/offline/cache", () => ({
  clearOfflineCache,
  OFFLINE_CACHE_DB_NAME: "treuplate-cache",
}));
vi.mock("@/lib/offline/idb", () => ({
  clearSyncQueue,
  SYNC_QUEUE_DB_NAME: "treuplate-offline",
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signOut } }),
  resetBrowserClient,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("clearClientUserState", () => {
  it("keeps the session cookie available for the sign-out server action", async () => {
    vi.stubGlobal("window", {});
    const { clearClientUserState } = await import("@/lib/auth/clear-client-state");

    await clearClientUserState(null, { preserveSession: true });

    expect(signOut).not.toHaveBeenCalled();
    expect(clearOfflineCache).toHaveBeenCalledOnce();
    expect(clearSyncQueue).toHaveBeenCalledOnce();
  });

  it("clears query cache, IDB helpers, cache storage, and local auth", async () => {
    const deletedCaches: string[] = [];
    const queryClient = { clear: vi.fn() };

    vi.stubGlobal("window", {});
    vi.stubGlobal("caches", {
      keys: async () => ["pages", "next-static-assets"],
      delete: async (key: string) => {
        deletedCaches.push(key);
        return true;
      },
    });
    vi.stubGlobal("indexedDB", {
      deleteDatabase: (name: string) => {
        const request: {
          onsuccess: ((ev?: unknown) => void) | null;
          onerror: ((ev?: unknown) => void) | null;
          onblocked: ((ev?: unknown) => void) | null;
        } = {
          onsuccess: null,
          onerror: null,
          onblocked: null,
        };
        queueMicrotask(() => request.onsuccess?.(name));
        return request;
      },
    });
    vi.stubGlobal("sessionStorage", {
      removeItem: vi.fn(),
    });

    const { clearClientUserState } = await import("@/lib/auth/clear-client-state");
    await clearClientUserState(queryClient as never);

    expect(queryClient.clear).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(resetBrowserClient).toHaveBeenCalledOnce();
    expect(clearOfflineCache).toHaveBeenCalledOnce();
    expect(clearSyncQueue).toHaveBeenCalledOnce();
    expect(deletedCaches.sort()).toEqual(["next-static-assets", "pages"]);
  });
});
