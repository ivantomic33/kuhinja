"use client";

import RouteError from "@/components/ui/RouteError";
import { sr } from "@/lib/i18n/sr";

export default function Error({ reset }: { reset: () => void }) {
  return <RouteError title={sr.recipes.title} description={sr.listStates.recipes.description} message={sr.listStates.recipes.error} reset={reset} />;
}
