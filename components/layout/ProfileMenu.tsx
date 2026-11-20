"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { clearClientUserState } from "@/lib/auth/clear-client-state";
import { signOutAction } from "@/lib/auth/actions";
import { APP_NAME } from "@/lib/config/app";
import { sr } from "@/lib/i18n/sr";
import { cn } from "@/lib/utils/cn";

export type ProfileMenuProps = {
  email?: string | null;
  displayName?: string | null;
  initials?: string;
  compact?: boolean;
  forceCompactClass?: string;
};

export function ProfileMenu({
  email,
  displayName,
  initials = APP_NAME[0],
  compact = false,
  forceCompactClass,
}: ProfileMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const label = displayName || email || sr.app.name;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setLoading(true);
    try {
      await clearClientUserState(queryClient);
    } catch {
      // Still sign out if storage APIs fail.
    }
    await signOutAction();
  }

  return (
    <div ref={rootRef} className={cn("relative", forceCompactClass)}>
      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute bottom-[calc(100%+8px)] left-0 z-50 min-w-[200px]",
            "rounded-[var(--radius-lg)] border border-border bg-elevated p-1 shadow-xl",
            compact ? "right-auto" : "right-0"
          )}
        >
          <Link
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm text-text hover:bg-surface-2"
          >
            <Settings className="size-4 text-muted" aria-hidden="true" />
            {sr.settings.title}
          </Link>
          <button
            role="menuitem"
            type="button"
            disabled={loading}
            onClick={() => {
              void handleSignOut();
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-md)] px-3 text-sm text-muted enabled:hover:bg-surface-2 enabled:hover:text-text disabled:cursor-not-allowed disabled:text-text-3"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {sr.auth.signOut}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "user-chip flex w-full min-h-14 items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5",
          "text-left outline-none transition-colors duration-150",
          "hover:bg-surface-2",
          compact && "min-h-0 border-0 bg-transparent p-0 justify-center"
        )}
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-sm font-semibold text-text">
          {initials}
        </span>
        <span className={cn("user-meta min-w-0 flex-1", compact && "hidden")}>
          <span className="block truncate text-[length:var(--fs-sm)] font-semibold text-text">
            {label}
          </span>
          {email ? (
            <span className="block truncate text-[length:var(--fs-xs)] text-[var(--text-3)]">
              {email}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  );
}
