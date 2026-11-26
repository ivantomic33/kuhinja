"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpen,
  Carrot,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { signOutAction } from "@/lib/auth/actions";
import { matchesNavPath, workspaceLinks } from "./workspace-links";

const TABS = [
  {
    href: "/dashboard",
    short: "Tabla",
    icon: LayoutDashboard,
  },
  {
    href: "/recipes",
    short: sr.recipes.title,
    icon: BookOpen,
  },
  {
    href: "/ingredients",
    short: "Sastojci",
    icon: Carrot,
  },
  {
    href: "/settings",
    short: sr.settings.title,
    icon: Settings,
  },
] as const;

const MORE_LINKS = [
  ...workspaceLinks,
  { href: "/notifications", label: sr.notifications.navLabel, icon: Bell },
  { href: "/premium", label: sr.premium.title, icon: Sparkles },
];

export function BottomNav() {
  const pathname = usePathname() || "/dashboard";
  const [moreOpen, setMoreOpen] = useState(false);
  const activeMoreLink = MORE_LINKS.find(({ href }) => matchesNavPath(pathname, href));

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const desktop = window.matchMedia("(min-width: 48rem)");
    function closeOnDesktop() {
      if (desktop.matches) setMoreOpen(false);
    }
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [moreOpen]);

  return (
    <>
      <nav
        aria-label="Mobilna navigacija"
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 md:hidden",
          "border-t border-border bg-surface/95 backdrop-blur-xl",
          "bottom-nav-safe"
        )}
      >
        <div className="mx-auto flex h-[var(--bottom-nav-height)] max-w-3xl items-stretch justify-around px-1">
          {TABS.map(({ href, short, icon: Icon }) => {
            const active = matchesNavPath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "mobile-nav-item focus-ring flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1",
                  "rounded-sm text-ui-xs font-medium",
                  active ? "bg-[var(--accent-soft)] font-semibold text-accent" : "text-muted"
                )}
              >
                <Icon
                  className={cn("size-5", active && "stroke-[2.25]")}
                  aria-hidden="true"
                />
                <span className="max-w-full">{short}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            aria-current={activeMoreLink ? "location" : undefined}
            onClick={() => setMoreOpen(true)}
            className={cn(
              "mobile-nav-item focus-ring flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1",
              "rounded-sm text-ui-xs font-medium",
              moreOpen || activeMoreLink ? "bg-[var(--accent-soft)] font-semibold text-accent" : "text-muted"
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            <span>{sr.common.more}</span>
          </button>
        </div>
      </nav>
      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={sr.common.more}>
        {MORE_LINKS.map(({ href, label, icon: Icon }) => {
          const active = activeMoreLink?.href === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm hover:bg-surface-2",
                active ? "bg-[var(--accent-soft)] text-accent" : "text-text"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
        <button
          type="button"
          className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm text-muted hover:bg-surface-2 hover:text-text"
          onClick={() => {
            void signOutAction();
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {sr.auth.signOut}
        </button>
      </BottomSheet>
    </>
  );
}
