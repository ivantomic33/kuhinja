"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoCard";
import { SectionCardHeader } from "@/components/ui/SectionCardHeader";
import { reasonShares } from "@/lib/waste/math";
import { cn } from "@/lib/utils/cn";

export type WasteSummaryWidgetProps = {
  totalNet: number;
  totalGross: number;
  totalCorrections: number;
  reasons: Array<{ reason: string; amount: number }>;
  topIngredients: Array<{ name: string; amount: number }>;
  locked?: boolean;
  from: string;
  to: string;
};

function money(value: number): string {
  return value.toLocaleString("sr-Latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const REASON_LABEL: Record<string, string> = {
  istek: "Istek",
  pokvareno: "Pokvareno",
  ostatak: "Ostatak",
  greška: "Greška",
  ostalo: "Ostalo",
};

export function WasteSummaryWidget({
  totalNet,
  totalGross,
  totalCorrections,
  reasons,
  topIngredients,
  locked = false,
  from,
  to,
}: WasteSummaryWidgetProps) {
  const shares = reasonShares(
    Object.fromEntries(reasons.map((row) => [row.reason, row.amount])),
  );

  return (
    <BentoCard
      dense
      className={cn(locked && "opacity-80")}
      header={
        <SectionCardHeader
          title="Otpad (tekući mesec)"
          singleLine
          action={
            <Link
              href="/otpad"
              className="text-ui-xs font-semibold text-accent hover:underline"
            >
              Otvori
            </Link>
          }
        />
      }
    >
      {locked ? (
        <p className="text-sm text-text-2">
          Evidencija otpada je dostupna od Starter paketa.{" "}
          <Link href="/premium#plan-starter" className="font-semibold text-accent hover:underline">
            Otključaj
          </Link>
        </p>
      ) : (
        <div className="grid gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-text-2">
              <Trash2 className="size-4" aria-hidden="true" />
              Neto
            </span>
            <span className="text-xl font-semibold tabular-nums text-text">
              {money(totalNet)} RSD
            </span>
          </div>
          <p className="text-ui-xs text-muted">
            Bruto {money(totalGross)} · ispravke {money(totalCorrections)} · {from}–{to}
          </p>
          {shares.length > 0 ? (
            <ul className="grid gap-1">
              {shares.map((row) => (
                <li
                  key={row.reason}
                  className="flex items-center justify-between gap-2 text-ui-xs text-text-2"
                >
                  <span>{REASON_LABEL[row.reason] ?? row.reason}</span>
                  <span className="tabular-nums">
                    {row.percent.toFixed(2)}% · {money(row.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-2">Nema unosa ovog meseca.</p>
          )}
          {topIngredients.length > 0 ? (
            <div>
              <p className="mb-1 text-ui-xs font-semibold text-text">Top sastojci</p>
              <ul className="grid gap-1">
                {topIngredients.slice(0, 5).map((row) => (
                  <li
                    key={row.name}
                    className="flex justify-between gap-2 text-ui-xs text-text-2"
                  >
                    <span className="truncate">{row.name}</span>
                    <span className="shrink-0 tabular-nums">{money(row.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </BentoCard>
  );
}
