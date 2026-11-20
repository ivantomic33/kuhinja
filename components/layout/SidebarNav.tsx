"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  BookOpenText,
  Boxes,
  CalendarDays,
  Carrot,
  Crown,
  LayoutDashboard,
  PanelLeft,
  Settings2,
} from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { sr } from "@/lib/i18n/sr";
import { stockSr } from "@/lib/i18n/stock";
import { cn } from "@/lib/utils/cn";
import { ProfileMenu } from "./ProfileMenu";

const MAIN_NAV = [
  {
    href: "/dashboard",
    label: "Kontrolna tabla",
    tip: "Kontrolna tabla",
    icon: LayoutDashboard,
    match: (path: string) => path === "/dashboard" || path.startsWith("/shift"),
  },
  {
    href: "/recipes",
    label: "Recepti",
    tip: "Recepti",
    icon: BookOpenText,
    match: (path: string) =>
      path.startsWith("/recipes") || path.startsWith("/scaler"),
  },
  {
    href: "/ingredients",
    label: "Sastojci",
    tip: "Sastojci",
    icon: Carrot,
    match: (path: string) => path.startsWith("/ingredients"),
  },
  {
    href: "/trebovanje",
    label: stockSr.nav,
    tip: stockSr.nav,
    icon: Boxes,
    match: (path: string) => path.startsWith("/trebovanje"),
  },
  {
    href: "/raspored",
    label: "Raspored",
    tip: "Raspored",
    icon: CalendarDays,
    match: (path: string) => path.startsWith("/raspored"),
  },
  {
    href: "/premium",
    label: "Premium",
    tip: "Premium",
    icon: Crown,
    match: (path: string) => path.startsWith("/premium"),
    trialPill: true,
  },
  {
    href: "/settings",
    label: "Podešavanja",
    tip: "Podešavanja",
    icon: Settings2,
    match: (path: string) => path.startsWith("/settings"),
  },
] as const;

export type SidebarNavProps = {
  email?: string | null;
  displayName?: string | null;
  recipeUsage?: ReactNode;
  isPremium?: boolean;
  expanded?: boolean;
  collapsedDesktop?: boolean;
  onToggleCollapse?: () => void;
  onRequestClose?: () => void;
};

function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name || email || "M").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 1).toUpperCase();
}

export function SidebarNav({
  email,
  displayName,
  recipeUsage,
  isPremium = false,
  expanded = false,
  collapsedDesktop = false,
  onToggleCollapse,
  onRequestClose,
}: SidebarNavProps) {
  const pathname = usePathname() || "/dashboard";
  const initials = initialsFrom(displayName, email);

  // Desktop user-collapsed rail (≥1200)
  const desktopRail = collapsedDesktop;
  // Mid-width automatic rail when overlay is closed (720–1199)
  // Mobile always shows full labels when open (never rail mode)

  return (
    <aside
      data-expanded={expanded ? "true" : "false"}
      data-collapsed={desktopRail ? "true" : "false"}
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border",
        "bg-[var(--sidebar-bg)] px-3 py-4",
        "transition-[width,transform] duration-200 ease-out",
        // ≥1200: expanded or user-collapsed rail
        desktopRail
          ? "min-[1200px]:w-[var(--sidebar-rail)]"
          : "min-[1200px]:w-[var(--sidebar)]",
        // 720–1199: rail by default, overlay when expanded
        expanded
          ? "max-[1199px]:w-[var(--sidebar)] max-[1199px]:shadow-[16px_0_48px_rgba(0,0,0,.5)]"
          : "max-[1199px]:w-[var(--sidebar-rail)]",
        // ≤719: off-canvas unless expanded; always full width when open
        expanded
          ? "max-[719px]:translate-x-0 max-[719px]:w-[var(--sidebar)]"
          : "max-[719px]:-translate-x-full max-[719px]:w-[var(--sidebar)]"
      )}
    >
      {/* Brand row */}
      <div
        className={cn(
          "flex min-h-14 items-center gap-3 px-2 pb-[18px] pt-1.5",
          // Rail stacking: desktop collapsed OR mid-width not expanded
          desktopRail && "min-[1200px]:flex-col min-[1200px]:items-center min-[1200px]:gap-2",
          !expanded &&
            "max-[1199px]:flex-col max-[1199px]:items-center max-[1199px]:gap-2 max-[719px]:flex-row max-[719px]:items-center"
        )}
      >
        <Link
          href="/dashboard"
          onClick={onRequestClose}
          className="flex min-w-0 items-center gap-3 rounded-[10px] outline-none"
        >
          <LogoMark className="size-9" />
          <span
            className={cn(
              "truncate text-[length:var(--fs-lg)] font-bold tracking-[-0.01em] text-text",
              desktopRail && "min-[1200px]:hidden",
              !expanded && "max-[1199px]:hidden max-[719px]:inline"
            )}
          >
            {sr.app.name}
          </span>
        </Link>

        <div
          className={cn(
            "ml-auto flex items-center gap-1",
            desktopRail && "min-[1200px]:ml-0",
            !expanded && "max-[1199px]:ml-0 max-[719px]:ml-auto"
          )}
        >
          <span
            className={cn(
              desktopRail && "min-[1200px]:hidden",
              !expanded && "max-[1199px]:hidden"
            )}
          >
            <OfflineIndicator />
          </span>
          <button
            type="button"
            aria-label="Skupi / proširi meni"
            onClick={onToggleCollapse}
            className="icon-btn size-10"
          >
            <PanelLeft className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav
        aria-label="Glavna navigacija"
        className="flex flex-1 flex-col gap-1 overflow-y-auto"
      >
        {MAIN_NAV.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          const isRailVisual =
            (desktopRail && true) || (!expanded && true);
          // Labels hidden in rail modes; always shown when mobile drawer open
          void isRailVisual;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={item.href === "/recipes" || item.href === "/ingredients" ? false : undefined}
              data-tip={item.tip}
              data-screen={item.href === "/raspored" ? "raspored" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={onRequestClose}
              className={cn(
                "group relative flex h-11 items-center gap-2 rounded-[10px] px-2 text-[length:var(--fs-base)] font-medium no-underline",
                "transition-colors duration-150 outline-none",
                active
                  ? "bg-[var(--accent-soft)] text-accent"
                  : "text-[var(--text-2)] hover:bg-surface-2 hover:text-text",
                desktopRail && "min-[1200px]:justify-center min-[1200px]:px-0",
                !expanded &&
                  "max-[1199px]:justify-center max-[1199px]:px-0 max-[719px]:justify-start max-[719px]:px-3"
              )}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2.5 bottom-2.5 left-[-12px] w-[3px] rounded-r-[3px] bg-accent",
                    desktopRail && "min-[1200px]:hidden",
                    !expanded && "max-[1199px]:hidden max-[719px]:block"
                  )}
                />
              ) : null}
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-[7px]",
                  active && "bg-[var(--accent-soft)]"
                )}
                aria-hidden="true"
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span
                className={cn(
                  "truncate",
                  desktopRail && "min-[1200px]:hidden",
                  !expanded && "max-[1199px]:hidden max-[719px]:inline"
                )}
              >
                {item.label}
              </span>
              {"trialPill" in item && item.trialPill && !isPremium ? (
                <span
                  className={cn(
                    "ml-auto rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11.5px] font-semibold text-accent",
                    desktopRail && "min-[1200px]:hidden",
                    !expanded && "max-[1199px]:hidden max-[719px]:inline-flex"
                  )}
                >
                  14 dana
                </span>
              ) : null}

              {/* Rail tooltip */}
              <span
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute left-[calc(100%+12px)] z-50 whitespace-nowrap rounded-lg border border-border-strong bg-surface-3 px-2.5 py-1.5 text-[length:var(--fs-sm)] text-text shadow-lg",
                  "hidden",
                  desktopRail &&
                    "min-[1200px]:group-hover:block min-[1200px]:group-focus-visible:block",
                  !expanded &&
                    "max-[1199px]:group-hover:block max-[1199px]:group-focus-visible:block max-[719px]:!hidden"
                )}
              >
                {item.tip}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-3 pt-3">
        {/* Plan card — hidden in rail */}
        <div
          className={cn(
            "rounded-xl border border-border bg-surface p-3.5",
            desktopRail && "min-[1200px]:hidden",
            !expanded && "max-[1199px]:hidden max-[719px]:block"
          )}
        >
          {isPremium ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-text">Premium</p>
              <span className="text-[length:var(--fs-xs)] text-[var(--text-3)]">
                Aktivan
              </span>
            </div>
          ) : (
            <>
              {recipeUsage}
              <Link
                href="/premium"
                onClick={onRequestClose}
                className={cn(
                  "mt-3 flex h-9 w-full items-center justify-center rounded-[10px] border border-border-strong",
                  "bg-surface-2 text-[length:var(--fs-sm)] font-semibold text-text no-underline",
                  "transition-colors hover:bg-surface-3"
                )}
              >
                Nadogradi na Premium
              </Link>
            </>
          )}
        </div>

        {/* User chip */}
        <div
          className={cn(
            desktopRail && "min-[1200px]:flex min-[1200px]:justify-center",
            !expanded &&
              "max-[1199px]:flex max-[1199px]:justify-center max-[719px]:block"
          )}
        >
          <ProfileMenu
            email={email}
            displayName={displayName}
            initials={initials}
            compact={false}
            forceCompactClass={cn(
              desktopRail &&
                "min-[1200px]:[&_.user-meta]:hidden min-[1200px]:[&_.user-chip]:border-0 min-[1200px]:[&_.user-chip]:bg-transparent min-[1200px]:[&_.user-chip]:p-0 min-[1200px]:[&_.user-chip]:min-h-0 min-[1200px]:[&_.user-chip]:justify-center",
              !expanded &&
                "max-[1199px]:[&_.user-meta]:hidden max-[1199px]:[&_.user-chip]:border-0 max-[1199px]:[&_.user-chip]:bg-transparent max-[1199px]:[&_.user-chip]:p-0 max-[1199px]:[&_.user-chip]:min-h-0 max-[1199px]:[&_.user-chip]:justify-center max-[719px]:[&_.user-meta]:!flex max-[719px]:[&_.user-chip]:!border max-[719px]:[&_.user-chip]:!bg-surface max-[719px]:[&_.user-chip]:!p-2.5 max-[719px]:[&_.user-chip]:!min-h-14"
            )}
          />
        </div>
      </div>
    </aside>
  );
}
