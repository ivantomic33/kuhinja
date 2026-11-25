import { z } from "zod";

/** Positive money amount with at most two decimal places. */
const moneyTwoDecimals = z
  .number()
  .finite()
  .positive()
  .max(9_999_999_999.99)
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Price must have at most two decimal places",
  });

/** Input for public.restock_ingredient RPC. */
export const restockIngredientPriceSchema = z
  .object({
    ingredientId: z.string().uuid(),
    newPrice: moneyTwoDecimals,
    note: z.string().trim().max(500).nullable().optional().default(null),
  })
  .strict();

export type RestockIngredientPriceInput = z.infer<
  typeof restockIngredientPriceSchema
>;
