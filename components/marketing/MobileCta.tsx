"use client";

import { useEffect, useState } from "react";
import { trackAnalytics, type LandingCtaLocation } from "@/lib/analytics/track";
import { sr } from "@/lib/i18n/sr";
import { primaryCtaClass, trialHref } from "./landing-links";

export function MobileCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function trackCta(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const location = event.target.closest("[data-landing-cta]")?.getAttribute("data-landing-cta");
      if (location) trackAnalytics("landing_cta_click", { location: location as LandingCtaLocation });
    }

    const hero = document.getElementById("landing-hero-cta");
    const end = document.getElementById("landing-end");
    function update() {
      setVisible(Boolean(hero && end &&
        hero.getBoundingClientRect().bottom <= 64 &&
        end.getBoundingClientRect().top > window.innerHeight));
    }
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    document.addEventListener("click", trackCta);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("click", trackCta);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:hidden">
      <a href={trialHref} data-landing-cta="mobile_sticky" className={`${primaryCtaClass} w-full`}>
        {sr.marketing.landing.trialCta}
      </a>
    </div>
  );
}
