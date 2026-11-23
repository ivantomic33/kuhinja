"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CircleAlert } from "lucide-react";
import { PrimaryButton } from "./PrimaryButton";
import { PageHeader } from "./PageHeader";
import { sr } from "@/lib/i18n/sr";

export default function RouteError({ message = sr.listStates.error, title, description, reset }: {
  message?: string;
  title?: string;
  description?: string;
  reset?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      {title ? <PageHeader title={title} description={description} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-surface p-4">
        <p role="alert" className="flex items-center gap-2 text-sm text-danger-text">
          <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
          {message}
        </p>
        <PrimaryButton variant="secondary" loading={pending} onClick={() => {
          startTransition(() => {
            router.refresh();
            reset?.();
          });
        }}>{sr.common.retry}</PrimaryButton>
      </div>
    </>
  );
}
