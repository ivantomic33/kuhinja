"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { AllergenNotice } from "@/components/allergens/AllergenNotice";
import { AllergenUpgradePlaceholder } from "@/components/allergens/AllergenUpgradePlaceholder";
import { BentoCard } from "@/components/ui/BentoCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getRecipeAllergenMatrix } from "@/lib/allergens/actions";
import {
  ALLERGEN_CATALOG,
  type AllergenCode,
  type AllergenPresence,
} from "@/lib/allergens/catalog";
import { allergenLabel } from "@/lib/allergens/catalog";
import {
  presenceAriaLabel,
  presenceSymbol,
} from "@/lib/allergens/matrix";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

async function fetchMatrix(recipeId: string) {
  const result = await getRecipeAllergenMatrix({ recipeId });
  if ("error" in result) {
    const err = new Error(result.error.message) as Error & {
      code?: string;
    };
    err.code = result.error.code;
    throw err;
  }
  return result.data;
}

export function RecipeAllergenMatrix({
  recipeId,
  className,
}: {
  recipeId: string;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["recipe-allergens", recipeId],
    queryFn: () => fetchMatrix(recipeId),
    staleTime: 30_000,
    retry: false,
  });

  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    // Refetch when ingredient allergens change elsewhere.
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === "updated" &&
        Array.isArray(event.query.queryKey) &&
        event.query.queryKey[0] === "recipe-allergens"
      ) {
        /* cache already handles */
      }
    });
    return unsubscribe;
  }, [queryClient]);

  const cellMap = useMemo(() => {
    const map = new Map<string, AllergenPresence | null>();
    for (const cell of query.data?.cells ?? []) {
      map.set(`${cell.ingredientId}:${cell.code}`, cell.presence);
    }
    return map;
  }, [query.data?.cells]);

  const totalsMap = useMemo(() => {
    const map = new Map<AllergenCode, AllergenPresence>();
    for (const row of query.data?.totals ?? []) {
      map.set(row.code, row.presence);
    }
    return map;
  }, [query.data?.totals]);

  const containsList = useMemo(
    () =>
      ALLERGEN_CATALOG.filter((entry) => totalsMap.get(entry.code) === "contains").map(
        (entry) => entry.label,
      ),
    [totalsMap],
  );
  const traceList = useMemo(
    () =>
      ALLERGEN_CATALOG.filter((entry) => totalsMap.get(entry.code) === "trace").map(
        (entry) => entry.label,
      ),
    [totalsMap],
  );

  const onExport = useCallback(async () => {
    setExporting(true);
    try {
      const response = await fetch(
        `/api/allergens/export?format=pdf&recipes=${encodeURIComponent(recipeId)}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message?: string; code?: string };
        } | null;
        throw new Error(body?.error?.message ?? sr.allergens.exportFailed);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `alergeni-${recipeId.slice(0, 8)}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    } finally {
      setExporting(false);
    }
  }, [recipeId]);

  if (query.isLoading) {
    return (
      <BentoCard
        className={className}
        header={
          <h2 className="text-base font-semibold text-text">{sr.allergens.recipeTitle}</h2>
        }
      >
        <p role="status" className="text-sm text-muted">
          {sr.common.loading}
        </p>
      </BentoCard>
    );
  }

  if (query.error) {
    const code = (query.error as Error & { code?: string }).code;
    if (code === "UPGRADE_REQUIRED") {
      return (
        <BentoCard
          className={className}
          header={
            <h2 className="text-base font-semibold text-text">{sr.allergens.recipeTitle}</h2>
          }
        >
          <AllergenUpgradePlaceholder />
        </BentoCard>
      );
    }
    return (
      <BentoCard
        className={className}
        header={
          <h2 className="text-base font-semibold text-text">{sr.allergens.recipeTitle}</h2>
        }
      >
        <p className="text-sm text-danger">{query.error.message}</p>
      </BentoCard>
    );
  }

  const data = query.data!;

  return (
    <BentoCard
      className={className}
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-text">{sr.allergens.recipeTitle}</h2>
          <PrimaryButton
            type="button"
            size="sm"
            variant="secondary"
            loading={exporting}
            leftIcon={<Download className="size-4" aria-hidden="true" />}
            onClick={() => void onExport()}
          >
            {sr.allergens.exportPdf}
          </PrimaryButton>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="overflow-x-auto">
          <table className="min-w-max border-collapse text-left text-ui-sm">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-surface px-2 py-2 font-semibold text-text shadow-[1px_0_0_var(--border)]"
                >
                  {sr.allergens.ingredientCol}
                </th>
                {ALLERGEN_CATALOG.map((entry) => (
                  <th
                    key={entry.code}
                    scope="col"
                    className="px-2 py-2 font-semibold text-text"
                    title={entry.label}
                  >
                    <span className="sr-only">{entry.label}</span>
                    <span aria-hidden="true" className="tabular-nums">
                      {entry.uredba}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ingredients.map((ingredient) => (
                <tr key={ingredient.id} className="border-t border-border">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-40 truncate bg-surface px-2 py-2 font-medium text-text shadow-[1px_0_0_var(--border)]"
                  >
                    {ingredient.name}
                  </th>
                  {ALLERGEN_CATALOG.map((entry) => {
                    const presence =
                      cellMap.get(`${ingredient.id}:${entry.code}`) ?? null;
                    const symbol = presenceSymbol(presence);
                    return (
                      <td key={entry.code} className="px-2 py-2 text-center tabular-nums">
                        {symbol ? (
                          <span
                            className={cn(
                              "inline-flex min-w-6 justify-center rounded px-1 font-semibold",
                              presence === "contains"
                                ? "bg-danger/15 text-danger"
                                : "bg-surface-3 text-text",
                            )}
                            aria-label={`${ingredient.name}: ${entry.label} — ${presenceAriaLabel(presence)}`}
                          >
                            <span aria-hidden="true">{symbol}</span>
                          </span>
                        ) : (
                          <span className="sr-only">
                            {ingredient.name}: {entry.label} — {presenceAriaLabel(null)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-t-2 border-border-strong">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface-2 px-2 py-2 font-semibold text-text shadow-[1px_0_0_var(--border)]"
                >
                  {sr.allergens.recipeTotal}
                </th>
                {ALLERGEN_CATALOG.map((entry) => {
                  const presence = totalsMap.get(entry.code) ?? null;
                  const symbol = presenceSymbol(presence);
                  return (
                    <td key={entry.code} className="bg-surface-2 px-2 py-2 text-center">
                      {symbol ? (
                        <span
                          className="font-semibold tabular-nums"
                          aria-label={`${sr.allergens.recipeTotal}: ${entry.label} — ${presenceAriaLabel(presence)}`}
                        >
                          <span aria-hidden="true">{symbol}</span>
                        </span>
                      ) : (
                        <span className="sr-only">
                          {sr.allergens.recipeTotal}: {entry.label} —{" "}
                          {presenceAriaLabel(null)}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid gap-2 text-ui-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold text-text">{sr.allergens.containsList}</p>
            <p className="text-text-2">
              {containsList.length > 0 ? containsList.join(", ") : sr.allergens.none}
            </p>
          </div>
          <div>
            <p className="font-semibold text-text">{sr.allergens.traceList}</p>
            <p className="text-text-2">
              {traceList.length > 0 ? traceList.join(", ") : sr.allergens.none}
            </p>
          </div>
        </div>

        <AllergenNotice />
      </div>
    </BentoCard>
  );
}

// silence unused import if tree-shaken oddly
void allergenLabel;
