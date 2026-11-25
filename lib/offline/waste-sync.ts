import {
  enqueueSyncOp,
  listSyncOps,
  MAX_SYNC_ATTEMPTS,
  moveToDeadLetter,
  removeSyncOp,
  updateSyncOp,
  type SyncQueueOp,
  type WasteEntryPayload,
} from "@/lib/offline/idb";
import { addWasteEntrySchema } from "@/lib/waste/schemas";

type Client = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

function isOnline() {
  return typeof navigator === "undefined" || navigator.onLine;
}

function isValidationFailure(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("upgrade_required") ||
    m.includes("invalid_") ||
    m.includes("unit_cost") ||
    m.includes("subject_") ||
    m.includes("recipe_cost") ||
    m.includes("ingredient_not") ||
    m.includes("access denied") ||
    m.includes("validation")
  );
}

async function pushWasteOp(supabase: Client, op: Extract<SyncQueueOp, { kind: "waste_entry" }>) {
  const p = op.payload;
  const args = addWasteEntrySchema.parse({
    ingredientId: p.ingredient_id,
    recipeId: p.recipe_id,
    quantity: p.quantity,
    unit: p.unit,
    reason: p.reason,
    note: p.note,
    adjustStock: p.adjust_stock,
    clientId: p.client_id,
    unitCostSnapshot: p.unit_cost_snapshot,
  });

  const { error } = await supabase.rpc("add_waste_entry", {
    p_ingredient_id: args.ingredientId ?? null,
    p_recipe_id: args.recipeId ?? null,
    p_quantity: args.quantity,
    p_unit: args.unit,
    p_reason: args.reason,
    p_note: args.note,
    p_adjust_stock: args.adjustStock,
    p_client_id: args.clientId,
    p_unit_cost_snapshot: args.unitCostSnapshot,
  });
  if (error) throw error;
}

async function flushOnce(): Promise<number> {
  if (!isOnline()) return 0;
  const ops = (await listSyncOps()).filter((op) => op.kind === "waste_entry");
  if (!ops.length) return 0;

  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient() as unknown as Client;
  let synced = 0;

  for (const op of ops) {
    if (op.kind !== "waste_entry") continue;
    try {
      await pushWasteOp(supabase, op);
      await removeSyncOp(op.id);
      synced += 1;
    } catch (error) {
      const attempts = (op.attempts ?? 0) + 1;
      const message =
        typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : String(error);
      const failed = { ...op, attempts, last_error: message };
      // Permanent validation / plan errors → dead letter immediately.
      if (isValidationFailure(message) || attempts >= MAX_SYNC_ATTEMPTS) {
        await moveToDeadLetter(failed, message);
      } else {
        await updateSyncOp(failed);
      }
    }
  }

  return synced;
}

let flushing = Promise.resolve(0);

export function flushWasteSyncQueue(): Promise<number> {
  const next = flushing.catch(() => 0).then(async () => {
    if (typeof navigator !== "undefined" && navigator.locks) {
      return await navigator.locks.request("treuplate-waste-sync", flushOnce);
    }
    return flushOnce();
  });
  flushing = next;
  return next;
}

export async function enqueueWasteEntry(
  payload: WasteEntryPayload,
): Promise<{ queued: boolean; clientId: string }> {
  const op = await enqueueSyncOp({
    kind: "waste_entry",
    id: payload.client_id,
    payload,
  });

  if (!isOnline()) return { queued: true, clientId: payload.client_id };

  await flushWasteSyncQueue();
  const stillQueued = (await listSyncOps()).some((pending) => pending.id === op.id);
  return { queued: stillQueued, clientId: payload.client_id };
}

export async function hasPendingWasteWrites(userId?: string): Promise<boolean> {
  for (const op of await listSyncOps()) {
    if (op.kind !== "waste_entry") continue;
    if (!userId || op.payload.user_id === userId) return true;
  }
  return false;
}
