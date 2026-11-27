"use client";

import { startTransition, useEffect, useId, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Carrot, Grid2X2, Plus, Search, Table2 } from "lucide-react";
import { CreateIngredientSheet } from "@/components/create/CreateIngredientSheet";
import { DeleteIngredientButton } from "@/components/create/DeleteIngredientButton";
import { ExportButtons } from "@/components/exports/ExportButtons";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { DataTable, sortTableRows, type DataTableColumn, type DataTableSort } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import RouteError from "@/components/ui/RouteError";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { UsageStrip } from "@/components/ui/UsageStrip";
import { useWorkspacePagination, WorkspacePagination } from "@/components/ui/WorkspacePagination";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import type { CachedIngredient } from "@/lib/offline/cache";
import { FREE_MAX_INGREDIENTS } from "@/lib/plan/limits";
import { queryKeys } from "@/lib/query/keys";
import { useHydratedData } from "@/lib/query/use-hydrated-data";
import { formatMoney } from "@/lib/utils/format";
import { TableMoney } from "@/components/ui/TableMoney";
import { cn } from "@/lib/utils/cn";

type ViewMode = "table" | "cards";

const VIEW_KEY = "treuplate-ingredients-view";

export type IngredientsWorkspaceProps = {
  venueId?: string | null;
  workspaceId?: string | null;
  loadError?: boolean;
};

export function IngredientsWorkspace({
  venueId = null,
  workspaceId = null,
  loadError = false,
}: IngredientsWorkspaceProps) {
  const { isFree, isPremium } = usePlan();
  const { showFreeLimit } = usePlanUi();
  const queryClient = useQueryClient();
  const listKey = queryKeys.ingredients(venueId);
  const items = useHydratedData<CachedIngredient[]>(listKey);
  const [open, setOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<CachedIngredient | null>(null);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const hasQuery = Boolean(query.trim());
  const [sort, setSort] = useState<DataTableSort>();
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
  const columns: DataTableColumn<CachedIngredient>[] = [
    {
      id: "name",
      header: "Naziv",
      compare: (a, b) => a.name.localeCompare(b.name, "sr-Latn"),
      cell: item => (
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-2 text-text-2">
            <Carrot className="size-5" aria-hidden="true" />
          </span>
          <span className="font-semibold text-text">{item.name}</span>
        </div>
      ),
    },
    {
      id: "unit",
      header: "Jedinica",
      mobileLabel: "Jedinica",
      cell: item => <span className="unit-chip">{item.unit}</span>,
    },
    {
      id: "price",
      header: "Trenutna cena",
      mobileLabel: "Trenutna cena",
      compare: (a, b) => a.price - b.price,
      align: "right",
      price: true,
      className: "font-semibold",
      cell: item => <TableMoney value={item.price} unit={item.unit} />,
    },
    {
      id: "waste",
      header: "Škart %",
      mobileLabel: "Škart",
      compare: (a, b) => a.waste_percent - b.waste_percent,
      className: "whitespace-nowrap tabular-nums",
      cell: item => `${formatMoney(item.waste_percent, { fractionDigits: 0 })}%`,
    },
    {
      id: "actions",
      header: "Akcije",
      mobileLabel: null,
      cell: item => (
        <div className="flex flex-wrap items-center gap-2 md:flex-nowrap md:justify-end">
          <button
            type="button"
            className="inline-flex h-11 min-w-11 items-center rounded-[10px] border border-border-strong bg-surface-2 px-3 text-ui-sm font-semibold text-text hover:bg-surface-3 md:h-9"
            onClick={() => {
              setEditTarget(item);
              setOpen(true);
            }}
          >
            Izmeni
          </button>
          <DeleteIngredientButton compact ingredientId={item.id} ingredientName={item.name} onDeleted={handleDeleted} />
        </div>
      ),
    },
  ];
  const { page, pageCount, goToPage, scrollRef, visible } = useWorkspacePagination(sortTableRows(filtered, columns, sort));

  function openCreate() {
    if (isFree && items.length >= FREE_MAX_INGREDIENTS) {
      showFreeLimit("FREE_LIMIT_INGREDIENTS");
      return;
    }
    setEditTarget(null);
    setOpen(true);
  }

  function handleDeleted(id: string) {
    queryClient.setQueryData<CachedIngredient[]>(listKey, (prev) => prev?.filter((row) => row.id !== id));
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title={sr.ingredients.title}
        description={sr.ingredients.subtitle}
        action={!loadError && items.length > 0 ? (
          <>
            <ExportButtons
              scope="ingredients"
              workspaceId={workspaceId}
              formats={["csv", "xlsx"]}
            />
            <PrimaryButton
              type="button"
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
              onClick={openCreate}
            >
              {sr.create.ingredient.add}
            </PrimaryButton>
          </>
        ) : undefined}
      />

      {!loadError ? <UsageStrip
        label={sr.ingredients.title}
        used={items.length}
        max={FREE_MAX_INGREDIENTS}
        isPremium={isPremium}
      /> : null}

      {loadError ? (
        <RouteError message={sr.listStates.ingredients.error} />
      ) : (
        <BentoCard
          flush={filtered.length > 0}
          bodyClassName="min-w-0"
          header={
            <div className="flex w-full min-w-0 flex-col gap-3">
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="w-full min-w-0 max-w-[480px] max-[900px]:max-w-none">
                  <label htmlFor={searchId} className="field-label">Pretraži sastojke</label>
                  <div className="field-input">
                    <Search className="size-4" aria-hidden="true" />
                    <input
                      id={searchId}
                      ref={searchRef}
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
                  </div>
                </div>
                <div className="hidden shrink-0 md:block">
                  <SegmentedControl<ViewMode>
                    ariaLabel="Prikaz"
                    value={view}
                    onChange={changeView}
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
              title={hasQuery ? sr.listStates.noResults : sr.listStates.ingredients.empty}
              description={hasQuery ? undefined : sr.listStates.ingredients.emptyDescription}
              actionLabel={hasQuery ? sr.listStates.clearSearch : sr.listStates.ingredients.emptyAction}
              onAction={hasQuery ? () => {
                setQuery("");
                goToPage(0);
                if (searchRef.current) {
                  searchRef.current.value = "";
                  searchRef.current.focus();
                }
              } : openCreate}
            />
          ) : (
            <>
              <DataTable
                className={view === "cards" ? "md:hidden" : undefined}
                columns={columns}
                rows={visible}
                rowKey={item => item.id}
                rowLabel={item => item.name}
                label={sr.ingredients.title}
                scrollRef={scrollRef}
                sort={sort}
                onSortChange={next => {
                  setSort(next);
                  goToPage(0);
                }}
                selectable
                stacked
              />
              {view === "cards" ? (
                <ul className="motion-card-list hidden min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-4 p-5 md:grid">
                  {visible.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-5 transition-colors hover:border-border-strong"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-surface-3 text-text-2">
                          <Carrot className="size-5" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-ui-lg font-semibold text-text line-clamp-2">
                            {item.name}
                          </p>
                        </div>
                        <span className="unit-chip shrink-0">{item.unit}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[10px] bg-surface px-3 py-3">
                          <p className="text-ui-xs text-text-3">
                            Trenutna cena
                          </p>
                          <p className="mt-1 text-ui-sm font-semibold tabular-nums text-text">
                            {formatMoney(item.price, { fractionDigits: 2 })} din/
                            {item.unit}
                          </p>
                        </div>
                        <div className="rounded-[10px] bg-surface px-3 py-3">
                          <p className="text-ui-xs text-text-3">
                            Škart
                          </p>
                          <p className="mt-1 text-ui-sm font-semibold tabular-nums text-text">
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
                            "text-ui-sm font-semibold text-text hover:bg-surface-3"
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
              ) : null}
            </>
          )}
        </BentoCard>
      )}

      <CreateIngredientSheet
        key={editTarget?.id ?? "create"}
        open={open}
        onClose={() => {
          setOpen(false);
          setEditTarget(null);
        }}
        venueId={venueId}
        currentCount={items.length}
        existing={items}
        ingredient={editTarget}
        onCreated={(ingredient) => {
          queryClient.setQueryData<CachedIngredient[]>(listKey, (prev) =>
            [...(prev ?? []).filter((row) => row.id !== ingredient.id), ingredient].sort(
              (a, b) => a.name.localeCompare(b.name, "sr")
            )
          );
        }}
      />
    </div>
  );
}
