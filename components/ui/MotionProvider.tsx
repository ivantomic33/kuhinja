"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

/**
 * Lightweight page-enter hint via the Web Animations API.
 * Framer Motion stays out of the root layout bundle (loaded only by overlays).
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const animation = document.querySelector("main")?.animate?.(
      [{ opacity: 0.9, transform: "translateY(-4px)" }, { opacity: 1, transform: "translateY(0)" }],
      { duration: 180, easing: "ease-out" }
    );
    return () => animation?.cancel();
  }, [pathname, reduced]);

  return children;
}
