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

const positiveQuantitySchema = z.number().finite().positive();
const priceSchema = z.number().finite().nonnegative();
const wasteSchema = z.number().finite().min(0).lt(100);

export const ingredientPurchaseSchema = z.object({
  unit: ingredientUnitSchema,
  unitAmount: positiveQuantitySchema,
  price: priceSchema,
  waste: wasteSchema,
});

export const recipeItemQuantitySchema = z.object({
  quantity: positiveQuantitySchema,
  quantityUnit: ingredientUnitSchema,
  ingredientUnit: ingredientUnitSchema,
});

export const profileUpdateSchema = z
  .object({
    full_name: z.string().trim().min(1).max(120),
  })
  .strict();

/** Server-side venue create — owner is always the authenticated user. */
export const venueInsertSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

/** @deprecated Prefer venueInsertSchema without client owner_id. */
export const venueInsertWithOwnerSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    owner_id: z.string().uuid(),
  })
  .strict();

export const venueUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
  })
  .strict();

export const ingredientInsertSchema = z
  .object({
    venue_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    unit: ingredientUnitSchema,
    price: priceSchema.default(0),
    waste_percent: wasteSchema.default(0),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const ingredientUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    unit: ingredientUnitSchema.optional(),
    price: priceSchema.optional(),
    waste_percent: wasteSchema.optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const ingredientPriceHistoryInsertSchema = z
  .object({
    ingredient_id: z.string().uuid(),
    price: z.number().finite().nonnegative(),
    recorded_at: z.string().datetime().optional(),
  })
  .strict();

export const recipeInsertSchema = z
  .object({
    venue_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    portions: z.number().finite().positive().default(1),
    selling_price: z.number().finite().nonnegative().default(0),
  })
  .strict();

export const recipeUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    portions: z.number().finite().positive().optional(),
    selling_price: z.number().finite().nonnegative().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const recipeItemInsertSchema = z
  .object({
    recipe_id: z.string().uuid(),
    ingredient_id: z.string().uuid(),
    quantity: positiveQuantitySchema,
  })
  .strict();

export const recipeItemUpdateSchema = z
  .object({
    ingredient_id: z.string().uuid().optional(),
    quantity: positiveQuantitySchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const checklistItemSchema = z
  .object({
    id: z.string().min(1).max(64),
    label: z.string().trim().min(1).max(200),
    minutes: z.number().finite().positive().max(24 * 60).optional(),
    group: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const checklistItemsSchema = z.array(checklistItemSchema);

export const checklistTemplateInsertSchema = z
  .object({
    venue_id: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    items: checklistItemsSchema.default([]),
  })
  .strict();

export const checklistTemplateUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    items: checklistItemsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export const checklistRunStatusSchema = z.enum(["active", "completed"]);

/** Client must not supply user_id — server sets it from getUser(). */
export const checklistRunInsertSchema = z
  .object({
    venue_id: z.string().uuid(),
    template_id: z.string().uuid(),
    status: checklistRunStatusSchema.default("active"),
    checked_item_ids: z.array(z.string().min(1).max(64)).default([]),
    started_at: z.string().datetime({ offset: true }).optional(),
    completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();

export const checklistRunUpdateSchema = z
  .object({
    status: checklistRunStatusSchema.optional(),
    checked_item_ids: z.array(z.string().min(1).max(64)).optional(),
    completed_at: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict()
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
