import { z } from "zod";

/** target_food_cost_pct: 1–100 inclusive, at most two decimal places. */
export const targetFoodCostPctSchema = z
  .number({ invalid_type_error: "target_food_cost_pct must be a number" })
  .finite()
  .gt(0, { message: "target_food_cost_pct must be greater than 0" })
  .max(100, { message: "target_food_cost_pct must be at most 100" })
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "target_food_cost_pct must have at most two decimal places",
  });

export const alertIdSchema = z.string().uuid();

export const markAlertReadSchema = z
  .object({
    alertId: alertIdSchema,
  })
  .strict();

export const updateRecipeFoodCostTargetSchema = z
  .object({
    recipeId: z.string().uuid(),
    targetFoodCostPct: targetFoodCostPctSchema,
  })
  .strict();

export const updateRecipeSellingPriceNetSchema = z
  .object({
    recipeId: z.string().uuid(),
    sellingPriceNet: z
      .number()
      .finite()
      .positive()
      .max(9_999_999_999.99)
      .nullable(),
  })
  .strict();

export type MarkAlertReadInput = z.infer<typeof markAlertReadSchema>;
export type TargetFoodCostPct = z.infer<typeof targetFoodCostPctSchema>;
