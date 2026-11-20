"use client";

import { AuthShell } from "@/components/auth/AuthShell";
import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";

export default function LoginError({ reset }: { reset: () => void }) {
  return <AuthShell title={sr.auth.signIn}><RouteError reset={reset} message="Prijava nije učitana." /></AuthShell>;
}
