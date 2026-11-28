import { PageHeader } from "@/components/layout/PageHeader";
import {
  PurchaseOrdersClient,
  type LowStockAlert,
  type PoListRow,
} from "@/components/purchase-orders/PurchaseOrdersClient";
import { createClient, getServerUser } from "@/lib/supabase/server";

function emailProviderConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY ||
      process.env.SMTP_URL ||
      process.env.EMAIL_PROVIDER_URL,
  );
}

export default async function PurchaseOrdersPage() {
  const supabase = await createClient();
  const user = await getServerUser();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const workspaceId = (membership?.workspace_id as string | undefined) ?? null;
  const role = (membership?.role as string | undefined) ?? "cook";
  const isChef =
    role === "chef" || role === "manager" || role === "owner";

  let canStockAlerts = false;
  let canPurchaseOrders = false;
  if (workspaceId) {
    const [alertsFeat, poFeat] = await Promise.all([
      supabase.rpc("workspace_has_feature", {
        p_workspace_id: workspaceId,
        p_feature: "stockAlerts",
      }),
      supabase.rpc("workspace_has_feature", {
        p_workspace_id: workspaceId,
        p_feature: "purchaseOrders",
      }),
    ]);
    canStockAlerts = Boolean(alertsFeat.data);
    canPurchaseOrders = Boolean(poFeat.data);
  }

  let orders: PoListRow[] = [];
  let alerts: LowStockAlert[] = [];

  if (workspaceId && isChef && canStockAlerts) {
    const { data: orderRows } = await supabase
      .from("purchase_orders")
      .select("id, number, status, created_at, suppliers ( name )")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(100);

    orders = (orderRows ?? []).map((row) => {
      const supplier = Array.isArray(row.suppliers)
        ? row.suppliers[0]
        : row.suppliers;
      return {
        id: row.id as string,
        number: Number(row.number) || 0,
        status: row.status as string,
        created_at: row.created_at as string,
        supplier_name: (supplier as { name?: string } | null)?.name ?? null,
      };
    });

    if (canStockAlerts) {
      const { data: alertRows } = await supabase
        .from("alerts")
        .select("id, subject_id, payload, created_at")
        .eq("workspace_id", workspaceId)
        .eq("kind", "low_stock")
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

      alerts = (alertRows ?? []).map((row) => ({
        id: row.id as string,
        subject_id: row.subject_id as string,
        payload: (row.payload ?? {}) as LowStockAlert["payload"],
        created_at: row.created_at as string,
      }));
    }
  }

  return (
    <>
      <PageHeader
        title="Narudžbenice"
        description="Upozorenja o zalihama, nacrti i prijem robe"
      />
      <PurchaseOrdersClient
        workspaceId={workspaceId}
        orders={orders}
        alerts={alerts}
        canStockAlerts={canStockAlerts}
        canPurchaseOrders={canPurchaseOrders}
        isChef={isChef}
        emailEnabled={emailProviderConfigured()}
      />
    </>
  );
}
