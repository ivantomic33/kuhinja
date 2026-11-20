import { z } from "zod";

export const planSchema = z.enum(["free", "pro"]);

export const ingredientUnitSchema = z.enum([
  "g",
  "kg",
  "ml",
  "l",
  "kom",
  "pak",
]);

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
});

export const venueInsertSchema = z.object({
  name: z.string().trim().min(1).max(120),
  owner_id: z.string().uuid(),
});

export const venueUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const ingredientInsertSchema = z.object({
  venue_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  unit: ingredientUnitSchema,
  price: z.number().finite().nonnegative().default(0),
  waste_percent: z.number().finite().min(0).lt(100).default(0),
  notes: z.string().trim().max(500).nullable().optional(),
});

export const ingredientUpdateSchema = ingredientInsertSchema
  .omit({ venue_id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const ingredientPriceHistoryInsertSchema = z.object({
  ingredient_id: z.string().uuid(),
  price: z.number().finite().nonnegative(),
  recorded_at: z.string().datetime().optional(),
});

export const recipeInsertSchema = z.object({
  venue_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  portions: z.number().finite().positive().default(1),
  selling_price: z.number().finite().nonnegative().default(0),
});

export const recipeUpdateSchema = recipeInsertSchema
  .omit({ venue_id: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const recipeItemInsertSchema = z.object({
  recipe_id: z.string().uuid(),
  ingredient_id: z.string().uuid(),
  quantity: z.number().finite().positive(),
});

export const recipeItemUpdateSchema = z
  .object({
    ingredient_id: z.string().uuid().optional(),
    quantity: z.number().finite().positive().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const checklistItemSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().trim().min(1).max(200),
  minutes: z.number().finite().positive().max(24 * 60).optional(),
  group: z.string().trim().min(1).max(80).optional(),
});

export const checklistItemsSchema = z.array(checklistItemSchema);

export const checklistTemplateInsertSchema = z.object({
  venue_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  items: checklistItemsSchema.default([]),
});

export const checklistTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    items: checklistItemsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const checklistRunStatusSchema = z.enum(["active", "completed"]);

export const checklistRunInsertSchema = z.object({
  venue_id: z.string().uuid(),
  template_id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: checklistRunStatusSchema.default("active"),
  checked_item_ids: z.array(z.string().min(1).max(64)).default([]),
  started_at: z.string().datetime({ offset: true }).optional(),
  completed_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export const checklistRunUpdateSchema = z
  .object({
    status: checklistRunStatusSchema.optional(),
    checked_item_ids: z.array(z.string().min(1).max(64)).optional(),
    completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type PlanInput = z.infer<typeof planSchema>;
export type IngredientUnitInput = z.infer<typeof ingredientUnitSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type VenueInsertInput = z.infer<typeof venueInsertSchema>;
export type VenueUpdateInput = z.infer<typeof venueUpdateSchema>;
export type IngredientInsertInput = z.infer<typeof ingredientInsertSchema>;
export type IngredientUpdateInput = z.infer<typeof ingredientUpdateSchema>;
export type IngredientPriceHistoryInsertInput = z.infer<
  typeof ingredientPriceHistoryInsertSchema
>;
export type RecipeInsertInput = z.infer<typeof recipeInsertSchema>;
export type RecipeUpdateInput = z.infer<typeof recipeUpdateSchema>;
export type RecipeItemInsertInput = z.infer<typeof recipeItemInsertSchema>;
export type RecipeItemUpdateInput = z.infer<typeof recipeItemUpdateSchema>;
export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type ChecklistTemplateInsertInput = z.infer<
  typeof checklistTemplateInsertSchema
>;
export type ChecklistTemplateUpdateInput = z.infer<
  typeof checklistTemplateUpdateSchema
>;
export type ChecklistRunStatusInput = z.infer<typeof checklistRunStatusSchema>;
export type ChecklistRunInsertInput = z.infer<typeof checklistRunInsertSchema>;
export type ChecklistRunUpdateInput = z.infer<typeof checklistRunUpdateSchema>;
