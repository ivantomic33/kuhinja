import { z } from "zod";

export const listNotificationsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(50),
  })
  .strict();

export const markNotificationReadSchema = z
  .object({
    notificationId: z.string().uuid(),
  })
  .strict();

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
export type MarkNotificationReadInput = z.infer<
  typeof markNotificationReadSchema
>;
