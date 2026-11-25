"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { acceptInviteAction } from "@/lib/workspace/actions";
import { sr } from "@/lib/i18n/sr";

export function AcceptInviteButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <PrimaryButton
        loading={pending}
        onClick={() => {
          startTransition(async () => {
            setError(null);
            const result = await acceptInviteAction({ token });
            if ("error" in result && result.error) {
              setError(result.error.message);
              return;
            }
            router.replace("/dashboard");
            router.refresh();
          });
        }}
      >
        {sr.workspace.acceptInvite}
      </PrimaryButton>
      {error ? <p className="text-ui-sm text-danger">{error}</p> : null}
    </div>
  );
}
