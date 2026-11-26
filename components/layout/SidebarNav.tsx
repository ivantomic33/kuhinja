"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode, type RefObject } from "react";
import {
  BookOpenText,
  Bell,
  Carrot,
  Crown,
  LayoutDashboard,
  PanelLeft,
  Settings2,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { useDialogFocus } from "@/components/ui/useDialogFocus";
import { APP_NAME } from "@/lib/config/app";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";
import { ProfileMenu } from "./ProfileMenu";
import { matchesNavPath, workspaceLinks } from "./workspace-links";

const NAV_GROUPS = [
  {
    title: "Kuhinja",
    links: [
      { href: "/dashboard", label: "Tabla", icon: LayoutDashboard },
      { href: "/recipes", label: sr.recipes.title, icon: BookOpenText },
      { href: "/ingredients", label: sr.ingredients.title, icon: Carrot },
      { href: "/notifications", label: sr.notifications.navLabel, icon: Bell },
      ...workspaceLinks,
    ],
  },
  {
    title: "Račun",
    links: [
      { href: "/premium", label: sr.premium.title, icon: Crown, trialPill: true },
      { href: "/settings", label: sr.settings.title, icon: Settings2 },
    ],
  },
] as const;

export type SidebarNavProps = {
  email?: string | null;
  displayName?: string | null;
  recipeUsage?: ReactNode;
  isPremium?: boolean;
  expanded?: boolean;
  collapsedDesktop?: boolean;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  onToggleCollapse?: (trigger: HTMLButtonElement) => void;
  onRequestClose?: () => void;
};

function initialsFrom(name?: string | null, email?: string | null): string {
  const source = (name || email || APP_NAME).trim();
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
  returnFocusRef,
  onToggleCollapse,
  onRequestClose,
}: SidebarNavProps) {
  const pathname = usePathname() || "/dashboard";
  const initials = initialsFrom(displayName, email);
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: expanded, onClose: () => onRequestClose?.(), panelRef, returnFocusRef });

  // Desktop user-collapsed rail (≥1200)
  const desktopRail = collapsedDesktop;
  // Mid-width automatic rail when overlay is closed (720–1199)
  // Mobile always shows full labels when open (never rail mode)

  return (
    <div
      id="app-sidebar"
      ref={panelRef}
      role={expanded ? "dialog" : "complementary"}
      aria-modal={expanded || undefined}
      aria-label={expanded ? "Navigacioni meni" : "Bočna traka"}
      tabIndex={expanded ? -1 : undefined}
      data-expanded={expanded ? "true" : "false"}
      data-collapsed={desktopRail ? "true" : "false"}
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border",
        "bg-[var(--sidebar-bg)] px-3 py-4",
        "transition-[width] duration-200 ease-out",
        // ≥1200: expanded or user-collapsed rail
        desktopRail
          ? "min-[1200px]:w-[var(--sidebar-rail)]"
          : "min-[1200px]:w-[var(--sidebar)]",
        // Tablet: rail by default, overlay when expanded.
        expanded
          ? "max-[1200px]:w-[var(--sidebar)] max-[1200px]:shadow-[var(--shadow-sidebar)]"
          : "max-[1200px]:w-[var(--sidebar-rail)]",
        // Mobile: remove the closed drawer from the tab order.
        expanded
          ? "max-md:w-[var(--sidebar)]"
          : "max-md:hidden"
      )}
    >
      {/* Brand row */}
      <div
        className={cn(
          "flex min-h-14 items-center gap-3 px-2 pb-5 pt-2",
          // Rail stacking: desktop collapsed OR mid-width not expanded
          desktopRail && "min-[1200px]:flex-col min-[1200px]:items-center min-[1200px]:gap-2",
          !expanded &&
            "max-[1200px]:flex-col max-[1200px]:items-center max-[1200px]:gap-2"
        )}
      >
        <Link
          href="/dashboard"
          aria-label={APP_NAME}
          onClick={onRequestClose}
          className="focus-ring flex min-h-11 min-w-11 items-center gap-3 rounded-lg max-[1200px]:justify-center"
        >
          <LogoMark className="size-9" />
          <span
            className={cn(
              "truncate text-ui-lg font-bold tracking-[-0.01em] text-text",
              desktopRail && "min-[1200px]:hidden",
              !expanded && "max-[1200px]:hidden"
            )}
          >
            {APP_NAME}
          </span>
        </Link>

        <div
          className={cn(
            "ml-auto flex items-center gap-1",
            desktopRail && "min-[1200px]:ml-0",
            !expanded && "max-[1200px]:ml-0"
          )}
        >
          <span
            className={cn(
              desktopRail && "min-[1200px]:hidden",
              !expanded && "max-[1200px]:hidden"
            )}
          >
            <OfflineIndicator />
          </span>
          <button
            type="button"
            aria-label={expanded ? "Zatvori meni" : "Skupi ili proširi meni"}
            aria-expanded={expanded ? true : undefined}
            onClick={(event) => expanded ? onRequestClose?.() : onToggleCollapse?.(event.currentTarget)}
            className="icon-btn focus-ring min-h-11 min-w-11"
          >
            {expanded ? <X className="size-5" aria-hidden="true" /> : <PanelLeft className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav
        aria-label="Glavna navigacija"
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-1 py-1"
      >
        {NAV_GROUPS.map(({ title, links }) => (
          <div
            key={links[0].href}
            role="group"
            aria-label={title}
            className="flex flex-col gap-1 border-t border-border pt-1"
          >
            <p
              aria-hidden="true"
              className={cn(
                "px-2 pt-1 text-xs font-medium text-muted",
                desktopRail && "min-[1200px]:hidden",
                !expanded && "max-[1200px]:hidden"
              )}
            >
              {title}
            </p>
            {links.map((item) => {
              const active = matchesNavPath(pathname, item.href);
              const showTrial = "trialPill" in item && item.trialPill && !isPremium;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-screen={item.href === "/raspored" ? "raspored" : undefined}
                  aria-current={active ? "page" : undefined}
                  onClick={onRequestClose}
                  className={cn(
                    "focus-ring group relative flex min-h-11 items-center gap-2 rounded-lg px-2 text-ui-base font-medium no-underline",
                    "transition-colors duration-150",
                    active
                      ? "bg-[var(--accent-soft)] text-accent"
                      : "text-text-2 hover:bg-surface-2 hover:text-text",
                    desktopRail && "min-[1200px]:justify-center min-[1200px]:px-0",
                    !expanded && "max-[1200px]:justify-center max-[1200px]:px-0"
                  )}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent"
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
                      desktopRail && "min-[1200px]:sr-only",
                      !expanded && "max-[1200px]:sr-only"
                    )}
                  >
                    {item.label}
                  </span>
                  {showTrial ? (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "ml-auto rounded-full bg-[var(--accent-soft)] px-2 py-1 text-ui-xs font-semibold text-accent",
                        desktopRail && "min-[1200px]:hidden",
                        !expanded && "max-[1200px]:hidden"
                      )}
                    >
                      14 dana
                    </span>
                  ) : null}

                  {/* Rail tooltip */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none fixed left-[var(--sidebar-rail)] z-50 whitespace-nowrap rounded-lg border border-border-strong bg-surface-3 px-3 py-2 text-ui-sm text-text shadow-lg",
                      "hidden",
                      desktopRail &&
                        "min-[1200px]:group-hover:block min-[1200px]:group-focus-visible:block",
                      !expanded &&
                        "md:max-[1200px]:group-hover:block md:max-[1200px]:group-focus-visible:block"
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-3 pt-3">
        {/* Plan card — hidden in rail */}
        <div
          className={cn(
            "rounded-xl border border-border bg-surface p-4",
            desktopRail && "min-[1200px]:hidden",
            !expanded && "max-[1200px]:hidden"
          )}
        >
          {isPremium ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-text">Premium</p>
              <span className="text-ui-xs text-text-3">
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
                  "focus-ring mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-border-strong",
                  "bg-surface-2 text-ui-sm font-semibold text-text no-underline",
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
              "max-[1200px]:flex max-[1200px]:justify-center"
          )}
        >
          <ProfileMenu
            email={email}
            displayName={displayName}
            initials={initials}
            forceCompactClass={cn(
              desktopRail &&
                "min-[1200px]:[&_.user-meta]:sr-only min-[1200px]:[&_.user-chip]:border-0 min-[1200px]:[&_.user-chip]:bg-transparent min-[1200px]:[&_.user-chip]:p-0 min-[1200px]:[&_.user-chip]:min-h-11 min-[1200px]:[&_.user-chip]:justify-center",
              !expanded &&
                "max-[1200px]:[&_.user-meta]:sr-only max-[1200px]:[&_.user-chip]:border-0 max-[1200px]:[&_.user-chip]:bg-transparent max-[1200px]:[&_.user-chip]:p-0 max-[1200px]:[&_.user-chip]:min-h-11 max-[1200px]:[&_.user-chip]:justify-center"
            )}
          />
        </div>
      </div>
    </div>
  );
}
