"use client";

import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title={sr.scaler.title} description={sr.listStates.scaler.description} message={sr.listStates.scaler.error} reset={reset} />;
}
