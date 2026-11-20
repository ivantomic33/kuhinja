"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { getGoogleOAuthUrl } from "@/lib/auth/actions";
import { sr } from "@/lib/i18n/sr";

type GoogleButtonProps = {
  nextPath?: string;
};

export function GoogleButton({ nextPath = "/dashboard" }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleGoogle() {
    setLoading(true);
    setError(undefined);

    const result = await getGoogleOAuthUrl(nextPath);

    if (!result.success || !result.url) {
      setError(result.message ?? sr.auth.errors.oauthFailed);
      setLoading(false);
      return;
    }

    window.location.assign(result.url);
  }

  return (
    <div className="flex flex-col gap-1">
      <PrimaryButton
        type="button"
        variant="ghost"
        fullWidth
        loading={loading}
        onClick={handleGoogle}
      >
        {sr.auth.continueWithGoogle}
      </PrimaryButton>
      {error ? (
        <p role="alert" className="text-center text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
