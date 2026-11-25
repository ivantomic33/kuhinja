"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { WasteEntryForm } from "@/components/waste/WasteEntryForm";
import type { CachedIngredient } from "@/lib/offline/cache";
import { formatBelgradeDateTime } from "@/lib/waste/period";
import { reasonShares } from "@/lib/waste/math";
import type { WasteEntryRow } from "@/lib/waste/actions";
import { getEntitlements, type PlanId } from "@/lib/plan/entitlements";

export type WasteWorkspaceProps = {
  workspaceId: string | null;
  workspaceName: string;
  userId: string;
  role: string;
  plan: PlanId;
  locked: boolean;
  canExportCsv: boolean;
  canExportPdfXlsx: boolean;
  from: string;
  to: string;
  totalNet: number;
  totalGross: number;
  totalCorrections: number;
  reasons: Array<{ reason: string; amount: number }>;
  topIngredients: Array<{ name: string; amount: number }>;
  entries: WasteEntryRow[];
  ingredients: CachedIngredient[];
  recipes: Array<{ id: string; name: string; venue_id: string; portions: number }>;
  recipeCosts: Record<string, number>;
};

function money(value: number) {
  return value.toLocaleString("sr-Latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function WasteWorkspace(props: WasteWorkspaceProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const entitlements = getEntitlements(props.plan);
  const canAdjustStock =
    props.role === "chef" ||
    props.role === "manager" ||
    props.role === "owner";

  const shares = useMemo(
    () =>
      reasonShares(
        Object.fromEntries(props.reasons.map((row) => [row.reason, row.amount])),
      ),
    [props.reasons],
  );

  function exportHref(format: "csv" | "pdf" | "xlsx") {
    if (!props.workspaceId) return "#";
    const q = new URLSearchParams({
      from: props.from,
      to: props.to,
      format,
      workspaceId: props.workspaceId,
    });
    return `/api/waste/export?${q.toString()}`;
  }

  function guardExport(format: "csv" | "pdf" | "xlsx", allowed: boolean) {
    if (!allowed) {
      toast.show({
        variant: "error",
        title:
          format === "csv"
            ? "CSV zahteva Starter+"
            : "PDF/Excel zahtevaju Pro paket",
      });
      return false;
    }
    return true;
  }

  if (!props.workspaceId) {
    return (
      <div className="grid gap-4">
        <PageHeader title="Otpad" description="Evidencija bačenih količina" />
        <p className="text-sm text-text-2">Nema aktivnog radnog prostora.</p>
      </div>
    );
  }

  if (props.locked) {
    return (
      <div className="grid gap-4">
        <PageHeader title="Otpad" description="Evidencija bačenih količina" />
        <p className="text-sm text-text-2">
          Evidencija otpada je deo Starter i Pro paketa.{" "}
          <Link href="/premium#plan-starter" className="font-semibold text-accent hover:underline">
            Pogledaj pakete
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Otpad"
        description={`${props.from} – ${props.to} · ${props.workspaceName}`}
        action={
          <PrimaryButton leftIcon={<Plus aria-hidden="true" />} onClick={() => setOpen(true)}>
            Novi unos
          </PrimaryButton>
        }
      />

      <section className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
        <div>
          <p className="text-ui-xs text-muted">Neto</p>
          <p className="text-2xl font-semibold tabular-nums">{money(props.totalNet)} RSD</p>
        </div>
        <div>
          <p className="text-ui-xs text-muted">Bruto</p>
          <p className="text-xl font-semibold tabular-nums">{money(props.totalGross)} RSD</p>
        </div>
        <div>
          <p className="text-ui-xs text-muted">Ispravke</p>
          <p className="text-xl font-semibold tabular-nums">{money(props.totalCorrections)} RSD</p>
        </div>
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Po razlozima</h2>
          <ul className="grid gap-1">
            {shares.map((row) => (
              <li key={row.reason} className="flex justify-between text-sm text-text-2">
                <span>{row.reason}</span>
                <span className="tabular-nums">
                  {row.percent.toFixed(2)}% · {money(row.amount)}
                </span>
              </li>
            ))}
            {shares.length === 0 ? (
              <li className="text-sm text-muted">Nema podataka.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold">Top sastojci</h2>
          <ul className="grid gap-1">
            {props.topIngredients.map((row) => (
              <li key={row.name} className="flex justify-between text-sm text-text-2">
                <span className="truncate">{row.name}</span>
                <span className="tabular-nums">{money(row.amount)}</span>
              </li>
            ))}
            {props.topIngredients.length === 0 ? (
              <li className="text-sm text-muted">Nema podataka.</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <a
          className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-text"
          href={exportHref("csv")}
          onClick={(event) => {
            if (!guardExport("csv", props.canExportCsv || entitlements.wasteExportCsv)) {
              event.preventDefault();
            }
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          CSV
        </a>
        <a
          className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-text"
          href={exportHref("pdf")}
          onClick={(event) => {
            if (!guardExport("pdf", props.canExportPdfXlsx || entitlements.wasteExportPdfXlsx)) {
              event.preventDefault();
            }
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          PDF
        </a>
        <a
          className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm font-semibold text-text"
          href={exportHref("xlsx")}
          onClick={(event) => {
            if (!guardExport("xlsx", props.canExportPdfXlsx || entitlements.wasteExportPdfXlsx)) {
              event.preventDefault();
            }
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Excel
        </a>
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-semibold">Unosi</h2>
        {props.entries.length === 0 ? (
          <p className="text-sm text-muted">Nema unosa u periodu.</p>
        ) : (
          <ul className="grid gap-2">
            {props.entries.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-lg bg-surface-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-text">{row.name}</p>
                  <p className="text-ui-xs text-muted">
                    {formatBelgradeDateTime(row.createdAt)} · {row.reason}
                    {row.isCorrection ? " · ispravka" : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm tabular-nums text-text">
                  {row.quantity} {row.unit} · {money(row.costRsd)} RSD
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <WasteEntryForm
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={props.workspaceId}
        userId={props.userId}
        canAdjustStock={canAdjustStock}
        ingredients={props.ingredients}
        recipes={props.recipes}
        recipeCosts={props.recipeCosts}
        onSaved={() => {
          // Soft refresh via navigation reload is enough for RSC data.
          if (typeof window !== "undefined") window.location.reload();
        }}
      />
    </div>
  );
}
