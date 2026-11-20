import {
  enqueueSyncOp,
  listSyncOps,
  removeSyncOp,
  type SyncQueueOp,
} from "@/lib/offline/idb";
import {
  runFromRow,
  type RunSnapshot,
} from "@/lib/shift/run";

export type { RunSnapshot } from "@/lib/shift/run";
export { runFromRow } from "@/lib/shift/run";

function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function pushOp(op: SyncQueueOp): Promise<void> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();

  if (op.kind === "checklist_run_upsert") {
    const { error } = await supabase.from("checklist_runs").upsert(
      {
        id: op.payload.id,
        venue_id: op.payload.venue_id,
        template_id: op.payload.template_id,
        user_id: op.payload.user_id,
        status: op.payload.status,
        checked_item_ids: op.payload.checked_item_ids,
        started_at: op.payload.started_at,
        completed_at: op.payload.completed_at,
      },
      { onConflict: "id" }
    );
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("checklist_runs")
    .update({
      ...(op.payload.status !== undefined
        ? { status: op.payload.status }
        : {}),
      ...(op.payload.checked_item_ids !== undefined
        ? { checked_item_ids: op.payload.checked_item_ids }
        : {}),
      ...(op.payload.completed_at !== undefined
        ? { completed_at: op.payload.completed_at }
        : {}),
    })
    .eq("id", op.payload.id);

  if (error) throw error;
}

/** Flush queued offline writes in order. Returns number of ops synced. */
export async function flushChecklistSyncQueue(): Promise<number> {
  if (!isOnline()) return 0;

  const ops = await listSyncOps();
  let synced = 0;

  for (const op of ops) {
    try {
      await pushOp(op);
      await removeSyncOp(op.id);
      synced += 1;
    } catch {
      // Stop on first failure so order is preserved; retry later.
      break;
    }
  }

  return synced;
}

export type PersistRunResult = {
  run: RunSnapshot;
  queued: boolean;
};

/** Persist run progress: direct write when online, else queue in IndexedDB. */
export async function persistChecklistRun(
  run: RunSnapshot,
  mode: "upsert" | "update" = "update"
): Promise<PersistRunResult> {
  if (!isOnline()) {
    await enqueueSyncOp(
      mode === "upsert"
        ? {
            kind: "checklist_run_upsert",
            payload: {
              id: run.id,
              venue_id: run.venue_id,
              template_id: run.template_id,
              user_id: run.user_id,
              status: run.status,
              checked_item_ids: run.checked_item_ids,
              started_at: run.started_at,
              completed_at: run.completed_at,
            },
          }
        : {
            kind: "checklist_run_update",
            payload: {
              id: run.id,
              status: run.status,
              checked_item_ids: run.checked_item_ids,
              completed_at: run.completed_at,
            },
          }
    );
    return { run, queued: true };
  }

  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();

    if (mode === "upsert") {
      const { data, error } = await supabase
        .from("checklist_runs")
        .upsert(
          {
            id: run.id,
            venue_id: run.venue_id,
            template_id: run.template_id,
            user_id: run.user_id,
            status: run.status,
            checked_item_ids: run.checked_item_ids,
            started_at: run.started_at,
            completed_at: run.completed_at,
          },
          { onConflict: "id" }
        )
        .select("*")
        .single();

      if (error) throw error;
      return { run: runFromRow(data), queued: false };
    }

    const { data, error } = await supabase
      .from("checklist_runs")
      .update({
        status: run.status,
        checked_item_ids: run.checked_item_ids,
        completed_at: run.completed_at,
      })
      .eq("id", run.id)
      .select("*")
      .single();

    if (error) throw error;
    return { run: runFromRow(data), queued: false };
  } catch {
    // Network blip while navigator.onLine is still true — queue and continue.
    await enqueueSyncOp(
      mode === "upsert"
        ? {
            kind: "checklist_run_upsert",
            payload: {
              id: run.id,
              venue_id: run.venue_id,
              template_id: run.template_id,
              user_id: run.user_id,
              status: run.status,
              checked_item_ids: run.checked_item_ids,
              started_at: run.started_at,
              completed_at: run.completed_at,
            },
          }
        : {
            kind: "checklist_run_update",
            payload: {
              id: run.id,
              status: run.status,
              checked_item_ids: run.checked_item_ids,
              completed_at: run.completed_at,
            },
          }
    );
    return { run, queued: true };
  }
}

export async function createChecklistRun(input: {
  venue_id: string;
  template_id: string;
  user_id: string;
}): Promise<PersistRunResult> {
  const now = new Date().toISOString();
  const run: RunSnapshot = {
    id: crypto.randomUUID(),
    venue_id: input.venue_id,
    template_id: input.template_id,
    user_id: input.user_id,
    status: "active",
    checked_item_ids: [],
    started_at: now,
    completed_at: null,
  };

  return persistChecklistRun(run, "upsert");
}
