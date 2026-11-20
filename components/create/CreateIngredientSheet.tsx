"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/AuthField";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { BigNumber } from "@/components/ui/BigNumber";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { parseDecimal } from "@/lib/domain/parse";
import { getPrimaryVenueId } from "@/lib/domain/venue";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import {
  saveIngredients,
  type CachedIngredient,
} from "@/lib/offline/cache";
import {
  canCreateIngredient,
  FREE_MAX_INGREDIENTS,
  isUnlimited,
} from "@/lib/plan/entitlements";
import {
  ingredientInsertSchema,
  ingredientUnitSchema,
  type IngredientUnitInput,
} from "@/lib/schemas/domain";
import { createClient } from "@/lib/supabase/client";
import { roundDisplay } from "@/lib/calc/foodcost";
import { cn } from "@/lib/utils/cn";

const UNITS = ingredientUnitSchema.options;

const UNIT_LABELS: Record<IngredientUnitInput, string> = {
  g: sr.recipes.units.g,
  kg: sr.recipes.units.kg,
  ml: sr.recipes.units.ml,
  l: sr.recipes.units.l,
  kom: sr.recipes.units.kom,
  pak: sr.recipes.units.pak,
};

export type CreateIngredientSheetProps = {
  open: boolean;
  onClose: () => void;
  venueId?: string | null;
  currentCount: number;
  existing?: CachedIngredient[];
  onCreated?: (ingredient: CachedIngredient) => void;
};

export function CreateIngredientSheet({
  open,
  onClose,
  venueId: venueIdProp,
  currentCount,
  existing = [],
  onCreated,
}: CreateIngredientSheetProps) {
  const router = useRouter();
  const online = useOnline(true);
  const { isFree } = usePlan();
  const { showFreeLimit, handleError } = usePlanUi();

  const [name, setName] = useState("");
  const [unit, setUnit] = useState<IngredientUnitInput>("kg");
  const [unitAmount, setUnitAmount] = useState("1");
  const [price, setPrice] = useState("");
  const [waste, setWaste] = useState("0");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const remainingFree = Math.max(0, FREE_MAX_INGREDIENTS - currentCount);

  const unitPricePreview = useMemo(() => {
    const amountValue = parseDecimal(unitAmount);
    const productPrice = parseDecimal(price);
    if (
      amountValue === null ||
      amountValue <= 0 ||
      productPrice === null ||
      productPrice < 0
    ) {
      return null;
    }
    return productPrice / amountValue;
  }, [unitAmount, price]);

  const effectivePrice = useMemo(() => {
    if (unitPricePreview === null) return null;
    const wasteValue = parseDecimal(waste);
    if (wasteValue === null || wasteValue < 0 || wasteValue >= 100) return null;
    const factor = 1 - wasteValue / 100;
    if (factor <= 0) return null;
    return unitPricePreview / factor;
  }, [unitPricePreview, waste]);

  const nameError = useMemo(() => {
    if (!touched.name && !fieldErrors.name) return undefined;
    if (!name.trim()) return sr.auth.errors.required;
    return fieldErrors.name;
  }, [name, touched.name, fieldErrors.name]);

  const isValid = useMemo(() => {
    const amountValue = parseDecimal(unitAmount);
    const productPrice = parseDecimal(price);
    const wasteValue = parseDecimal(waste);
    return (
      name.trim().length > 0 &&
      amountValue !== null &&
      amountValue > 0 &&
      productPrice !== null &&
      productPrice >= 0 &&
      wasteValue !== null &&
      wasteValue >= 0 &&
      wasteValue < 100
    );
  }, [name, unitAmount, price, waste]);

  function reset() {
    setName("");
    setUnit("kg");
    setUnitAmount("1");
    setPrice("");
    setWaste("0");
    setNotes("");
    setFieldErrors({});
    setFormError(undefined);
    setTouched({});
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(undefined);
    setFieldErrors({});
    setTouched({ name: true, unitAmount: true, price: true, waste: true });

    if (!online) {
      setFormError(sr.create.offline);
      return;
    }

    if (isFree && currentCount >= FREE_MAX_INGREDIENTS) {
      showFreeLimit("FREE_LIMIT_INGREDIENTS");
      return;
    }

    const amountValue = parseDecimal(unitAmount);
    const productPrice = parseDecimal(price);
    const wasteValue = parseDecimal(waste);

    if (amountValue === null || amountValue <= 0) {
      setFieldErrors({ unitAmount: sr.create.invalidNumber });
      return;
    }
    if (productPrice === null || productPrice < 0) {
      setFieldErrors({ price: sr.create.invalidNumber });
      return;
    }
    if (wasteValue === null || wasteValue < 0 || wasteValue >= 100) {
      setFieldErrors({ waste: sr.create.invalidNumber });
      return;
    }

    const pricePerUnit = productPrice / amountValue;

    let venueId = venueIdProp ?? null;
    if (!venueId) {
      venueId = await getPrimaryVenueId();
    }
    if (!venueId) {
      setFormError(sr.create.noVenue);
      return;
    }

    const parsed = ingredientInsertSchema.safeParse({
      venue_id: venueId,
      name,
      unit,
      price: pricePerUnit,
      waste_percent: wasteValue,
      notes: notes.trim() ? notes.trim() : null,
    });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !errors[key]) {
          errors[key] =
            key === "name" ? sr.auth.errors.required : issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("ingredients")
        .insert({
          venue_id: parsed.data.venue_id,
          name: parsed.data.name,
          unit: parsed.data.unit,
          price: parsed.data.price,
          waste_percent: parsed.data.waste_percent,
          notes: parsed.data.notes ?? null,
        })
        .select("id, venue_id, name, unit, price, waste_percent, notes")
        .single();

      if (error) {
        if (handleError(error)) return;
        const message = error.message?.toLowerCase() ?? "";
        if (
          error.code === "23505" ||
          message.includes("unique") ||
          message.includes("duplicate")
        ) {
          setFormError(sr.create.duplicateName);
          return;
        }
        setFormError(sr.create.genericError);
        return;
      }

      if (!data) {
        setFormError(sr.create.genericError);
        return;
      }

      const created: CachedIngredient = {
        id: data.id,
        venue_id: data.venue_id,
        name: data.name,
        unit: data.unit,
        price: Number(data.price) || 0,
        waste_percent: Number(data.waste_percent) || 0,
        notes: data.notes,
      };

      const merged = [
        ...existing.filter((row) => row.id !== created.id),
        created,
      ].sort((a, b) => a.name.localeCompare(b.name, "sr"));
      void saveIngredients(merged);

      onCreated?.(created);
      reset();
      onClose();
      router.refresh();
    } catch (error) {
      if (handleError(error)) return;
      setFormError(sr.create.genericError);
    } finally {
      setLoading(false);
    }
  }

  const wasteNum = parseDecimal(waste) ?? 0;

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={sr.create.ingredient.title}
      size="lg"
      description={
        <span>
          {sr.create.ingredient.limitFreeRemaining} {remainingFree}{" "}
          {sr.create.ingredient.limitFreeOf} {FREE_MAX_INGREDIENTS}
          {" · "}
          {sr.create.ingredient.limitPremium}
        </span>
      }
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <PrimaryButton
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
            className="sm:min-w-[120px]"
          >
            {sr.common.cancel}
          </PrimaryButton>
          <PrimaryButton
            type="submit"
            form="create-ingredient-form"
            loading={loading}
            disabled={!isValid}
            className="sm:min-w-[180px]"
          >
            {sr.create.ingredient.submit}
          </PrimaryButton>
        </div>
      }
    >
      <form
        id="create-ingredient-form"
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left column */}
          <div className="flex flex-col gap-3">
            <AuthField
              label={`${sr.create.ingredient.name} *`}
              name="ingredientName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              error={nameError}
              autoComplete="off"
              required
            />

            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-medium text-text">
                {sr.create.ingredient.unit} *
              </p>
              <SegmentedControl<IngredientUnitInput>
                ariaLabel={sr.create.ingredient.unit}
                value={unit}
                onChange={setUnit}
                size="sm"
                options={UNITS.map((value) => ({
                  value,
                  label: UNIT_LABELS[value],
                }))}
              />
            </div>

            <AuthField
              label={`${sr.create.ingredient.notes} (${sr.create.ingredient.notesOptional})`}
              name="ingredientNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={fieldErrors.notes}
            />
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-3">
            <AuthField
              label={`${sr.create.ingredient.unitAmount} *`}
              name="ingredientUnitAmount"
              inputMode="decimal"
              value={unitAmount}
              onChange={(e) => setUnitAmount(e.target.value)}
              error={fieldErrors.unitAmount}
              placeholder="1"
              required
            />

            <div className="flex flex-col gap-1">
              <label
                htmlFor="ingredientPrice"
                className="text-sm font-medium text-text"
              >
                {sr.create.ingredient.price} *
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  {sr.create.ingredient.pricePrefix}
                </span>
                <input
                  id="ingredientPrice"
                  name="ingredientPrice"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="1.990"
                  required
                  aria-invalid={fieldErrors.price ? true : undefined}
                  className={cn(
                    "min-h-11 w-full rounded-[var(--radius-md)] border bg-surface-2 py-2 pl-12 pr-3",
                    "text-base text-text outline-none placeholder:text-muted",
                    "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    fieldErrors.price ? "border-danger" : "border-border"
                  )}
                />
              </div>
              {fieldErrors.price ? (
                <p role="alert" className="text-sm text-danger">
                  {fieldErrors.price}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="ingredientWaste"
                  className="text-sm font-medium text-text"
                >
                  {sr.create.ingredient.waste}
                </label>
                <span className="text-sm font-semibold tabular-nums text-text">
                  {wasteNum}%
                </span>
              </div>
              <input
                id="ingredientWaste"
                name="ingredientWaste"
                type="range"
                min={0}
                max={50}
                step={1}
                value={Math.min(50, Math.max(0, wasteNum))}
                onChange={(e) => setWaste(e.target.value)}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-[var(--accent)]"
              />
              <AuthField
                label=""
                name="ingredientWasteInput"
                inputMode="decimal"
                value={waste}
                onChange={(e) => setWaste(e.target.value)}
                error={fieldErrors.waste}
                placeholder="0"
                aria-label={sr.create.ingredient.waste}
                className="min-h-9"
              />
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div
          className={cn(
            "rounded-[var(--radius-lg)] border border-border bg-surface-2 p-4",
            "transition-colors duration-150"
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            {sr.create.ingredient.livePreview}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted">
                {sr.create.ingredient.unitPriceHint}
              </p>
              {unitPricePreview !== null ? (
                <p className="mt-1 flex flex-wrap items-baseline gap-1">
                  <BigNumber
                    value={roundDisplay(unitPricePreview)}
                    fractionDigits={2}
                    size="sm"
                    label={sr.create.ingredient.unitPriceHint}
                  />
                  <span className="text-sm text-muted">
                    {sr.recipes.foodCost.currency}/{UNIT_LABELS[unit]}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-lg font-semibold text-muted">—</p>
              )}
              <p className="mt-0.5 text-xs text-muted">
                {sr.create.ingredient.packageHint}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted">
                {sr.ingredients.effectivePrice}
              </p>
              {effectivePrice !== null ? (
                <p className="mt-1 flex flex-wrap items-baseline gap-1">
                  <BigNumber
                    value={roundDisplay(effectivePrice)}
                    fractionDigits={2}
                    size="sm"
                    className="text-accent"
                    label={sr.ingredients.effectivePrice}
                  />
                  <span className="text-sm text-muted">
                    {sr.recipes.foodCost.currency}/{UNIT_LABELS[unit]}
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-lg font-semibold text-muted">—</p>
              )}
              <p className="mt-0.5 text-xs text-muted">
                {sr.create.ingredient.withWaste} ·{" "}
                {sr.ingredients.effectivePriceHint}
              </p>
            </div>
          </div>
        </div>

        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
      </form>
    </BottomSheet>
  );
}
