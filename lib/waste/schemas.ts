import { z } from "zod";
import { ingredientUnitSchema } from "@/lib/schemas/domain";

export const wasteReasonSchema = z.enum([
  "istek",
  "pokvareno",
  "ostatak",
  "greška",
  "ostalo",
]);

export type WasteReason = z.infer<typeof wasteReasonSchema>;

export const WASTE_REASONS = wasteReasonSchema.options;

/** Positive quantity for new waste rows: max 3 decimals, max 1_000_000. */
export const wasteQuantitySchema = z
  .number({ invalid_type_error: "Količina mora biti broj" })
  .finite()
  .positive({ message: "Količina mora biti pozitivna" })
  .max(1_000_000, { message: "Količina je prevelika" })
  .refine((value) => Math.round(value * 1000) / 1000 === value, {
    message: "Količina sme imati najviše 3 decimale",
  });

export const addWasteEntrySchema = z
  .object({
    ingredientId: z.string().uuid().nullable().optional(),
    recipeId: z.string().uuid().nullable().optional(),
    quantity: wasteQuantitySchema,
    unit: ingredientUnitSchema,
    reason: wasteReasonSchema,
    note: z.string().trim().max(500).nullable().optional().default(null),
    adjustStock: z.boolean().optional().default(false),
    clientId: z.string().uuid().nullable().optional().default(null),
    /** Offline cache snapshot — only used when clientId is set. */
    unitCostSnapshot: z
      .number()
      .finite()
      .nonnegative()
      .max(9_999_999_999.9999)
      .nullable()
      .optional()
      .default(null),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasIng = Boolean(value.ingredientId);
    const hasRec = Boolean(value.recipeId);
    if (hasIng === hasRec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Izaberite sastojak ili recept.",
        path: ["ingredientId"],
      });
    }
  });

export const addWasteCorrectionSchema = z
  .object({
    entryId: z.string().uuid(),
    note: z.string().trim().max(500).nullable().optional().default(null),
  })
  .strict();

export const wasteExportFormatSchema = z.enum(["csv", "pdf", "xlsx"]);

export type WasteExportFormat = z.infer<typeof wasteExportFormatSchema>;

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Datum mora biti YYYY-MM-DD")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(d.getTime());
  }, "Neispravan datum");

export const wasteExportQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    format: wasteExportFormatSchema,
    workspaceId: z.string().uuid().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Početni datum mora biti pre završnog.",
        path: ["from"],
      });
    }
    const fromMs = Date.parse(`${value.from}T00:00:00Z`);
    const toMs = Date.parse(`${value.to}T00:00:00Z`);
    const days = Math.floor((toMs - fromMs) / 86_400_000);
    if (days > 370) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Period ne sme biti duži od 370 dana.",
        path: ["to"],
      });
    }
  });

export const wasteReportPeriodSchema = z
  .object({
    workspaceId: z.string().uuid(),
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.from > value.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Početni datum mora biti pre završnog.",
        path: ["from"],
      });
    }
    const fromMs = Date.parse(`${value.from}T00:00:00Z`);
    const toMs = Date.parse(`${value.to}T00:00:00Z`);
    const days = Math.floor((toMs - fromMs) / 86_400_000);
    if (days > 370) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Period ne sme biti duži od 370 dana.",
        path: ["to"],
      });
    }
  });
