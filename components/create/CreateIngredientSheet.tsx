"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/AuthField";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { BigNumber } from "@/components/ui/BigNumber";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FieldHelp } from "@/components/ui/FieldHelp";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { readVersionConflictMessage } from "@/lib/auth/version-conflict";
import { parseDecimal } from "@/lib/domain/parse";
import { updateVersioned } from "@/lib/domain/versioned-update-client";
import { getPrimaryVenueId } from "@/lib/domain/venue";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import {
  saveIngredients,
  type CachedIngredient,
} from "@/lib/offline/cache";
import { createIngredientAction } from "@/lib/plan/actions";
import {
  canCreateIngredient,
  FREE_MAX_INGREDIENTS,
} from "@/lib/plan/entitlements";
import { getFreeLimitCode } from "@/lib/plan/free-limit";
import {
  ingredientInsertSchema,
  ingredientPurchaseSchema,
  ingredientUnitSchema,
  type IngredientUnitInput,
} from "@/lib/schemas/domain";
import { effectivePrice, roundDisplay } from "@/lib/calc/foodcost";
import { unitPrice } from "@/lib/calc/prices";
import { cn } from "@/lib/utils/cn";

const UNITS = ingredientUnitSchema.options;
const MAX_WASTE = 99.99;
const copy = sr.create.ingredient;

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
  ingredient?: CachedIngredient | null;
  onCreated?: (ingredient: CachedIngredient) => void;
};

export function CreateIngredientSheet({
  open,
  onClose,
  venueId: venueIdProp,
  currentCount,
  existing = [],
  ingredient,
  onCreated,
}: CreateIngredientSheetProps) {
  const router = useRouter();
  const online = useOnline(true);
  const { plan } = usePlan();
  const { showFreeLimit, handleError } = usePlanUi();
  const { toast } = useToast();

  const [name, setName] = useState(ingredient?.name ?? "");
  const [unit, setUnit] = useState<IngredientUnitInput>(ingredient?.unit ?? "kg");
  const [unitAmount, setUnitAmount] = useState("1");
  const [price, setPrice] = useState(ingredient ? String(ingredient.price) : "");
  const [waste, setWaste] = useState(String(ingredient?.waste_percent ?? 0));
  const [notes, setNotes] = useState(ingredient?.notes ?? "");
  const [duplicateName, setDuplicateName] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();
  const [conflict, setConflict] = useState(false);
  const formId = useId();
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const remainingFree = Math.max(0, FREE_MAX_INGREDIENTS - currentCount);

  const amountValue = parseDecimal(unitAmount);
  const productPrice = parseDecimal(price);
  const wasteValue = parseDecimal(waste);
  const purchase = ingredientPurchaseSchema.safeParse({
    unit,
    unitAmount: amountValue,
    price: productPrice,
    waste: wasteValue,
  });
  const purchaseErrors = purchase.success ? {} : purchase.error.flatten().fieldErrors;
  const unitPricePreview = amountValue === null || productPrice === null ? null : unitPrice(productPrice, amountValue);
  const errors = {
    ingredientName: !name.trim() ? sr.auth.errors.required
      : !ingredientInsertSchema.shape.name.safeParse(name).success ? copy.nameTooLong
      : duplicateName ? sr.create.duplicateName : undefined,
    ingredientUnitAmount: purchaseErrors.unitAmount ? copy.unitAmountError : undefined,
    ingredientPrice: purchaseErrors.price || (!purchaseErrors.unitAmount && unitPricePreview === null)
      ? copy.priceError : undefined,
    ingredientWasteInput: purchaseErrors.waste || wasteValue === null || wasteValue > MAX_WASTE
      || Number(wasteValue.toFixed(2)) !== wasteValue ? copy.wasteError : undefined,
    ingredientNotes: ingredientInsertSchema.shape.notes.safeParse(notes).success ? undefined : copy.notesTooLong,
  };
  const firstInvalid = Object.keys(errors).find(key => errors[key as keyof typeof errors]);
  const wasteNum = Math.min(MAX_WASTE, Math.max(0, Number((wasteValue ?? 0).toFixed(2))));
  const wasteText = `${wasteNum.toLocaleString("sr-Latn", { maximumFractionDigits: 2 })}%`;
  const adjustedPrice = unitPricePreview !== null && wasteValue !== null && !errors.ingredientWasteInput
    ? effectivePrice(unitPricePreview, wasteValue) : Number.NaN;
  const effectivePricePreview = Number.isFinite(adjustedPrice) ? adjustedPrice : null;

  function visibleError(field: keyof typeof errors) {
    return touched[field] ? errors[field] : undefined;
  }

  function touch(field: keyof typeof errors) {
    setTouched(previous => ({ ...previous, [field]: true }));
  }

  function focusField(form: HTMLFormElement, name: string) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLElement) requestAnimationFrame(() => field.focus());
  }

  function reset() {
    setName("");
    setUnit("kg");
    setUnitAmount("1");
    setPrice("");
    setWaste("0");
    setNotes("");
    setDuplicateName(false);
    setFormError(undefined);
    setConflict(false);
    setTouched({});
  }

  function handleClose() {
    if (loading) return;
    reset();
    onClose();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || conflict) return;
    const form = event.currentTarget;
    setFormError(undefined);

    if (firstInvalid || !purchase.success || unitPricePreview === null) {
      setTouched(Object.fromEntries(Object.keys(errors).map(field => [field, true])));
      if (firstInvalid) focusField(form, firstInvalid);
      return;
    }

    if (!online) {
      setFormError(sr.create.offline);
      return;
    }

    if (!ingredient && !canCreateIngredient(plan, currentCount)) {
      showFreeLimit("FREE_LIMIT_INGREDIENTS");
      return;
    }

    setLoading(true);
    try {
      const venueId = ingredient?.venue_id ?? venueIdProp ?? await getPrimaryVenueId();
      if (!venueId) {
        setFormError(sr.create.noVenue);
        return;
      }

      const parsed = ingredientInsertSchema.safeParse({
        venue_id: venueId,
        name,
        unit: purchase.data.unit,
        price: unitPricePreview,
        waste_percent: purchase.data.waste,
        notes: notes.trim() || null,
      });
      if (!parsed.success) {
        setFormError(sr.create.genericError);
        return;
      }

      if (ingredient && ingredient.version === undefined) {
        setConflict(true);
        setFormError(sr.pwa.versionConflict);
        return;
      }
      const { venue_id, ...patch } = parsed.data;
      const result = ingredient?.version === undefined
        ? await createIngredientAction({ venue_id, ...patch })
        : await updateVersioned("ingredients", { id: ingredient.id, version: ingredient.version, patch });

      if ("error" in result) {
        const conflictMessage = readVersionConflictMessage(result.error);
        if (conflictMessage) {
          setConflict(true);
          setFormError(conflictMessage);
          return;
        }
        const limitCode = getFreeLimitCode(result.error);
        if (limitCode || result.error.code === "LIMIT_REACHED") {
          showFreeLimit(limitCode ?? "FREE_LIMIT_INGREDIENTS");
          return;
        }
        if (handleError(result.error)) return;
        if (
          result.error.code === "VALIDATION_ERROR" &&
          result.error.message === "duplicate"
        ) {
          setDuplicateName(true);
          touch("ingredientName");
          focusField(form, "ingredientName");
          return;
        }
        setFormError(sr.create.genericError);
        return;
      }

      const data = result.data;
      const created: CachedIngredient = {
        id: data.id,
        venue_id: data.venue_id,
        name: data.name,
        unit: data.unit as CachedIngredient["unit"],
        price: Number(data.price) || 0,
        waste_percent: Number(data.waste_percent) || 0,
        notes: data.notes,
        version: data.version,
      };

      const merged = [
        ...existing.filter((row) => row.id !== created.id),
        created,
      ].sort((a, b) => a.name.localeCompare(b.name, "sr"));
      void saveIngredients(merged);

      onCreated?.(created);
      toast(ingredient ? copy.editSuccess : copy.success, "success");
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

  const priceError = visibleError("ingredientPrice");
  const wasteError = visibleError("ingredientWasteInput");
  const preview = { unit, unitPricePreview, effectivePricePreview };

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={ingredient ? copy.editTitle : copy.title}
      size="lg"
      description={ingredient ? undefined :
        <span>
          {copy.limitFreeRemaining} {remainingFree} {copy.limitFreeOf} {FREE_MAX_INGREDIENTS}
          {" · "}
          {copy.limitPremium}
        </span>
      }
      footer={
        <div className="grid gap-3">
          <IngredientPricePreview {...preview} compact />
          {formError ? <p id={`${formId}-error`} role="alert" className="text-sm text-danger">{formError}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">
            {conflict ? (
              <PrimaryButton type="button" variant="secondary" onClick={() => window.location.reload()}>
                {sr.pwa.versionConflictRefresh}
              </PrimaryButton>
            ) : null}
            <PrimaryButton type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              {sr.common.cancel}
            </PrimaryButton>
            <PrimaryButton
              type="submit"
              form={formId}
              loading={loading}
              disabled={conflict}
              aria-describedby={conflict && formError ? `${formId}-error` : undefined}
            >
              {ingredient ? sr.common.save : copy.submit}
            </PrimaryButton>
          </div>
        </div>
      }
    >
      <form
        id={formId}
        className="grid items-start gap-4 md:grid-cols-2"
        onSubmit={onSubmit}
        noValidate
      >
        <div className="grid min-w-0 gap-2 md:gap-3">
          <AuthField
            label={`${copy.name} *`}
            name="ingredientName"
            value={name}
            onChange={event => {
              setName(event.currentTarget.value);
              setDuplicateName(false);
            }}
            onBlur={() => touch("ingredientName")}
            error={visibleError("ingredientName")}
            autoComplete="off"
            className="max-md:min-h-12"
            required
          />

          <div className="grid min-w-0 gap-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text">{copy.unit} *</p>
              <FieldHelp label={copy.unit}>{sr.onboarding.fieldHelp.unit}</FieldHelp>
            </div>
            <SegmentedControl<IngredientUnitInput>
              ariaLabel={copy.unit}
              value={unit}
              onChange={setUnit}
              size="sm"
              className="grid! grid-cols-6 [&>button]:min-h-11! [&>button]:px-1!"
              options={UNITS.map(value => ({ value, label: UNIT_LABELS[value] }))}
            />
          </div>

          <AuthField
            label={`${copy.unitAmount} *`}
            name="ingredientUnitAmount"
            inputMode="decimal"
            value={unitAmount}
            onChange={event => setUnitAmount(event.currentTarget.value)}
            onBlur={() => touch("ingredientUnitAmount")}
            error={visibleError("ingredientUnitAmount")}
            placeholder="1"
            className="max-md:min-h-12"
            required
          />

          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <label htmlFor={`${formId}-price`} className="text-sm font-medium text-text">
                {copy.price} *
                <span className="sr-only"> ({copy.pricePrefix})</span>
              </label>
              <FieldHelp label={copy.price}>{sr.onboarding.fieldHelp.price}</FieldHelp>
            </div>
            <div className="relative">
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                {copy.pricePrefix}
              </span>
              <input
                id={`${formId}-price`}
                name="ingredientPrice"
                inputMode="decimal"
                value={price}
                onChange={event => setPrice(event.currentTarget.value)}
                onBlur={() => touch("ingredientPrice")}
                placeholder="1990,00"
                required
                aria-invalid={priceError ? true : undefined}
                aria-describedby={priceError ? `${formId}-price-error` : undefined}
                className={cn(
                  "focus-ring h-12 w-full rounded-[var(--radius-input)] border bg-surface-2 py-2 pl-11 pr-3 md:h-13",
                  "text-base tabular-nums text-text outline-none placeholder:text-muted",
                  priceError ? "border-danger" : "border-border"
                )}
              />
            </div>
            {priceError ? <p id={`${formId}-price-error`} role="alert" className="text-sm text-danger">{priceError}</p> : null}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_5rem] items-end gap-x-3 gap-y-1">
            <div className="grid min-w-0 gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <label htmlFor={`${formId}-waste`} className="text-sm font-medium text-text">{copy.waste}</label>
                  <FieldHelp label={copy.waste}>{sr.onboarding.fieldHelp.waste}</FieldHelp>
                </span>
                <span aria-hidden="true" className="text-sm font-semibold tabular-nums text-text">
                  {errors.ingredientWasteInput ? "—" : wasteText}
                </span>
              </div>
              <input
                id={`${formId}-waste`}
                name="ingredientWaste"
                type="range"
                min={0}
                max={MAX_WASTE}
                step="any"
                value={wasteNum}
                aria-valuetext={wasteText}
                onChange={event => setWaste(String(Number(event.currentTarget.valueAsNumber.toFixed(2))))}
                className="focus-ring h-11 w-full cursor-pointer rounded-md accent-accent"
              />
            </div>
            <AuthField
              label={copy.wasteInput}
              name="ingredientWasteInput"
              inputMode="decimal"
              value={waste}
              onChange={event => setWaste(event.currentTarget.value)}
              onBlur={() => touch("ingredientWasteInput")}
              aria-label={`${copy.waste} · ${copy.wasteInput}`}
              aria-invalid={wasteError ? true : undefined}
              aria-describedby={wasteError ? `${formId}-waste-error` : undefined}
              className="h-11 min-h-11 tabular-nums"
            />
            {wasteError ? <p id={`${formId}-waste-error`} role="alert" className="col-span-full text-sm text-danger">{wasteError}</p> : null}
          </div>

          <AuthField
            label={`${copy.notes} (${copy.notesOptional})`}
            name="ingredientNotes"
            value={notes}
            onChange={event => setNotes(event.currentTarget.value)}
            onBlur={() => touch("ingredientNotes")}
            error={visibleError("ingredientNotes")}
            className="max-md:min-h-12"
          />
        </div>
        <IngredientPricePreview {...preview} />
      </form>
    </BottomSheet>
  );
}

function IngredientPricePreview({
  unit,
  unitPricePreview,
  effectivePricePreview,
  compact = false,
}: {
  unit: IngredientUnitInput;
  unitPricePreview: number | null;
  effectivePricePreview: number | null;
  compact?: boolean;
}) {
  const suffix = ` ${copy.pricePrefix}/${UNIT_LABELS[unit]}`;
  const prices = [
    { label: copy.unitPriceHint, value: unitPricePreview },
    { label: sr.ingredients.effectivePrice, value: effectivePricePreview, adjusted: true },
  ];

  return (
    <section
      aria-label={copy.livePreview}
      className={cn(
        "min-w-0 rounded-lg border border-border bg-surface-2",
        compact ? "p-2 md:hidden" : "hidden p-4 md:block"
      )}
    >
      <p className="text-sm font-semibold text-text">{copy.livePreview}</p>
      <dl className={cn("grid", compact ? "mt-1 grid-cols-2 gap-2" : "mt-3 gap-4")}>
        {prices.map(({ label, value, adjusted }) => (
          <div key={label} className="min-w-0">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="mt-1 min-w-0">
              {value === null ? (
                <span className="text-ui-lg font-semibold text-muted">—</span>
              ) : (
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
                  <BigNumber
                    value={roundDisplay(value)}
                    fractionDigits={2}
                    size="sm"
                    durationMs={0}
                    label={label}
                    className={cn(compact && "text-ui-lg", adjusted && "text-accent")}
                  />
                  <span className="text-ui-xs text-muted">{suffix.trim()}</span>
                </span>
              )}
              {adjusted && !compact ? (
                <p className="mt-1 text-xs text-muted">{sr.ingredients.effectivePriceHint}</p>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
