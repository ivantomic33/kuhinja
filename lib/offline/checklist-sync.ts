import { getChecklistRunAlias, saveChecklistRunAlias } from "@/lib/offline/cache";
import {
  enqueueSyncOp,
  listSyncOps,
  MAX_SYNC_ATTEMPTS,
  moveToDeadLetter,
  removeSyncOp,
  updateSyncOp,
  type ChecklistRunStart,
  type SyncQueueOp,
} from "@/lib/offline/idb";
import { upsertShiftChecklistItemSchema } from "@/lib/schemas/domain";
import { runFromRow, type RunSnapshot } from "@/lib/shift/run";
import type { createClient } from "@/lib/supabase/client";

export type { RunSnapshot } from "@/lib/shift/run";

type Client = ReturnType<typeof createClient>;
type ChecklistSyncOp = Exclude<SyncQueueOp, { kind: "waste_entry" }>;

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

async function ensureRun(supabase: Client, run: ChecklistRunStart) {
  const id = await getChecklistRunAlias(run.id);
  if (id !== run.id) return id;

  // Never reset status when a start is retried after another device finished.
  const { error } = await supabase.from("checklist_runs").upsert(run, {
    onConflict: "id",
    ignoreDuplicates: true,
  });
  if (!error) return id;
  if (error.code !== "23505") throw error;

  const { data, error: lookupError } = await supabase.from("checklist_runs")
    .select("id")
    .eq("venue_id", run.venue_id)
    .eq("template_id", run.template_id)
    .eq("user_id", run.user_id)
    .eq("status", "active")
    .maybeSingle();
  if (lookupError || !data) throw lookupError ?? error;
  await saveChecklistRunAlias(id, data.id);
  return data.id;
}

function opRunId(op: ChecklistSyncOp) {
  return op.kind === "checklist_item_upsert" ? op.payload.run_id : op.payload.id;
}

async function pushOp(supabase: Client, op: ChecklistSyncOp, runId: string) {
  if (op.kind === "checklist_item_upsert") {
    const { item_id, checked, ensure_run } = op.payload;
    if (ensure_run) {
      const { id, venue_id, template_id, user_id, started_at } = ensure_run;
      runId = await ensureRun(supabase, { id, venue_id, template_id, user_id, started_at });
    }
    const args = upsertShiftChecklistItemSchema.parse({
      p_run_id: runId,
      p_item_id: item_id,
      p_checked: checked,
    });
    const { error } = await supabase.rpc("upsert_shift_checklist_item", args);
    if (error) throw error;
    return;
  }

  if (op.kind === "checklist_run_start") {
    await ensureRun(supabase, op.payload);
    return;
  }

  // Older IndexedDB entries can still contain a legacy snapshot.
  if (op.kind === "checklist_run_upsert") {
    const { error } = await supabase.from("checklist_runs")
      .upsert({ ...op.payload, id: runId }, { onConflict: "id" });
    if (error) throw error;
    return;
  }

  const { status, checked_item_ids, completed_at } = op.payload;
  const patch = { status, checked_item_ids, completed_at };
  const { error } = await supabase.from("checklist_runs").update(patch).eq("id", runId);
  if (error) throw error;
}

async function flushOnce(): Promise<number> {
  if (!isOnline()) return 0;
  const ops = (await listSyncOps()).filter((op) => op.kind !== "waste_entry");
  if (!ops.length) return 0;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const failedItems = new Map<string, string[]>();
  let synced = 0;

  for (const op of ops) {
    let itemKey: string | undefined;
    try {
      const runId = await getChecklistRunAlias(opRunId(op));
      if (op.kind === "checklist_item_upsert") {
        itemKey = JSON.stringify([runId, op.payload.item_id]);
      }
      await pushOp(supabase, op, runId);
      // A retry of an earlier toggle must not undo this successful write.
      if (itemKey) {
        for (const id of failedItems.get(itemKey) ?? []) await removeSyncOp(id);
        failedItems.delete(itemKey);
      }
      await removeSyncOp(op.id);
      synced++;
    } catch (error) {
      const attempts = (op.attempts ?? 0) + 1;
      const message = typeof error === "object" && error && "message" in error
        ? String(error.message)
        : String(error);
      const failed = { ...op, attempts, last_error: message };
      if (attempts >= MAX_SYNC_ATTEMPTS) {
        await moveToDeadLetter(failed, message);
      } else {
        await updateSyncOp(failed);
        if (itemKey) {
          const earlier = failedItems.get(itemKey) ?? [];
          earlier.push(op.id);
          failedItems.set(itemKey, earlier);
        }
      }
    }
  }

  return synced;
}

let flushing = Promise.resolve(0);

export function flushChecklistSyncQueue(): Promise<number> {
  const next = flushing.catch(() => 0).then(async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request("treuplate-checklist-sync", flushOnce);
    }
    return flushOnce();
  });
  flushing = next;
  return next;
}

export async function hasPendingChecklistWrites(id: string): Promise<boolean> {
  const runId = await getChecklistRunAlias(id);
  for (const op of await listSyncOps()) {
    if (op.kind === "waste_entry") continue;
    if (await getChecklistRunAlias(opRunId(op)) === runId) return true;
  }
  return false;
}

type PersistRunResult = { run: RunSnapshot; queued: boolean };

async function persist(run: RunSnapshot, input: Parameters<typeof enqueueSyncOp>[0]): Promise<PersistRunResult> {
  const op = await enqueueSyncOp(input);
  if (!isOnline()) return { run, queued: true };

  await flushChecklistSyncQueue();
  const queued = (await listSyncOps()).some((pending) => pending.id === op.id);
  return { run: { ...run, id: await getChecklistRunAlias(run.id) }, queued };
}

export async function persistChecklistItemDelta({
  run,
  itemId,
  checked,
}: {
  run: RunSnapshot;
  itemId: string;
  checked: boolean;
}): Promise<PersistRunResult> {
  const args = upsertShiftChecklistItemSchema.parse({
    p_run_id: run.id,
    p_item_id: itemId,
    p_checked: checked,
  });
  const ids = new Set(run.checked_item_ids);
  if (checked) ids.add(itemId);
  else ids.delete(itemId);

  return persist({ ...run, checked_item_ids: [...ids] }, {
    kind: "checklist_item_upsert",
    payload: { run_id: args.p_run_id, item_id: args.p_item_id, checked: args.p_checked },
  });
}

export async function completeChecklistRun(run: RunSnapshot): Promise<PersistRunResult> {
  const completed_at = new Date().toISOString();
  return persist({ ...run, status: "completed", completed_at }, {
    kind: "checklist_run_update",
    payload: { id: run.id, status: "completed", completed_at },
  });
}

export async function createChecklistRun(input: {
  venue_id: string;
  template_id: string;
  user_id: string;
}): Promise<PersistRunResult> {
  const pending = (await listSyncOps()).find((op) => op.kind === "checklist_run_start" &&
    op.payload.user_id === input.user_id && op.payload.template_id === input.template_id);
  const start = pending?.kind === "checklist_run_start" ? pending.payload : {
    id: crypto.randomUUID(),
    started_at: new Date().toISOString(),
    ...input,
  };
  const run: RunSnapshot = { ...start, status: "active", checked_item_ids: [], completed_at: null };
  const result = pending
    ? { run, queued: true }
    : await persist(run, { kind: "checklist_run_start", payload: start });

  if (result.run.id !== start.id) {
    const current = await loadChecklistRun(result.run.id);
    if (current) return { ...result, run: current };
  }
  return result;
}

export async function loadChecklistRun(id: string): Promise<RunSnapshot | null> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const runId = await getChecklistRunAlias(id);
  const [{ data: run, error: runError }, { data: items, error: itemsError }] = await Promise.all([
    supabase.from("checklist_runs").select("id, venue_id, template_id, user_id, status, checked_item_ids, started_at, completed_at, created_at, updated_at").eq("id", runId).maybeSingle(),
    supabase.from("shift_checklist_items").select("item_id, checked").eq("run_id", runId),
  ]);
  if (runError || itemsError) throw runError ?? itemsError;
  return run ? runFromRow(run, items) : null;
}
