import { redirect } from "next/navigation";
import { AcceptInviteButton } from "@/components/workspace/AcceptInviteButton";
import { AuthShell } from "@/components/auth/AuthShell";
import { hashInviteToken, INVITE_GENERIC_ERROR } from "@/lib/workspace/invite-token";
import { createClient, getServerUser } from "@/lib/supabase/server";
import { sr } from "@/lib/i18n/sr";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  const trimmed = token?.trim() ?? "";
  if (trimmed.length < 20) {
    return (
      <AuthShell title={sr.workspace.inviteTitle}>
        <p className="text-ui-sm text-text-2">{INVITE_GENERIC_ERROR}</p>
      </AuthShell>
    );
  }

  const user = await getServerUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${trimmed}`)}`);
  }

  const supabase = await createClient();
  const tokenHash = hashInviteToken(trimmed);
  const { data: rows } = await supabase.rpc("lookup_workspace_invite", {
    p_token_hash: tokenHash,
  });
  const invite = Array.isArray(rows) ? rows[0] : rows;

  // Same generic message for missing / expired / used.
  const invalid =
    !invite ||
    Boolean(invite.accepted_at) ||
    new Date(String(invite.expires_at)).getTime() <= Date.now();

  if (invalid) {
    return (
      <AuthShell title={sr.workspace.inviteTitle}>
        <p className="text-ui-sm text-text-2">{INVITE_GENERIC_ERROR}</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={sr.workspace.inviteTitle}>
      <p className="mb-4 text-ui-sm text-text-2">
        {sr.workspace.inviteBody}
      </p>
      <AcceptInviteButton token={trimmed} />
    </AuthShell>
  );
}
