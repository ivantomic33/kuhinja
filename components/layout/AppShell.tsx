"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { InstallHint } from "@/components/pwa/InstallHint";
import { OfflineIndicator } from "@/components/pwa/OfflineIndicator";
import { PlanBootstrap } from "@/components/plan/PlanBootstrap";
import { PlanProvider } from "@/components/plan/PlanProvider";
import { ToastProvider } from "@/components/ui/Toast";
import type { PlanQueryResult } from "@/lib/hooks/usePlan";
import { APP_NAME } from "@/lib/config/app";
import { cn } from "@/lib/utils/cn";
import { SidebarNav } from "./SidebarNav";
import { BottomNav } from "./BottomNav";

export type AppShellProps = {
  children: ReactNode;
  email?: string | null;
  displayName?: string | null;
  recipeUsage?: ReactNode;
  isPremium?: boolean;
  /** Server-resolved plan seed for React Query (avoids client waterfall). */
  initialPlan?: PlanQueryResult | null;
};

export function AppShell({
  children,
  email,
  displayName,
  recipeUsage,
  isPremium = false,
  initialPlan = null,
}: AppShellProps) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [collapsedDesktop, setCollapsedDesktop] = useState(false);

  // Close overlay drawer on navigation
  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  // Close overlay when resizing up to desktop expanded band
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 1200) {
        setExpanded(false);
      }
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const railCollapsed = collapsedDesktop;

  return (
    <div className="flex min-h-dvh bg-background text-text">
      {/* Scrim for mid-width / mobile expanded sidebar */}
      {expanded ? (
        <button
          type="button"
          aria-label="Zatvori meni"
          className="fixed inset-0 z-30 bg-black/50 min-[1200px]:hidden"
          onClick={() => setExpanded(false)}
        />
      ) : null}

      <SidebarNav
        email={email}
        displayName={displayName}
        recipeUsage={recipeUsage}
        isPremium={isPremium}
        expanded={expanded}
        collapsedDesktop={railCollapsed}
        onToggleCollapse={() => {
          // ≥1200: toggle rail; <1200: toggle overlay
          if (typeof window !== "undefined" && window.innerWidth >= 1200) {
            setCollapsedDesktop((v) => !v);
          } else {
            setExpanded((v) => !v);
          }
        }}
        onRequestClose={() => setExpanded(false)}
      />

      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out",
          railCollapsed
            ? "min-[1200px]:pl-[var(--sidebar-rail)]"
            : "min-[1200px]:pl-[var(--sidebar)]",
          "max-[1199px]:pl-[var(--sidebar-rail)] max-[719px]:pl-0"
        )}
      >
        {/* Mobile topbar ≤719px */}
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background px-4 py-3 min-[720px]:hidden">
          <button
            type="button"
            aria-label="Otvori meni"
            onClick={() => setExpanded(true)}
            className="icon-btn bordered"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <LogoMark className="size-8" />
          <p className="text-base font-bold tracking-tight text-text">
            {APP_NAME}
          </p>
          <div className="ml-auto">
            <OfflineIndicator />
          </div>
        </header>

        <main className="flex-1">
          <div className={cn(
            "app-content",
            pathname === "/trebovanje" && "app-content-stock"
          )}>
            <div className="mb-4 empty:hidden">
              <InstallHint />
            </div>
            <PlanProvider>
              {initialPlan ? <PlanBootstrap initial={initialPlan} /> : null}
              <ToastProvider>{children}</ToastProvider>
            </PlanProvider>
          </div>
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
