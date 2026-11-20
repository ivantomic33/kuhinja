"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { Carrot, Grid2X2, Plus, Search, Table2 } from "lucide-react";
import { CreateIngredientSheet } from "@/components/create/CreateIngredientSheet";
import { DeleteIngredientButton } from "@/components/create/DeleteIngredientButton";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { UsageStrip } from "@/components/ui/UsageStrip";
import { useWorkspacePagination, WorkspacePagination } from "@/components/ui/WorkspacePagination";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import type { CachedIngredient } from "@/lib/offline/cache";
import { FREE_MAX_INGREDIENTS } from "@/lib/plan/limits";
import { formatMoney } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type ViewMode = "table" | "cards";

const VIEW_KEY = "mise-ingredients-view";

export type IngredientsWorkspaceProps = {
  initialIngredients: CachedIngredient[];
  venueId?: string | null;
  loadError?: boolean;
};

export function IngredientsWorkspace({
  initialIngredients,
  venueId = null,
  loadError = false,
}: IngredientsWorkspaceProps) {
  const { isFree, isPremium } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const [items, setItems] = useState(initialIngredients);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CachedIngredient | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("table");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "table" || saved === "cards") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((row) => {
      return (
        !q ||
        row.name.toLowerCase().includes(q) ||
        row.unit.toLowerCase().includes(q)
      );
    });
  }, [items, query]);
  const { page, pageCount, goToPage, scrollRef, visible } = useWorkspacePagination(filtered);
  const paginated = pageCount > 1;

  function openCreate() {
    if (isFree && items.length >= FREE_MAX_INGREDIENTS) {
      showFreeLimit("FREE_LIMIT_INGREDIENTS");
      return;
    }
    setEditTarget(null);
    setOpen(true);
  }

  function handleDeleted(id: string) {
    setItems((prev) => prev.filter((row) => row.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={sr.ingredients.title}
        description="Cene, jedinice i škart."
        action={
          <PrimaryButton
            type="button"
            leftIcon={<Plus className="size-4" aria-hidden="true" />}
            onClick={openCreate}
          >
            Dodaj sastojak
          </PrimaryButton>
        }
      />

      <UsageStrip
        label="Sastojci"
        used={items.length}
        max={FREE_MAX_INGREDIENTS}
        isPremium={isPremium}
      />

      {loadError && items.length === 0 ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-[var(--danger-soft)] p-5 text-danger"
        >
          Sastojci nisu učitani. Proverite vezu i osvežite stranicu.
        </p>
      ) : (
        <BentoCard
          header={
            <div className="flex w-full flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <label className="field-input w-full min-w-[240px] max-w-[480px] max-[900px]:max-w-none">
                  <Search className="size-4" aria-hidden="true" />
                  <span className="sr-only">{sr.common.search}</span>
                  <input
                    type="search"
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      startTransition(() => {
                        setQuery(value);
                        goToPage(0);
                      });
                    }}
                    placeholder="Pretraži sastojke..."
                  />
                </label>
                <SegmentedControl<ViewMode>
                  ariaLabel="Prikaz"
                  value={view}
                  onChange={changeView}
                  className="shrink-0"
                  options={[
                    {
                      value: "table",
                      label: "Tabela",
                      icon: <Table2 className="size-4" aria-hidden="true" />,
                    },
                    {
                      value: "cards",
                      label: "Kartice",
                      icon: <Grid2X2 className="size-4" aria-hidden="true" />,
                    },
                  ]}
                />
              </div>
              <WorkspacePagination page={page} pageCount={pageCount} goToPage={goToPage} />
            </div>
          }
          footer={
            items.length > 0 ? (
              <>
                <span>
                  {filtered.length} od {items.length} sastojaka
                </span>
                <span>Cene su bez PDV-a</span>
              </>
            ) : null
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Carrot className="size-7" aria-hidden="true" />}
              title={
                query
                  ? `Nema rezultata za „${query}”`
                  : "Još nema sastojaka"
              }
              description={
                query
                  ? "Proverite pravopis ili probajte drugi naziv."
                  : "Unesite sastojke sa cenom i jedinicom da bi food cost bio tačan."
              }
              action={
                query ? undefined : (
                  <PrimaryButton onClick={openCreate}>
                    Dodaj sastojak
                  </PrimaryButton>
                )
              }
            />
          ) : view === "table" ? (
            <div
              ref={scrollRef}
              className={paginated
                ? "app-scroll -mx-6 -mb-6 max-h-[70dvh] overflow-auto"
                : "-mx-6 -mb-6 overflow-x-auto"}
              role={paginated ? "region" : undefined}
              aria-label={paginated ? sr.ingredients.title : undefined}
              tabIndex={paginated ? 0 : undefined}
            >
              <table className="app-table">
                <thead className={paginated ? "sticky top-0 z-10 shadow-[0_1px_0_var(--border)]" : undefined}>
                  <tr>
                    <th>Naziv</th>
                    <th>Jedinica</th>
                    <th>Trenutna cena</th>
                    <th>Škart %</th>
                    <th>
                      <span className="sr-only">Akcije</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-[var(--text-2)]">
                            <Carrot className="size-5" aria-hidden="true" />
                          </span>
                          <span className="font-semibold text-text">
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="unit-chip">{item.unit}</span>
                      </td>
                      <td>
                        <span className="font-semibold tabular-nums">
                          {formatMoney(item.price, { fractionDigits: 2 })}
                        </span>{" "}
                        <span className="text-[var(--text-3)]">
                          din/{item.unit}
                        </span>
                      </td>
                      <td className="tabular-nums">
                        {formatMoney(item.waste_percent, {
                          fractionDigits: 0,
                        })}
                        %
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-9 items-center rounded-[10px] border border-border-strong bg-surface-2 px-3",
                              "text-[length:var(--fs-sm)] font-semibold text-text hover:bg-surface-3"
                            )}
                            onClick={() => {
                              setEditTarget(item);
                              setOpen(true);
                            }}
                          >
                            Izmeni
                          </button>
                          <DeleteIngredientButton
                            compact
                            ingredientId={item.id}
                            ingredientName={item.name}
                            onDeleted={handleDeleted}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 p-1">
              {visible.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-[18px] transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-3 text-[var(--text-2)]">
                      <Carrot className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[17px] font-semibold text-text line-clamp-2">
                        {item.name}
                      </p>
                    </div>
                    <span className="unit-chip shrink-0">{item.unit}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-[10px] bg-surface px-3 py-2.5">
                      <p className="text-[length:var(--fs-xs)] text-[var(--text-3)]">
                        Trenutna cena
                      </p>
                      <p className="mt-0.5 text-[length:var(--fs-sm)] font-semibold tabular-nums text-text">
                        {formatMoney(item.price, { fractionDigits: 2 })} din/
                        {item.unit}
                      </p>
                    </div>
                    <div className="rounded-[10px] bg-surface px-3 py-2.5">
                      <p className="text-[length:var(--fs-xs)] text-[var(--text-3)]">
                        Škart
                      </p>
                      <p className="mt-0.5 text-[length:var(--fs-sm)] font-semibold tabular-nums text-text">
                        {formatMoney(item.waste_percent, {
                          fractionDigits: 0,
                        })}
                        %
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-9 flex-1 items-center justify-center rounded-[10px] border border-border-strong bg-surface px-3",
                        "text-[length:var(--fs-sm)] font-semibold text-text hover:bg-surface-3"
                      )}
                      onClick={() => {
                        setEditTarget(item);
                        setOpen(true);
                      }}
                    >
                      Izmeni
                    </button>
                    <DeleteIngredientButton
                      compact
                      ingredientId={item.id}
                      ingredientName={item.name}
                      onDeleted={handleDeleted}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </BentoCard>
      )}

      <CreateIngredientSheet
        open={open}
        onClose={() => {
          setOpen(false);
          setEditTarget(null);
        }}
        venueId={venueId}
        currentCount={items.length}
        existing={items}
        // If sheet supports edit later; for now create still works
        onCreated={(ingredient) => {
          setItems((prev) =>
            [...prev.filter((row) => row.id !== ingredient.id), ingredient].sort(
              (a, b) => a.name.localeCompare(b.name, "sr")
            )
          );
        }}
      />
    </div>
  );
}
