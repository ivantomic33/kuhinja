"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { clearClientUserState } from "@/lib/auth/clear-client-state";
import { signOutAction } from "@/lib/auth/actions";
import { sr } from "@/lib/i18n/sr";

export function SignOutButton() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      // Wipe caches / IDB / React Query before cookies redirect away.
      await clearClientUserState(queryClient);
    } catch {
      // Still sign out even if a storage API fails.
    }
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
