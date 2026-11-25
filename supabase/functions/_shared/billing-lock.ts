import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export function createBillingAdmin(url: string, serviceRole: string) {
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export class BillingBusyError extends Error {
  constructor() {
    super("billing_lock_busy");
  }
}

export async function withBillingLock<T>(
  admin: ReturnType<typeof createBillingAdmin>,
  key: string,
  handler: (token: string) => Promise<T>,
): Promise<T> {
  const token = crypto.randomUUID();
  const claim = await admin.rpc("claim_billing_lock", {
    p_key: key,
    p_token: token,
  });
  if (claim.error) throw new Error("billing_lock_claim");
  if (claim.data !== true) throw new BillingBusyError();

  try {
    return await handler(token);
  } finally {
    const { error } = await admin.rpc("release_billing_lock", {
      p_key: key,
      p_token: token,
    });
    if (error) {
      console.error(
        JSON.stringify({ outcome: "error", reason: "billing_lock_release" }),
      );
    }
  }
}
