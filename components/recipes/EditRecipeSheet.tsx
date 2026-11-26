"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/AuthField";
import { usePlanUiOptional } from "@/components/plan/PlanProvider";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { readVersionConflictMessage } from "@/lib/auth/version-conflict";
import { parseDecimal } from "@/lib/domain/parse";
import { updateVersioned } from "@/lib/domain/versioned-update-client";
import { useOnline } from "@/lib/hooks/useOnline";
import { sr } from "@/lib/i18n/sr";
import {
  touchRecentRecipe,
  type CachedRecipe,
  type CachedRecipeItem,
} from "@/lib/offline/cache";
import { recipeUpdateSchema } from "@/lib/schemas/domain";

export type EditedRecipeSummary = {
  id: string;
  name: string;
  venue_id: string;
  portions: number;
  selling_price: number;
  description?: string | null;
  version: number;
};

export type EditRecipeSheetProps = {
  open: boolean;
  onClose: () => void;
  recipe: {
    id: string;
    venue_id: string;
    name: string;
    description?: string | null;
    portions: number;
    selling_price: number;
    version: number;
  };
  /** Keep offline cache items in sync after header update */
  cachedItems?: CachedRecipeItem[];
  onUpdated?: (recipe: EditedRecipeSummary) => void;
};

export function EditRecipeSheet({
  open,
  onClose,
  recipe,
  cachedItems,
  onUpdated,
}: EditRecipeSheetProps) {
  const router = useRouter();
  const formErrorId = useId();
  const online = useOnline(true);
  const { handleError } = usePlanUiOptional();

  const [name, setName] = useState(recipe.name);
  const [description, setDescription] = useState(recipe.description ?? "");
  const [portions, setPortions] = useState(String(recipe.portions));
  const [sellingPrice, setSellingPrice] = useState(
    String(recipe.selling_price)
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [conflict, setConflict] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(recipe.name);
    setDescription(recipe.description ?? "");
    setPortions(String(recipe.portions));
    setSellingPrice(String(recipe.selling_price));
    setFieldErrors({});
    setFormError(undefined);
    setConflict(false);
  }, [open, recipe]);

  function handleClose() {
    if (loading) return;
    onClose();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (conflict || loading) return;
    setFormError(undefined);
    setConflict(false);
    setFieldErrors({});

    if (!online) {
      setFormError(sr.create.offline);
      return;
    }

    const portionsValue = parseDecimal(portions);
    const priceValue = parseDecimal(sellingPrice);

    if (portionsValue === null || portionsValue <= 0) {
      setFieldErrors({ portions: sr.create.invalidNumber });
      return;
    }
    if (priceValue === null || priceValue < 0) {
      setFieldErrors({ selling_price: sr.create.invalidNumber });
      return;
    }

    const parsed = recipeUpdateSchema.safeParse({
      name,
      description: description.trim() ? description.trim() : null,
      portions: portionsValue,
      selling_price: priceValue,
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
      const result = await updateVersioned("recipes", {
        id: recipe.id,
        version: recipe.version,
        patch: parsed.data,
      });

      if ("error" in result) {
        const conflictMessage = readVersionConflictMessage(result.error);
        if (conflictMessage) {
          setConflict(true);
          setFormError(conflictMessage);
          return;
        }
        if (handleError?.(result.error)) return;
        const message = result.error.message?.toLowerCase() ?? "";
        if (
          result.error.code === "VALIDATION_ERROR" &&
          (message.includes("unique") || message.includes("duplicate"))
        ) {
          setFormError(sr.create.duplicateName);
          return;
        }
        setFormError(sr.create.genericError);
        return;
      }

      const data = result.data;
      const updated: EditedRecipeSummary = {
        id: data.id,
        venue_id: data.venue_id,
        name: data.name,
        description: data.description,
        portions: Number(data.portions) || 1,
        selling_price: Number(data.selling_price) || 0,
        version: data.version,
      };

      const cached: Omit<CachedRecipe, "cachedAt"> = {
        ...updated,
        items: cachedItems,
      };
      void touchRecentRecipe(cached);

      onUpdated?.(updated);
      onClose();
      router.refresh();
    } catch (error) {
      if (handleError?.(error)) return;
      setFormError(sr.create.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={sr.create.recipe.editTitle}
    >
      <form className="flex flex-col gap-2 pb-1" onSubmit={onSubmit} noValidate>
        <AuthField
          label={sr.create.recipe.name}
          name="editRecipeName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          autoComplete="off"
          required
        />

        <AuthField
          label={`${sr.create.recipe.description} (${sr.create.recipe.descriptionOptional})`}
          name="editRecipeDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErrors.description}
        />

        <AuthField
          label={sr.create.recipe.portions}
          name="editRecipePortions"
          inputMode="decimal"
          value={portions}
          onChange={(e) => setPortions(e.target.value)}
          error={fieldErrors.portions}
          required
        />

        <AuthField
          label={`${sr.create.recipe.sellingPrice} (${sr.recipes.foodCost.currency})`}
          name="editRecipeSellingPrice"
          inputMode="decimal"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
          error={fieldErrors.selling_price}
        />

        {formError ? (
          <div role="alert" className="grid gap-2 text-sm text-danger">
            <p id={formErrorId}>{formError}</p>
            {conflict ? (
              <PrimaryButton
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => window.location.reload()}
              >
                {sr.pwa.versionConflictRefresh}
              </PrimaryButton>
            ) : null}
          </div>
        ) : null}

        <PrimaryButton type="submit" fullWidth loading={loading} disabled={conflict} aria-describedby={conflict ? formErrorId : undefined}>
          {sr.create.recipe.editSubmit}
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
