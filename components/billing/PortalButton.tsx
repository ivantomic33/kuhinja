"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { openCustomerPortal } from "@/lib/billing/invoke";
import { sr } from "@/lib/i18n/sr";

type PortalButtonProps = {
  disabled?: boolean;
};

export function PortalButton({ disabled = false }: PortalButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleClick() {
    setLoading(true);
    setError(undefined);

    const result = await openCustomerPortal();
    if ("error" in result) {
      setError(sr.billing.portalError);
      setLoading(false);
      return;
    }

    window.location.assign(result.url);
  }

  return (
    <div className="flex flex-col gap-1">
      <PrimaryButton
        type="button"
        fullWidth
        disabled={disabled}
        loading={loading}
        onClick={handleClick}
      >
        Upravljaj pretplatom
      </PrimaryButton>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
