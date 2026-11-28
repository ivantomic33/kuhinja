import { cache } from "react";
import { z } from "zod";
import type { Role } from "@/lib/auth/permissions";
import { isRole } from "@/lib/auth/permissions";
import {
  actionError,
  requireActionUser,
  type ActionError,
  type ActionUserContext,
} from "@/lib/server/action";
import {
  readActiveWorkspaceCookie,
  writeActiveWorkspaceCookie,
} from "@/lib/workspace/cookie";

export const workspaceIdSchema = z.string().uuid();

export type WorkspaceMembership = {
  workspaceId: string;
  name: string;
  role: Role;
};

export type ActiveWorkspace = WorkspaceMembership;

async function loadMemberships(
  ctx: ActionUserContext,
): Promise<WorkspaceMembership[]> {
  const { data, error } = await ctx.supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces ( id, name )")
    .eq("user_id", ctx.user.id)
    .order("created_at", { ascending: true });

  if (error) return [];

  const rows: WorkspaceMembership[] = [];
  for (const row of data ?? []) {
    const role = row.role;
    if (!isRole(role)) continue;
    const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
    if (!ws || typeof ws !== "object" || !("id" in ws) || !("name" in ws)) continue;
    rows.push({
      workspaceId: String(ws.id),
      name: String(ws.name),
      role,
    });
  }
  return rows;
}

/**
 * Resolve the active workspace for the signed-in user.
 * Cookie is a hint only — membership is always re-checked.
 */
export const resolveActiveWorkspace = cache(
  async (): Promise<ActiveWorkspace | null> => {
    const auth = await requireActionUser();
    if ("error" in auth) return null;

    const memberships = await loadMemberships(auth);
    if (memberships.length === 0) return null;

    const cookieId = await readActiveWorkspaceCookie();
    const fromCookie = cookieId
      ? memberships.find((m) => m.workspaceId === cookieId)
      : undefined;
    const active = fromCookie ?? memberships[0]!;

    if (!fromCookie || fromCookie.workspaceId !== cookieId) {
      try {
        await writeActiveWorkspaceCookie(active.workspaceId);
      } catch {
        // Server Component cookie write may be read-only; middleware/action can set later.
      }
    }

    return active;
  },
);

export async function requireWorkspaceMember(
  minRole: Role = "cook",
  workspaceIdInput?: string,
  context?: ActionUserContext,
): Promise<(ActionUserContext & ActiveWorkspace) | ActionError> {
  const auth = context ?? (await requireActionUser());
  if ("error" in auth) return auth;

  const parsedId = workspaceIdInput
    ? workspaceIdSchema.safeParse(workspaceIdInput)
    : null;
  if (workspaceIdInput && !parsedId?.success) {
    return actionError("VALIDATION_ERROR", "Neispravan workspace.");
  }

  const memberships = await loadMemberships(auth);
  if (memberships.length === 0) {
    return actionError("FORBIDDEN", "Niste član nijednog workspace-a.");
  }

  let target =
    (parsedId?.success
      ? memberships.find((m) => m.workspaceId === parsedId.data)
      : null) ?? null;

  if (!target) {
    const cookieId = await readActiveWorkspaceCookie();
    target =
      (cookieId ? memberships.find((m) => m.workspaceId === cookieId) : null) ??
      memberships[0]!;
  }

  const { ROLE_RANK } = await import("@/lib/auth/permissions");
  if (ROLE_RANK[target.role] < ROLE_RANK[minRole]) {
    return actionError("FORBIDDEN", "Nemate dozvolu za ovu akciju.");
  }

  return { ...auth, ...target };
}

/** Owner's plan drives seat limits for the workspace. */
export async function getWorkspaceMemberLimit(
  ctx: ActionUserContext,
  workspaceId: string,
): Promise<number> {
  const { data } = await ctx.supabase.rpc("workspace_member_limit", {
    p_workspace_id: workspaceId,
  });
  return typeof data === "number" && data > 0 ? data : 1;
}

export async function getWorkspaceSeatCount(
  ctx: ActionUserContext,
  workspaceId: string,
): Promise<number> {
  const { data, error } = await ctx.supabase.rpc("workspace_member_seat_count", {
    p_workspace_id: workspaceId,
  });
  if (error || typeof data !== "number") {
    const [{ count: members }, { count: invites }] = await Promise.all([
      ctx.supabase
        .from("workspace_members")
        .select("user_id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
      ctx.supabase
        .from("workspace_invites")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .is("accepted_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);
    return (members ?? 0) + (invites ?? 0);
  }
  return data;
}
