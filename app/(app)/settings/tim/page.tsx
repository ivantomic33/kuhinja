import { PageHeader } from "@/components/ui/PageHeader";
import { TeamSettingsClient } from "@/components/workspace/TeamSettingsClient";
import type { InviteRole, Role } from "@/lib/auth/permissions";
import { isRole } from "@/lib/auth/permissions";
import { sr } from "@/lib/i18n/sr";
import {
  getWorkspaceMemberLimit,
  getWorkspaceSeatCount,
  resolveActiveWorkspace,
} from "@/lib/workspace/server";
import { requireActionUser } from "@/lib/server/action";
import { redirect } from "next/navigation";

export default async function TeamSettingsPage() {
  const active = await resolveActiveWorkspace();
  if (!active) redirect("/settings");

  const auth = await requireActionUser();
  if ("error" in auth) redirect("/login");

  const { data: memberRows } = await auth.supabase.rpc("list_workspace_members", {
    p_workspace_id: active.workspaceId,
  });

  const members = (memberRows ?? [])
    .map((row: {
      user_id: string;
      role: string;
      full_name: string | null;
      email: string | null;
    }) => {
      if (!isRole(row.role)) return null;
      return {
        userId: row.user_id,
        role: row.role as Role,
        fullName: row.full_name ?? "",
        email: row.email ?? "",
      };
    })
    .filter(Boolean) as {
    userId: string;
    role: Role;
    fullName: string;
    email: string;
  }[];

  const { data: inviteRows } = await auth.supabase
    .from("workspace_invites")
    .select("id, email, role, expires_at")
    .eq("workspace_id", active.workspaceId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const invites = (inviteRows ?? [])
    .filter((row) => row.role === "manager" || row.role === "chef" || row.role === "cook")
    .map((row) => ({
      id: row.id as string,
      email: row.email as string,
      role: row.role as InviteRole,
      expiresAt: row.expires_at as string,
    }));

  const [memberLimit, seatCount] = await Promise.all([
    getWorkspaceMemberLimit(auth, active.workspaceId),
    getWorkspaceSeatCount(auth, active.workspaceId),
  ]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title={sr.workspace.teamTitle} description={sr.workspace.teamSubtitle} />
      <TeamSettingsClient
        workspaceId={active.workspaceId}
        actorRole={active.role}
        actorUserId={auth.user.id}
        members={members}
        invites={invites}
        memberLimit={memberLimit}
        seatCount={seatCount}
      />
    </div>
  );
}
