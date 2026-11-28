import { z } from "zod";

export const paddleId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}_[a-z0-9]{26}$`));

const paddleConfigSchema = z.object({
  PADDLE_API_KEY: z.string().trim().min(1),
  PADDLE_WEBHOOK_SECRET: z.string().trim().min(1),
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: z.string().trim().min(1),
  NEXT_PUBLIC_PADDLE_ENVIRONMENT: z.enum(["sandbox", "production"]),
  NEXT_PUBLIC_PADDLE_PRICE_MONTHLY: paddleId("pri"),
  NEXT_PUBLIC_PADDLE_PRICE_YEARLY: paddleId("pri"),
}).superRefine((config, ctx) => {
  const prefix = config.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "sandbox" ? "test_" : "live_";
  if (!config.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.startsWith(prefix)) {
    ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_PADDLE_CLIENT_TOKEN"], message: "Wrong Paddle environment" });
  }
  if (config.NEXT_PUBLIC_PADDLE_PRICE_MONTHLY === config.NEXT_PUBLIC_PADDLE_PRICE_YEARLY) {
    ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_PADDLE_PRICE_YEARLY"], message: "Price IDs must differ" });
  }
});

export function getPaddleConfig(env: Record<string, string | undefined> = process.env) {
  const parsed = paddleConfigSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid Paddle configuration: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  return parsed.data;
}
