"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sr } from "@/lib/i18n/sr";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthActionResult = {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
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
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { success: false, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { success: false, message: mapAuthError(error.message) };
  }

  return { success: true };
}

export async function registerAction(
  input: RegisterInput
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { success: false, fieldErrors };
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
    return { success: false, message: mapAuthError(error.message) };
  }

  if (!data.user) {
    return { success: false, message: sr.auth.errors.generic };
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
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { success: false, fieldErrors };
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { success: false, message: mapAuthError(error.message) };
  }

  return {
    success: true,
    message: sr.auth.resetEmailSent,
  };
}

export async function resetPasswordAction(
  input: ResetPasswordInput
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return { success: false, fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { success: false, message: mapAuthError(error.message) };
  }

  return {
    success: true,
    message: sr.auth.passwordUpdated,
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function getGoogleOAuthUrl(
  nextPath = "/dashboard"
): Promise<AuthActionResult & { url?: string }> {
  const origin = await getOrigin();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return { success: false, message: sr.auth.errors.oauthFailed };
  }

  return { success: true, url: data.url };
}
