import type { ChecklistRun } from "@/lib/supabase/database.types";
import { parseCheckedItemIds } from "@/lib/shift/parse-items";

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

export function runFromRow(row: ChecklistRun): RunSnapshot {
  return {
    id: row.id,
    venue_id: row.venue_id,
    template_id: row.template_id,
    user_id: row.user_id,
    status: row.status,
    checked_item_ids: parseCheckedItemIds(row.checked_item_ids),
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
