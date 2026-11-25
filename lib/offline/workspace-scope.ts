/**
 * Offline key scoping: `${userId}:${workspaceId}:<entity>`
 * Falls back to user-only keys only when workspace is unknown (legacy reads).
 */

import { useWorkspaceStore } from "@/lib/stores/workspace";

let cachedWorkspaceId: string | null | undefined;

export function resetOfflineWorkspaceIdCache(): void {
  cachedWorkspaceId = undefined;
}

export function setOfflineWorkspaceId(workspaceId: string | null): void {
  cachedWorkspaceId = workspaceId;
}

export function resolveOfflineWorkspaceId(): string | null {
  if (cachedWorkspaceId !== undefined) return cachedWorkspaceId;
  if (typeof window === "undefined") return null;
  try {
    cachedWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
  } catch {
    cachedWorkspaceId = null;
  }
  return cachedWorkspaceId ?? null;
}

export function offlineScopeKey(
  userId: string,
  workspaceId: string | null | undefined,
  suffix: string,
): string {
  if (workspaceId) return `${userId}:${workspaceId}:${suffix}`;
  return `${userId}:${suffix}`;
}

export function offlineUserPrefix(userId: string): string {
  return `${userId}:`;
}

export function offlineWorkspacePrefix(userId: string, workspaceId: string): string {
  return `${userId}:${workspaceId}:`;
}
