import { describe, expect, it } from "vitest";
import {
  can,
  canChangeMemberRole,
  canRemoveMember,
  ROLE_PERMISSIONS,
  ROLES,
  sqlMinRoleForAction,
  type PermissionAction,
  roleRank,
} from "./permissions";

const ACTIONS: PermissionAction[] = [
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

describe("permissions matrix", () => {
  it("owner has every action", () => {
    for (const action of ACTIONS) {
      expect(can("owner", action)).toBe(true);
    }
  });

  it("manager cannot delete workspace or transfer ownership", () => {
    expect(can("manager", "deleteWorkspace")).toBe(false);
    expect(can("manager", "transferOwnership")).toBe(false);
    expect(can("manager", "inviteMembers")).toBe(true);
    expect(can("manager", "manageRecipes")).toBe(true);
  });

  it("chef manages kitchen data but not members", () => {
    expect(can("chef", "manageRecipes")).toBe(true);
    expect(can("chef", "manageProcurement")).toBe(true);
    expect(can("chef", "checklist")).toBe(true);
    expect(can("chef", "inviteMembers")).toBe(false);
    expect(can("chef", "deleteWorkspace")).toBe(false);
  });

  it("cook only reads and checks lists", () => {
    expect(ROLE_PERMISSIONS.cook).toEqual(["read", "checklist"]);
    expect(can("cook", "manageProcurement")).toBe(false);
    expect(can("cook", "manageRecipes")).toBe(false);
  });

  it("aligns can() with SQL min-role thresholds", () => {
    for (const role of ROLES) {
      for (const action of ACTIONS) {
        const min = sqlMinRoleForAction(action);
        if (!min) continue;
        const expected = roleRank(role) >= roleRank(min);
        // Owner-only extras stay owner-only even if rank matches.
        if (
          (action === "deleteWorkspace" || action === "transferOwnership") &&
          role !== "owner"
        ) {
          expect(can(role, action)).toBe(false);
          continue;
        }
        // Manager loses two owner actions already covered above.
        if (action === "deleteWorkspace" || action === "transferOwnership") {
          expect(can(role, action)).toBe(role === "owner");
          continue;
        }
        expect(can(role, action)).toBe(expected);
      }
    }
  });

  it("blocks self role change and manager elevating to owner", () => {
    expect(
      canChangeMemberRole({
        actorRole: "owner",
        actorUserId: "a",
        targetUserId: "a",
        targetRole: "owner",
        nextRole: "manager",
      }),
    ).toBe(false);

    expect(
      canChangeMemberRole({
        actorRole: "manager",
        actorUserId: "a",
        targetUserId: "b",
        targetRole: "cook",
        nextRole: "owner",
      }),
    ).toBe(false);

    expect(
      canChangeMemberRole({
        actorRole: "manager",
        actorUserId: "a",
        targetUserId: "b",
        targetRole: "cook",
        nextRole: "chef",
      }),
    ).toBe(true);
  });

  it("manager cannot remove owner or manager", () => {
    expect(
      canRemoveMember({
        actorRole: "manager",
        actorUserId: "a",
        targetUserId: "b",
        targetRole: "owner",
      }),
    ).toBe(false);
    expect(
      canRemoveMember({
        actorRole: "manager",
        actorUserId: "a",
        targetUserId: "b",
        targetRole: "chef",
      }),
    ).toBe(true);
  });
});
