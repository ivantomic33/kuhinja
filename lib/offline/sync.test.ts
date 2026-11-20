import { afterEach, expect, it, vi } from "vitest";

const { loadBrowserClient, updateRun, listSyncOps, removeSyncOp } = vi.hoisted(() => ({
  loadBrowserClient: vi.fn(),
  updateRun: vi.fn(),
  listSyncOps: vi.fn(),
  removeSyncOp: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  loadBrowserClient();
  return { createClient: () => ({ from: updateRun }) };
});

vi.mock("@/lib/offline/idb", () => ({ listSyncOps, removeSyncOp }));

afterEach(() => vi.unstubAllGlobals());

it("loads the browser client only when there is a pending checklist write", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const { syncOfflineQueues } = await import("@/lib/offline/sync");
  listSyncOps.mockResolvedValueOnce([]).mockResolvedValueOnce([{
    id: "pending-1",
    kind: "checklist_run_update",
    payload: { id: "run-1", checked_item_ids: ["task-1"] },
  }]);
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  updateRun.mockReturnValue({ update });

  expect(await syncOfflineQueues()).toEqual({ checklistOps: 0 });
  expect(loadBrowserClient).not.toHaveBeenCalled();

  expect(await syncOfflineQueues()).toEqual({ checklistOps: 1 });
  expect(updateRun).toHaveBeenCalledWith("checklist_runs");
  expect(update).toHaveBeenCalledWith({ checked_item_ids: ["task-1"] });
  expect(removeSyncOp).toHaveBeenCalledWith("pending-1");
});
