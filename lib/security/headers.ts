export const HSTS_HEADER = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains",
} as const;

export const BASE_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
] as const;

export function isProductionEnv(env = process.env.NODE_ENV): boolean {
  return env === "production";
}

/** Browser hardening headers. HSTS is production-only. */
export function getSecurityHeaders(production = isProductionEnv()) {
  return production
    ? [...BASE_SECURITY_HEADERS, HSTS_HEADER]
    : [...BASE_SECURITY_HEADERS];
}

export function applySecurityHeaders(
  headers: Headers,
  cspValue: string,
  production = isProductionEnv(),
): void {
  headers.set("Content-Security-Policy", cspValue);
  for (const { key, value } of getSecurityHeaders(production)) {
    headers.set(key, value);
  }
}
