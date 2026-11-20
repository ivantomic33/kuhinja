"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { cn } from "@/lib/utils/cn";

type WaitlistButtonProps = {
  planLabel?: string;
  className?: string;
  fullWidth?: boolean;
};

/**
 * Team waitlist CTA — local ack only until a real waitlist endpoint exists.
 * TODO: wire email capture / provider.
 */
export function WaitlistButton({
  planLabel = "Team",
  className,
  fullWidth = true,
}: WaitlistButtonProps) {
  const [joined, setJoined] = useState(false);

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <PrimaryButton
        type="button"
        variant="secondary"
        fullWidth={fullWidth}
        disabled={joined}
        className="btn-waitlist min-h-[46px]"
        onClick={() => setJoined(true)}
      >
        {joined ? "Na waitlisti" : "Priključi se waitlisti"}
      </PrimaryButton>
      {joined ? (
        <p className="text-center text-[length:var(--fs-xs)] text-[var(--text-3)]">
          Javićemo vam kada {planLabel} bude dostupan.
        </p>
      ) : null}
    </div>
  );
}
