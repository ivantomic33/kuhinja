import { z } from "zod";

export const scheduleIdSchema = z.string().uuid();
export const scheduleDateSchema = z.string().date();
export const scheduleTimeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):(?:00|30)$/);
export const scheduleCodeSchema = z.enum(["J", "P", "N", "D", "X", "O", "B", "G"]);

export const scheduleActionSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("employee"),
      id: scheduleIdSchema.optional(),
      full_name: z.string().trim().min(1).max(120),
      role: z.string().trim().min(1).max(100),
      hourly_rate_rsd: z.number().min(0).max(99999999).nullable(),
      login_email: z.string().trim().email().max(254).nullable(),
    })
    .strict(),
  z
    .object({
      type: z.literal("location"),
      name: z.string().trim().min(1).max(120),
    })
    .strict(),
  z
    .object({
      type: z.literal("assignment"),
      employee_id: scheduleIdSchema,
      date: scheduleDateSchema,
      code: scheduleCodeSchema.nullable(),
      custom_start: scheduleTimeSchema.nullable(),
      custom_end: scheduleTimeSchema.nullable(),
    })
    .strict(),
  z.object({ type: z.literal("publish") }).strict(),
  z.object({ type: z.literal("copy") }).strict(),
  z
    .object({
      type: z.literal("undo"),
      token: scheduleIdSchema,
    })
    .strict(),
  z.object({ type: z.literal("share") }).strict(),
  z.object({ type: z.literal("unshare") }).strict(),
  z
    .object({
      type: z.literal("request"),
      requestType: z.enum(["slobodan", "zamena"]),
      date: scheduleDateSchema,
      with_employee_id: scheduleIdSchema.nullable(),
      note: z.string().trim().max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal("decide"),
      id: scheduleIdSchema,
      status: z.enum(["odobreno", "odbijeno"]),
    })
    .strict(),
]);

export const updateScheduleInputSchema = z
  .object({
    location: scheduleIdSchema,
    week: scheduleDateSchema,
    command: scheduleActionSchema,
  })
  .strict();

export const loadScheduleReportInputSchema = z
  .object({
    location: scheduleIdSchema,
    month: scheduleDateSchema,
  })
  .strict();

export type ScheduleAction = z.input<typeof scheduleActionSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleInputSchema>;
export type LoadScheduleReportInput = z.infer<
  typeof loadScheduleReportInputSchema
>;
