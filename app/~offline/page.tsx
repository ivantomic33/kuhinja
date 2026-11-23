import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { BentoCard } from "@/components/ui/BentoCard";
import { sr } from "@/lib/i18n/sr";

export const metadata: Metadata = {
  title: sr.pwa.offlineTitle,
  robots: { index: false, follow: false },
};

export default function OfflineFallbackPage() {
  return (
    <main className="page-gutter mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 bg-background py-8 text-text">
      <BentoCard>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CloudOff className="size-8 text-muted" aria-hidden="true" />
          <h1 className="text-2xl font-semibold tracking-tight">{sr.pwa.offlineTitle}</h1>
          <p className="text-base text-muted">{sr.pwa.offlineBody}</p>
          <Link
            href="/dashboard"
            className="mt-1 inline-flex min-h-[44px] items-center rounded-[var(--radius-input)] border border-border bg-surface-2 px-3 text-sm font-medium text-text"
          >
            {sr.pwa.openDashboard}
          </Link>
        </div>
      </BentoCard>
    </main>
  );
}
