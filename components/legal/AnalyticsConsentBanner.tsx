"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ANALYTICS_ENABLED,
  canLoadAnalytics,
  readAnalyticsConsent,
  writeAnalyticsConsent,
} from "@/lib/legal/analytics";
import { LEGAL_VERSIONS } from "@/lib/legal/versions";
import { sr } from "@/lib/i18n/sr";
import { PrimaryButton } from "@/components/ui/PrimaryButton";

/**
 * Shown only when analytics is compiled-in (ANALYTICS_ENABLED).
 * Blocks analytics load until the user accepts.
 */
export function AnalyticsConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ANALYTICS_ENABLED) return;
    if (readAnalyticsConsent() != null) return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!canLoadAnalytics()) return;
    // Hook for future analytics bootstrap (must stay behind canLoadAnalytics).
  }, [visible]);

  if (!ANALYTICS_ENABLED || !visible) return null;

  return (
    <div
      role="dialog"
      aria-label={sr.legal.analyticsBannerTitle}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-elevated p-4 shadow-2xl"
    >
      <div className="page-gutter mx-auto flex max-w-app flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {sr.legal.analyticsBannerBody}{" "}
          <Link
            href={LEGAL_VERSIONS.privacy.path}
            className="font-medium text-text underline-offset-2 hover:underline"
          >
            {LEGAL_VERSIONS.privacy.title}
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <PrimaryButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              writeAnalyticsConsent("rejected");
              setVisible(false);
            }}
          >
            {sr.legal.analyticsReject}
          </PrimaryButton>
          <PrimaryButton
            type="button"
            size="sm"
            onClick={() => {
              writeAnalyticsConsent("accepted");
              setVisible(false);
            }}
          >
            {sr.legal.analyticsAccept}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
