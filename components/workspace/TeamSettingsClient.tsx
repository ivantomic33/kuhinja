"use client";

import { useState, useTransition } from "react";
import { can, type InviteRole, type Role } from "@/lib/auth/permissions";
import {
  changeMemberRoleAction,
  createInviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/lib/workspace/actions";
import { BentoCard } from "@/components/ui/BentoCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";

export type TeamMemberRow = {
  userId: string;
  email: string;
  fullName: string;
  role: Role;
};

export type TeamInviteRow = {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
};

const ROLE_LABEL: Record<Role, string> = {
  owner: "Vlasnik",
  manager: "Menadžer",
  chef: "Šef",
  cook: "Kuvar",
};

export function TeamSettingsClient({
  workspaceId,
  actorRole,
  actorUserId,
  members,
  invites,
  memberLimit,
  seatCount,
}: {
  workspaceId: string;
  actorRole: Role;
  actorUserId: string;
  members: TeamMemberRow[];
  invites: TeamInviteRow[];
  memberLimit: number;
  seatCount: number;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("cook");
  const [pending, startTransition] = useTransition();

  const canInvite = can(actorRole, "inviteMembers");

  function run(action: () => Promise<{ error?: { message: string } } | { data: unknown }>) {
    startTransition(async () => {
      setMessage(null);
      const result = await action();
      if ("error" in result && result.error) {
        setMessage(result.error.message);
        return;
      }
      setMessage(sr.workspace.saved);
      window.location.reload();
    });
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BentoCard
        header={
          <div className="flex w-full items-center justify-between gap-2">
            <h2 className="text-ui-md font-semibold text-text">{sr.workspace.members}</h2>
            <p className="text-ui-sm text-text-2 tabular-nums">
              {seatCount} / {memberLimit}
            </p>
          </div>
        }
      >
        <ul className="divide-y divide-border">
          {members.map((member) => {
            const canEdit =
              can(actorRole, "changeRole") &&
              member.userId !== actorUserId &&
              (actorRole === "owner" ||
                (actorRole === "manager" &&
                  (member.role === "chef" || member.role === "cook")));
            const canRemove =
              member.userId === actorUserId ||
              (can(actorRole, "removeMember") &&
                (actorRole === "owner" ||
                  (actorRole === "manager" &&
                    (member.role === "chef" || member.role === "cook"))));

            return (
              <li
                key={member.userId}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-text">
                    {member.fullName || member.email || member.userId}
                  </p>
                  <p className="truncate text-ui-sm text-text-2">{member.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit ? (
                    <select
                      className="rounded-lg border border-border bg-surface-2 px-2 py-1 text-ui-sm"
                      defaultValue={member.role}
                      disabled={pending}
                      onChange={(event) => {
                        const role = event.target.value as Role;
                        if (role === "owner") return;
                        run(() =>
                          changeMemberRoleAction({
                            workspaceId,
                            userId: member.userId,
                            role,
                          }),
                        );
                      }}
                    >
                      <option value="manager">{ROLE_LABEL.manager}</option>
                      <option value="chef">{ROLE_LABEL.chef}</option>
                      <option value="cook">{ROLE_LABEL.cook}</option>
                    </select>
                  ) : (
                    <span className="rounded-full bg-surface-2 px-2 py-1 text-ui-xs text-text-2">
                      {ROLE_LABEL[member.role]}
                    </span>
                  )}
                  {canRemove ? (
                    <PrimaryButton
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() =>
                        run(() =>
                          removeMemberAction({
                            workspaceId,
                            userId: member.userId,
                          }),
                        )
                      }
                    >
                      {member.userId === actorUserId
                        ? sr.workspace.leave
                        : sr.workspace.remove}
                    </PrimaryButton>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </BentoCard>

      {canInvite ? (
        <BentoCard header={<h2 className="text-ui-md font-semibold text-text">{sr.workspace.invite}</h2>}>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              run(() =>
                createInviteAction({
                  workspaceId,
                  email,
                  role: inviteRole,
                }),
              );
            }}
          >
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="field-label">{sr.workspace.inviteEmail}</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2"
                placeholder="ime@restoran.rs"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="field-label">{sr.workspace.role}</span>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2"
              >
                <option value="manager">{ROLE_LABEL.manager}</option>
                <option value="chef">{ROLE_LABEL.chef}</option>
                <option value="cook">{ROLE_LABEL.cook}</option>
              </select>
            </label>
            <PrimaryButton type="submit" loading={pending} disabled={seatCount >= memberLimit}>
              {sr.workspace.sendInvite}
            </PrimaryButton>
          </form>
          {seatCount >= memberLimit ? (
            <p className="text-ui-sm text-warning">{sr.workspace.limitReached}</p>
          ) : null}
        </BentoCard>
      ) : null}

      <BentoCard header={<h2 className="text-ui-md font-semibold text-text">{sr.workspace.activeInvites}</h2>}>
        {invites.length === 0 ? (
          <p className="text-ui-sm text-text-2">{sr.workspace.noInvites}</p>
        ) : (
          <ul className="divide-y divide-border">
            {invites.map((invite) => (
              <li
                key={invite.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-text">{invite.email}</p>
                  <p className="text-ui-sm text-text-2">
                    {ROLE_LABEL[invite.role]} · {sr.workspace.expires}{" "}
                    {new Date(invite.expiresAt).toLocaleDateString("sr-Latn")}
                  </p>
                </div>
                {canInvite ? (
                  <PrimaryButton
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        revokeInviteAction({
                          workspaceId,
                          inviteId: invite.id,
                        }),
                      )
                    }
                  >
                    {sr.workspace.revoke}
                  </PrimaryButton>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </BentoCard>

      {message ? <p className="text-ui-sm text-text-2">{message}</p> : null}
    </div>
  );
}
