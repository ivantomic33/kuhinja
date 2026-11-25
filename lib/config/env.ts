import { z } from "zod";

const siteUrlSchema = z.string().url().regex(/^https?:\/\/[^/\\?#@\s]+$/);

export function getSiteUrl(): string {
  const result = siteUrlSchema.safeParse(process.env.NEXT_PUBLIC_SITE_URL);
  if (!result.success) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an absolute HTTP(S) origin without a trailing slash, path, query, or credentials.");
  }
  return new URL(result.data).origin;
}
