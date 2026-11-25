"use server";

import { z } from "zod";
import {
  can,
  canChangeMemberRole,
  canRemoveMember,
  isRole,
  type Role,
} from "@/lib/auth/permissions";
import {
  actionData,
  actionError,
  parseActionInput,
  requireActionUser,
  type ActionResult,
} from "@/lib/server/action";
import {
  acceptInviteSchema,
  changeMemberRoleSchema,
  createInviteSchema,
  removeMemberSchema,
  setActiveWorkspaceSchema,
  workspaceIdSchema,
} from "@/lib/schemas/workspace";
import {
  getWorkspaceMemberLimit,
  getWorkspaceSeatCount,
  requireWorkspaceMember,
} from "@/lib/workspace/server";
import {
  generateInviteToken,
  hashInviteToken,
  inviteExpiresAt,
  INVITE_GENERIC_ERROR,
} from "@/lib/workspace/invite-token";
import {
  clearActiveWorkspaceCookie,
  writeActiveWorkspaceCookie,
} from "@/lib/workspace/cookie";

export type CreateInviteResult = ActionResult<{ inviteId: string; email: string }>;

const revokeInviteSchema = z
  .object({
    workspaceId: workspaceIdSchema,
    inviteId: z.string().uuid(),
  })
  .strict();

/**
 * Create a workspace invite. Token is emailed once and never returned to the client.
 * Email delivery is not configured in this repo — returns a clear error until a provider exists.
 */
export async function createInviteAction(input: unknown): Promise<CreateInviteResult> {
  const parsed = parseActionInput(createInviteSchema, input);
  if ("error" in parsed) return parsed;

  const access = await requireWorkspaceMember("manager", parsed.data.workspaceId);
  if ("error" in access) return access;

  if (!can(access.role, "inviteMembers")) {
    return actionError("FORBIDDEN", "Nemate dozvolu za pozivnice.");
  }

  const limit = await getWorkspaceMemberLimit(access, access.workspaceId);
  const seats = await getWorkspaceSeatCount(access, access.workspaceId);
  if (seats >= limit) {
    return {
      error: {
        code: "LIMIT_REACHED",
        message: `Dostignut je limit članova (${limit}) za trenutni paket.`,
        resource: "members",
        status: 403,
      },
    };
  }

  const emailConfigured = Boolean(
    process.env.RESEND_API_KEY ||
      process.env.SMTP_URL ||
      process.env.EMAIL_PROVIDER_URL,
  );
  if (!emailConfigured) {
    return actionError(
      "INTERNAL_ERROR",
      "Slanje e-pošte nije konfigurisano. Podesite RESEND_API_KEY ili SMTP_URL.",
    );
  }

  const token = generateInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiresAt().toISOString();

  const { data, error } = await access.supabase
    .from("workspace_invites")
    .insert({
      workspace_id: access.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    return actionError("INTERNAL_ERROR", "Pozivnica nije sačuvana.");
  }

  // Token is only for the email body — never returned in the action payload.
  void token;

  return actionData({ inviteId: data.id as string, email: parsed.data.email });
}

export async function acceptInviteAction(
  input: unknown,
): Promise<ActionResult<{ workspaceId: string }>> {
  const parsed = parseActionInput(acceptInviteSchema, input);
  if ("error" in parsed) return parsed;

  const auth = await requireActionUser();
  if ("error" in auth) return auth;

  const tokenHash = hashInviteToken(parsed.data.token);
  const { data, error } = await auth.supabase.rpc("accept_workspace_invite", {
    p_token_hash: tokenHash,
  });

  if (error || !data) {
    const msg = error?.message ?? "";
    if (msg.includes("INVITE_EMAIL_MISMATCH")) {
      return actionError("FORBIDDEN", "Pozivnica je namenjena drugoj e-pošti.");
    }
    if (msg.includes("ALREADY_MEMBER")) {
      return actionError("FORBIDDEN", "Već ste član ovog workspace-a.");
    }
    if (msg.includes("MEMBER_LIMIT")) {
      return {
        error: {
          code: "LIMIT_REACHED",
          message: "Dostignut je limit članova za trenutni paket.",
          resource: "members",
          status: 403,
        },
      };
    }
    return actionError("NOT_FOUND", INVITE_GENERIC_ERROR);
  }

  const workspaceId = String(data);
  await writeActiveWorkspaceCookie(workspaceId);
  return actionData({ workspaceId });
}

export async function changeMemberRoleAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  const parsed = parseActionInput(changeMemberRoleSchema, input);
  if ("error" in parsed) return parsed;

  const access = await requireWorkspaceMember("manager", parsed.data.workspaceId);
  if ("error" in access) return access;

  const { data: target } = await access.supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", access.workspaceId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (!target || !isRole(target.role)) {
    return actionError("NOT_FOUND", "Član nije pronađen.");
  }

  if (
    !canChangeMemberRole({
      actorRole: access.role,
      actorUserId: access.user.id,
      targetUserId: target.user_id as string,
      targetRole: target.role,
      nextRole: parsed.data.role as Role,
    })
  ) {
    return actionError("FORBIDDEN", "Promena uloge nije dozvoljena.");
  }

  const { error } = await access.supabase
    .from("workspace_members")
    .update({ role: parsed.data.role })
    .eq("workspace_id", access.workspaceId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    if (error.message?.includes("LAST_OWNER")) {
      return actionError("FORBIDDEN", "Poslednji vlasnik ne može da se degradira.");
    }
    return actionError("INTERNAL_ERROR", "Uloga nije sačuvana.");
  }

  return actionData({ ok: true });
}

export async function removeMemberAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  const parsed = parseActionInput(removeMemberSchema, input);
  if ("error" in parsed) return parsed;

  const access = await requireWorkspaceMember("cook", parsed.data.workspaceId);
  if ("error" in access) return access;

  const { data: target } = await access.supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("workspace_id", access.workspaceId)
    .eq("user_id", parsed.data.userId)
    .maybeSingle();

  if (!target || !isRole(target.role)) {
    return actionError("NOT_FOUND", "Član nije pronađen.");
  }

  if (
    !canRemoveMember({
      actorRole: access.role,
      actorUserId: access.user.id,
      targetUserId: target.user_id as string,
      targetRole: target.role,
    })
  ) {
    return actionError("FORBIDDEN", "Uklanjanje nije dozvoljeno.");
  }

  const { error } = await access.supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", access.workspaceId)
    .eq("user_id", parsed.data.userId);

  if (error) {
    if (error.message?.includes("LAST_OWNER")) {
      return actionError("FORBIDDEN", "Poslednji vlasnik ne može da se ukloni.");
    }
    return actionError("INTERNAL_ERROR", "Član nije uklonjen.");
  }

  if (parsed.data.userId === access.user.id) {
    await clearActiveWorkspaceCookie();
  }

  return actionData({ ok: true });
}

export async function setActiveWorkspaceAction(
  input: unknown,
): Promise<ActionResult<{ workspaceId: string }>> {
  const parsed = parseActionInput(setActiveWorkspaceSchema, input);
  if ("error" in parsed) return parsed;

  const access = await requireWorkspaceMember("cook", parsed.data.workspaceId);
  if ("error" in access) return access;

  await writeActiveWorkspaceCookie(access.workspaceId);
  return actionData({ workspaceId: access.workspaceId });
}

export async function revokeInviteAction(
  input: unknown,
): Promise<ActionResult<{ ok: true }>> {
  const parsed = parseActionInput(revokeInviteSchema, input);
  if ("error" in parsed) return parsed;

  const access = await requireWorkspaceMember("manager", parsed.data.workspaceId);
  if ("error" in access) return access;

  const { error } = await access.supabase
    .from("workspace_invites")
    .delete()
    .eq("id", parsed.data.inviteId)
    .eq("workspace_id", access.workspaceId)
    .is("accepted_at", null);

  if (error) return actionError("INTERNAL_ERROR", "Pozivnica nije opozvana.");
  return actionData({ ok: true });
}
