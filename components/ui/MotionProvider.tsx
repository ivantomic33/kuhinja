"use client";

import { MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/usePrefersReducedMotion";

export function MotionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const animation = document.querySelector("main")?.animate?.(
      [{ opacity: 0.9, top: "-4px" }, { opacity: 1, top: "0" }],
      { duration: 180, easing: "ease-out" }
    );
    return () => animation?.cancel();
  }, [pathname, reduced]);

  return <MotionConfig reducedMotion="user" skipAnimations={reduced}>{children}</MotionConfig>;
}
