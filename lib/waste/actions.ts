"use server";

import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import { requireWorkspaceMember } from "@/lib/workspace/server";
import {
  addWasteCorrectionSchema,
  addWasteEntrySchema,
  wasteReportPeriodSchema,
} from "./schemas";
import { belgradeMonthBounds } from "./period";

function mapRpcError(error: {
  message?: string;
  code?: string;
}): ActionResult<never> {
  const message = error.message ?? "Request failed.";
  if (error.code === "42501" || message.toLowerCase().includes("access denied")) {
    return actionError("FORBIDDEN", "Nemate dozvolu za ovu radnju.");
  }
  if (message.includes("UPGRADE_REQUIRED")) {
    return actionError("UPGRADE_REQUIRED", "Evidencija otpada zahteva Starter ili Pro paket.");
  }
  if (message.includes("CORRECTION_WINDOW_EXPIRED")) {
    return actionError("VALIDATION_ERROR", "Ispravka je dozvoljena samo u roku od 24 sata.");
  }
  if (message.includes("CORRECTION_ALREADY_EXISTS")) {
    return actionError("VALIDATION_ERROR", "Ovaj unos je već ispravljen.");
  }
  if (message.includes("RECIPE_COST_UNAVAILABLE")) {
    return actionError("VALIDATION_ERROR", "Trošak porcije recepta nije dostupan.");
  }
  if (message.includes("UNIT_COST_MISMATCH")) {
    return actionError("VALIDATION_ERROR", "Cena se uzima sa servera i ne može se menjati.");
  }
  if (message.includes("NEGATIVE_STOCK")) {
    return actionError("VALIDATION_ERROR", "Zaliha ne sme biti negativna.");
  }
  if (
    message.includes("INVALID_") ||
    message.includes("INGREDIENT_") ||
    message.includes("RECIPE_") ||
    message.includes("ENTRY_") ||
    message.includes("SUBJECT_") ||
    message.includes("ADJUST_STOCK") ||
    error.code === "22023" ||
    error.code === "P0001" ||
    error.code === "P0002"
  ) {
    return actionError("VALIDATION_ERROR", message);
  }
  return actionError("INTERNAL_ERROR", message);
}

export type WasteEntryRow = {
  id: string;
  workspaceId: string;
  ingredientId: string | null;
  recipeId: string | null;
  name: string;
  quantity: number;
  unit: string;
  reason: string;
  unitCostSnapshot: number;
  costRsd: number;
  isCorrection: boolean;
  clientId: string | null;
  createdAt: string;
};

function mapEntry(row: Record<string, unknown>): WasteEntryRow {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    ingredientId: row.ingredient_id ? String(row.ingredient_id) : null,
    recipeId: row.recipe_id ? String(row.recipe_id) : null,
    name: String(row.ingredient_name_snapshot ?? ""),
    quantity: Number(row.quantity) || 0,
    unit: String(row.unit ?? ""),
    reason: String(row.reason ?? ""),
    unitCostSnapshot: Number(row.unit_cost_snapshot) || 0,
    costRsd: Number(row.cost_rsd) || 0,
    isCorrection: Boolean(row.is_correction),
    clientId: row.client_id ? String(row.client_id) : null,
    createdAt: String(row.created_at ?? ""),
  };
}

export async function addWasteEntry(
  input: unknown,
): Promise<ActionResult<WasteEntryRow>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(addWasteEntrySchema, input);
  if ("error" in parsed) return parsed;

  const { data, error } = await auth.supabase.rpc("add_waste_entry", {
    p_ingredient_id: parsed.data.ingredientId ?? null,
    p_recipe_id: parsed.data.recipeId ?? null,
    p_quantity: parsed.data.quantity,
    p_unit: parsed.data.unit,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
    p_adjust_stock: parsed.data.adjustStock,
    p_client_id: parsed.data.clientId,
    p_unit_cost_snapshot: parsed.data.unitCostSnapshot,
  });

  if (error) return mapRpcError(error);
  return actionData(mapEntry((data ?? {}) as Record<string, unknown>));
}

export async function addWasteCorrection(
  input: unknown,
): Promise<ActionResult<WasteEntryRow>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(addWasteCorrectionSchema, input);
  if ("error" in parsed) return parsed;

  const { data, error } = await auth.supabase.rpc("add_waste_correction", {
    p_entry_id: parsed.data.entryId,
    p_note: parsed.data.note,
  });

  if (error) return mapRpcError(error);
  return actionData(mapEntry((data ?? {}) as Record<string, unknown>));
}

export type WasteSummary = {
  totalNet: number;
  totalGross: number;
  totalCorrections: number;
  reasons: Array<{ reason: string; amount: number }>;
  topIngredients: Array<{ name: string; ingredientId: string | null; amount: number }>;
  from: string;
  to: string;
  locked: boolean;
};

export async function loadWasteMonthSummary(
  workspaceId?: string,
): Promise<ActionResult<WasteSummary>> {
  const member = await requireWorkspaceMember("cook", workspaceId);
  if ("error" in member) return member;

  const { data: hasFeature } = await member.supabase.rpc("workspace_has_feature", {
    p_workspace_id: member.workspaceId,
    p_feature: "waste_log",
  });

  const bounds = belgradeMonthBounds();
  if (!hasFeature) {
    return actionData({
      totalNet: 0,
      totalGross: 0,
      totalCorrections: 0,
      reasons: [],
      topIngredients: [],
      from: bounds.from,
      to: bounds.to,
      locked: true,
    });
  }

  const { data, error } = await member.supabase.rpc("waste_report_summary", {
    p_workspace_id: member.workspaceId,
    p_from: bounds.from,
    p_to: bounds.to,
  });

  if (error) return mapRpcError(error);

  const payload = (data ?? {}) as {
    total_net?: number;
    total_gross?: number;
    total_corrections?: number;
    reasons?: Array<{ reason?: string; amount?: number }>;
    top_ingredients?: Array<{ name?: string; ingredient_id?: string; amount?: number }>;
  };

  return actionData({
    totalNet: Number(payload.total_net) || 0,
    totalGross: Number(payload.total_gross) || 0,
    totalCorrections: Number(payload.total_corrections) || 0,
    reasons: (payload.reasons ?? []).map((row) => ({
      reason: String(row.reason ?? ""),
      amount: Number(row.amount) || 0,
    })),
    topIngredients: (payload.top_ingredients ?? []).map((row) => ({
      name: String(row.name ?? ""),
      ingredientId: row.ingredient_id ? String(row.ingredient_id) : null,
      amount: Number(row.amount) || 0,
    })),
    from: bounds.from,
    to: bounds.to,
    locked: false,
  });
}

export async function listWasteEntries(
  input: unknown,
): Promise<ActionResult<WasteEntryRow[]>> {
  const parsed = parseActionInput(wasteReportPeriodSchema, input);
  if ("error" in parsed) return parsed;

  const member = await requireWorkspaceMember("cook", parsed.data.workspaceId);
  if ("error" in member) return member;

  const { data, error } = await member.supabase.rpc("waste_report", {
    p_workspace_id: parsed.data.workspaceId,
    p_from: parsed.data.from,
    p_to: parsed.data.to,
  });

  if (error) return mapRpcError(error);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return actionData(
    rows.map((row) =>
      mapEntry({
        id: row.entry_id,
        workspace_id: parsed.data.workspaceId,
        ingredient_id: row.ingredient_id,
        recipe_id: row.recipe_id,
        ingredient_name_snapshot: row.subject_name,
        quantity: row.quantity,
        unit: row.unit,
        reason: row.reason,
        unit_cost_snapshot: row.unit_cost_snapshot,
        cost_rsd: row.cost_rsd,
        is_correction: row.is_correction,
        client_id: null,
        created_at: row.created_at,
      }),
    ),
  );
}
