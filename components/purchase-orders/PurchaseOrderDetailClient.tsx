"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  getPurchaseOrderText,
  markPurchaseOrderCopied,
  receivePurchaseOrder,
} from "@/lib/purchase-orders/actions";

export type DetailItem = {
  id: string;
  ingredient_name_snapshot: string;
  unit: string;
  qty_ordered: number;
  qty_received: number | null;
  unit_price_received: number | null;
};

export function PurchaseOrderDetailClient({
  orderId,
  status,
  number,
  supplierName,
  supplierEmail,
  items,
  emailEnabled,
}: {
  orderId: string;
  status: string;
  number: number;
  supplierName: string | null;
  supplierEmail: string | null;
  items: DetailItem[];
  emailEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lines, setLines] = useState(
    () =>
      items.map((item) => ({
        itemId: item.id,
        qtyReceived: item.qty_received ?? item.qty_ordered,
        unitPrice: item.unit_price_received,
        qtyOrdered: item.qty_ordered,
        name: item.ingredient_name_snapshot,
        unit: item.unit,
        already: item.qty_received != null,
      })),
  );

  const immutable = status === "poslato" || status === "primljeno";
  const canReceive = status !== "primljeno";

  const overReceive = useMemo(
    () => lines.some((line) => line.qtyReceived > line.qtyOrdered),
    [lines],
  );

  function copyText(markSent: boolean) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const textResult = await getPurchaseOrderText({ orderId });
      if ("error" in textResult) {
        setError(textResult.error.message);
        return;
      }
      try {
        await navigator.clipboard.writeText(textResult.data.text);
      } catch {
        setError("Kopiranje nije uspelo.");
        return;
      }
      if (markSent && status === "nacrt") {
        const sent = await markPurchaseOrderCopied({
          orderId,
          sentTo: "clipboard",
        });
        if ("error" in sent) {
          setError(sent.error.message);
          return;
        }
      }
      setMessage(
        textResult.data.waLink
          ? `Kopirano. WhatsApp: ${textResult.data.waLink}`
          : "Tekst narudžbenice je kopiran.",
      );
      router.refresh();
    });
  }

  function receive() {
    setError(null);
    setMessage(null);
    if (overReceive) {
      const ok = window.confirm(
        "Neke količine su veće od naručenih. Potvrdite višak.",
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await receivePurchaseOrder({
        orderId,
        lines: lines
          .filter((line) => !line.already)
          .map((line) => ({
            itemId: line.itemId,
            qtyReceived: line.qtyReceived,
            unitPrice:
              line.unitPrice != null && line.unitPrice > 0
                ? Number(line.unitPrice.toFixed(2))
                : null,
          })),
      });
      if ("error" in result) {
        setError(result.error.message);
        return;
      }
      setMessage(`Prijem sačuvan · status ${result.data.status}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <PrimaryButton disabled={pending} loading={pending} onClick={() => copyText(false)}>
          Kopiraj tekst
        </PrimaryButton>
        {status === "nacrt" ? (
          <PrimaryButton
            variant="secondary"
            disabled={pending}
            loading={pending}
            onClick={() => copyText(true)}
          >
            Kopiraj i označi poslato
          </PrimaryButton>
        ) : null}
        <a
          className="inline-flex h-10 items-center rounded-lg border border-border px-3 text-sm font-medium"
          href={`/api/purchase-orders/${orderId}/pdf`}
        >
          Preuzmi PDF
        </a>
        <PrimaryButton
          variant="secondary"
          disabled
          title={
            emailEnabled
              ? supplierEmail
                ? undefined
                : "Dobavljač nema e-poštu"
              : "Servis za e-poštu nije podešen"
          }
        >
          {emailEnabled && supplierEmail
            ? "Pošalji e-poštom"
            : "E-pošta nedostupna"}
        </PrimaryButton>
      </div>

      <p className="text-sm text-text-muted">
        #{number} · {supplierName ?? "Bez dobavljača"} · {status}
        {immutable ? " · zaključano" : ""}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-sm text-text">{message}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border text-text-muted">
            <tr>
              <th className="px-3 py-2">Sastojak</th>
              <th className="px-3 py-2">Naručeno</th>
              <th className="px-3 py-2">Primljeno</th>
              <th className="px-3 py-2">Cena / jed.</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, index) => (
              <tr key={line.itemId} className="border-t border-border/70">
                <td className="px-3 py-2">
                  {line.name}{" "}
                  <span className="text-text-muted">({line.unit})</span>
                </td>
                <td className="px-3 py-2 tabular-nums">{line.qtyOrdered}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step="0.0001"
                    className="w-28 rounded-md border border-border bg-surface-2 px-2 py-1"
                    disabled={!canReceive || line.already || pending}
                    value={line.qtyReceived}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                qtyReceived: Number.isFinite(value)
                                  ? value
                                  : 0,
                              }
                            : row,
                        ),
                      );
                    }}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-28 rounded-md border border-border bg-surface-2 px-2 py-1"
                    disabled={!canReceive || line.already || pending}
                    value={line.unitPrice ?? ""}
                    placeholder="opciono"
                    onChange={(event) => {
                      const raw = event.target.value;
                      setLines((prev) =>
                        prev.map((row, i) =>
                          i === index
                            ? {
                                ...row,
                                unitPrice:
                                  raw === ""
                                    ? null
                                    : Number.isFinite(Number(raw))
                                      ? Number(raw)
                                      : null,
                              }
                            : row,
                        ),
                      );
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canReceive ? (
        <PrimaryButton disabled={pending} loading={pending} onClick={receive}>
          Potvrdi prijem
        </PrimaryButton>
      ) : null}
    </div>
  );
}
