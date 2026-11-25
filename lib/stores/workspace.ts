"use client";

import { create } from "zustand";
import type { Role } from "@/lib/auth/permissions";

export type WorkspaceStoreState = {
  activeWorkspaceId: string | null;
  role: Role | null;
  name: string | null;
  setWorkspace: (input: {
    activeWorkspaceId: string;
    role: Role;
    name: string;
  }) => void;
  clear: () => void;
};

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  activeWorkspaceId: null,
  role: null,
  name: null,
  setWorkspace: (input) =>
    set({
      activeWorkspaceId: input.activeWorkspaceId,
      role: input.role,
      name: input.name,
    }),
  clear: () => set({ activeWorkspaceId: null, role: null, name: null }),
}));

export const selectActiveWorkspaceId = (s: WorkspaceStoreState) => s.activeWorkspaceId;
export const selectWorkspaceRole = (s: WorkspaceStoreState) => s.role;
export const selectWorkspaceName = (s: WorkspaceStoreState) => s.name;
