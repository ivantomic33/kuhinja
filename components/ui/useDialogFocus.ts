"use client";

import { useEffect, useRef, type RefObject } from "react";

const openDialogs: HTMLElement[] = [];
let scrollLocks = 0;
let originalBodyOverflow = "";

const focusable = "a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable=true]";

type DialogFocusOptions = {
  open: boolean;
  onClose: () => void;
  panelRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  returnFocusTo?: HTMLElement;
  lockScroll?: boolean;
};

export function useDialogFocus({
  open, onClose, panelRef, initialFocusRef, returnFocusRef, returnFocusTo, lockScroll = true,
}: DialogFocusOptions) {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;

    const previous = returnFocusTo ?? returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const isTop = () => openDialogs.at(-1) === panel;
    openDialogs.push(panel);

    if (lockScroll) {
      if (scrollLocks === 0) originalBodyOverflow = document.body.style.overflow;
      scrollLocks += 1;
      document.body.style.overflow = "hidden";
    }

    const frame = requestAnimationFrame(() => {
      if (isTop() && !panel.contains(document.activeElement)) {
        (initialFocusRef?.current ?? panel).focus({ preventScroll: true });
      }
    });

    function onKeyDown(event: KeyboardEvent) {
      if (!isTop() || event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
      }
      if (event.key !== "Tab") return;

      const stops = Array.from(panel.querySelectorAll<HTMLElement>(focusable))
        .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") &&
          !element.closest("[inert]") && element.getClientRects().length > 0 &&
          getComputedStyle(element).visibility === "visible");
      const edge = event.shiftKey ? stops.at(-1) : stops[0];
      const active = document.activeElement;
      if (!stops.includes(active as HTMLElement) ||
          active === (event.shiftKey ? stops[0] : stops.at(-1))) {
        event.preventDefault();
        (edge ?? panel).focus();
      }
    }

    function onFocusIn(event: FocusEvent) {
      if (isTop() && event.target instanceof Node && !panel.contains(event.target)) {
        panel.focus({ preventScroll: true });
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      const wasTop = isTop();
      openDialogs.splice(openDialogs.indexOf(panel), 1);
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      if (lockScroll) {
        scrollLocks -= 1;
        if (scrollLocks === 0) document.body.style.overflow = originalBodyOverflow;
      }

      if (wasTop) {
        const next = openDialogs.at(-1);
        if (previous?.isConnected && (!next || next.contains(previous))) {
          previous.focus({ preventScroll: true });
        }
      }
    };
  }, [open, panelRef, initialFocusRef, returnFocusRef, returnFocusTo, lockScroll]);
}
