import {
  checklistItemsSchema,
  type ChecklistItemInput,
} from "@/lib/schemas/domain";

/** Safely parse template items JSON into typed checklist items. */
export function parseChecklistItems(raw: unknown): ChecklistItemInput[] {
  const result = checklistItemsSchema.safeParse(raw);
  if (result.success) return result.data;

  if (!Array.isArray(raw)) return [];

  const recovered: ChecklistItemInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : null;
    const label = typeof record.label === "string" ? record.label.trim() : null;
    if (!id || !label) continue;

    const item: ChecklistItemInput = { id, label };
    if (
      typeof record.minutes === "number" &&
      Number.isFinite(record.minutes) &&
      record.minutes > 0
    ) {
      item.minutes = record.minutes;
    }
    if (typeof record.group === "string" && record.group.trim()) {
      item.group = record.group.trim();
    }
    recovered.push(item);
  }
  return recovered;
}

export function parseCheckedItemIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.length > 0);
}
