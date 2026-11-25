import type { ChecklistRun } from "@/lib/supabase/database.types";
import { parseCheckedItemIds } from "@/lib/shift/parse-items";
import {
  shiftChecklistItemStateListSchema,
  type ShiftChecklistItemState,
} from "@/lib/schemas/domain";

export type RunSnapshot = {
  id: string;
  venue_id: string;
  template_id: string;
  user_id: string;
  status: "active" | "completed";
  checked_item_ids: string[];
  started_at: string;
  completed_at: string | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Item rows override legacy JSON per item, including explicit unchecks.
 */
export function resolveCheckedItemIds(
  runCheckedItemIds: unknown,
  itemRows?: Array<Pick<ShiftChecklistItemState, "item_id" | "checked">> | null
): string[] {
  const parsedRows = shiftChecklistItemStateListSchema.safeParse(itemRows ?? []);
  const ids = new Set(parseCheckedItemIds(runCheckedItemIds));
  if (parsedRows.success) {
    for (const row of parsedRows.data) {
      if (row.checked) ids.add(row.item_id);
      else ids.delete(row.item_id);
    }
  }
  return [...ids];
}

export function runFromRow(
  row: ChecklistRun,
  itemRows?: Array<Pick<ShiftChecklistItemState, "item_id" | "checked">> | null
): RunSnapshot {
  return {
    id: row.id,
    venue_id: row.venue_id,
    template_id: row.template_id,
    user_id: row.user_id,
    status: row.status,
    checked_item_ids: resolveCheckedItemIds(row.checked_item_ids, itemRows),
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
