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
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-text"
          >
            <LogoMark className="size-9" />
            {sr.app.name}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5" aria-label="Glavna navigacija">
            <Link href="/#features" className="hidden text-sm text-muted hover:text-text md:block">Funkcije</Link>
            <Link href="/#pricing" className="hidden text-sm text-muted hover:text-text md:block">Cenovnik</Link>
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded-[var(--radius-input)] px-2 text-sm text-muted hover:text-text"
            >
              {sr.marketing.navLogin}
            </Link>
            <Link
              href="/register"
              className="flex min-h-11 items-center rounded-[var(--radius-input)] bg-accent px-4 text-sm font-semibold text-background hover:opacity-90"
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
