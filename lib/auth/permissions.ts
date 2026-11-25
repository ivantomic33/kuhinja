/**
 * Workspace role matrix — keep in sync with public.is_member ranks in SQL.
 * cook=1, chef=2, manager=3, owner=4
 */

export const ROLES = ["owner", "manager", "chef", "cook"] as const;
export type Role = (typeof ROLES)[number];

export const INVITE_ROLES = ["manager", "chef", "cook"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export const ROLE_RANK: Record<Role, number> = {
  cook: 1,
  chef: 2,
  manager: 3,
  owner: 4,
};

export type PermissionAction =
  | "read"
  | "manageRecipes"
  | "manageProcurement"
  | "manageShifts"
  | "manageSchedule"
  | "checklist"
  | "inviteMembers"
  | "changeRole"
  | "removeMember"
  | "deleteWorkspace"
  | "transferOwnership";

const ALL_ACTIONS: PermissionAction[] = [
  "read",
  "manageRecipes",
  "manageProcurement",
  "manageShifts",
  "manageSchedule",
  "checklist",
  "inviteMembers",
  "changeRole",
  "removeMember",
  "deleteWorkspace",
  "transferOwnership",
];

/** Actions granted per role (mirrors SQL is_member thresholds). */
export const ROLE_PERMISSIONS: Record<Role, readonly PermissionAction[]> = {
  owner: ALL_ACTIONS,
  manager: ALL_ACTIONS.filter(
    (action) => action !== "deleteWorkspace" && action !== "transferOwnership",
  ),
  chef: [
    "read",
    "manageRecipes",
    "manageProcurement",
    "manageShifts",
    "manageSchedule",
    "checklist",
  ],
  cook: ["read", "checklist"],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function roleRank(role: Role): number {
  return ROLE_RANK[role];
}

export function hasMinRole(role: Role, min: Role): boolean {
  return roleRank(role) >= roleRank(min);
}

export function can(role: Role, action: PermissionAction): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

/** SQL policy minimum role for a given action (for alignment tests). */
export function sqlMinRoleForAction(action: PermissionAction): Role | null {
  switch (action) {
    case "read":
    case "checklist":
      return "cook";
    case "manageRecipes":
    case "manageProcurement":
    case "manageShifts":
    case "manageSchedule":
      return "chef";
    case "inviteMembers":
    case "changeRole":
    case "removeMember":
      return "manager";
    case "deleteWorkspace":
    case "transferOwnership":
      return "owner";
    default:
      return null;
  }
}

/**
 * Whether actor may assign `nextRole` to a target currently holding `targetRole`.
 * Owner: anyone except self-demote handled by caller.
 * Manager: only chef/cook targets and only to chef/cook.
 */
export function canChangeMemberRole(input: {
  actorRole: Role;
  actorUserId: string;
  targetUserId: string;
  targetRole: Role;
  nextRole: Role;
}): boolean {
  const { actorRole, actorUserId, targetUserId, targetRole, nextRole } = input;
  if (!can(actorRole, "changeRole")) return false;
  if (actorUserId === targetUserId) return false;
  if (actorRole === "owner") {
    return nextRole !== "owner" || targetRole === "owner";
  }
  if (actorRole === "manager") {
    if (!["chef", "cook"].includes(targetRole)) return false;
    if (!["chef", "cook"].includes(nextRole)) return false;
    return true;
  }
  return false;
}

export function canRemoveMember(input: {
  actorRole: Role;
  actorUserId: string;
  targetUserId: string;
  targetRole: Role;
}): boolean {
  const { actorRole, actorUserId, targetUserId, targetRole } = input;
  if (actorUserId === targetUserId) {
    // Leaving is allowed except last-owner (enforced in SQL/server).
    return true;
  }
  if (!can(actorRole, "removeMember")) return false;
  if (actorRole === "owner") return true;
  if (actorRole === "manager") return targetRole === "chef" || targetRole === "cook";
  return false;
}
