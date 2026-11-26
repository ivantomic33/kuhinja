import { z } from "zod";

export const exportScopeSchema = z.enum(["ingredients", "recipes"]);
export const exportFormatSchema = z.enum(["csv", "xlsx", "pdf"]);

export const kitchenExportSchema = z
  .object({
    scope: exportScopeSchema,
    format: exportFormatSchema,
    workspaceId: z.string().uuid(),
    recipeId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.scope === "ingredients" && value.format === "pdf") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "PDF kartica je dostupna samo za recepte.",
        path: ["format"],
      });
    }
    if (value.format === "pdf" && !value.recipeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Izaberite recept za PDF karticu.",
        path: ["recipeId"],
      });
    }
    if (value.format !== "pdf" && value.recipeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ID recepta se koristi samo za PDF karticu.",
        path: ["recipeId"],
      });
    }
  });

export type KitchenExportInput = z.infer<typeof kitchenExportSchema>;
export type ExportScope = z.infer<typeof exportScopeSchema>;
export type ExportFormat = z.infer<typeof exportFormatSchema>;
