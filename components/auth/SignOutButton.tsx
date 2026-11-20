"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { signOutAction } from "@/lib/auth/actions";
import { sr } from "@/lib/i18n/sr";

export function SignOutButton() {
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    await signOutAction();
  }

  return (
    <PrimaryButton
      type="button"
      variant="ghost"
      fullWidth
      loading={loading}
      onClick={handleSignOut}
    >
      {sr.auth.signOut}
    </PrimaryButton>
  );
}
