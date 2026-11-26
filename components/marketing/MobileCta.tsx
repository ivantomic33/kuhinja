"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { primaryCtaClass } from "./landing-links";

export function MobileCta({ label }: { label: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("landing-hero-cta");
    const end = document.getElementById("landing-end");
    function update() {
      setVisible(
        Boolean(
          hero &&
            end &&
            hero.getBoundingClientRect().bottom <= 64 &&
            end.getBoundingClientRect().top > window.innerHeight,
        ),
      );
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
      <Link
        href="/login"
        prefetch={false}
        data-landing-cta="mobile_sticky"
        className={`${primaryCtaClass} w-full`}
      >
        {label}
      </Link>
    </div>
  );
}
