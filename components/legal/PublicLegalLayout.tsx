import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/LogoMark";
import { SiteFooterLinks } from "@/components/legal/SiteFooterLinks";
import { AnalyticsConsentBanner } from "@/components/legal/AnalyticsConsentBanner";
import { sr } from "@/lib/i18n/sr";

export function PublicLegalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-text">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="page-gutter mx-auto flex h-16 max-w-app items-center justify-between gap-4">
          <Link
            href="/"
            className="focus-ring flex min-h-11 items-center gap-3 rounded-md text-xl font-semibold tracking-tight text-text"
          >
            <LogoMark className="size-8" />
            {sr.app.name}
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Glavna navigacija">
            <Link
              href="/faq"
              className="focus-ring hidden min-h-11 items-center rounded-md px-2 text-sm text-muted hover:text-text sm:inline-flex"
            >
              FAQ
            </Link>
            <Link
              href="/login"
              className="focus-ring flex min-h-11 items-center rounded-[var(--radius-input)] px-2 text-sm text-muted hover:text-text"
            >
              {sr.marketing.navLogin}
            </Link>
            <Link
              href="/register"
              className="focus-ring flex min-h-11 items-center rounded-[var(--radius-input)] bg-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
            >
              {sr.marketing.navRegister}
            </Link>
          </nav>
        </div>
      </header>

      <main className="page-gutter mx-auto max-w-app py-10">{children}</main>

      <footer className="border-t border-border py-8">
        <div className="page-gutter mx-auto flex max-w-app flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} {sr.app.name}
          </p>
          <SiteFooterLinks />
        </div>
      </footer>
      <AnalyticsConsentBanner />
    </div>
  );
}
