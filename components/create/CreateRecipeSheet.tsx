"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AuthField } from "@/components/auth/AuthField";
import { usePlanUi } from "@/components/plan/PlanProvider";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { parseDecimal } from "@/lib/domain/parse";
import { getPrimaryVenueId } from "@/lib/domain/venue";
import { useOnline } from "@/lib/hooks/useOnline";
import { usePlan } from "@/lib/hooks/usePlan";
import { sr } from "@/lib/i18n/sr";
import {
  saveRecentRecipes,
  type CachedRecipe,
} from "@/lib/offline/cache";
import { canCreateRecipe } from "@/lib/plan/entitlements";
import { recipeInsertSchema } from "@/lib/schemas/domain";
import { createClient } from "@/lib/supabase/client";


export type CreatedRecipeSummary = {
  id: string;
  name: string;
  venue_id: string;
  portions: number;
  selling_price: number;
  description?: string | null;
};

export type CreateRecipeSheetProps = {
  open: boolean;
  onClose: () => void;
  venueId?: string | null;
  currentCount: number;
  onCreated?: (recipe: CreatedRecipeSummary) => void;
};

export function CreateRecipeSheet({
  open,
  onClose,
  venueId: venueIdProp,
  currentCount,
  onCreated,
}: CreateRecipeSheetProps) {
  const router = useRouter();
  const online = useOnline(true);
  const { plan } = usePlan();
  const { showFreeLimit, handleError } = usePlanUi();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [portions, setPortions] = useState("1");
  const [sellingPrice, setSellingPrice] = useState("0");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function reset() {
    setName("");
    setDescription("");
    setPortions("1");
    setSellingPrice("0");
    setFieldErrors({});
    setFormError(undefined);
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

    if (!online) {
      setFormError(sr.create.offline);
      return;
    }

    if (!canCreateRecipe(plan, currentCount)) {
      showFreeLimit("FREE_LIMIT_RECIPES");
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

    let venueId = venueIdProp ?? null;
    if (!venueId) {
      venueId = await getPrimaryVenueId();
    }
    if (!venueId) {
      setFormError(sr.create.noVenue);
      return;
    }

    const parsed = recipeInsertSchema.safeParse({
      venue_id: venueId,
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
      const supabase = createClient();
      const { data, error } = await supabase
        .from("recipes")
        .insert({
          venue_id: parsed.data.venue_id,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          portions: parsed.data.portions,
          selling_price: parsed.data.selling_price,
        })
        .select("id, venue_id, name, description, portions, selling_price")
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

      const created: CreatedRecipeSummary = {
        id: data.id,
        venue_id: data.venue_id,
        name: data.name,
        description: data.description,
        portions: Number(data.portions) || 1,
        selling_price: Number(data.selling_price) || 0,
      };

      const cached: Omit<CachedRecipe, "cachedAt"> = {
        ...created,
      };
      void saveRecentRecipes([cached]);

      onCreated?.(created);
      reset();
      onClose();
      router.push(`/recipes/${created.id}`);
      router.refresh();
    } catch (error) {
      if (handleError(error)) return;
      setFormError(sr.create.genericError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title={sr.create.recipe.title}
    >
      <form className="flex flex-col gap-2 pb-1" onSubmit={onSubmit} noValidate>
        <AuthField
          label={sr.create.recipe.name}
          name="recipeName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          autoComplete="off"
          required
        />

        <AuthField
          label={`${sr.create.recipe.description} (${sr.create.recipe.descriptionOptional})`}
          name="recipeDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={fieldErrors.description}
        />

        <AuthField
          label={sr.create.recipe.portions}
          name="recipePortions"
          inputMode="decimal"
          value={portions}
          onChange={(e) => setPortions(e.target.value)}
          error={fieldErrors.portions}
          required
        />

        <AuthField
          label={`${sr.create.recipe.sellingPrice} (${sr.recipes.foodCost.currency})`}
          name="recipeSellingPrice"
          inputMode="decimal"
          value={sellingPrice}
          onChange={(e) => setSellingPrice(e.target.value)}
          error={fieldErrors.selling_price}
        />

        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <PrimaryButton type="submit" fullWidth loading={loading}>
          {sr.create.recipe.submit}
        </PrimaryButton>
      </form>
    </BottomSheet>
  );
}
