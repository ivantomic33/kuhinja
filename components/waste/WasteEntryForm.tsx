"use client";

import { useMemo, useState } from "react";
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
  const toast = useToast();
  const online = useOnline(true);
  const [step, setStep] = useState<1 | 2>(1);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState<Subject | null>(null);
  const [qtyText, setQtyText] = useState("");
  const [reason, setReason] = useState<WasteReason>("istek");
  const [adjustStock, setAdjustStock] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
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
    setOfflinePool(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickIngredient(row: CachedIngredient) {
    if (!(row.price >= 0) || !Number.isFinite(row.price)) {
      toast.show({
        variant: "error",
        title: "Cena nije u kešu",
        description: "Unos offline nije moguć bez cene sastojka.",
      });
      return;
    }
    setSubject({ kind: "ingredient", row });
    setStep(2);
  }

  function pickRecipe(id: string, name: string) {
    const unitCost = recipeCosts[id];
    if (unitCost == null || !Number.isFinite(unitCost) || unitCost < 0) {
      toast.show({
        variant: "error",
        title: "Trošak porcije nije dostupan",
        description: online
          ? "Recept nema izračunat trošak porcije."
          : "Offline unos recepta zahteva keširan trošak porcije.",
      });
      return;
    }
    setSubject({ kind: "recipe", id, name, unitCost });
    setStep(2);
  }

  async function submit() {
    if (!subject) return;
    const quantity = parseDecimal(qtyText);
    if (quantity == null || quantity <= 0) {
      toast.show({
        variant: "error",
        title: "Unesite količinu",
      });
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
          toast.show({
            variant: "error",
            title: "Cena nije dostupna offline",
          });
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
        toast.show({
          variant: "success",
          title: "Sačuvano offline",
          description: "Unos će se poslati kad se mreža vrati.",
        });
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
          toast.show({
            variant: "error",
            title: result.error.message,
          });
          return;
        }
        toast.show({ variant: "success", title: "Otpad je zabeležen" });
      }
      onSaved?.();
      handleClose();
    } catch (error) {
      toast.show({
        variant: "error",
        title: error instanceof Error ? error.message : "Greška pri čuvanju",
      });
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
          <input
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
                onClick={() => setQtyText(String(chip.value).replace(".", ","))}
              >
                {chip.label}
              </button>
            ))}
          </div>
          <input
            value={qtyText}
            onChange={(event) => setQtyText(event.target.value)}
            inputMode="decimal"
            className="input w-full text-center text-2xl tabular-nums"
            placeholder="0"
            aria-label="Količina"
          />
          <NumericKeypad
            onKey={(key) =>
              setQtyText((prev) => (prev + key).replace(/^0+(?=\d)/, ""))
            }
            onBackspace={() => setQtyText((prev) => prev.slice(0, -1))}
            onClear={() => setQtyText("")}
            decimalChar=","
          />
          <div className="flex flex-wrap gap-2">
            {WASTE_REASONS.map((value) => (
              <button
                key={value}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-ui-xs font-semibold",
                  reason === value
                    ? "bg-accent text-white"
                    : "bg-surface-2 text-text",
                )}
                onClick={() => setReason(value)}
              >
                {REASON_LABEL[value]}
              </button>
            ))}
          </div>
          {canAdjustStock && subject?.kind === "ingredient" && online ? (
            <label className="flex items-center gap-2 text-sm text-text-2">
              <input
                type="checkbox"
                checked={adjustStock}
                onChange={(event) => setAdjustStock(event.target.checked)}
              />
              Skini i sa zaliha
            </label>
          ) : null}
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value.slice(0, 500))}
            rows={2}
            className="input w-full"
            placeholder="Napomena (opciono)"
          />
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
