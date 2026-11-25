import { afterEach, describe, expect, it, vi } from "vitest";

const clearOfflineCache = vi.fn(async () => undefined);
const clearOfflineCacheForUser = vi.fn(async () => undefined);
const resetOfflineUserIdCache = vi.fn();
const clearSyncQueue = vi.fn(async () => undefined);
const clearDeadLetters = vi.fn(async () => undefined);
const resetBrowserClient = vi.fn();
const signOut = vi.fn(async () => undefined);

vi.mock("@/lib/offline/cache", () => ({
  clearOfflineCache,
  clearOfflineCacheForUser,
  resetOfflineUserIdCache,
  resolveOfflineUserId: async () => "test-user",
  OFFLINE_CACHE_DB_NAME: "treuplate-cache",
}));
vi.mock("@/lib/offline/idb", () => ({
  clearSyncQueue,
  clearDeadLetters,
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
    expect(clearDeadLetters).toHaveBeenCalledOnce();
  });

  it("clears query cache, IDB helpers, cache storage, and local auth", async () => {
    const deletedCaches: string[] = [];
    const queryClient = { clear: vi.fn() };

    vi.stubGlobal("window", {});
    vi.stubGlobal("caches", {
      keys: async () => ["public-navigations", "next-static-assets", "unrelated-cache"],
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
    expect(clearDeadLetters).toHaveBeenCalledOnce();
    expect(clearOfflineCacheForUser).toHaveBeenCalledWith("test-user");
    expect(resetOfflineUserIdCache).toHaveBeenCalledOnce();
    expect(deletedCaches.sort()).toEqual(["next-static-assets", "public-navigations"]);
  });
});
