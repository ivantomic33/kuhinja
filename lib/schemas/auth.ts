import { z } from "zod";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { sr } from "@/lib/i18n/sr";
import { registerLegalConsentSchema } from "@/lib/schemas/legal";

const emailField = z
  .string()
  .trim()
  .min(1, sr.auth.errors.required)
  .email(sr.auth.errors.emailInvalid);

const passwordField = z
  .string()
  .min(1, sr.auth.errors.required)
  .min(8, sr.auth.errors.passwordMin);

export const loginSchema = z
  .object({
    email: emailField,
    password: passwordField,
  })
  .strict();

export const registerSchema = z
  .object({
    email: emailField,
    password: passwordField,
    fullName: z.string().trim().min(1, sr.auth.errors.required).max(120),
    venueName: z.string().trim().min(1, sr.auth.errors.required).max(120),
    ...registerLegalConsentSchema.shape,
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailField,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, sr.auth.errors.required),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: sr.auth.errors.passwordMismatch,
    path: ["confirmPassword"],
  });

export const googleOAuthInputSchema = z
  .object({
    nextPath: z
      .string()
      .max(500)
      .default("/dashboard")
      .refine((value) => safeRedirectPath(value) === value, "Invalid redirect path"),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
