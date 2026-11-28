"use client";

import { useReportWebVitals } from "next/dist/client/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    navigator.sendBeacon("/api/vitals", JSON.stringify(metric));
  });

  return null;
}
