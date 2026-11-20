"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Carrot,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { signOutAction } from "@/lib/auth/actions";
import { matchesWorkspace, workspaceLinks } from "./workspace-links";

const TABS = [
  {
    href: "/dashboard",
    label: sr.dashboard.title,
    short: "Tabla",
    icon: LayoutDashboard,
    match: (path: string) => path === "/dashboard",
  },
  {
    href: "/recipes",
    label: sr.recipes.title,
    short: sr.recipes.title,
    icon: BookOpen,
    match: (path: string) => path.startsWith("/recipes"),
  },
  {
    href: "/ingredients",
    label: sr.recipes.foodCost.ingredients,
    short: "Sastojci",
    icon: Carrot,
    match: (path: string) => path.startsWith("/ingredients"),
  },
  {
    href: "/settings",
    label: sr.settings.title,
    short: "Nalog",
    icon: Settings,
    match: (path: string) => path.startsWith("/settings"),
  },
] as const;

export function BottomNav() {
  const pathname = usePathname() || "/dashboard";
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMoreOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  return (
    <nav
      aria-label="Mobilna navigacija"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 min-[720px]:hidden",
        "border-t border-border bg-surface/95 backdrop-blur-xl",
        "pb-[max(8px,env(safe-area-inset-bottom))]"
      )}
    >
      <div className="mx-auto flex h-[var(--bottom-nav-height)] max-w-3xl items-stretch justify-around px-1">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={tab.href === "/recipes" || tab.href === "/ingredients" ? false : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5",
                "rounded-[var(--radius-sm)] text-[11px] font-medium outline-none",
                "focus-visible:ring-2 focus-visible:ring-accent",
                active ? "text-accent" : "text-muted"
              )}
            >
              <Icon
                className={cn("size-5", active && "stroke-[2.25]")}
                aria-hidden="true"
              />
              <span className="truncate px-0.5">{tab.short}</span>
            </Link>
          );
        })}

        <div className="relative flex flex-1" ref={menuRef}>
          <button
            ref={triggerRef}
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-0.5",
              "rounded-[var(--radius-sm)] text-[11px] font-medium outline-none",
              "focus-visible:ring-2 focus-visible:ring-accent",
              moreOpen || pathname.startsWith("/premium") || workspaceLinks.some(({ href }) => matchesWorkspace(pathname, href))
                ? "text-accent"
                : "text-muted"
            )}
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            <span>Više</span>
          </button>

          {moreOpen ? (
            <div
              className={cn(
                "absolute bottom-[calc(100%+8px)] right-1 z-50 max-h-[calc(100dvh-8rem)] w-52 overflow-y-auto",
                "rounded-[var(--radius-lg)] border border-border bg-surface p-1 shadow-xl"
              )}
            >
              {workspaceLinks.map(({ href, label, icon: Icon }) => {
                const active = matchesWorkspace(pathname, href);
                return <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm hover:bg-surface-2", active ? "text-accent" : "text-text")}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                </Link>;
              })}
              <Link
                href="/premium"
                onClick={() => setMoreOpen(false)}
                className="flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm text-text hover:bg-surface-2"
              >
                <Sparkles className="size-4 text-accent" aria-hidden="true" />
                {sr.premium.title}
              </Link>
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
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
