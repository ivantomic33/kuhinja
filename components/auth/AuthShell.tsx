import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { APP_NAME } from "@/lib/config/app";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";
import { Check } from "lucide-react";
import { FoodCostMockup } from "@/components/marketing/FoodCostMockup";

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function AuthShell({
  title,
  subtitle,
  children,
  className,
}: AuthShellProps) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-8 lg:px-12">
      <div className="grid w-full max-w-[1120px] items-center gap-16 lg:grid-cols-[1.1fr_1fr]">
      <aside className="hidden flex-col gap-7 lg:flex">
        <Link href="/" className="inline-flex w-fit items-center gap-3 text-2xl font-semibold tracking-tight"><LogoMark className="size-10" />{APP_NAME}</Link>
        <div><p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-accent">Vaša kuhinja. Pod kontrolom.</p><h2 className="max-w-md text-4xl font-semibold leading-[1.15] tracking-[-0.04em]">Dobra priprema počinje jasnim brojevima.</h2></div>
        <FoodCostMockup />
        <p className="inline-flex items-center gap-2 text-sm text-muted"><Check className="size-4" />Recepti, troškovi i priprema smene.</p>
      </aside>
      <div
        className={cn(
          "mx-auto w-full max-w-md rounded-[var(--radius-xl)] border border-border bg-surface p-6 sm:p-8 lg:p-10",
          className
        )}
      >
        <div className="mb-8 flex flex-col gap-2">
          <div className="mb-4 flex items-center gap-2 lg:hidden">
            <LogoMark className="size-8" />
            <p className="text-sm font-medium text-accent">{APP_NAME}</p>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-muted">{subtitle}</p>
          ) : null}
        </div>
        <div className="[&>div]:gap-5 [&_form]:gap-4">{children}</div>
      </div>
      </div>
    </div>
  );
}
