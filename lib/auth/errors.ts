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

export function authErrorMessage(error?: string | null): string {
  if (!error) return sr.auth.errors.generic;
  const lower = error.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return sr.auth.errors.invalidCredentials;
  }
  if (lower.includes("email not confirmed")) {
    return sr.auth.errors.emailNotConfirmed;
  }
  return sr.auth.errors.generic;
}
