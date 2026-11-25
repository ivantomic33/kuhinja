import { cookies } from "next/headers";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace";

export function workspaceCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 365) {
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.TREUPLATE_DEPLOYMENT === "staging";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function readActiveWorkspaceCookie(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ACTIVE_WORKSPACE_COOKIE)?.value?.trim() ?? "";
  return value.length > 0 ? value : null;
}

export async function writeActiveWorkspaceCookie(workspaceId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, workspaceCookieOptions());
}

export async function clearActiveWorkspaceCookie(): Promise<void> {
  const store = await cookies();
  store.set(ACTIVE_WORKSPACE_COOKIE, "", { ...workspaceCookieOptions(0), maxAge: 0 });
}
