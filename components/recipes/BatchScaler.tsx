"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import {
  Check,
  ClipboardCopy,
  FileDown,
  ShoppingCart,
} from "lucide-react";
import { BentoCard } from "@/components/ui/BentoCard";
import { BigNumber } from "@/components/ui/BigNumber";
import { NumericKeypad } from "@/components/ui/NumericKeypad";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StateLink } from "@/components/ui/RouteStates";
import {
  MAX_SERVINGS,
  MIN_SERVINGS,
  calculateBatchScale,
  clampServings,
  formatScaledQuantity,
  formatShoppingListText,
  type ScalerIngredientInput,
  type ScalerUnit,
  type ScalingMode,
} from "@/lib/calc/scaler";
import { sr } from "@/lib/i18n/sr";
import type { Plan } from "@/lib/supabase/plan";
import { cn } from "@/lib/utils/cn";

export type BatchScalerIngredient = {
  id: string;
  name: string;
  quantity: number;
  unit: ScalerUnit;
  scaling?: ScalingMode;
  packageSize: number;
};

export type BatchScalerProps = {
  recipeId: string;
  recipeName: string;
  baseServings: number;
  /** Bake / cycle time in minutes */
  baseTimeMinutes: number;
  ingredients: BatchScalerIngredient[];
  plan: Plan;
};

function formatFactor(factor: number): string {
  if (!Number.isFinite(factor) || factor <= 0) return "—";
  return new Intl.NumberFormat("sr-Latn", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(factor);
}

export function BatchScaler({
  recipeId,
  recipeName,
  baseServings,
  baseTimeMinutes,
  ingredients,
}: BatchScalerProps) {
  const safeBase = baseServings > 0 ? baseServings : 1;

  const [targetServings, setTargetServings] = useState(() =>
    clampServings(safeBase)
  );
  const [ovenCapacity, setOvenCapacity] = useState(12);
  const [showShopping, setShowShopping] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [servingsDraft, setServingsDraft] = useState(String(targetServings));

  useEffect(() => {
    setServingsDraft(String(targetServings));
  }, [targetServings]);

  const scalerInputs: ScalerIngredientInput[] = useMemo(
    () =>
      ingredients.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        scaling: item.scaling ?? "linear",
        packageSize: item.packageSize,
      })),
    [ingredients]
  );

  const result = useMemo(
    () =>
      calculateBatchScale({
        ingredients: scalerInputs,
        baseServings: safeBase,
        targetServings,
        ovenCapacity,
        baseTime: baseTimeMinutes,
        totalPieces: targetServings,
      }),
    [
      scalerInputs,
      safeBase,
      targetServings,
      ovenCapacity,
      baseTimeMinutes,
    ]
  );

  const shoppingText = useMemo(
    () =>
      formatShoppingListText(
        result.shoppingList,
        `${sr.scaler.shoppingList} — ${recipeName}`
      ),
    [result.shoppingList, recipeName]
  );

  const applyServings = useCallback((raw: number) => {
    if (!Number.isFinite(raw)) return;
    setTargetServings(clampServings(raw));
  }, []);

  function onSliderChange(value: string) {
    applyServings(Number(value));
  }

  function onServingsInputChange(value: string) {
    setServingsDraft(value);
    const normalized = value.replace(",", ".").trim();
    if (!normalized) return;
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      applyServings(parsed);
    }
  }

  function onServingsBlur() {
    setServingsDraft(String(targetServings));
  }

  function onKeypadKey(key: string) {
    setServingsDraft((prev) => {
      const nextRaw = `${prev}${key}`.replace(/[^\d]/g, "");
      const clipped = nextRaw.slice(0, 3);
      const parsed = Number(clipped);
      if (Number.isFinite(parsed) && clipped.length > 0) {
        applyServings(parsed);
      }
      return clipped;
    });
  }

  function onKeypadBackspace() {
    setServingsDraft((prev) => {
      const next = prev.slice(0, -1);
      if (next) {
        applyServings(Number(next));
      } else {
        applyServings(MIN_SERVINGS);
      }
      return next;
    });
  }

  function onKeypadClear() {
    setServingsDraft("");
    applyServings(MIN_SERVINGS);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shoppingText);
      setCopyState("done");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2000);
    }
  }

  if (ingredients.length === 0) return <EmptyState title={sr.scaler.emptyIngredients}
    action={<StateLink href={`/recipes/${recipeId}`}>{sr.scaler.backToRecipe}</StateLink>} />;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted">{sr.scaler.title}</p>
        <h1>
          {recipeName}
        </h1>
        <p className="text-sm text-muted">{sr.scaler.hint}</p>
      </div>

      <div>
        <PrimaryButton
          leftIcon={<ShoppingCart aria-hidden="true" />}
          aria-expanded={showShopping}
          aria-controls="scaler-shopping-list"
          onClick={() => {
            setShowShopping(true);
            window.requestAnimationFrame(() => {
              const list = document.getElementById("scaler-shopping-list");
              list?.focus({ preventScroll: true });
              list?.scrollIntoView({ block: "start" });
            });
          }}
        >
          {sr.scaler.shoppingList}
        </PrimaryButton>
      </div>

      <BentoCard
        header={
          <h2 className="text-base font-semibold text-text">
            {sr.scaler.targetServings}
          </h2>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm text-muted">{sr.scaler.baseServings}</p>
              <p className="text-base font-medium tabular-nums text-text">
                {safeBase}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">{sr.scaler.factor}</p>
              <p className="text-base font-medium tabular-nums text-text">
                × {formatFactor(result.factor)}
              </p>
            </div>
          </div>

          <BigNumber
            value={targetServings}
            fractionDigits={0}
            label={sr.scaler.targetServings}
          />

          <label className="flex flex-col gap-1">
            <span className="sr-only">{sr.scaler.targetServings}</span>
            <input
              type="range"
              min={MIN_SERVINGS}
              max={MAX_SERVINGS}
              step={1}
              value={targetServings}
              onChange={(event) => onSliderChange(event.target.value)}
              className={cn(
                "h-2 w-full cursor-pointer appearance-none rounded-[var(--radius-pill)]",
                "bg-surface-2 accent-[var(--accent)]"
              )}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{sr.scaler.targetServings}</span>
            <input
              type="number"
              inputMode="numeric"
              min={MIN_SERVINGS}
              max={MAX_SERVINGS}
              value={servingsDraft}
              onChange={(event) => onServingsInputChange(event.target.value)}
              onBlur={onServingsBlur}
              className={cn(
                "min-h-[52px] w-full rounded-[var(--radius-input)] border border-border",
                "bg-surface-2 px-3 text-base tabular-nums text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-accent"
              )}
            />
          </label>

          <NumericKeypad
            onKey={onKeypadKey}
            onBackspace={onKeypadBackspace}
            onClear={onKeypadClear}
            showDecimal={false}
            className="max-w-sm lg:[&_button]:min-h-11 lg:[&_button]:h-11 lg:[&_button]:text-lg"
          />

          <p className="text-sm text-muted">{sr.scaler.liveHint}</p>
        </div>
      </BentoCard>

      <BentoCard
        header={
          <h2 className="text-base font-semibold text-text">
            {sr.scaler.ingredients}
          </h2>
        }
      >
          <ul className="flex flex-col gap-1">
            {result.scaled.map((item) => {
              const display = formatScaledQuantity(
                item.scaledQuantity,
                item.unit
              );
              const scalingLabel =
                item.scaling === "sublinear"
                  ? sr.scaler.scalingSublinear
                  : sr.scaler.scalingLinear;

              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-[var(--radius-input)]",
                    "border border-border bg-surface-2 px-2 py-2",
                    "motion-safe:transition-colors"
                  )}
                >
                  <div className="min-w-0 flex flex-col gap-1">
                    <span className="truncate text-base font-medium text-text">
                      {item.name}
                    </span>
                    <span className="text-xs text-muted">{scalingLabel}</span>
                  </div>
                  <span
                    data-numeric
                    className="shrink-0 text-base font-semibold tabular-nums text-text"
                  >
                    {display.label}
                  </span>
                </li>
              );
            })}
          </ul>
      </BentoCard>

      <BentoCard
        header={
          <h2 className="text-base font-semibold text-text">
            {sr.scaler.ovenTitle}
          </h2>
        }
      >
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-muted">{sr.scaler.ovenCapacity}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              value={ovenCapacity}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isFinite(next)) return;
                setOvenCapacity(Math.min(500, Math.max(1, Math.round(next))));
              }}
              className={cn(
                "min-h-[52px] w-full rounded-[var(--radius-input)] border border-border",
                "bg-surface-2 px-3 text-base tabular-nums text-text",
                "outline-none focus-visible:ring-2 focus-visible:ring-accent"
              )}
            />
            <span className="text-sm text-muted">
              {sr.scaler.ovenCapacityHint}
            </span>
          </label>

          <p className="text-sm text-muted">
            {sr.scaler.baseTime}: {baseTimeMinutes} {sr.scaler.ovenMinutes}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-[var(--radius-input)] border border-border bg-surface-2 p-2">
              <p className="text-sm text-muted">{sr.scaler.ovenCycles}</p>
              <BigNumber
                value={result.oven.cycles}
                fractionDigits={0}
                label={sr.scaler.ovenCycles}
                className="text-3xl sm:text-4xl"
              />
            </div>
            <div className="rounded-[var(--radius-input)] border border-border bg-surface-2 p-2">
              <p className="text-sm text-muted">{sr.scaler.ovenTotalTime}</p>
              <BigNumber
                value={result.oven.totalTime}
                fractionDigits={0}
                suffix={` ${sr.scaler.ovenMinutes}`}
                label={sr.scaler.ovenTotalTime}
                className="text-3xl sm:text-4xl"
              />
            </div>
          </div>
        </div>
      </BentoCard>
      <BentoCard
        id="scaler-shopping-list"
        className="scroll-mt-20"
        tabIndex={-1}
        header={
          <h2 className="text-base font-semibold text-text">
            {sr.scaler.shoppingList}
          </h2>
        }
      >
        <div className="flex flex-col gap-2">
          <PrimaryButton
            type="button"
            fullWidth
            leftIcon={<ShoppingCart className="size-5" aria-hidden="true" />}
            aria-expanded={showShopping}
            onClick={() => setShowShopping((open) => !open)}
          >
            {sr.scaler.shoppingList}
          </PrimaryButton>

          {showShopping ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{sr.scaler.shoppingListHint}</p>

              {result.shoppingList.length === 0 ? (
                <p className="text-sm text-muted">{sr.scaler.shoppingEmpty}</p>
              ) : (
                <pre
                  className={cn(
                    "whitespace-pre-wrap rounded-[var(--radius-input)] border border-border",
                    "bg-surface-2 p-2 font-sans text-sm leading-relaxed text-text"
                  )}
                >
                  {shoppingText}
                </pre>
              )}

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PrimaryButton
                  type="button"
                  variant="ghost"
                  fullWidth
                  leftIcon={
                    copyState === "done" ? (
                      <Check className="size-5" aria-hidden="true" />
                    ) : (
                      <ClipboardCopy className="size-5" aria-hidden="true" />
                    )
                  }
                  onClick={() => void handleCopy()}
                  disabled={result.shoppingList.length === 0}
                >
                  {copyState === "done"
                    ? sr.scaler.copied
                    : copyState === "error"
                      ? sr.scaler.copyFailed
                      : sr.scaler.copy}
                </PrimaryButton>

                <div className="flex flex-col gap-2">
                  <PrimaryButton
                    type="button"
                    variant="ghost"
                    fullWidth
                    leftIcon={<FileDown className="size-5" aria-hidden="true" />}
                    disabled
                    title="PDF izvoz trenutno nije dostupan"
                  >
                    {sr.scaler.exportPdf}
                  </PrimaryButton>
                  <p className="text-xs text-muted">PDF izvoz trenutno nije dostupan.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </BentoCard>

    </div>
  );
}
