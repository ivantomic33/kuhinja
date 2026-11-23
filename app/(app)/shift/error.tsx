"use client";

import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title={sr.shift.title} description={sr.listStates.shift.description} message={sr.listStates.shift.error} reset={reset} />;
}
