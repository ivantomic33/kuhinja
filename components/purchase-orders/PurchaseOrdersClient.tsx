"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { createPurchaseOrderDraft } from "@/lib/purchase-orders/actions";
import { markAlertRead } from "@/lib/alerts/actions";

export type PoListRow = {
  id: string;
  number: number;
  status: string;
  created_at: string;
  supplier_name: string | null;
};

export type LowStockAlert = {
  id: string;
  subject_id: string;
  payload: {
    ingredient_name?: string;
    current_stock?: number;
    par_level?: number;
    unit?: string;
  };
  created_at: string;
};

export function PurchaseOrdersClient({
  workspaceId,
  orders,
  alerts,
  canStockAlerts,
  canPurchaseOrders,
  isChef,
  emailEnabled,
}: {
  workspaceId: string | null;
  orders: PoListRow[];
  alerts: LowStockAlert[];
  canStockAlerts: boolean;
  canPurchaseOrders: boolean;
  isChef: boolean;
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered =
    statusFilter === "all"
      ? orders
      : orders.filter((row) => row.status === statusFilter);

  function createDraft(source: "alerts" | "trebovanje") {
    if (!workspaceId || !isChef) return;
    setError(null);
    setBusy(true);
    startTransition(async () => {
      const result = await createPurchaseOrderDraft({
        workspaceId,
        sourceAlerts: source === "alerts" || source === "trebovanje",
        sourceTrebovanje: source === "trebovanje",
      });
      setBusy(false);
      if ("error" in result) {
        setError(result.error.message);
        return;
      }
      router.refresh();
      if (result.data.orderIds[0]) {
        router.push(`/purchase-orders/${result.data.orderIds[0]}`);
      }
    });
  }

  function dismissAlert(alertId: string) {
    startTransition(async () => {
      await markAlertRead({ alertId });
      router.refresh();
    });
  }

  if (!isChef) {
    return (
      <p className="rounded-xl border border-border bg-surface p-4 text-sm text-text-muted">
        Narudžbenice su dostupne šefu i iznad. Zalihe su samo za čitanje.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          disabled={!canStockAlerts || busy || pending || !workspaceId}
          loading={busy}
          onClick={() => createDraft("alerts")}
        >
          Nova iz upozorenja
        </PrimaryButton>
        <PrimaryButton
          variant="secondary"
          disabled={!canPurchaseOrders || busy || pending || !workspaceId}
          loading={busy}
          onClick={() => createDraft("trebovanje")}
        >
          Nova iz trebovanja
        </PrimaryButton>
        {!canPurchaseOrders ? (
          <span className="self-center text-xs text-text-muted">
            Iz trebovanja: Pro paket
          </span>
        ) : null}
        {!emailEnabled ? (
          <span className="self-center text-xs text-text-muted">
            E-pošta dobavljaču nije podešena
          </span>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}

      {canStockAlerts && alerts.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text">Niske zalihe</h2>
          <ul className="space-y-2">
            {alerts.map((alert) => (
              <li
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {alert.payload.ingredient_name ?? "Sastojak"}:{" "}
                  {alert.payload.current_stock ?? "?"} /{" "}
                  {alert.payload.par_level ?? "?"} {alert.payload.unit ?? ""}
                </span>
                <PrimaryButton
                  variant="secondary"
                  disabled={pending}
                  onClick={() => dismissAlert(alert.id)}
                >
                  Pročitano
                </PrimaryButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        {["all", "nacrt", "poslato", "primljeno"].map((value) => (
          <button
            key={value}
            type="button"
            className={`rounded-full border px-3 py-1 ${
              statusFilter === value
                ? "border-accent bg-accent/10 text-text"
                : "border-border text-text-muted"
            }`}
            onClick={() => setStatusFilter(value)}
          >
            {value === "all" ? "Sve" : value}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Broj</th>
              <th className="px-3 py-2 font-medium">Dobavljač</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Datum</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-text-muted">
                  Nema narudžbenica.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.id} className="border-t border-border/70">
                  <td className="px-3 py-2">
                    <Link
                      href={`/purchase-orders/${row.id}`}
                      className="font-semibold text-accent underline-offset-2 hover:underline"
                    >
                      #{row.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {row.supplier_name ?? "Bez dobavljača"}
                  </td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {new Date(row.created_at).toLocaleDateString("sr-Latn")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
