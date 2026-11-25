import { headers } from "next/headers";

/**
 * Best-effort ISO country from the edge (Vercel sets `x-vercel-ip-country`).
 * Returns undefined when unknown — callers must NOT invent a sentinel for Paddle.
 * Never pass app-only values like "OTHERS" into Paddle APIs.
 */
export async function getVisitorCountry(): Promise<string | undefined> {
  const h = await headers();
  const raw =
    h.get("x-vercel-ip-country") ??
    h.get("cf-ipcountry") ??
    h.get("x-country-code");

  if (!raw) return undefined;

  const code = raw.trim().toUpperCase();
  // Vercel uses XX for unknown; CF uses XX/T1 for unknown/tor.
  if (!/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") {
    return undefined;
  }

  return code;
}
