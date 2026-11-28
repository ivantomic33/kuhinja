import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { PurchaseOrderDetailClient } from "@/components/purchase-orders/PurchaseOrderDetailClient";
import { createClient, getServerUser } from "@/lib/supabase/server";
import { hasWorkspaceFeature } from "@/lib/billing/entitlements-server";

function emailProviderConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY ||
      process.env.SMTP_URL ||
      process.env.EMAIL_PROVIDER_URL,
  );
}

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getServerUser();

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const role = (membership?.role as string | undefined) ?? "cook";
  const isChef =
    role === "chef" || role === "manager" || role === "owner";
  if (!isChef) notFound();

  const { data: order } = await supabase
    .from("purchase_orders")
    .select(
      "id, number, status, workspace_id, suppliers ( name, contact_email ), purchase_order_items ( id, ingredient_name_snapshot, unit, qty_ordered, qty_received, unit_price_received )",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();
  if (!await hasWorkspaceFeature(supabase, order.workspace_id, "stockAlerts")) notFound();

  const supplier = Array.isArray(order.suppliers)
    ? order.suppliers[0]
    : order.suppliers;
  const items = (order.purchase_order_items ?? []) as Array<{
    id: string;
    ingredient_name_snapshot: string;
    unit: string;
    qty_ordered: number;
    qty_received: number | null;
    unit_price_received: number | null;
  }>;

  return (
    <>
      <PageHeader
        title={`Narudžbenica #${order.number}`}
        description={
          (supplier as { name?: string } | null)?.name ?? "Bez dobavljača"
        }
      />
      <p className="mb-4 text-sm">
        <Link href="/purchase-orders" className="text-accent hover:underline">
          ← Sve narudžbenice
        </Link>
      </p>
      <PurchaseOrderDetailClient
        orderId={order.id as string}
        status={order.status as string}
        number={Number(order.number) || 0}
        supplierName={(supplier as { name?: string } | null)?.name ?? null}
        supplierEmail={
          (supplier as { contact_email?: string | null } | null)?.contact_email ??
          null
        }
        items={items.map((item) => ({
          id: item.id,
          ingredient_name_snapshot: item.ingredient_name_snapshot,
          unit: item.unit,
          qty_ordered: Number(item.qty_ordered) || 0,
          qty_received:
            item.qty_received == null ? null : Number(item.qty_received),
          unit_price_received:
            item.unit_price_received == null
              ? null
              : Number(item.unit_price_received),
        }))}
        emailEnabled={emailProviderConfigured()}
      />
    </>
  );
}
