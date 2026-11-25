import { sr } from "@/lib/i18n/sr";

/** Map Zod field errors into a simple record for form UI. */
export function zodFieldErrors(
  issues: { path: (string | number)[]; message: string }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/**
 * Map Supabase Auth / GoTrue error messages to Serbian UI copy.
 * Keep matching on stable English fragments from the Auth API.
 */
export function authErrorMessage(error?: string | null): string {
  if (!error) return sr.auth.errors.generic;
  const lower = error.toLowerCase();

  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid email or password")
  ) {
    return sr.auth.errors.invalidCredentials;
  }
  if (lower.includes("email not confirmed")) {
    return sr.auth.errors.emailNotConfirmed;
  }
  if (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("email address is already registered") ||
    lower.includes("user with this email has already been registered")
  ) {
    return sr.auth.errors.emailTaken;
  }
  if (
    lower.includes("password should be") ||
    lower.includes("password is too weak") ||
    lower.includes("weak password")
  ) {
    return sr.auth.errors.passwordMin;
  }
  if (
    lower.includes("database error saving new user") ||
    lower.includes("database error checking email") ||
    lower.includes("error creating user")
  ) {
    return sr.auth.errors.databaseSignup;
  }
  if (
    lower.includes("signups not allowed") ||
    lower.includes("signup is disabled") ||
    lower.includes("email signups are disabled")
  ) {
    return sr.auth.errors.signupsDisabled;
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("email rate limit") ||
    lower.includes("over_email_send_rate_limit") ||
    lower.includes("too many requests")
  ) {
    return sr.auth.errors.rateLimited;
  }
  if (
    lower.includes("invalid redirect") ||
    lower.includes("redirect_uri") ||
    lower.includes("redirect url")
  ) {
    return sr.auth.errors.invalidRedirect;
  }
  if (
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("failed to fetch") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound")
  ) {
    return sr.auth.errors.network;
  }
  if (lower.includes("invalid email") || lower.includes("unable to validate email")) {
    return sr.auth.errors.emailInvalid;
  }

  return sr.auth.errors.generic;
}
