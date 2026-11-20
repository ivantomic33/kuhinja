"use client";

import { Pencil, Plus, Save, Trash2, UtensilsCrossed } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EditRecipeSheet,
  type EditedRecipeSummary,
} from "@/components/recipes/EditRecipeSheet";
import { usePlanUiOptional } from "@/components/plan/PlanProvider";
import { BentoCard } from "@/components/ui/BentoCard";
import { BigNumber } from "@/components/ui/BigNumber";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import {
  areUnitsCompatible,
  calculateFoodCost,
  foodCostPercentFromPrices,
  lineCost,
  roundDisplay,
  type CalcUnit,
  type IngredientLineInput,
  type PricingMode,
} from "@/lib/calc/foodcost";
import {
  saveRecipeItems,
  type RecipeCacheMeta,
} from "@/lib/domain/saveRecipeItems";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import {
  touchRecentRecipe,
  type CachedRecipe,
  type CachedRecipeItem,
} from "@/lib/offline/cache";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

export type CalculatorIngredient = {
  id: string;
  name: string;
  unit: CalcUnit;
  price: number;
  waste_percent: number;
};

export type CalculatorInitialLine = {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: CalcUnit;
};

export type FoodCostCalculatorProps = {
  recipeId?: string;
  recipeName: string;
  recipeDescription?: string | null;
  venueId?: string;
  portions?: number;
  sellingPrice?: number;
  ingredients: CalculatorIngredient[];
  initialLines?: CalculatorInitialLine[];
  defaultVatPercent?: number;
  defaultTargetPercent?: number;
  defaultMarginPercent?: number;
  /** When false, hide save/edit actions (offline fallback). */
  allowPersist?: boolean;
};

type DraftLine = {
  key: string;
  ingredientId: string;
  quantity: string;
  unit: CalcUnit;
};

const ALL_UNITS: CalcUnit[] = ["g", "kg", "ml", "l", "kom", "pak"];

const UNIT_LABELS: Record<CalcUnit, string> = {
  g: sr.recipes.units.g,
  kg: sr.recipes.units.kg,
  ml: sr.recipes.units.ml,
  l: sr.recipes.units.l,
  kom: sr.recipes.units.kom,
  pak: sr.recipes.units.pak,
};

function newLineKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyLine(defaultUnit: CalcUnit = "g"): DraftLine {
  return {
    key: newLineKey(),
    ingredientId: "",
    quantity: "",
    unit: defaultUnit,
  };
}

function parseQuantity(raw: string): number {
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function compatibleUnits(priceUnit: CalcUnit | null): CalcUnit[] {
  if (!priceUnit) return ALL_UNITS;
  return ALL_UNITS.filter((unit) => areUnitsCompatible(unit, priceUnit));
}

function formatMoney(value: number): string {
  return `${roundDisplay(value).toLocaleString("sr-Latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${sr.recipes.foodCost.currency}`;
}

export function FoodCostCalculator({
  recipeId,
  recipeName,
  recipeDescription = null,
  venueId,
  portions = 1,
  sellingPrice = 0,
  ingredients,
  initialLines = [],
  defaultVatPercent = 20,
  defaultTargetPercent = 30,
  defaultMarginPercent = 70,
  allowPersist = true,
}: FoodCostCalculatorProps) {
  const router = useRouter();
  const online = useOnline(true);
  const { handleError } = usePlanUiOptional();

  const ingredientMap = useMemo(() => {
    const map = new Map<string, CalculatorIngredient>();
    for (const item of ingredients) {
      map.set(item.id, item);
    }
    return map;
  }, [ingredients]);

  const [lines, setLines] = useState<DraftLine[]>(() => {
    if (initialLines.length === 0) {
      return [createEmptyLine()];
    }
    return initialLines.map((line) => ({
      key: line.id || newLineKey(),
      ingredientId: line.ingredientId,
      quantity: String(line.quantity),
      unit: line.unit,
    }));
  });

  const [mode, setMode] = useState<PricingMode>("target_food_cost");
  const [targetPercent, setTargetPercent] = useState(defaultTargetPercent);
  const [marginPercent, setMarginPercent] = useState(defaultMarginPercent);
  const [vatPercent, setVatPercent] = useState(defaultVatPercent);

  const [header, setHeader] = useState({
    name: recipeName,
    description: recipeDescription,
    portions,
    sellingPrice,
    venueId: venueId ?? "",
  });
  const [cachedItems, setCachedItems] = useState<CachedRecipeItem[]>(() =>
    initialLines.map((line) => ({
      id: line.id,
      ingredient_id: line.ingredientId,
      quantity: line.quantity,
      unit: line.unit,
    }))
  );

  const [editOpen, setEditOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | undefined>();
  const [statusError, setStatusError] = useState<string | undefined>();

  const canPersist = Boolean(allowPersist && recipeId && header.venueId);

  const calcLines: IngredientLineInput[] = useMemo(() => {
    return lines
      .map((line) => {
        const ingredient = ingredientMap.get(line.ingredientId);
        if (!ingredient) return null;
        if (!areUnitsCompatible(line.unit, ingredient.unit)) return null;

        return {
          quantity: parseQuantity(line.quantity),
          quantityUnit: line.unit,
          price: ingredient.price,
          priceUnit: ingredient.unit,
          lossPercent: ingredient.waste_percent,
        } satisfies IngredientLineInput;
      })
      .filter((line): line is IngredientLineInput => line !== null);
  }, [lines, ingredientMap]);

  const activePercent =
    mode === "target_food_cost" ? targetPercent : marginPercent;

  const result = useMemo(
    () =>
      calculateFoodCost({
        lines: calcLines,
        mode,
        percent: activePercent,
        vatPercent,
      }),
    [calcLines, mode, activePercent, vatPercent]
  );

  const menuFoodCostPct = useMemo(
    () =>
      foodCostPercentFromPrices(result.portionCost, header.sellingPrice),
    [result.portionCost, header.sellingPrice]
  );

  const priceDelta = result.netPrice - header.sellingPrice;

  const perLineDisplayCosts = useMemo(() => {
    return lines.map((line) => {
      const ingredient = ingredientMap.get(line.ingredientId);
      if (!ingredient) return null;
      if (!areUnitsCompatible(line.unit, ingredient.unit)) return null;
      const cost = lineCost({
        quantity: parseQuantity(line.quantity),
        quantityUnit: line.unit,
        price: ingredient.price,
        priceUnit: ingredient.unit,
        lossPercent: ingredient.waste_percent,
      });
      return roundDisplay(cost);
    });
  }, [lines, ingredientMap]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };

        if (patch.ingredientId !== undefined) {
          const ingredient = ingredientMap.get(patch.ingredientId);
          if (ingredient) {
            if (!areUnitsCompatible(next.unit, ingredient.unit)) {
              next.unit = ingredient.unit;
            }
          }
        }
        return next;
      })
    );
  }

  function addLine() {
    setLines((prev) => [...prev, createEmptyLine()]);
  }

  function removeLine(key: string) {
    setLines((prev) => {
      if (prev.length <= 1) {
        return [createEmptyLine()];
      }
      return prev.filter((line) => line.key !== key);
    });
  }

  function buildRecipeMeta(): RecipeCacheMeta | null {
    if (!recipeId || !header.venueId) return null;
    return {
      id: recipeId,
      venue_id: header.venueId,
      name: header.name,
      description: header.description,
      portions: header.portions,
      selling_price: header.sellingPrice,
    };
  }

  async function handleSaveLines() {
    if (!canPersist || !recipeId) return;
    setStatusMessage(undefined);
    setStatusError(undefined);

    if (!online) {
      setStatusError(sr.create.offline);
      return;
    }

    const meta = buildRecipeMeta();
    if (!meta) {
      setStatusError(sr.recipes.foodCost.saveLinesError);
      return;
    }

    const drafts = lines.map((line) => {
      const ingredient = ingredientMap.get(line.ingredientId);
      return {
        ingredientId: line.ingredientId,
        quantity: parseQuantity(line.quantity),
        quantityUnit: line.unit,
        ingredientUnit: ingredient?.unit ?? line.unit,
      };
    });

    setSaveLoading(true);
    try {
      const saved = await saveRecipeItems(recipeId, drafts, meta);
      if (!saved.ok) {
        if (saved.code === "empty") {
          setStatusError(sr.recipes.foodCost.saveLinesEmpty);
        } else if (saved.code === "duplicate") {
          setStatusError(sr.recipes.foodCost.saveLinesDuplicate);
        } else if (
          saved.code === "invalid" ||
          saved.code === "incompatible"
        ) {
          setStatusError(sr.recipes.foodCost.saveLinesInvalid);
        } else {
          setStatusError(sr.recipes.foodCost.saveLinesError);
        }
        return;
      }

      setCachedItems(saved.items);
      setLines(
        saved.items.map((item) => ({
          key: item.id || newLineKey(),
          ingredientId: item.ingredient_id,
          quantity: String(item.quantity),
          unit: (item.unit as CalcUnit) ?? "g",
        }))
      );
      setStatusMessage(sr.recipes.foodCost.saveLinesSuccess);
      router.refresh();
    } catch (error) {
      if (handleError(error)) return;
      setStatusError(sr.recipes.foodCost.saveLinesError);
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleApplySuggestedPrice() {
    if (!canPersist || !recipeId) return;
    setStatusMessage(undefined);
    setStatusError(undefined);

    if (!online) {
      setStatusError(sr.create.offline);
      return;
    }

    const nextPrice = roundDisplay(result.netPrice);
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setStatusError(sr.recipes.foodCost.applyPriceError);
      return;
    }

    setApplyLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("recipes")
        .update({ selling_price: nextPrice })
        .eq("id", recipeId);

      if (error) {
        if (handleError(error)) return;
        setStatusError(sr.recipes.foodCost.applyPriceError);
        return;
      }

      setHeader((prev) => ({ ...prev, sellingPrice: nextPrice }));

      const cached: Omit<CachedRecipe, "cachedAt"> = {
        id: recipeId,
        venue_id: header.venueId,
        name: header.name,
        description: header.description,
        portions: header.portions,
        selling_price: nextPrice,
        items: cachedItems,
      };
      void touchRecentRecipe(cached);

      setStatusMessage(sr.recipes.foodCost.applyPriceSuccess);
      router.refresh();
    } catch (error) {
      if (handleError(error)) return;
      setStatusError(sr.recipes.foodCost.applyPriceError);
    } finally {
      setApplyLoading(false);
    }
  }

  function handleRecipeUpdated(updated: EditedRecipeSummary) {
    setHeader({
      name: updated.name,
      description: updated.description ?? null,
      portions: updated.portions,
      sellingPrice: updated.selling_price,
      venueId: updated.venue_id,
    });
    setStatusMessage(sr.create.recipe.editSuccess);
    setStatusError(undefined);
  }

  const hasIngredients = ingredients.length > 0;

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="order-first flex min-w-0 flex-col gap-2 xl:col-span-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted">{sr.recipes.foodCost.title}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-text">
              {header.name}
            </h1>
            <p className="text-sm text-muted">{sr.recipes.foodCost.hint}</p>
          </div>
          {canPersist ? (
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center",
                "rounded-[var(--radius-input)] border border-border text-muted",
                "hover:bg-surface-2 hover:text-text",
                "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              )}
              aria-label={sr.recipes.foodCost.editRecipe}
              title={sr.recipes.foodCost.editRecipe}
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <aside className="order-2 flex min-w-0 flex-col gap-5 xl:sticky xl:top-8 xl:col-start-2 xl:row-start-2 xl:row-span-2" aria-label="Pregled obračuna">
      <BentoCard className="border-t-2 border-t-accent/70">
        <p className="text-sm text-muted">{sr.recipes.foodCost.portionCost}</p>
        <BigNumber value={roundDisplay(result.portionCost)} fractionDigits={2} suffix={" " + sr.recipes.foodCost.currency} label={sr.recipes.foodCost.portionCost} size="sm" className="text-3xl" />
        <dl className="mt-2 flex flex-col gap-4 border-t border-border pt-5 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">{sr.recipes.foodCost.suggestedNet}</dt><dd className="whitespace-nowrap font-semibold tabular-nums">{formatMoney(result.netPrice)}</dd></div>
          <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">{sr.recipes.foodCost.grossPrice}</dt><dd className="whitespace-nowrap font-semibold tabular-nums">{formatMoney(result.grossPrice)}</dd></div>
          <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted">{sr.recipes.foodCost.foodCostPercent}</dt><dd className="font-semibold tabular-nums">{roundDisplay(result.foodCostPercent).toLocaleString("sr-Latn")}%</dd></div>
        </dl>
      </BentoCard>

      {/* Menu price vs suggested */}
      {canPersist ? (
        <BentoCard
          header={
            <h2 className="text-base font-semibold text-text">
              {sr.recipes.foodCost.menuPrice}
            </h2>
          }
          footer={
            <PrimaryButton
              type="button"
              fullWidth
              loading={applyLoading}
              disabled={!online || result.netPrice <= 0}
              onClick={() => {
                void handleApplySuggestedPrice();
              }}
            >
              {sr.recipes.foodCost.applyPrice}
            </PrimaryButton>
          }
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted">
                {sr.recipes.foodCost.menuPrice}
              </p>
              <p
                data-numeric
                className="text-lg font-semibold tabular-nums text-text"
              >
                {formatMoney(header.sellingPrice)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted">
                {sr.recipes.foodCost.suggestedNet}
              </p>
              <p
                data-numeric
                className="text-xl font-semibold tabular-nums text-text"
              >
                {formatMoney(result.netPrice)}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted">
                {sr.recipes.foodCost.menuFoodCost}
              </p>
              <p
                data-numeric
                className="text-xl font-semibold tabular-nums text-text"
              >
                {header.sellingPrice > 0
                  ? `${roundDisplay(menuFoodCostPct).toLocaleString("sr-Latn", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}%`
                  : "—"}
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted">
                {sr.recipes.foodCost.priceDelta}
              </p>
              <p
                data-numeric
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  priceDelta > 0
                    ? "text-danger"
                    : priceDelta < 0
                      ? "text-accent"
                      : "text-text"
                )}
              >
                {`${priceDelta > 0 ? "+" : ""}${formatMoney(priceDelta)}`}
              </p>
            </div>
          </div>
        </BentoCard>
      ) : null}

      </aside>

      {/* Mode toggle + params */}
      <details className="order-3 min-w-0 rounded-xl border border-border bg-surface p-4 xl:col-start-1">
      <summary className="cursor-pointer text-sm font-medium text-muted">Napredni parametri obračuna</summary>
      <BentoCard className="mt-4 border-0 shadow-none"
        header={
          <h2 className="text-base font-semibold text-text">
            {sr.recipes.foodCost.results}
          </h2>
        }
      >
        <div className="flex flex-wrap gap-1" role="group" aria-label="Mode">
          <Chip
            selectable
            selected={mode === "target_food_cost"}
            onSelectedChange={() => setMode("target_food_cost")}
          >
            {sr.recipes.foodCost.modeTarget}
          </Chip>
          <Chip
            selectable
            selected={mode === "margin"}
            onSelectedChange={() => setMode("margin")}
          >
            {sr.recipes.foodCost.modeMargin}
          </Chip>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {mode === "target_food_cost" ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text">
                {sr.recipes.foodCost.targetPercent}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0.01}
                max={99.99}
                step={0.1}
                value={targetPercent}
                onChange={(event) =>
                  setTargetPercent(Number(event.target.value) || 0)
                }
                className={inputClassName}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-text">
                {sr.recipes.foodCost.marginPercent}
              </span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={99.99}
                step={0.1}
                value={marginPercent}
                onChange={(event) =>
                  setMarginPercent(Number(event.target.value) || 0)
                }
                className={inputClassName}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-text">
              {sr.recipes.foodCost.vatPercent}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step={0.1}
              value={vatPercent}
              onChange={(event) =>
                setVatPercent(Number(event.target.value) || 0)
              }
              className={inputClassName}
            />
          </label>
        </div>

        <p className="text-sm text-muted">{sr.recipes.foodCost.liveHint}</p>
      </BentoCard>

      </details>

      {/* Ingredient lines */}
      <BentoCard className="order-1 xl:col-start-1 xl:row-start-2"
        header={
          <h2 className="text-base font-semibold text-text">
            {sr.recipes.foodCost.ingredients}
          </h2>
        }
        footer={
          hasIngredients ? (
            <div className="flex flex-col gap-2">
              <PrimaryButton
                type="button"
                variant="ghost"
                fullWidth
                leftIcon={<Plus className="size-4" aria-hidden="true" />}
                onClick={addLine}
              >
                {sr.recipes.foodCost.addLine}
              </PrimaryButton>
              {canPersist ? (
                <PrimaryButton
                  type="button"
                  fullWidth
                  loading={saveLoading}
                  disabled={!online}
                  leftIcon={<Save className="size-4" aria-hidden="true" />}
                  onClick={() => {
                    void handleSaveLines();
                  }}
                >
                  {sr.recipes.foodCost.saveLines}
                </PrimaryButton>
              ) : null}
            </div>
          ) : null
        }
      >
        {!hasIngredients ? (
          <EmptyState
            icon={<UtensilsCrossed className="size-6" aria-hidden="true" />}
            title={sr.recipes.foodCost.emptyIngredients}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {lines.map((line, index) => {
              const ingredient = ingredientMap.get(line.ingredientId);
              const units = compatibleUnits(ingredient?.unit ?? null);
              const displayCost = perLineDisplayCosts[index];
              const unitMismatch =
                ingredient != null &&
                !areUnitsCompatible(line.unit, ingredient.unit);

              return (
                <li
                  key={line.key}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-text">
                        {sr.recipes.foodCost.ingredient}
                      </span>
                      <select
                        value={line.ingredientId}
                        onChange={(event) =>
                          updateLine(line.key, {
                            ingredientId: event.target.value,
                          })
                        }
                        className={cn(inputClassName, "appearance-none")}
                      >
                        <option value="">
                          {sr.recipes.foodCost.selectIngredient}
                        </option>
                        {ingredients.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      className={cn(
                        "mt-6 inline-flex size-10 shrink-0 items-center justify-center",
                        "rounded-[var(--radius-input)] border border-border text-muted",
                        "hover:bg-surface hover:text-danger",
                        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      )}
                      aria-label={sr.recipes.foodCost.removeLine}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-text">
                        {sr.recipes.foodCost.quantity}
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.key, {
                            quantity: event.target.value,
                          })
                        }
                        className={inputClassName}
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-text">
                        {sr.recipes.foodCost.unit}
                      </span>
                      <select
                        value={line.unit}
                        onChange={(event) =>
                          updateLine(line.key, {
                            unit: event.target.value as CalcUnit,
                          })
                        }
                        className={cn(inputClassName, "appearance-none")}
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>
                            {UNIT_LABELS[unit]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted">
                      {sr.recipes.foodCost.lineCost}
                    </span>
                    <span
                      data-numeric
                      className="text-sm font-semibold tabular-nums text-text"
                    >
                      {unitMismatch
                        ? sr.recipes.foodCost.noCompatibleUnit
                        : displayCost == null
                          ? `0.00 ${sr.recipes.foodCost.currency}`
                          : `${displayCost.toLocaleString("sr-Latn", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} ${sr.recipes.foodCost.currency}`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </BentoCard>

      {statusError ? (
        <p role="alert" className="order-4 text-sm text-danger xl:col-span-2">
          {statusError}
        </p>
      ) : null}
      {statusMessage ? (
        <p role="status" className="order-4 text-sm text-success xl:col-span-2">
          {statusMessage}
        </p>
      ) : null}

      {canPersist && recipeId ? (
        <EditRecipeSheet
          open={editOpen}
          onClose={() => setEditOpen(false)}
          recipe={{
            id: recipeId,
            venue_id: header.venueId,
            name: header.name,
            description: header.description,
            portions: header.portions,
            selling_price: header.sellingPrice,
          }}
          cachedItems={cachedItems}
          onUpdated={handleRecipeUpdated}
        />
      ) : null}
    </div>
  );
}

const inputClassName = cn(
  "min-h-11 w-full rounded-[var(--radius-input)] border border-border bg-surface px-3",
  "text-base text-text outline-none",
  "placeholder:text-muted",
  "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
);
