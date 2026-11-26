"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { AllergenUpgradePlaceholder } from "@/components/allergens/AllergenUpgradePlaceholder";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getMenuAllergenMatrix } from "@/lib/allergens/actions";
import {
  ALLERGEN_CATALOG,
  type AllergenCode,
  type AllergenPresence,
} from "@/lib/allergens/catalog";
import { ALLERGEN_NOTICE } from "@/lib/allergens/notice";
import { presenceAriaLabel, presenceSymbol } from "@/lib/allergens/matrix";
import { sr } from "@/lib/i18n/sr";

type MenuRecipe = {
  id: string;
  name: string;
  totals: { code: AllergenCode; presence: AllergenPresence }[];
};

export function MenuAllergenPrintTable({
  recipeIds,
  loadError = false,
}: {
  recipeIds: string[];
  loadError?: boolean;
}) {
  const [recipes, setRecipes] = useState<MenuRecipe[] | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(
    null,
  );
  const recipeIdsKey = recipeIds.join(",");

  useEffect(() => {
    let active = true;
    const ids = recipeIdsKey ? recipeIdsKey.split(",") : [];

    if (loadError) {
      setError({ message: sr.allergens.menuLoadFailed });
      return () => {
        active = false;
      };
    }

    if (ids.length === 0) {
      setRecipes([]);
      return () => {
        active = false;
      };
    }

    void getMenuAllergenMatrix({ recipeIds: ids })
      .then((result) => {
        if (!active) return;
        if ("error" in result) {
          setError({ code: result.error.code, message: result.error.message });
          return;
        }
        setRecipes(result.data.recipes);
      })
      .catch(() => {
        if (active) setError({ message: sr.allergens.menuLoadFailed });
      });

    return () => {
      active = false;
    };
  }, [loadError, recipeIdsKey]);

  const isLocked = error?.code === "UPGRADE_REQUIRED";
  const tableRecipes = recipes ?? [];
  const totalsByRecipe = new Map(
    tableRecipes.map((recipe) => [
      recipe.id,
      new Map(recipe.totals.map(({ code, presence }) => [code, presence])),
    ]),
  );

  return (
    <main className="allergen-print-page flex min-w-0 flex-col gap-4">
      <PageHeader
        title={sr.allergens.menuTitle}
        description={sr.allergens.menuDescription}
        action={
          recipes && recipes.length > 0 && !error ? (
            <PrimaryButton
              type="button"
              className="allergen-print-controls"
              leftIcon={<Printer aria-hidden="true" />}
              onClick={() => window.print()}
            >
              {sr.allergens.print}
            </PrimaryButton>
          ) : undefined
        }
      />

      {isLocked ? (
        <AllergenUpgradePlaceholder />
      ) : error ? (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      ) : recipes === null ? (
        <p role="status" className="text-sm text-muted">
          {sr.common.loading}
        </p>
      ) : recipes.length === 0 ? (
        <p className="text-sm text-text-2">{sr.allergens.menuEmpty}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="allergen-print-table min-w-max border-collapse text-left text-ui-sm">
              <thead>
                <tr className="border-b border-border-strong">
                  <th scope="col" className="px-2 py-2 font-semibold text-text">
                    {sr.allergens.recipeCol}
                  </th>
                  {ALLERGEN_CATALOG.map((entry) => (
                    <th
                      key={entry.code}
                      scope="col"
                      title={entry.label}
                      className="px-2 py-2 text-center font-semibold text-text"
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
                {tableRecipes.map((recipe) => {
                  const totals = totalsByRecipe.get(recipe.id);
                  return (
                    <tr key={recipe.id} className="border-b border-border">
                      <th
                        scope="row"
                        className="max-w-64 px-2 py-2 font-medium text-text"
                      >
                        {recipe.name}
                      </th>
                      {ALLERGEN_CATALOG.map((entry) => {
                        const presence = totals?.get(entry.code) ?? null;
                        const symbol = presenceSymbol(presence);
                        return (
                          <td
                            key={entry.code}
                            className="px-2 py-2 text-center tabular-nums"
                            aria-label={`${recipe.name}: ${entry.label} — ${presenceAriaLabel(presence)}`}
                          >
                            {symbol || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-text-2">
            {sr.allergens.printLegend}
          </p>
          <p className="text-xs text-text-2">{ALLERGEN_NOTICE}</p>
        </>
      )}
    </main>
  );
}
