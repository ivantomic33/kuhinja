import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { sr } from "@/lib/i18n/sr";

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background text-text">
      <header className="sticky top-0 z-40 border-b border-border bg-background">
        <div className="page-gutter mx-auto flex h-16 max-w-app items-center justify-between gap-3 md:h-20">
          <Link
            href="/"
            className="focus-ring flex min-h-11 min-w-11 items-center gap-2 rounded-md text-lg font-semibold tracking-tight text-text sm:text-2xl"
          >
            <LogoMark className="size-8 shrink-0" />
            {sr.app.name}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5" aria-label="Glavna navigacija">
            <Link href="/#features" className="focus-ring hidden min-h-11 min-w-11 items-center rounded-md text-sm text-muted hover:text-text md:inline-flex">Funkcije</Link>
            <Link href="/#cenovnik" className="focus-ring hidden min-h-11 min-w-11 items-center rounded-md text-sm text-muted hover:text-text md:inline-flex">{sr.marketing.landing.pricing}</Link>
            <Link
              href="/login"
              className="focus-ring flex min-h-11 min-w-11 items-center rounded-[var(--radius-input)] px-2 text-sm text-muted hover:text-text"
            >
              {sr.marketing.navLogin}
            </Link>
            <Link
              href="/register"
              className="focus-ring flex min-h-11 min-w-11 items-center rounded-[var(--radius-input)] bg-accent px-3 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
            >
              {sr.marketing.navRegister}
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
