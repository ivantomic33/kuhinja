"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
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
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const openAtEnd = useRef(false);

  const label = displayName || email || sr.app.name;
  const secondaryEmail = email && email !== label ? email : null;

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)');
    if (items) items[openAtEnd.current ? items.length - 1 : 0]?.focus();
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function handleMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      requestAnimationFrame(() => setOpen(false));
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "Home") items[0].focus();
    else if (event.key === "End") items.at(-1)?.focus();
    else items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
  }

  async function handleSignOut() {
    setLoading(true);
    try {
      await clearClientUserState(queryClient, { preserveSession: true });
    } catch {
      // Still sign out if storage APIs fail.
    }
    await signOutAction();
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative", forceCompactClass)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          openAtEnd.current = false;
          setOpen(value => !value);
        }}
        onKeyDown={event => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          event.preventDefault();
          openAtEnd.current = event.key === "ArrowUp";
          setOpen(true);
        }}
        className={cn(
          "user-chip focus-ring flex min-h-14 w-full min-w-11 items-center gap-3 rounded-xl border border-border bg-surface p-3",
          "text-left transition-colors duration-150",
          "hover:bg-surface-2",
          compact && "min-h-11 justify-center border-0 bg-transparent p-0"
        )}
      >
        <span className="sr-only">Meni naloga:</span>
        <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-sm font-semibold text-text">
          {initials}
        </span>
        <span className={cn("user-meta min-w-0 flex-1", compact && "sr-only")}>
          <span className="block truncate text-ui-sm font-semibold text-text">
            {label}
          </span>
          {secondaryEmail ? (
            <span className="block truncate text-ui-xs text-text-3">
              {secondaryEmail}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="Meni naloga"
          onKeyDown={handleMenuKey}
          className="absolute bottom-[calc(100%+8px)] left-0 z-50 min-w-[200px] rounded-lg border border-border bg-elevated p-1 shadow-xl"
        >
          <Link
            role="menuitem"
            tabIndex={-1}
            href="/settings"
            onClick={() => setOpen(false)}
            className="focus-ring flex min-h-11 items-center gap-2 rounded-md px-3 text-sm text-text hover:bg-surface-2"
          >
            <Settings className="size-4 text-muted" aria-hidden="true" />
            {sr.settings.title}
          </Link>
          <button
            role="menuitem"
            tabIndex={-1}
            type="button"
            disabled={loading}
            onClick={() => void handleSignOut()}
            className="focus-ring flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-sm text-muted enabled:hover:bg-surface-2 enabled:hover:text-text disabled:text-text-3"
          >
            <LogOut className="size-4" aria-hidden="true" />
            {sr.auth.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}
