"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";

export default function RegisterError({ reset }: { reset: () => void }) {
  return <AuthShell title={sr.auth.signUp}><RouteError reset={reset} message="Registracija nije učitana." /></AuthShell>;
}
