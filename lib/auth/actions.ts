"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sr } from "@/lib/i18n/sr";
import { authErrorMessage, zodFieldErrors } from "@/lib/auth/errors";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { checkoutReturnPath } from "@/lib/billing/checkout-intent";
import { currentConsent, persistPendingLegalConsent } from "@/lib/legal/consent";
import {
  forgotPasswordSchema,
  googleOAuthInputSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/lib/schemas/auth";
import {
  actionError,
  requireActionUser,
  type ActionErrorBody,
} from "@/lib/server/action";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Structured error for callers that need codes (UNAUTHORIZED, etc.). */
  error?: ActionErrorBody;
  url?: string;
  needsEmailConfirmation?: boolean;
};

function mapAuthError(message: string): string {
  return authErrorMessage(message);
}

function logAuthFailure(scope: string, error: { message?: string; status?: number; code?: string } | null) {
  if (!error) return;
  console.error(`[auth:${scope}]`, error.message ?? "unknown", {
    status: error.status,
    code: error.code,
  });
}

async function getOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host = headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://dlztt72p-3000.euw.devtunnels.ms/";
}

export async function loginAction(
  input: LoginInput
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parsed.error.issues),
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    logAuthFailure("login", error);
    const message = mapAuthError(error.message);
    return {
      success: false,
      message,
      error: { code: "UNAUTHORIZED", message },
    };
  }

  if (data.user && !(await persistPendingLegalConsent(supabase, data.user))) {
    await supabase.auth.signOut({ scope: "local" });
    return { success: false, message: sr.auth.errors.legalConsentFailed };
  }

  return { success: true };
}

export async function registerAction(
  input: RegisterInput,
  checkout?: string,
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parsed.error.issues),
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const consent = currentConsent(parsed.data.marketingOptIn);
  const checkoutPath = checkoutReturnPath(checkout);

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${checkoutPath ? encodeURIComponent(checkoutPath) : "/login"}`,
      data: {
        full_name: parsed.data.fullName,
        venue_name: parsed.data.venueName,
        // Nested object for session-based consent write after verify/login.
        legal_consent: consent,
        // Flat keys kept for older DB triggers / debugging.
        legal_terms_version: consent.terms,
        legal_privacy_version: consent.privacy,
        legal_accepted_at: consent.acceptedAt,
        ...(consent.marketing
          ? { legal_marketing_version: consent.marketing }
          : {}),
      },
    },
  });

  if (error) {
    logAuthFailure("register", error);
    const message = mapAuthError(error.message);
    return {
      success: false,
      message,
      error: { code: "VALIDATION_ERROR", message },
    };
  }

  // Supabase may return a user with empty identities when the email already
  // exists (email enumeration protection). Treat that as "email taken".
  const identities = data.user?.identities;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    return {
      success: false,
      message: sr.auth.errors.emailTaken,
      error: { code: "VALIDATION_ERROR", message: sr.auth.errors.emailTaken },
    };
  }

  if (!data.user) {
    logAuthFailure("register", { message: "signUp returned no user and no error" });
    return {
      success: false,
      message: sr.auth.errors.generic,
      error: { code: "INTERNAL_ERROR", message: sr.auth.errors.generic },
    };
  }

  // Profile + default venue are created by the handle_new_user DB trigger
  // from auth metadata (full_name, venue_name).

  if (data.session) {
    const recorded = await persistPendingLegalConsent(supabase, data.user);
    await supabase.auth.signOut({ scope: "local" });
    if (!recorded) {
      return { success: false, message: sr.auth.errors.legalConsentFailed };
    }
  }

  return {
    success: true,
    needsEmailConfirmation: !data.session,
    message: data.session ? sr.auth.registerReady : sr.auth.registerSuccess,
  };
}

export async function forgotPasswordAction(
  input: ForgotPasswordInput
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parsed.error.issues),
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    logAuthFailure("forgot-password", error);
    const message = mapAuthError(error.message);
    return {
      success: false,
      message,
      error: { code: "INTERNAL_ERROR", message },
    };
  }

  return {
    success: true,
    message: sr.auth.resetEmailSent,
  };
}

export async function resetPasswordAction(
  input: ResetPasswordInput
): Promise<AuthActionResult> {
  // Recovery session must be a real user — never trust getSession() alone.
  const auth = await requireActionUser();
  if ("error" in auth) {
    return {
      success: false,
      message: sr.auth.errors.generic,
      error: auth.error,
    };
  }

  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: zodFieldErrors(parsed.error.issues),
      error: {
        code: "VALIDATION_ERROR",
        message: parsed.error.issues[0]?.message ?? "Invalid input.",
      },
    };
  }

  const { error } = await auth.supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    logAuthFailure("reset-password", error);
    const message = mapAuthError(error.message);
    return {
      success: false,
      message,
      error: { code: "INTERNAL_ERROR", message },
    };
  }

  if (!(await persistPendingLegalConsent(auth.supabase, auth.user))) {
    await auth.supabase.auth.signOut({ scope: "local" });
    return { success: true, message: sr.auth.passwordUpdated, url: "/login?consent=retry" };
  }

  return { success: true, message: sr.auth.passwordUpdated };
}

export async function signOutAction() {
  const supabase = await createClient();
  // Prefer getUser so we only clear a verified session cookie set.
  await supabase.auth.getUser();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getGoogleOAuthUrl(
  nextPath = "/dashboard"
): Promise<AuthActionResult> {
  const parsed = googleOAuthInputSchema.safeParse({ nextPath });
  if (!parsed.success) {
    return {
      success: false,
      message: sr.auth.errors.oauthFailed,
      error: actionError("VALIDATION_ERROR", "Invalid redirect path.").error,
    };
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeRedirectPath(parsed.data.nextPath))}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    logAuthFailure("google-oauth", error);
    return {
      success: false,
      message: sr.auth.errors.oauthFailed,
      error: actionError("INTERNAL_ERROR", sr.auth.errors.oauthFailed).error,
    };
  }

  return { success: true, url: data.url };
}
