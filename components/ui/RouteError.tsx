"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PrimaryButton } from "./PrimaryButton";
import { sr } from "@/lib/i18n/sr";

export default function RouteError({ message = "Stranica nije učitana.", reset }: {
  message?: string;
  reset?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-surface p-4">
      <p role="alert" className="text-sm text-danger-text">{message}</p>
      <PrimaryButton variant="secondary" loading={pending} onClick={() => {
        startTransition(() => {
          router.refresh();
          reset?.();
        });
      }}>{sr.common.retry}</PrimaryButton>
    </div>
  );
}
