import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resolveCheckedItemIds, type RunSnapshot } from "@/lib/shift/run";

const { loadBrowserClient, updateRun, rpc, enqueueSyncOp, listSyncOps, moveToDeadLetter, removeSyncOp, updateSyncOp } = vi.hoisted(() => ({
  loadBrowserClient: vi.fn(),
  updateRun: vi.fn(),
  rpc: vi.fn(),
  enqueueSyncOp: vi.fn(),
  listSyncOps: vi.fn(),
  moveToDeadLetter: vi.fn(),
  removeSyncOp: vi.fn(),
  updateSyncOp: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => {
  loadBrowserClient();
  return { createClient: () => ({ from: updateRun, rpc }) };
});

vi.mock("@/lib/offline/idb", () => ({
  enqueueSyncOp, listSyncOps, moveToDeadLetter, removeSyncOp, updateSyncOp, MAX_SYNC_ATTEMPTS: 5,
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

const run: RunSnapshot = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  venue_id: "venue-a", template_id: "template-a", user_id: "user-a",
  status: "active", completed_at: null, started_at: "2026-11-24T12:00:00Z",
  checked_item_ids: ["task-1", "task-2"],
};

it("loads the browser client only when there is a pending checklist write", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const { syncOfflineQueues } = await import("@/lib/offline/sync");
  listSyncOps.mockResolvedValue([]);
  const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  updateRun.mockReturnValue({ update });

  expect(await syncOfflineQueues()).toEqual({ checklistOps: 0, wasteOps: 0 });
  expect(loadBrowserClient).not.toHaveBeenCalled();

  listSyncOps.mockResolvedValue([{
    id: "pending-1",
    kind: "checklist_run_update",
    payload: { id: "run-1", checked_item_ids: ["task-1"] },
  }]);
  expect(await syncOfflineQueues()).toEqual({ checklistOps: 1, wasteOps: 0 });
  expect(updateRun).toHaveBeenCalledWith("checklist_runs");
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ checked_item_ids: ["task-1"] }));
  expect(removeSyncOp).toHaveBeenCalledWith("pending-1");
});

it("queues only the changed item and saves completion without a checklist snapshot", async () => {
  vi.stubGlobal("navigator", { onLine: false });
  const { persistChecklistItemDelta, completeChecklistRun } = await import("./checklist-sync");

  const changed = await persistChecklistItemDelta({ run, itemId: "task-1", checked: false });
  expect(changed.run.checked_item_ids).toEqual(["task-2"]);
  expect(changed.queued).toBe(true);
  expect(enqueueSyncOp).toHaveBeenNthCalledWith(1, {
    kind: "checklist_item_upsert",
    payload: { run_id: run.id, item_id: "task-1", checked: false },
  });
  await completeChecklistRun(changed.run);
  expect(enqueueSyncOp).toHaveBeenNthCalledWith(2, {
    kind: "checklist_run_update",
    payload: { id: run.id, status: "completed", completed_at: expect.any(String) },
  });
});

it("leaves queued waste entries for the waste worker", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const { flushChecklistSyncQueue } = await import("./checklist-sync");
  listSyncOps.mockResolvedValueOnce([{ id: "waste-1", kind: "waste_entry", payload: {} }]);

  expect(await flushChecklistSyncQueue()).toBe(0);
  expect(updateRun).not.toHaveBeenCalled();
  expect(removeSyncOp).not.toHaveBeenCalled();
  expect(updateSyncOp).not.toHaveBeenCalled();
});

function delta(id: string, item_id: string, checked: boolean, attempts = 0) {
  return {
    id, kind: "checklist_item_upsert", attempts, last_error: null,
    payload: { run_id: run.id, item_id, checked },
  };
}

it("keeps retry metadata and continues with another item in the same run", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const { flushChecklistSyncQueue } = await import("./checklist-sync");
  listSyncOps.mockResolvedValueOnce([delta("first", "task-1", true), delta("other", "task-2", true)]);
  rpc.mockResolvedValueOnce({ error: { message: "offline" } }).mockResolvedValue({ error: null });

  expect(await flushChecklistSyncQueue()).toBe(1);
  expect(updateSyncOp).toHaveBeenCalledWith(expect.objectContaining({ id: "first", attempts: 1, last_error: "offline" }));
  expect(removeSyncOp.mock.calls).toEqual([["other"]]);
  expect(rpc.mock.calls).toEqual([
    ["upsert_shift_checklist_item", { p_run_id: run.id, p_item_id: "task-1", p_checked: true }],
    ["upsert_shift_checklist_item", { p_run_id: run.id, p_item_id: "task-2", p_checked: true }],
  ]);
  expect(updateRun).not.toHaveBeenCalled();
});

it("drops a pending retry when a newer toggle of the same item succeeds", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const { flushChecklistSyncQueue } = await import("./checklist-sync");
  listSyncOps.mockResolvedValueOnce([delta("earlier", "task-1", true, 2), delta("newer", "task-1", false)]);
  rpc.mockResolvedValueOnce({ error: { message: "write failed" } }).mockResolvedValue({ error: null });

  expect(await flushChecklistSyncQueue()).toBe(1);
  expect(removeSyncOp.mock.calls).toEqual([["earlier"], ["newer"]]);
});

it("moves the fifth failure to dead letter and continues replay", async () => {
  vi.stubGlobal("navigator", { onLine: true });
  const { flushChecklistSyncQueue } = await import("./checklist-sync");
  listSyncOps.mockResolvedValueOnce([delta("broken", "task-1", true, 4), delta("next", "task-2", true)]);
  rpc.mockResolvedValueOnce({ error: { message: "permission denied" } }).mockResolvedValue({ error: null });

  expect(await flushChecklistSyncQueue()).toBe(1);
  expect(moveToDeadLetter).toHaveBeenCalledWith(
    expect.objectContaining({ id: "broken", attempts: 5, last_error: "permission denied" }),
    "permission denied",
  );
  expect(updateSyncOp).not.toHaveBeenCalled();
  expect(removeSyncOp).toHaveBeenCalledWith("next");
});

it("keeps untouched legacy items and honors explicit unchecks", () => {
  expect(resolveCheckedItemIds(["task-1", "task-2"], [
    { item_id: "task-1", checked: false },
    { item_id: "task-3", checked: true },
  ])).toEqual(["task-2", "task-3"]);
});
