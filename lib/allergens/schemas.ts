import { z } from "zod";
import { ALLERGEN_CODES, ALLERGEN_PRESENCE } from "./catalog";

export const allergenCodeSchema = z.enum(ALLERGEN_CODES);
export const allergenPresenceSchema = z.enum(ALLERGEN_PRESENCE);

export const allergenItemSchema = z
  .object({
    code: allergenCodeSchema,
    presence: allergenPresenceSchema,
  })
  .strict();

export const setIngredientAllergensSchema = z
  .object({
    ingredientId: z.string().uuid(),
    items: z.array(allergenItemSchema).max(14),
  })
  .strict();

export const getRecipeAllergenMatrixSchema = z
  .object({
    recipeId: z.string().uuid(),
  })
  .strict();

export const allergenExportQuerySchema = z
  .object({
    recipes: z
      .union([z.string().uuid(), z.array(z.string().uuid()).min(1).max(200)])
      .transform((value) => (Array.isArray(value) ? value : [value]))
      .pipe(z.array(z.string().uuid()).min(1).max(200)),
    format: z.literal("pdf"),
  })
  .strict();

export type SetIngredientAllergensInput = z.infer<
  typeof setIngredientAllergensSchema
>;
export type AllergenExportQuery = z.infer<typeof allergenExportQuerySchema>;
