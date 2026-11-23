import type { ReactNode } from "react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";
import { APP_NAME } from "@/lib/config/app";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function AuthShell({ title, subtitle, children, className }: AuthShellProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-6">
      <div className={cn(
        "w-full min-w-0 max-w-[420px] rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:p-6",
        className
      )}>
        <header className="mb-6 grid gap-2">
          <Link href="/" className="focus-ring mb-2 inline-flex min-h-11 w-fit items-center gap-2 rounded-md font-semibold text-text">
            <LogoMark className="size-9" />
            <span>{APP_NAME}</span>
          </Link>
          <h1>{title}</h1>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </header>
        <div className="[&>div]:gap-4 [&_form]:gap-3">{children}</div>
        <footer className="mt-4 border-t border-border pt-2 text-center">
          <Link href="/premium" className="focus-ring inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-text-2 hover:underline">
            {sr.auth.pricingLink}
          </Link>
        </footer>
      </div>
    </main>
  );
}
