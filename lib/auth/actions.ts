"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sr } from "@/lib/i18n/sr";
import { zodFieldErrors } from "@/lib/auth/errors";
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
};

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return sr.auth.errors.invalidCredentials;
  }
  if (lower.includes("email not confirmed")) {
    return sr.auth.errors.emailNotConfirmed;
  }
  if (lower.includes("user already registered")) {
    return sr.auth.errors.generic;
  }

  return sr.auth.errors.generic;
}

async function getOrigin() {
  const headerStore = await headers();
  const origin = headerStore.get("origin");
  if (origin) return origin;

  const host = headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
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
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      message: mapAuthError(error.message),
      error: { code: "UNAUTHORIZED", message: mapAuthError(error.message) },
    };
  }

  return { success: true };
}

export async function registerAction(
  input: RegisterInput
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

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/login`,
      data: {
        full_name: parsed.data.fullName,
        venue_name: parsed.data.venueName,
      },
    },
  });

  if (error) {
    return {
      success: false,
      message: mapAuthError(error.message),
      error: { code: "VALIDATION_ERROR", message: mapAuthError(error.message) },
    };
  }

  if (!data.user) {
    return {
      success: false,
      message: sr.auth.errors.generic,
      error: { code: "INTERNAL_ERROR", message: sr.auth.errors.generic },
    };
  }

  // Profile + default venue are created by the handle_new_user DB trigger
  // from auth metadata (full_name, venue_name).

  // Ensure we do not keep a session if Supabase returned one
  if (data.session) {
    await supabase.auth.signOut();
  }

  return {
    success: true,
    message: sr.auth.registerSuccess,
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
    return {
      success: false,
      message: mapAuthError(error.message),
      error: { code: "INTERNAL_ERROR", message: mapAuthError(error.message) },
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
    return {
      success: false,
      message: mapAuthError(error.message),
      error: { code: "INTERNAL_ERROR", message: mapAuthError(error.message) },
    };
  }

  return {
    success: true,
    message: sr.auth.passwordUpdated,
  };
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
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(parsed.data.nextPath)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return {
      success: false,
      message: sr.auth.errors.oauthFailed,
      error: actionError("INTERNAL_ERROR", sr.auth.errors.oauthFailed).error,
    };
  }

  return { success: true, url: data.url };
}
