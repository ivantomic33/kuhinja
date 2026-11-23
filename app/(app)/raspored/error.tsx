"use client";

import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title={sr.listStates.schedule.title} description={sr.listStates.schedule.description} message={sr.listStates.schedule.error} reset={reset} />;
}
