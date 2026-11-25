"use client";

import { useEffect } from "react";
import type { Role } from "@/lib/auth/permissions";
import { useWorkspaceStore } from "@/lib/stores/workspace";

export function WorkspaceBootstrap({
  workspaceId,
  role,
  name,
}: {
  workspaceId: string;
  role: Role;
  name: string;
}) {
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace);

  useEffect(() => {
    setWorkspace({ activeWorkspaceId: workspaceId, role, name });
  }, [workspaceId, role, name, setWorkspace]);

  return null;
}
