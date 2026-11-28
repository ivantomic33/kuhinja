import { z } from "zod";
import { requireActionUser } from "@/lib/server/action";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireActionUser();
  if ("error" in auth) {
    return Response.json(auth, { status: 401 });
  }

  const { id: rawId } = await context.params;
  const idParsed = idSchema.safeParse(rawId);
  if (!idParsed.success) {
    return Response.json(
      { error: { code: "VALIDATION_ERROR", message: "Neispravan ID." } },
      { status: 400 },
    );
  }

  const { data: order, error } = await auth.supabase
    .from("purchase_orders")
    .select(
      "id, number, status, created_at, workspace_id, suppliers ( name ), purchase_order_items ( ingredient_name_snapshot, qty_ordered, unit ), workspaces ( name )",
    )
    .eq("id", idParsed.data)
    .maybeSingle();

  if (error) {
    return Response.json(
      { error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 },
    );
  }
  if (!order) {
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Narudžbenica nije pronađena." } },
      { status: 404 },
    );
  }

  const { data: memberOk } = await auth.supabase.rpc("is_member", {
    p_workspace_id: order.workspace_id,
    p_min_role: "chef",
  });
  if (!memberOk) {
    return Response.json(
      { error: { code: "FORBIDDEN", message: "Nemate pristup." } },
      { status: 403 },
    );
  }

  const feature = await auth.supabase.rpc("workspace_has_feature", {
    p_workspace_id: order.workspace_id, p_feature: "purchase_orders",
  });
  if (feature.error) return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  if (!feature.data) return Response.json({ error: "UPGRADE_REQUIRED" }, { status: 402 });

  const supplier = Array.isArray(order.suppliers) ? order.suppliers[0] : order.suppliers;
  const workspace = Array.isArray(order.workspaces)
    ? order.workspaces[0]
    : order.workspaces;
  const items = (order.purchase_order_items ?? []) as Array<{
    ingredient_name_snapshot: string;
    qty_ordered: number;
    unit: string;
  }>;

  const { buildPurchaseOrderPdf } = await import("@/lib/purchase-orders/pdf");
  const pdfBytes = await buildPurchaseOrderPdf({
    workspaceName: (workspace as { name?: string } | null)?.name ?? "TreuPlate",
    orderNumber: Number(order.number) || 0,
    status: order.status as string,
    supplierName: (supplier as { name?: string } | null)?.name ?? null,
    createdAt: new Date(order.created_at as string),
    lines: items.map((item) => ({
      name: item.ingredient_name_snapshot,
      qty: Number(item.qty_ordered) || 0,
      unit: item.unit,
    })),
  });

  const filename = `narudzbenica-${order.number}.pdf`;
  return new Response(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

void z;
