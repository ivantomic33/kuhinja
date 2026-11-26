"use client";

import { memo, use, useCallback, useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { SaleFoodCost } from "@/components/stock/SaleFoodCost";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import RouteError from "@/components/ui/RouteError";
import { useToast } from "@/components/ui/Toast";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import { stockSr as t } from "@/lib/i18n/stock";
import { hasMinPlan, planDisplayName } from "@/lib/plan/entitlements";
import { applySale, undoSale } from "@/lib/stock/actions";
import { belgradeToday, formatQty, previewSaleDeductions, selectSaleRecipes } from "@/lib/stock/math";
import { summarizeSaleFoodCost } from "@/lib/stock/saleFoodCost";
import type { RecipeForSale, SaleDeductionLine, StockRow } from "@/lib/stock/types";
import { cn } from "@/lib/utils/cn";

export type SaleModalProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  venueId: string;
  recipes: Promise<RecipeForSale[] | null>;
  stockRows: StockRow[];
  userId?: string | null;
  onOpenRestock: () => void;
  onSaved: () => void;
};

type SaleResult = {
  id: string;
  date: string;
  lines: SaleDeductionLine[];
  foodCost: ReturnType<typeof summarizeSaleFoodCost>;
};

const emptyRecipes: RecipeForSale[] = [];

const saleDateFormatter = new Intl.DateTimeFormat("sr-Latn-RS", {
  timeZone: "Europe/Belgrade",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const SaleRecipeRow = memo(function SaleRecipeRow({
  recipe,
  count,
  changeCount,
}: {
  recipe: RecipeForSale;
  count: number;
  changeCount: (recipeId: string, delta: number) => void;
}) {
  const summary = recipe.items.slice(0, 3).map((item) => item.name).join(", ");

  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{recipe.name}</p>
        <p className="truncate text-ui-xs text-text-3">{summary || "—"}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="icon-btn size-11"
          aria-label={`Smanji količinu: ${recipe.name}`}
          onClick={() => changeCount(recipe.id, -1)}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="w-8 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {count}
        </span>
        <button
          type="button"
          className="icon-btn size-11"
          aria-label={`Povećaj količinu: ${recipe.name}`}
          onClick={() => changeCount(recipe.id, 1)}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
});

const SalePreview = memo(function SalePreview({ lines }: { lines: SaleDeductionLine[] }) {
  const negativeNames = lines.filter((line) => line.after < 0).map((line) => line.name);
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3">
      <h3 className="text-sm font-semibold text-text">{t.saleLive}</h3>
      {lines.length === 0 ? (
        <p className="text-sm text-text-2">{t.saleLiveEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lines.map((line) => (
            <li
              key={line.ingredientId}
              className={cn("flex items-center justify-between gap-2 text-sm", line.after < 0 && "text-danger")}
            >
              <span className="truncate">{line.name}</span>
              <span className="shrink-0 tabular-nums">
                −{formatQty(line.qty)} → {formatQty(line.after)} {line.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
      {negativeNames.length > 0 ? (
        <p className="rounded-lg border border-danger/30 bg-[var(--danger-soft)] px-3 py-2 text-sm text-danger">
          {t.saleNegBanner.replace("{names}", negativeNames.join(", "))}
        </p>
      ) : null}
    </section>
  );
});

export function SaleModal({
  open,
  onClose,
  returnFocusRef,
  venueId,
  recipes: recipeData,
  stockRows,
  userId,
  onOpenRestock,
  onSaved,
}: SaleModalProps) {
  const loadedRecipes = use(recipeData);
  const recipes = loadedRecipes ?? emptyRecipes;
  const { toast } = useToast();
  const router = useRouter();
  const { plan } = usePlan();
  const canSeeFoodCost = hasMinPlan(plan, "starter");
  const canSeeDishes = hasMinPlan(plan, "pro");
  const [date, setDate] = useState("");
  const [shift, setShift] = useState("");
  const fieldId = useId();
  const [portions, setPortions] = useState<Record<string, number>>({});
  const [previewPortions, setPreviewPortions] = useState(portions);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [negOpen, setNegOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [result, setResult] = useState<SaleResult | null>(null);
  const [undoingSaleId, setUndoingSaleId] = useState<string | null>(null);
  const saleInFlight = useRef(false);
  const activeResultId = useRef<string | null>(null);
  const undoInFlight = useRef(new Set<string>());

  useEffect(() => {
    if (!open) return;
    const emptyPortions = {};
    setDate(belgradeToday());
    setShift("");
    setPortions(emptyPortions);
    setPreviewPortions(emptyPortions);
    setError(null);
    setLoading(false);
    setNegOpen(false);
    setResultOpen(false);
    setResult(null);
    activeResultId.current = null;
  }, [open]);

  useEffect(() => {
    if (!open || portions === previewPortions) return;
    const timeout = window.setTimeout(() => setPreviewPortions(portions), 120);
    return () => window.clearTimeout(timeout);
  }, [open, portions, previewPortions]);

  const editing = open && !resultOpen;
  const stockMap = useMemo(
    () => new Map(editing ? stockRows.map((row) => [row.ingredientId, row]) : []),
    [editing, stockRows]
  );
  const recipesById = useMemo(
    () => new Map(editing ? recipes.map((recipe, index) => [recipe.id, { recipe, index }]) : []),
    [editing, recipes]
  );
  const previewRecipes = useMemo(
    () => selectSaleRecipes(recipesById, previewPortions),
    [recipesById, previewPortions]
  );
  const previewLines = useMemo(
    () => previewSaleDeductions(previewRecipes, previewPortions, stockMap),
    [previewRecipes, previewPortions, stockMap]
  );

  const totalPortions = useMemo(
    () => Object.values(portions).reduce((sum, n) => sum + n, 0),
    [portions]
  );

  let resultDescription = "";
  if (result) {
    const formatted = saleDateFormatter.format(new Date(result.date));
    if (!canSeeFoodCost) resultDescription = `${t.saleResultStock} · ${formatted}`;
    else if (result.date === belgradeToday()) resultDescription = `${t.saleResultToday} · ${formatted}`;
    else resultDescription = formatted;
  }

  const changeCount = useCallback((recipeId: string, delta: number) => {
    if (saleInFlight.current) return;
    setPortions((prev) => {
      const count = prev[recipeId] ?? 0;
      const next = Math.max(0, count + delta);
      if (next === count) return prev;
      const updated = { ...prev };
      if (next === 0) delete updated[recipeId];
      else updated[recipeId] = next;
      return updated;
    });
  }, []);

  async function commit(allowNegative: boolean) {
    if (saleInFlight.current || totalPortions <= 0) return;
    const previewCurrent = portions === previewPortions;
    const selected = previewCurrent ? previewRecipes : selectSaleRecipes(recipesById, portions);
    const lines = previewCurrent ? previewLines : previewSaleDeductions(selected, portions, stockMap);
    if (lines.length === 0) return;
    if (!previewCurrent) setPreviewPortions(portions);
    if (!allowNegative && lines.some((line) => line.after < 0)) {
      setNegOpen(true);
      return;
    }

    saleInFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      const saleDate = date || belgradeToday();
      const foodCost = summarizeSaleFoodCost(selected, portions);
      const { saleId } = await applySale({
        venueId,
        lines,
        userId,
        allowNegative,
      });
      activeResultId.current = saleId;
      setResult({ id: saleId, date: saleDate, foodCost, lines });
      setNegOpen(false);
      setResultOpen(true);
      onSaved();
      toast(t.saleSuccess, {
        durationMs: 10000,
        action: {
          label: t.saleUndo,
          onClick: () => void handleUndo(saleId),
        },
      });
    } catch (err) {
      if (err instanceof Error && err.message === "negative") {
        setNegOpen(true);
      } else {
        setError(sr.common.error);
      }
    } finally {
      saleInFlight.current = false;
      setLoading(false);
    }
  }

  function closeEntry() {
    if (!saleInFlight.current) onClose();
  }

  function closeNegative() {
    if (!saleInFlight.current) setNegOpen(false);
  }

  function closeResult() {
    activeResultId.current = null;
    setResultOpen(false);
    onClose();
  }

  async function handleUndo(saleId: string) {
    if (undoInFlight.current.has(saleId)) return;
    undoInFlight.current.add(saleId);
    if (activeResultId.current === saleId) {
      setUndoingSaleId(saleId);
      setError(null);
    }
    try {
      await undoSale({ venueId, saleId });
      toast(t.saleUndone);
      onSaved();
      if (activeResultId.current === saleId) closeResult();
    } catch {
      if (activeResultId.current === saleId) setError(sr.common.error);
      else toast(sr.common.error, "danger");
    } finally {
      undoInFlight.current.delete(saleId);
      setUndoingSaleId((id) => id === saleId ? null : id);
    }
  }

  return (
    <>
      <BottomSheet
        open={editing}
        onClose={closeEntry}
        returnFocusRef={returnFocusRef}
        title={t.saleTitle}
        description={t.saleSub}
        size="lg"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <p id={`${fieldId}-portions`} className="text-sm text-text-2">
              {totalPortions === 0 ? "Dodaj najmanje jednu porciju da evidentiraš prodaju." : `${t.saleTotal}: ${totalPortions}`}
            </p>
            <div className="flex gap-2">
              <PrimaryButton variant="secondary" disabled={loading} onClick={closeEntry}>
                {sr.common.cancel}
              </PrimaryButton>
              <PrimaryButton
                loading={loading}
                disabled={totalPortions === 0}
                aria-describedby={totalPortions === 0 ? `${fieldId}-portions` : undefined}
                onClick={() => void commit(false)}
              >
                {t.saleSubmit}
              </PrimaryButton>
            </div>
          </div>
        }
      >
        <fieldset disabled={loading} className="flex min-w-0 flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label htmlFor={`${fieldId}-date`} className="flex flex-col gap-1 text-ui-xs text-text-2">
              {t.saleDate}
              <input
                id={`${fieldId}-date`}
                type="date"
                className="field-control"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label htmlFor={`${fieldId}-shift`} className="flex flex-col gap-1 text-ui-xs text-text-2">
              {t.saleShift}
              <select
                id={`${fieldId}-shift`}
                className="field-control"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
              >
                <option value="">{t.saleShiftNone}</option>
                <option value="jutro">{t.saleShiftMorning}</option>
                <option value="podne">{t.saleShiftNoon}</option>
                <option value="vece">{t.saleShiftEvening}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">{t.saleRecipes}</h3>
              {loadedRecipes === null ? (
                <RouteError message={t.saleLoadError} />
              ) : recipes.length === 0 ? (
                <p className="text-sm text-text-2">{t.saleEmptyRecipes}</p>
              ) : editing ? (
                <ul className="flex flex-col gap-2">
                  {recipes.map((recipe) => (
                    <SaleRecipeRow
                      key={recipe.id}
                      recipe={recipe}
                      count={portions[recipe.id] ?? 0}
                      changeCount={changeCount}
                    />
                  ))}
                </ul>
              ) : null}
            </section>

            {editing ? <SalePreview lines={previewLines} /> : null}
          </div>

          {error && !negOpen ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
        </fieldset>
      </BottomSheet>

      <BottomSheet
        open={negOpen}
        onClose={closeNegative}
        title={t.negTitle}
        size="md"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <PrimaryButton variant="secondary" disabled={loading} onClick={closeNegative}>
              {t.negReduce}
            </PrimaryButton>
            <PrimaryButton
              variant="secondary"
              disabled={loading}
              onClick={() => {
                if (saleInFlight.current) return;
                setNegOpen(false);
                onClose();
                onOpenRestock();
              }}
            >
              {t.negRestock}
            </PrimaryButton>
            <PrimaryButton loading={loading} onClick={() => void commit(true)}>
              {t.negContinue}
            </PrimaryButton>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          <p className="text-sm text-text-2">{t.negBody}</p>
          <ul className="list-disc pl-5 text-sm text-danger">
            {negOpen && previewLines
              .filter((l) => l.after < 0)
              .map((l) => (
                <li key={l.ingredientId}>
                  {l.name}: {formatQty(l.after)} {l.unit}
                </li>
              ))}
          </ul>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
      </BottomSheet>

      <BottomSheet
        id="modalSaleResult"
        open={resultOpen}
        onClose={closeResult}
        returnFocusRef={returnFocusRef}
        title={canSeeFoodCost ? t.saleFoodCostTitle : t.saleResultTitle}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {resultDescription}
            <span className="rounded-full border border-border-strong bg-surface-2 px-2 py-1 text-xs font-medium text-text">
              {planDisplayName(canSeeDishes ? "pro" : plan)}
            </span>
          </span>
        }
        size="lg"
        className="md:max-w-[640px]"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            {result ? (
              <PrimaryButton
                variant="ghost"
                className="mr-auto"
                loading={undoingSaleId === result.id}
                onClick={() => void handleUndo(result.id)}
              >
                {t.saleUndo}
              </PrimaryButton>
            ) : null}
            <PrimaryButton variant="secondary" onClick={closeResult}>
              {sr.common.close}
            </PrimaryButton>
            <PrimaryButton onClick={closeResult}>
              {t.saleResultOpenStock}
            </PrimaryButton>
          </div>
        }
      >
        {result ? (
          <div className="flex flex-col gap-4">
            <SaleFoodCost
              summary={canSeeFoodCost ? result.foodCost : null}
              showDishes={canSeeDishes}
              onSeePlans={() => {
                closeResult();
                router.push("/premium");
              }}
            />
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-text">{t.saleResultStock}</h3>
              <ul className="flex flex-col gap-2">
                {result.lines.map((line) => (
                  <li
                    key={line.ingredientId}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm"
                  >
                    <span>{line.name}</span>
                    <span className="shrink-0 tabular-nums text-danger">
                      −{formatQty(line.qty)} {line.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          </div>
        ) : null}
      </BottomSheet>
    </>
  );
}
