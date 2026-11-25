import { z } from "zod";
import { INVITE_ROLES, ROLES } from "@/lib/auth/permissions";

export const workspaceIdSchema = z.string().uuid("Neispravan workspace.");

export const workspaceRoleSchema = z.enum(ROLES);
export const inviteRoleSchema = z.enum(INVITE_ROLES);

export const createInviteSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    email: z
      .string()
      .trim()
      .email("Unesite ispravan email")
      .transform((value) => value.toLowerCase()),
    role: inviteRoleSchema,
  })
  .strict();

export const acceptInviteSchema = z
  .object({
    token: z.string().trim().min(20).max(128),
  })
  .strict();

export const changeMemberRoleSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    userId: z.string().uuid(),
    role: workspaceRoleSchema.refine((role) => role !== "owner", {
      message: "Vlasništvo se ne dodeljuje ovom akcijom.",
    }),
  })
  .strict();

export const removeMemberSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    userId: z.string().uuid(),
  })
  .strict();

export const setActiveWorkspaceSchema = z
  .object({
    workspaceId: workspaceIdSchema,
  })
  .strict();

export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
