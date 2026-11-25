import { z } from "zod";

/** Positive quantity, max 4 decimal places. */
export const qty4Schema = z
  .number({ invalid_type_error: "Quantity must be a number" })
  .finite()
  .positive()
  .max(9_999_999_999.9999)
  .refine((value) => Math.round(value * 10_000) / 10_000 === value, {
    message: "Quantity must have at most 4 decimal places",
  });

/** Non-negative quantity (receive may be 0), max 4 decimals. */
export const qtyReceivedSchema = z
  .number({ invalid_type_error: "Quantity must be a number" })
  .finite()
  .nonnegative()
  .max(9_999_999_999.9999)
  .refine((value) => Math.round(value * 10_000) / 10_000 === value, {
    message: "Quantity must have at most 4 decimal places",
  });

/** Positive money, 2 decimal places. */
export const money2Schema = z
  .number()
  .finite()
  .positive()
  .max(9_999_999_999.99)
  .refine((value) => Math.round(value * 100) / 100 === value, {
    message: "Price must have at most two decimal places",
  });

export const stockReasonSchema = z.enum([
  "prijem",
  "potrosnja",
  "popis",
  "greska_popisa",
  "otpad",
  "korekcija",
]);

export type StockReason = z.infer<typeof stockReasonSchema>;

export const purchaseOrderStatusSchema = z.enum(["nacrt", "poslato", "primljeno"]);

export const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());

export const adjustStockSchema = z
  .object({
    ingredientId: z.string().uuid(),
    delta: z
      .number()
      .finite()
      .refine((v) => v !== 0, { message: "Delta must not be zero" })
      .refine((v) => Math.round(v * 10_000) / 10_000 === v, {
        message: "Delta must have at most 4 decimal places",
      })
      .refine((v) => Math.abs(v) <= 9_999_999_999.9999, {
        message: "Delta out of range",
      }),
    reason: stockReasonSchema,
    note: z.string().trim().max(500).nullable().optional().default(null),
    /** Required confirmation path for greska_popisa below zero. */
    allowNegative: z.boolean().optional().default(false),
  })
  .strict();

export const createPurchaseOrderDraftSchema = z
  .object({
    workspaceId: z.string().uuid(),
    /** low_stock alerts / par gaps */
    sourceAlerts: z.boolean().default(true),
    /** trebovanje stock_levels below min — Pro only */
    sourceTrebovanje: z.boolean().default(false),
    /** Optional explicit ingredient filter */
    ingredientIds: z.array(z.string().uuid()).max(200).optional(),
  })
  .strict()
  .refine((v) => v.sourceAlerts || v.sourceTrebovanje, {
    message: "At least one source is required",
  });

export const updatePurchaseOrderDraftItemsSchema = z
  .object({
    orderId: z.string().uuid(),
    items: z
      .array(
        z
          .object({
            ingredientId: z.string().uuid().nullable().optional(),
            ingredientName: z.string().trim().min(1).max(200),
            unit: z.string().trim().min(1).max(20),
            qtyOrdered: qty4Schema,
          })
          .strict(),
      )
      .max(200),
  })
  .strict();

export const receivePurchaseOrderSchema = z
  .object({
    orderId: z.string().uuid(),
    lines: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            qtyReceived: qtyReceivedSchema,
            unitPrice: money2Schema.nullable().optional().default(null),
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const markOrderSentSchema = z
  .object({
    orderId: z.string().uuid(),
    sentTo: z.string().trim().max(320).nullable().optional().default(null),
  })
  .strict();

export const purchaseOrderIdSchema = z.string().uuid();

export const sendPurchaseOrderEmailSchema = z
  .object({
    orderId: z.string().uuid(),
    to: emailSchema,
    cc: emailSchema.optional(),
    replyTo: emailSchema.optional(),
  })
  .strict();

export const supplierUpsertSchema = z
  .object({
    workspaceId: z.string().uuid(),
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    contactEmail: emailSchema.nullable().optional().default(null),
    contactPhone: z.string().trim().max(40).nullable().optional().default(null),
  })
  .strict();

export const updateIngredientStockFieldsSchema = z
  .object({
    ingredientId: z.string().uuid(),
    parLevel: z
      .number()
      .finite()
      .nonnegative()
      .max(9_999_999_999.999)
      .nullable()
      .optional(),
    packSize: z
      .number()
      .finite()
      .positive()
      .max(9_999_999_999.999)
      .nullable()
      .optional(),
    supplierId: z.string().uuid().nullable().optional(),
  })
  .strict();

export const inventorySetSchema = z
  .object({
    ingredientId: z.string().uuid(),
    counted: z
      .number()
      .finite()
      .nonnegative()
      .max(9_999_999_999.9999)
      .refine((v) => Math.round(v * 10_000) / 10_000 === v, {
        message: "Counted qty must have at most 4 decimal places",
      }),
    note: z.string().trim().max(500).nullable().optional().default(null),
  })
  .strict();
