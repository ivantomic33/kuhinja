"use server";

import { z } from "zod";
import { hasWorkspaceFeature } from "@/lib/billing/entitlements-server";
import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import {
  adjustStockSchema,
  createPurchaseOrderDraftSchema,
  inventorySetSchema,
  markOrderSentSchema,
  receivePurchaseOrderSchema,
  supplierUpsertSchema,
  updateIngredientStockFieldsSchema,
  updatePurchaseOrderDraftItemsSchema,
} from "./schemas";
import { groupBySupplier, mergeOrderCandidates } from "./qty";
import { formatPurchaseOrderText, waMeLink } from "./text";

const orderIdOnlySchema = z.object({ orderId: z.string().uuid() }).strict();

function mapRpcError(error: {
  message?: string;
  code?: string;
}): ActionResult<never> {
  const message = error.message ?? "Request failed.";
  if (error.code === "42501" || message.toLowerCase().includes("access denied")) {
    return actionError("FORBIDDEN", "Nemate dozvolu za ovu radnju.");
  }
  if (message.includes("NEGATIVE_STOCK")) {
    return actionError("VALIDATION_ERROR", "Zaliha ne sme biti negativna.");
  }
  if (message.includes("ORDER_ALREADY_RECEIVED") || message.includes("ITEM_ALREADY_RECEIVED")) {
    return actionError("VALIDATION_ERROR", "Narudžbenica je već primljena.");
  }
  if (message.includes("ORDER_NOT_DRAFT")) {
    return actionError("VALIDATION_ERROR", "Narudžbenica nije u statusu nacrt.");
  }
  if (message.includes("UPGRADE_REQUIRED")) {
    return actionError("UPGRADE_REQUIRED", "Ova funkcija zahteva viši paket.");
  }
  if (
    message.includes("INVALID_") ||
    message.includes("INGREDIENT_") ||
    message.includes("ORDER_") ||
    message.includes("ITEM_") ||
    error.code === "22023" ||
    error.code === "P0001" ||
    error.code === "P0002"
  ) {
    return actionError("VALIDATION_ERROR", message);
  }
  return actionError("INTERNAL_ERROR", message);
}

async function requireChef(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  workspaceId: string,
): Promise<ActionResult<never> | null> {
  const { data: ok, error } = await supabase.rpc("is_member", {
    p_workspace_id: workspaceId,
    p_min_role: "chef",
  });
  if (error) return actionError("INTERNAL_ERROR", error.message);
  if (!ok) {
    return actionError(
      "FORBIDDEN",
      "Samo šef i iznad mogu da upravljaju narudžbenicama.",
    );
  }
  return null;
}

export async function adjustStock(
  input: unknown,
): Promise<ActionResult<{ ingredientId: string; currentStock: number }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(adjustStockSchema, input);
  if ("error" in parsed) return parsed;

  const { data, error } = await auth.supabase.rpc("adjust_stock", {
    p_ingredient_id: parsed.data.ingredientId,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
    p_purchase_order_id: null,
    p_allow_negative: parsed.data.allowNegative,
  });

  if (error) return mapRpcError(error);

  const row = data as { id?: string; current_stock?: number } | null;
  return actionData({
    ingredientId: row?.id ?? parsed.data.ingredientId,
    currentStock: Number(row?.current_stock) || 0,
  });
}

/** Popis: set absolute stock via delta from current. */
export async function setStockByInventory(
  input: unknown,
): Promise<ActionResult<{ ingredientId: string; currentStock: number }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(inventorySetSchema, input);
  if ("error" in parsed) return parsed;

  const { data: ing, error: loadError } = await auth.supabase
    .from("ingredients")
    .select("id, current_stock, workspace_id")
    .eq("id", parsed.data.ingredientId)
    .maybeSingle();

  if (loadError) return actionError("INTERNAL_ERROR", loadError.message);
  if (!ing) return actionError("NOT_FOUND", "Sastojak nije pronađen.");

  const denied = await requireChef(auth.supabase, ing.workspace_id as string);
  if (denied) return denied;
  if (!await hasWorkspaceFeature(auth.supabase, ing.workspace_id, "stockInventory")) {
    return mapRpcError({ message: "UPGRADE_REQUIRED" });
  }

  const current = Number(ing.current_stock) || 0;
  const delta = parsed.data.counted - current;
  if (delta === 0) {
    return actionData({ ingredientId: ing.id as string, currentStock: current });
  }

  const { data, error } = await auth.supabase.rpc("adjust_stock", {
    p_ingredient_id: parsed.data.ingredientId,
    p_delta: delta,
    p_reason: "popis",
    p_note: parsed.data.note,
    p_purchase_order_id: null,
    p_allow_negative: false,
  });

  if (error) return mapRpcError(error);
  const row = data as { id?: string; current_stock?: number } | null;
  return actionData({
    ingredientId: row?.id ?? parsed.data.ingredientId,
    currentStock: Number(row?.current_stock) || 0,
  });
}

export async function updateIngredientStockFields(
  input: unknown,
): Promise<ActionResult<{ ingredientId: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(updateIngredientStockFieldsSchema, input);
  if ("error" in parsed) return parsed;

  const { data: ing, error: loadError } = await auth.supabase
    .from("ingredients")
    .select("id, workspace_id")
    .eq("id", parsed.data.ingredientId)
    .maybeSingle();

  if (loadError) return actionError("INTERNAL_ERROR", loadError.message);
  if (!ing) return actionError("NOT_FOUND", "Sastojak nije pronađen.");

  const denied = await requireChef(auth.supabase, ing.workspace_id as string);
  if (denied) return denied;

  const patch: Record<string, unknown> = {};
  if ("parLevel" in parsed.data) patch.par_level = parsed.data.parLevel ?? null;
  if ("packSize" in parsed.data) patch.pack_size = parsed.data.packSize ?? null;
  if ("supplierId" in parsed.data) patch.supplier_id = parsed.data.supplierId ?? null;

  if (Object.keys(patch).length === 0) {
    return actionData({ ingredientId: parsed.data.ingredientId });
  }

  const { error } = await auth.supabase
    .from("ingredients")
    .update(patch)
    .eq("id", parsed.data.ingredientId);

  if (error) return actionError("INTERNAL_ERROR", error.message);
  return actionData({ ingredientId: parsed.data.ingredientId });
}

export async function upsertSupplier(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(supplierUpsertSchema, input);
  if ("error" in parsed) return parsed;

  const denied = await requireChef(auth.supabase, parsed.data.workspaceId);
  if (denied) return denied;

  const row = {
    workspace_id: parsed.data.workspaceId,
    name: parsed.data.name,
    contact_email: parsed.data.contactEmail,
    contact_phone: parsed.data.contactPhone,
  };

  if (parsed.data.id) {
    const { data, error } = await auth.supabase
      .from("suppliers")
      .update(row)
      .eq("id", parsed.data.id)
      .eq("workspace_id", parsed.data.workspaceId)
      .select("id")
      .maybeSingle();
    if (error) return actionError("INTERNAL_ERROR", error.message);
    if (!data) return actionError("NOT_FOUND", "Dobavljač nije pronađen.");
    return actionData({ id: data.id as string });
  }

  const { data, error } = await auth.supabase
    .from("suppliers")
    .insert(row)
    .select("id")
    .single();
  if (error) return actionError("INTERNAL_ERROR", error.message);
  return actionData({ id: data.id as string });
}

export async function createPurchaseOrderDraft(
  input: unknown,
): Promise<ActionResult<{ orderIds: string[]; count: number }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(createPurchaseOrderDraftSchema, input);
  if ("error" in parsed) return parsed;

  const workspaceId = parsed.data.workspaceId;
  const denied = await requireChef(auth.supabase, workspaceId);
  if (denied) return denied;

  if (parsed.data.sourceAlerts) {
    const { data: hasAlerts } = await auth.supabase.rpc("workspace_has_feature", {
      p_workspace_id: workspaceId,
      p_feature: "stockAlerts",
    });
    if (!hasAlerts) {
      return actionError(
        "UPGRADE_REQUIRED",
        "Upozorenja o zalihama su dostupna od Starter paketa.",
      );
    }
  }

  if (parsed.data.sourceTrebovanje) {
    const { data: hasPo } = await auth.supabase.rpc("workspace_has_feature", {
      p_workspace_id: workspaceId,
      p_feature: "purchaseOrders",
    });
    if (!hasPo) {
      return actionError(
        "UPGRADE_REQUIRED",
        "Narudžbenice iz trebovanja su dostupne od Pro paketa.",
      );
    }
  }

  const { data: ingredients, error: ingError } = await auth.supabase
    .from("ingredients")
    .select(
      "id, name, unit, par_level, current_stock, pack_size, supplier_id, workspace_id",
    )
    .eq("workspace_id", workspaceId)
    .limit(500);

  if (ingError) return actionError("INTERNAL_ERROR", ingError.message);

  let list = ingredients ?? [];
  if (parsed.data.ingredientIds?.length) {
    const allow = new Set(parsed.data.ingredientIds);
    list = list.filter((row) => allow.has(row.id as string));
  }

  type Cand = {
    ingredientId: string;
    name: string;
    unit: string;
    supplierId: string | null;
    parLevel?: number | null;
    currentStock?: number | null;
    packSize?: number | null;
    trebovanjeNeed?: number | null;
  };

  const candidates: Cand[] = [];

  if (parsed.data.sourceAlerts) {
    for (const row of list) {
      const par = row.par_level == null ? null : Number(row.par_level);
      const cur = Number(row.current_stock) || 0;
      if (par == null || !(cur < par)) continue;
      candidates.push({
        ingredientId: row.id as string,
        name: row.name as string,
        unit: row.unit as string,
        supplierId: (row.supplier_id as string | null) ?? null,
        parLevel: par,
        currentStock: cur,
        packSize: row.pack_size == null ? null : Number(row.pack_size),
      });
    }
  }

  if (parsed.data.sourceTrebovanje) {
    const { data: levels, error: levelError } = await auth.supabase
      .from("stock_levels")
      .select("ingredient_id, qty, min_qty")
      .limit(500);
    if (levelError) return actionError("INTERNAL_ERROR", levelError.message);

    const byId = new Map(list.map((row) => [row.id as string, row]));
    for (const level of levels ?? []) {
      const ing = byId.get(level.ingredient_id as string);
      if (!ing) continue;
      const qty = Number(level.qty) || 0;
      const min = Number(level.min_qty) || 0;
      if (!(qty < min)) continue;
      candidates.push({
        ingredientId: ing.id as string,
        name: ing.name as string,
        unit: ing.unit as string,
        supplierId: (ing.supplier_id as string | null) ?? null,
        parLevel: ing.par_level == null ? null : Number(ing.par_level),
        currentStock: Number(ing.current_stock) || 0,
        packSize: ing.pack_size == null ? null : Number(ing.pack_size),
        trebovanjeNeed: Math.max(0, min - qty),
      });
    }
  }

  const merged = mergeOrderCandidates(candidates);
  if (merged.length === 0) {
    return actionError("VALIDATION_ERROR", "Nema stavki za narudžbenicu.");
  }

  const groups = groupBySupplier(merged);
  const orderIds: string[] = [];

  for (const [supplierId, lines] of groups) {
    const { data: number, error: numError } = await auth.supabase.rpc(
      "allocate_purchase_order_number",
      { p_workspace_id: workspaceId },
    );
    if (numError) return mapRpcError(numError);

    const { data: order, error: orderError } = await auth.supabase
      .from("purchase_orders")
      .insert({
        workspace_id: workspaceId,
        supplier_id: supplierId,
        number: number as number,
        status: "nacrt",
        created_by: auth.user.id,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      return actionError(
        "INTERNAL_ERROR",
        orderError?.message ?? "Order insert failed",
      );
    }

    const { error: itemsError } = await auth.supabase
      .from("purchase_order_items")
      .insert(
        lines.map((line) => ({
          purchase_order_id: order.id,
          ingredient_id: line.ingredientId,
          ingredient_name_snapshot: line.name,
          unit: line.unit,
          qty_ordered: line.qty,
        })),
      );
    if (itemsError) return actionError("INTERNAL_ERROR", itemsError.message);
    orderIds.push(order.id as string);
  }

  return actionData({ orderIds, count: orderIds.length });
}

export async function replacePurchaseOrderDraftItems(
  input: unknown,
): Promise<ActionResult<{ orderId: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(updatePurchaseOrderDraftItemsSchema, input);
  if ("error" in parsed) return parsed;

  const { data: order, error: orderError } = await auth.supabase
    .from("purchase_orders")
    .select("id, workspace_id, status")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (orderError) return actionError("INTERNAL_ERROR", orderError.message);
  if (!order) return actionError("NOT_FOUND", "Narudžbenica nije pronađena.");
  if (order.status !== "nacrt") {
    return actionError("VALIDATION_ERROR", "Samo nacrt se može menjati.");
  }

  const denied = await requireChef(auth.supabase, order.workspace_id as string);
  if (denied) return denied;

  const { error: delError } = await auth.supabase
    .from("purchase_order_items")
    .delete()
    .eq("purchase_order_id", order.id);
  if (delError) return actionError("INTERNAL_ERROR", delError.message);

  if (parsed.data.items.length > 0) {
    const { error: insError } = await auth.supabase
      .from("purchase_order_items")
      .insert(
        parsed.data.items.map((item) => ({
          purchase_order_id: order.id,
          ingredient_id: item.ingredientId ?? null,
          ingredient_name_snapshot: item.ingredientName,
          unit: item.unit,
          qty_ordered: item.qtyOrdered,
        })),
      );
    if (insError) return actionError("INTERNAL_ERROR", insError.message);
  }

  return actionData({ orderId: order.id as string });
}

export async function getPurchaseOrderText(
  input: unknown,
): Promise<ActionResult<{ text: string; waLink: string | null; orderId: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const orderIdParse = parseActionInput(orderIdOnlySchema, input);
  if ("error" in orderIdParse) return orderIdParse;

  const { data: order, error } = await auth.supabase
    .from("purchase_orders")
    .select(
      "id, number, status, created_at, workspace_id, supplier_id, suppliers ( name, contact_phone ), purchase_order_items ( ingredient_name_snapshot, qty_ordered, unit ), workspaces ( name )",
    )
    .eq("id", orderIdParse.data.orderId)
    .maybeSingle();

  if (error) return actionError("INTERNAL_ERROR", error.message);
  if (!order) return actionError("NOT_FOUND", "Narudžbenica nije pronađena.");

  const denied = await requireChef(auth.supabase, order.workspace_id as string);
  if (denied) return denied;

  const supplier = Array.isArray(order.suppliers) ? order.suppliers[0] : order.suppliers;
  const workspace = Array.isArray(order.workspaces)
    ? order.workspaces[0]
    : order.workspaces;
  const items = (order.purchase_order_items ?? []) as Array<{
    ingredient_name_snapshot: string;
    qty_ordered: number;
    unit: string;
  }>;

  const text = formatPurchaseOrderText({
    workspaceName: (workspace as { name?: string } | null)?.name ?? "TreuPlate",
    orderNumber: Number(order.number) || 0,
    status: order.status as string,
    supplierName: (supplier as { name?: string } | null)?.name ?? null,
    createdAt: order.created_at as string,
    lines: items.map((item) => ({
      name: item.ingredient_name_snapshot,
      qty: Number(item.qty_ordered) || 0,
      unit: item.unit,
    })),
  });

  const phone = (supplier as { contact_phone?: string | null } | null)?.contact_phone;
  return actionData({
    text,
    waLink: waMeLink(phone),
    orderId: order.id as string,
  });
}

export async function markPurchaseOrderCopied(
  input: unknown,
): Promise<ActionResult<{ orderId: string; status: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(markOrderSentSchema, input);
  if ("error" in parsed) return parsed;

  const { data, error } = await auth.supabase.rpc("mark_purchase_order_sent", {
    p_order_id: parsed.data.orderId,
    p_sent_to: parsed.data.sentTo ?? "clipboard",
  });

  if (error) return mapRpcError(error);
  const row = data as { id?: string; status?: string } | null;
  return actionData({
    orderId: row?.id ?? parsed.data.orderId,
    status: row?.status ?? "poslato",
  });
}

export async function receivePurchaseOrder(
  input: unknown,
): Promise<ActionResult<{ orderId: string; status: string }>> {
  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const parsed = parseActionInput(receivePurchaseOrderSchema, input);
  if ("error" in parsed) return parsed;

  const lines = parsed.data.lines.map((line) => ({
    item_id: line.itemId,
    qty_received: line.qtyReceived,
    unit_price: line.unitPrice ?? null,
  }));

  const { data, error } = await auth.supabase.rpc("receive_purchase_order", {
    p_order_id: parsed.data.orderId,
    p_lines: lines,
  });

  if (error) return mapRpcError(error);
  const row = data as { id?: string; status?: string } | null;
  return actionData({
    orderId: row?.id ?? parsed.data.orderId,
    status: row?.status ?? "primljeno",
  });
}
