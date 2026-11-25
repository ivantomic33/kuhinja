type ReadEnv = (name: string) => string | undefined;

export function paddleApiBase(environment: string | undefined) {
  if (environment === "sandbox") return "https://sandbox-api.paddle.com";
  if (environment === "live") return "https://api.paddle.com";
  throw new Error("Set the Paddle environment to sandbox or live");
}

export function paddleApi(readEnv: ReadEnv) {
  const base = paddleApiBase(readEnv("PADDLE_ENVIRONMENT"));
  const key = readEnv("PADDLE_API_KEY");
  if (!key) throw new Error("Missing Paddle API key");

  async function request<T>(path: string, method = "GET", body?: object) {
    const response = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: body && JSON.stringify(body),
      redirect: "error",
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      throw new Error(`Paddle ${method} ${response.status}: ${detail?.error?.code ?? "request_failed"}`);
    }
    return await response.json() as { data: T; meta?: { pagination?: { next: string; has_more: boolean } } };
  }

  return {
    async get<T>(path: string) { return (await request<T>(path)).data; },
    async post<T>(path: string, body: object) { return (await request<T>(path, "POST", body)).data; },
    async patch<T>(path: string, body: object) { return (await request<T>(path, "PATCH", body)).data; },
    async *list<T>(path: string) {
      let next = path;
      while (next) {
        const page = await request<T[]>(next);
        yield* page.data;
        const pagination = page.meta?.pagination;
        next = "";
        if (pagination?.has_more) {
          const url = new URL(pagination.next);
          if (url.origin !== base) throw new Error("Invalid Paddle pagination origin");
          next = url.pathname + url.search;
        }
      }
    },
  };
}

export type PaddleApi = ReturnType<typeof paddleApi>;

export async function paddleMac(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type PaidAccess = {
  plan: "starter" | "pro" | "advanced";
  interval: "month" | "year";
  priceId: string;
  until: string;
  signature: string;
};

export async function signPaidAccess(
  secret: string, subscriptionId: string, access: Omit<PaidAccess, "signature">,
): Promise<PaidAccess> {
  const { plan, interval, priceId, until } = access;
  return { ...access, signature: await paddleMac(secret, JSON.stringify([subscriptionId, plan, interval, priceId, until])) };
}

export async function readPaidAccess(
  secret: string, subscriptionId: string, value: unknown,
): Promise<PaidAccess | null> {
  if (!value || typeof value !== "object") return null;
  const { plan, interval, priceId, until, signature } = value as Partial<PaidAccess>;
  if ((plan !== "starter" && plan !== "pro" && plan !== "advanced") ||
      (interval !== "month" && interval !== "year") ||
      typeof priceId !== "string" || !/^pri_[a-z\d]{26}$/.test(priceId) || typeof until !== "string" ||
      !Number.isFinite(Date.parse(until)) || typeof signature !== "string") return null;
  const signed = await signPaidAccess(secret, subscriptionId, { plan, interval, priceId, until });
  return signature === signed.signature ? signed : null;
}

type Money = { amount: string; currency_code: string };

export type PaddlePrice = {
  id: string;
  status: string;
  product_id: string;
  unit_price: Money;
  tax_mode: string;
  billing_cycle: { interval: string; frequency: number } | null;
  trial_period: {
    interval: string;
    frequency: number;
    requires_payment_method: boolean;
    unit_price: Money | null;
  } | null;
};

export function matchesPaddleInterval(price: PaddlePrice, interval: "monthly" | "yearly") {
  return price.status === "active" && price.billing_cycle?.frequency === 1 &&
    price.billing_cycle.interval === (interval === "monthly" ? "month" : "year");
}

export function matchingTrialPrice(trial: PaddlePrice, regular: PaddlePrice) {
  const trialPeriod = trial.trial_period;
  return Boolean(trialPeriod && trialPeriod.interval === "day" && trialPeriod.frequency === 14 &&
    trialPeriod.requires_payment_method && !trialPeriod.unit_price && !regular.trial_period &&
    trial.product_id === regular.product_id && trial.tax_mode === regular.tax_mode &&
    trial.unit_price.amount === regular.unit_price.amount &&
    trial.unit_price.currency_code === regular.unit_price.currency_code);
}

export type PaddleSubscription = {
  id: string;
  customer_id: string;
  status: "active" | "trialing" | "past_due" | "paused" | "canceled";
  current_billing_period: { starts_at: string; ends_at: string } | null;
  next_billed_at: string | null;
  scheduled_change: { action: string; effective_at: string } | null;
  items: Array<{
    price: { id: string; billing_cycle: { interval: string; frequency: number } | null };
    quantity: number;
    trial_dates: { ends_at: string } | null;
  }>;
  custom_data: Record<string, unknown> | null;
};

export type PaddleTransaction = {
  id: string;
  status: string;
  subscription_id: string | null;
  custom_data: Record<string, unknown> | null;
  origin: string;
  checkout: { url: string | null } | null;
  items: Array<{ price: { id: string } }>;
};

export async function verifyPaddleSignature(
  body: string,
  header: string,
  secret: string,
  now = Math.floor(Date.now() / 1000),
) {
  const parts = header.split(";").map((part) => part.trim().split("="));
  const timestamp = parts.find(([key]) => key === "ts")?.[1];
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"],
  );
  const signedBody = encoder.encode(`${timestamp}:${body}`);
  for (const [name, digest] of parts) {
    if (name !== "h1" || !/^[a-f\d]{64}$/i.test(digest)) continue;
    const bytes = Uint8Array.from(digest.match(/../g)!, (hex) => parseInt(hex, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, signedBody)) return true;
  }
  return false;
}
