"use client";

import { useId, useMemo, useState, type SetStateAction } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { NumericKeypad } from "@/components/ui/NumericKeypad";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useToast } from "@/components/ui/Toast";
import { useOnline } from "@/lib/hooks/useOnline";
import {
  getCachedIngredients,
  getRecentRecipes,
  type CachedIngredient,
  type CachedRecipe,
} from "@/lib/offline/cache";
import { enqueueWasteEntry } from "@/lib/offline/waste-sync";
import { addWasteEntry } from "@/lib/waste/actions";
import { WASTE_REASONS, type WasteReason } from "@/lib/waste/schemas";
import { parseDecimal } from "@/lib/domain/parse";
import type { IngredientUnit } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils/cn";

export type WasteEntryFormProps = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  canAdjustStock: boolean;
  ingredients: CachedIngredient[];
  recipes: Array<Pick<CachedRecipe, "id" | "name" | "venue_id" | "portions">>;
  recipeCosts: Record<string, number>;
  onSaved?: () => void;
};

const QUICK_QTY: Array<{ label: string; value: number; unit?: IngredientUnit }> = [
  { label: "100 g", value: 100, unit: "g" },
  { label: "250 g", value: 250, unit: "g" },
  { label: "500 g", value: 500, unit: "g" },
  { label: "1 kom", value: 1, unit: "kom" },
];

const REASON_LABEL: Record<WasteReason, string> = {
  istek: "Istek",
  pokvareno: "Pokvareno",
  ostatak: "Ostatak",
  greška: "Greška",
  ostalo: "Ostalo",
};

type Subject =
  | { kind: "ingredient"; row: CachedIngredient }
  | { kind: "recipe"; id: string; name: string; unitCost: number };

export function WasteEntryForm({
  open,
  onClose,
  workspaceId,
  userId,
  canAdjustStock,
  ingredients,
  recipes,
  recipeCosts,
  onSaved,
}: WasteEntryFormProps) {
  const { toast } = useToast();
  const id = useId();
  const online = useOnline(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [qtyText, setQtyText] = useState("");
  const [reason, setReason] = useState<WasteReason>("istek");
  const [adjustStock, setAdjustStock] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [quantityError, setQuantityError] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offlinePool, setOfflinePool] = useState<{
    ingredients: CachedIngredient[];
    recipes: Array<{ id: string; name: string }>;
  } | null>(null);

  const poolIngredients = offlinePool?.ingredients ?? ingredients;
  const poolRecipes = offlinePool?.recipes ?? recipes;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ings = poolIngredients.filter((row) =>
      !q ? true : row.name.toLowerCase().includes(q),
    );
    const recs = poolRecipes.filter((row) =>
      !q ? true : row.name.toLowerCase().includes(q),
    );
    return { ings: ings.slice(0, 30), recs: recs.slice(0, 20) };
  }, [poolIngredients, poolRecipes, query]);

  async function ensureOfflinePool() {
    if (online) return;
    const [ings, recs] = await Promise.all([
      getCachedIngredients(),
      getRecentRecipes(),
    ]);
    setOfflinePool({
      ingredients: ings,
      recipes: recs.map((r) => ({ id: r.id, name: r.name })),
    });
  }

  function reset() {
    setStep(1);
    setQuery("");
    setSubject(null);
    setQtyText("");
    setReason("istek");
    setAdjustStock(false);
    setNote("");
    setQuantityError(false);
    setSaveError(null);
    setOfflinePool(null);
  }

  function updateQuantity(next: SetStateAction<string>) {
    setQtyText(next);
    setQuantityError(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickIngredient(row: CachedIngredient) {
    if (!(row.price >= 0) || !Number.isFinite(row.price)) {
      toast("Cena nije u kešu. Unos offline nije moguć bez cene sastojka.", "danger");
      return;
    }
    setSubject({ kind: "ingredient", row });
    setStep(2);
  }

  function pickRecipe(id: string, name: string) {
    const unitCost = recipeCosts[id];
    if (unitCost == null || !Number.isFinite(unitCost) || unitCost < 0) {
      toast(
        online
          ? "Trošak porcije nije dostupan. Recept nema izračunat trošak porcije."
          : "Trošak porcije nije dostupan. Offline unos recepta zahteva keširan trošak porcije.",
        "danger",
      );
      return;
    }
    setSubject({ kind: "recipe", id, name, unitCost });
    setStep(2);
  }

  async function submit() {
    if (!subject) return;
    setSaveError(null);
    const quantity = parseDecimal(qtyText);
    if (quantity == null || quantity <= 0) {
      setQuantityError(true);
      return;
    }

    const unit: IngredientUnit =
      subject.kind === "ingredient" ? subject.row.unit : "kom";
    const unitCost =
      subject.kind === "ingredient" ? subject.row.price : subject.unitCost;
    const name =
      subject.kind === "ingredient" ? subject.row.name : subject.name;
    const clientId = crypto.randomUUID();

    setSaving(true);
    try {
      if (!online) {
        if (!Number.isFinite(unitCost)) {
          setSaveError("Cena nije dostupna offline.");
          return;
        }
        await enqueueWasteEntry({
          client_id: clientId,
          workspace_id: workspaceId,
          user_id: userId,
          ingredient_id: subject.kind === "ingredient" ? subject.row.id : null,
          recipe_id: subject.kind === "recipe" ? subject.id : null,
          quantity,
          unit,
          reason,
          note: note.trim() || null,
          adjust_stock: false,
          unit_cost_snapshot: unitCost,
          name_snapshot: name,
        });
        toast("Sačuvano offline. Unos će se poslati kad se mreža vrati.", "success");
      } else {
        const result = await addWasteEntry({
          ingredientId: subject.kind === "ingredient" ? subject.row.id : null,
          recipeId: subject.kind === "recipe" ? subject.id : null,
          quantity,
          unit,
          reason,
          note: note.trim() || null,
          adjustStock: canAdjustStock && adjustStock,
          clientId,
          unitCostSnapshot: null,
        });
        if ("error" in result) {
          setSaveError(result.error.message);
          return;
        }
        toast("Otpad je zabeležen.", "success");
      }
      onSaved?.();
      handleClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Greška pri čuvanju.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={step === 1 ? "Šta je bačeno?" : "Količina i razlog"}
      description={
        subject
          ? subject.kind === "ingredient"
            ? subject.row.name
            : subject.name
          : "Dva dodira: stavka, pa količina."
      }
      footer={
        step === 2 ? (
          <PrimaryButton
            className="w-full"
            disabled={saving}
            onClick={() => void submit()}
          >
            {saving ? "Čuvanje…" : "Sačuvaj otpad"}
          </PrimaryButton>
        ) : undefined
      }
    >
      {step === 1 ? (
        <div className="grid gap-3">
          <label htmlFor={`${id}-search`} className="text-sm text-text-2">Pretraži sastojak ili recept</label>
          <input
            id={`${id}-search`}
            type="search"
            value={query}
            onFocus={() => void ensureOfflinePool()}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pretraži sastojak ili recept"
            className="input w-full"
            autoComplete="off"
          />
          <div className="grid gap-2">
            <p className="text-ui-xs font-semibold text-text-2">Sastojci</p>
            {filtered.ings.length === 0 ? (
              <p className="text-sm text-muted">Nema sastojaka u kešu.</p>
            ) : (
              filtered.ings.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="focus-ring rounded-lg bg-surface-2 px-3 py-2 text-left text-sm font-medium text-text"
                  onClick={() => pickIngredient(row)}
                >
                  {row.name}
                  <span className="ml-2 text-ui-xs text-muted">{row.unit}</span>
                </button>
              ))
            )}
            <p className="mt-2 text-ui-xs font-semibold text-text-2">Recepti</p>
            {filtered.recs.length === 0 ? (
              <p className="text-sm text-muted">Nema recepata.</p>
            ) : (
              filtered.recs.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className="focus-ring rounded-lg bg-surface-2 px-3 py-2 text-left text-sm font-medium text-text"
                  onClick={() => pickRecipe(row.id, row.name)}
                >
                  {row.name}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_QTY.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="rounded-full bg-surface-2 px-3 py-1 text-ui-xs font-semibold text-text"
                onClick={() => updateQuantity(String(chip.value).replace(".", ","))}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <label htmlFor={`${id}-quantity`} className="text-sm text-text-2">Količina</label>
          <input
            id={`${id}-quantity`}
            value={qtyText}
            onChange={(event) => updateQuantity(event.target.value)}
            inputMode="decimal"
            className="input w-full text-center text-2xl tabular-nums"
            placeholder="0"
            aria-invalid={quantityError || undefined}
            aria-describedby={quantityError ? `${id}-quantity-error` : undefined}
          />
          {quantityError ? <p id={`${id}-quantity-error`} role="alert" className="text-sm text-danger-text">Unesite količinu veću od nule.</p> : null}
          <NumericKeypad
            onKey={(key) =>
              updateQuantity((prev) => (prev + key).replace(/^0+(?=\d)/, ""))
            }
            onBackspace={() => updateQuantity((prev) => prev.slice(0, -1))}
            onClear={() => updateQuantity("")}
            decimalChar=","
          />
          <fieldset>
            <legend className="mb-2 text-sm text-text-2">Razlog otpisa</legend>
            <div className="flex flex-wrap gap-2">
            {WASTE_REASONS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={reason === value}
                className={cn(
                  "focus-ring min-h-11 rounded-full px-3 py-2 text-ui-xs font-semibold outline-none",
                  reason === value
                    ? "bg-accent text-text-on-accent"
                    : "bg-surface-2 text-text",
                )}
                onClick={() => setReason(value)}
              >
                {REASON_LABEL[value]}
              </button>
            ))}
            </div>
          </fieldset>
          {canAdjustStock && subject?.kind === "ingredient" && online ? (
            <label htmlFor={`${id}-stock`} className="flex items-center gap-2 text-sm text-text-2">
              <input
                id={`${id}-stock`}
                type="checkbox"
                checked={adjustStock}
                onChange={(event) => setAdjustStock(event.target.checked)}
              />
              Skini i sa zaliha
            </label>
          ) : null}
          <label htmlFor={`${id}-note`} className="text-sm text-text-2">Napomena (opciono)</label>
          <textarea
            id={`${id}-note`}
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 500))}
            rows={2}
            className="input w-full"
            placeholder="Napomena (opciono)"
          />
          {saveError ? <p role="alert" className="text-sm text-danger-text">{saveError}</p> : null}
          <button
            type="button"
            className="text-ui-xs font-semibold text-accent"
            onClick={() => setStep(1)}
          >
            Nazad na izbor
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
