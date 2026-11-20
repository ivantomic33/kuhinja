import { z } from "zod";
import { sr } from "@/lib/i18n/sr";

const emailField = z
  .string()
  .trim()
  .min(1, sr.auth.errors.required)
  .email(sr.auth.errors.emailInvalid);

const passwordField = z
  .string()
  .min(1, sr.auth.errors.required)
  .min(8, sr.auth.errors.passwordMin);

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, sr.auth.errors.required),
});

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  fullName: z.string().trim().min(1, sr.auth.errors.required).max(120),
  venueName: z.string().trim().min(1, sr.auth.errors.required).max(120),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, sr.auth.errors.required),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: sr.auth.errors.passwordMismatch,
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
